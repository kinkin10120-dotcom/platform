import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getStorage } from "firebase-admin/storage";
import { setGlobalOptions } from "firebase-functions/v2";
import { defineSecret } from "firebase-functions/params";

initializeApp();
export const db = getFirestore();
export const auth = getAuth();
export const messaging = getMessaging();
export const storage = getStorage();

export const REGION = "asia-northeast3";
setGlobalOptions({ region: REGION });

// Resend API 키는 Vercel 환경에만 있으므로, 공유 시크릿으로 보호된
// /api/notify-email 라우트를 통해 실제 이메일 발송을 위임한다.
export const internalNotifySecret = defineSecret("INTERNAL_NOTIFY_SECRET");

// fetch()는 401/500 같은 실패 응답을 던지지 않고 그냥 resolve해버려서, 이 호출을 그냥
// await만 하고 넘어가면 (예전에 실제로 그랬듯) 시크릿이 어긋나거나 Resend가 실패해도
// 아무 로그도 안 남고 이메일만 조용히 안 가는 상태가 된다 — 상태 코드를 확인해서 실패 시
// 최소한 Cloud Functions 로그에는 남긴다.
// 모든 발신 메일이 공유하는 바깥 틀 — 각 메일 함수는 안쪽 콘텐츠(제목/본문 박스/버튼)만
// 만들고, 상단 HANDYWORKS 워드마크와 하단 회사 정보 푸터는 여기서 한 번만 관리한다.
function emailShell(contentHtml: string): string {
  return `
    <div style="padding: 24px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <div style="max-width: 560px; margin: 0 auto;">
        <div style="background: #f5f5f7; border-radius: 20px; padding: 36px;">
          ${contentHtml}
        </div>
        <div style="text-align: center; margin-top: 28px; padding: 0 16px;">
          <img src="https://handyhand.co.kr/logo-handyhand-black.png" alt="HANDYHAND" height="14" style="height: 14px; width: auto; opacity: 0.55;" />
          <p style="margin: 12px 0 0; font-size: 11px; color: #a1a1a6; line-height: 1.7;">
            주식회사 핸디핸드 · 대표 최형준 · 사업자등록번호 128-87-00105<br/>
            경기도 고양시 덕양구 삼원로63 고양아크비즈지식산업센터 F804호 · 070-8835-2311
          </p>
          <p style="margin: 10px 0 0; font-size: 11px; color: #c7c7cc;">© 2026 HANDYHAND. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;
}

export async function sendNotifyEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    const res = await fetch("https://handyhand.co.kr/api/notify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": internalNotifySecret.value() },
      body: JSON.stringify({ to, subject, html: emailShell(html) }),
    });
    if (!res.ok) {
      console.error(`알림 이메일 발송 실패 (to: ${to}, status: ${res.status}): ${await res.text().catch(() => "")}`);
    }
  } catch (e) {
    console.error(`알림 이메일 발송 중 네트워크 오류 (to: ${to}):`, e);
  }
}

// 주간 요약 다이제스트(관리자/고객 공통)에 실제 계산된 수치·목록만 근거로 한 AI 한줄평을
// 붙여준다 — /api/project-insight와 같은 패턴으로, Anthropic 키는 Vercel에만 있어서
// 내부 시크릿으로 보호된 라우트를 거친다. 실패해도 다이제스트 발송 자체는 막지 않는다.
export async function generateWeeklySummaryInsight(
  audience: "admin" | "client",
  overdueCount: number,
  dueSoonCount: number,
  details: string[]
): Promise<string | undefined> {
  try {
    const res = await fetch("https://handyhand.co.kr/api/weekly-summary-insight", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": internalNotifySecret.value() },
      body: JSON.stringify({ audience, overdueCount, dueSoonCount, details }),
    });
    if (!res.ok) {
      console.error(`주간 요약 AI 생성 실패 (status: ${res.status}): ${await res.text().catch(() => "")}`);
      return undefined;
    }
    const data = (await res.json()) as { summary?: string };
    return typeof data.summary === "string" ? data.summary : undefined;
  } catch (e) {
    console.error("주간 요약 AI 생성 중 오류:", e);
    return undefined;
  }
}

// 계약(contracts.ts)과 견적(quotes.ts) 양쪽 모두 알림 상세 내역에 금액을 표기할 때 쓴다.
export function formatMoneySimple(amount: number, currency: string) {
  if (currency === "USD") {
    return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${Math.round(amount).toLocaleString("ko-KR")}원`;
}
