import crypto from "crypto";
import { XMLParser } from "fast-xml-parser";
import { FieldValue } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { db, internalNotifySecret, recordSystemAlert } from "./shared";

// Upwork 등 프리랜서 플랫폼을 매번 직접 들어가서 확인하는 시간을 줄이기 위해, 저장 검색
// (Saved Search)의 RSS 피드를 주기적으로 읽어와 새 공고만 한글 번역까지 붙여 쌓아둔다.
// RSS는 로그인/API 승인 없이 공개된 공식 기능이라 계정 정지 등의 위험이 없다 — 반면
// Fiverr(Buyer Requests)·Clutch는 이런 공개 피드가 아예 없어 이 방식이 적용되지 않는다.

const MAX_ITEMS_PER_FEED = 50;
const MAX_AGE_DAYS = 14;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function translateJob(title: string, description: string): Promise<{ titleKo: string; descriptionKo: string }> {
  try {
    const res = await fetch("https://handyhand.co.kr/api/translate-job", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": internalNotifySecret.value() },
      body: JSON.stringify({ title, description }),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = (await res.json()) as { titleKo?: string; descriptionKo?: string };
    if (!data.titleKo || !data.descriptionKo) throw new Error("빈 번역 결과");
    return { titleKo: data.titleKo, descriptionKo: data.descriptionKo };
  } catch (e) {
    console.error("공고 번역 실패, 원문으로 대체:", e);
    return { titleKo: title, descriptionKo: description };
  }
}

type RssItem = { title?: string; link?: string; guid?: string | { "#text"?: string }; pubDate?: string; description?: string };

export const fetchFreelanceJobs = onSchedule(
  { schedule: "every 30 minutes", timeZone: "Asia/Seoul", secrets: [internalNotifySecret], timeoutSeconds: 300 },
  async () => {
    const configsSnap = await db.collection("freelanceFeedConfigs").where("enabled", "==", true).get();
    if (configsSnap.empty) return;

    const parser = new XMLParser();
    const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

    for (const configDoc of configsSnap.docs) {
      const config = configDoc.data();
      try {
        const res = await fetch(config.url);
        if (!res.ok) throw new Error(`피드 응답 status ${res.status}`);
        const xml = await res.text();
        const parsed = parser.parse(xml);
        const rawItems = parsed?.rss?.channel?.item;
        const items: RssItem[] = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

        for (const item of items.slice(0, MAX_ITEMS_PER_FEED)) {
          const link = item.link;
          if (!link) continue;
          const postedAt = item.pubDate ? Date.parse(item.pubDate) : Date.now();
          if (Number.isFinite(postedAt) && postedAt < cutoff) continue;

          const id = crypto.createHash("sha1").update(link).digest("hex");
          const ref = db.collection("freelanceJobs").doc(id);

          // create()는 문서가 이미 있으면 예외를 던진다 — 이미 처리한 공고를 매번 다시
          // 번역 API 호출까지 해가며 덮어쓰지 않도록, 별도 조회 없이 이 실패로 중복을 거른다.
          try {
            await ref.create({ platform: config.platform, link, createdMarker: true });
          } catch {
            continue;
          }

          try {
            const title = (item.title ?? "").trim();
            const description = stripHtml(item.description ?? "");
            const { titleKo, descriptionKo } = await translateJob(title, description);

            await ref.set({
              platform: config.platform,
              title,
              titleKo,
              description,
              descriptionKo,
              link,
              postedAt: Number.isFinite(postedAt) ? postedAt : Date.now(),
              fetchedAt: FieldValue.serverTimestamp(),
              status: "new",
            });
          } catch (e) {
            // 번역/저장 도중 실패하면 예약만 된 빈 문서가 영구히 남아 다음 실행에서도 계속
            // 건너뛰어지므로(위 create() 중복 방지 로직 때문에), 예약을 지워 다음 실행에
            // 다시 시도되게 한다.
            console.error(`공고 저장 실패, 다음 실행에 재시도: ${link}`, e);
            await ref.delete().catch(() => {});
          }
        }
      } catch (e) {
        console.error(`입찰 공고 피드 수집 실패 (${config.label ?? config.url}):`, e);
        await recordSystemAlert("freelance_feed", `입찰 공고 피드 수집이 실패했습니다: ${config.label ?? config.url}`);
      }
    }
  }
);
