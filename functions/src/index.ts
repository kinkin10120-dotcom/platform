import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, FieldPath, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getStorage } from "firebase-admin/storage";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onDocumentUpdated, onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import { defineSecret } from "firebase-functions/params";
import { createHash } from "crypto";
import { normalizeEmail, contractEmailMatches } from "./emailMatch";

initializeApp();
const db = getFirestore();
const auth = getAuth();
const messaging = getMessaging();
const storage = getStorage();

const REGION = "asia-northeast3";
setGlobalOptions({ region: REGION });

// Resend API 키는 Vercel 환경에만 있으므로, 공유 시크릿으로 보호된
// /api/notify-email 라우트를 통해 실제 이메일 발송을 위임한다.
const internalNotifySecret = defineSecret("INTERNAL_NOTIFY_SECRET");

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

async function sendNotifyEmail(to: string, subject: string, html: string): Promise<void> {
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

type TaskStatus = "pending" | "todo" | "in_progress" | "done";

/* ------------------------------------------------------------------ */
/* 1) 클라이언트 계정 생성 (관리자 전용 callable)                          */
/*    - 클라이언트 SDK로 직접 생성하면 현재 로그인한 관리자가 로그아웃되므로,   */
/*      서버(Admin SDK)에서 대신 계정을 만들어 이메일 없이도 즉시 발급한다.   */
/* ------------------------------------------------------------------ */
export const createClientAccount = onCall({ invoker: "public", secrets: [internalNotifySecret] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const callerSnap = await db.collection("users").doc(request.auth.uid).get();
  if (!callerSnap.exists || callerSnap.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "관리자만 계정을 생성할 수 있습니다.");
  }

  const { email, name, clientId } = request.data as {
    email?: string;
    name?: string;
    clientId?: string;
  };

  if (!email || !name || !clientId) {
    throw new HttpsError("invalid-argument", "email, name, clientId는 필수입니다.");
  }

  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) {
    throw new HttpsError("not-found", "존재하지 않는 클라이언트입니다.");
  }

  let userRecord;
  try {
    // 비밀번호 없이 계정만 먼저 만들고, 실제 비밀번호는 클라이언트 본인이 이메일 링크로 직접
    // 설정하게 한다(관리자가 비밀번호를 알거나 평문으로 전달할 필요가 없어짐).
    userRecord = await auth.createUser({ email, displayName: name });
  } catch (err: any) {
    if (err?.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "이미 사용 중인 이메일입니다.");
    }
    throw new HttpsError("internal", `계정 생성 중 오류가 발생했습니다: ${err?.message ?? err}`);
  }

  await db.collection("users").doc(userRecord.uid).set({
    email,
    name,
    role: "client",
    clientId,
    createdAt: FieldValue.serverTimestamp(),
  });

  await sendAccountEmail(email, name, "created");

  return { uid: userRecord.uid };
});

/* ------------------------------------------------------------------ */
/* 1-1) 비밀번호 설정/재설정 링크 이메일 발송 (관리자 전용 callable)          */
/*    - 계정 생성 시 자동으로 한 번 호출되고, 클라이언트가 비밀번호를 잊었을 때  */
/*      관리자가 계정 관리 화면에서 다시 트리거할 수도 있다.                  */
/* ------------------------------------------------------------------ */
export const sendPasswordResetLink = onCall({ invoker: "public", secrets: [internalNotifySecret] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  }
  const callerSnap = await db.collection("users").doc(request.auth.uid).get();
  if (!callerSnap.exists || callerSnap.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "관리자만 사용할 수 있습니다.");
  }

  const { email, name } = request.data as { email?: string; name?: string };
  if (!email) {
    throw new HttpsError("invalid-argument", "email은 필수입니다.");
  }

  await sendAccountEmail(email, name ?? "", "reset");
  return { ok: true };
});

/* ------------------------------------------------------------------ */
/* 1-2) 클라이언트 계정 삭제 (관리자 전용 callable)                        */
/*    - Firebase Auth 계정과 users/{uid} Firestore 문서를 함께 삭제한다.    */
/* ------------------------------------------------------------------ */
export const deleteClientAccount = onCall({ invoker: "public" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  const callerSnap = await db.collection("users").doc(request.auth.uid).get();
  if (!callerSnap.exists || callerSnap.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "관리자만 사용할 수 있습니다.");
  }
  const { uid, email } = request.data as { uid?: string; email?: string };
  if (!uid && !email) throw new HttpsError("invalid-argument", "uid 또는 email이 필요합니다.");

  const targetUid = uid ?? (await auth.getUserByEmail(email!)).uid;
  await auth.deleteUser(targetUid);
  await db.collection("users").doc(targetUid).delete().catch(() => {});
  return { ok: true, uid: targetUid };
});

async function sendAccountEmail(email: string, name: string, kind: "created" | "reset") {
  const resetLink = await auth.generatePasswordResetLink(email, {
    url: "https://handyhand.co.kr/login",
  });
  const greeting = kind === "created"
    ? `${name}님, 안녕하세요.<br/>제품개발·제조 진행 상황을 실시간으로 확인할 수 있는 HANDYWORKS 계정이 발급되었습니다.`
    : `${name ? name + "님, " : ""}비밀번호 재설정을 요청하셨습니다.`;
  const title = kind === "created" ? "HANDYWORKS 계정이 생성되었습니다" : "비밀번호 재설정 안내";
  const cta = kind === "created" ? "비밀번호 설정하고 시작하기" : "비밀번호 재설정하기";

  const html = `
    <h2 style="color: #1d1d1f; margin: 0 0 16px; font-size: 19px;">${title}</h2>
    <p style="color: #1d1d1f; font-size: 14px; line-height: 1.6;">${greeting}</p>
    <p style="color: #86868b; font-size: 13px; margin: 16px 0;">아래 버튼을 눌러 비밀번호를 설정한 뒤 로그인해주세요. 로그인 이메일은 <b style="color:#1d1d1f">${email}</b> 입니다.</p>
    <p style="color: #86868b; font-size: 13px; margin: 0 0 16px;">이 링크는 <b style="color:#1d1d1f">1시간 동안만</b> 유효합니다. 시간이 지나면 다시 요청해주세요.</p>
    <a href="${resetLink}" style="display: inline-block; background: #1d1d1f; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 999px; font-size: 14px; font-weight: 600;">${cta}</a>
    ${kind === "created" ? `
    <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e5e5e5;">
      <p style="color: #1d1d1f; font-size: 14px; font-weight: 600; margin: 0 0 10px;">간단 사용법</p>
      <ul style="color: #1d1d1f; font-size: 13px; line-height: 1.9; margin: 0; padding-left: 18px;">
        <li>홈 화면에서 프로젝트 진행률과 업무 일정을 한눈에 확인할 수 있어요.</li>
        <li>업무를 클릭하면 상세 내용, 첨부 파일, 코멘트를 볼 수 있어요.</li>
        <li>확인/승인이 필요한 업무는 화면 상단에 강조되어 표시돼요.</li>
        <li>궁금한 점은 사이드바의 "문의하기" 메뉴로 언제든 남겨주세요.</li>
      </ul>
    </div>` : ""}
    <p style="margin-top: 24px; font-size: 12px; color: #86868b;">이 이메일에 대한 요청을 하지 않으셨다면 무시하셔도 됩니다.</p>
  `;

  await sendNotifyEmail(email, `[HANDYWORKS] ${title}`, html);
}

/* ------------------------------------------------------------------ */
/* 1-2-1) 계약 발송 (관리자 전용 callable)                                 */
/*    - 상대방(갑) 서명 시 IP/기기 정보/서버 타임스탬프를 남기는 것과 대칭으로,  */
/*      을(관리자) 쪽 발송 행위도 "누가·언제·어디서" 보냈는지 같은 수준으로     */
/*      남긴다. 클라이언트에서 직접 Firestore를 쓰면 IP를 신뢰할 수 없어(요청  */
/*      쪽에서 조작 가능) Cloud Function을 거쳐 서버가 직접 관측한 IP/UA만     */
/*      기록한다.                                                        */
/* ------------------------------------------------------------------ */
export const sendContract = onCall({ invoker: "public" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  }
  const callerSnap = await db.collection("users").doc(request.auth.uid).get();
  const caller = callerSnap.data();
  if (!callerSnap.exists || caller?.role !== "admin") {
    throw new HttpsError("permission-denied", "관리자만 발송할 수 있습니다.");
  }

  const { contractId } = request.data as { contractId?: string };
  if (!contractId) {
    throw new HttpsError("invalid-argument", "contractId는 필수입니다.");
  }
  const snap = await db.collection("contracts").doc(contractId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "존재하지 않는 계약입니다.");
  }
  const data = snap.data()!;

  const ip = request.rawRequest?.ip ?? request.rawRequest?.headers?.["x-forwarded-for"] ?? "";
  const userAgent = request.rawRequest?.headers?.["user-agent"] ?? "";
  // 발송자는 "이 로그인 계정이 누구였는지"가 아니라 "을(계약 당사자)이 누구인지"를 남기는
  // 것이므로, 직인 옆 서명("최형준 · 대표")과 마찬가지로 항상 같은 값으로 고정한다 — 여러
  // 관리자 계정이 있어도 발송자 표기는 흔들리지 않는다.
  const sentBy = "주식회사 핸디핸드 최형준 대표";

  // data는 이번 발송 이전 상태라 sentBy/sentAt이 아직(또는 이전 발송 값 그대로) 남아있다 —
  // {{eulSignature}} 토큰이 이번 발송 기준으로 정확히 치환되도록 방금 확정된 값을 합쳐 넣는다.
  const enrichedData = { ...data, sentBy, sentAt: new Date() };

  const resolvedBodyText = resolveContractTokens(data.bodyText ?? "", enrichedData);
  const resolvedAttachments = ((data.attachments ?? []) as any[]).map((a) => ({
    id: a.id,
    title: a.title,
    bodyHtml: resolveContractTokens(a.bodyHtml ?? "", enrichedData),
  }));
  // 서명 시점 해시(contentHash)와 같은 방식으로, "우리가 실제로 무엇을 보냈는지"도 남겨서
  // 나중에 발송본과 서명본이 정말 같은 내용이었는지 대조 검증할 수 있게 한다.
  const sentContentHash = createHash("sha256")
    .update(resolvedBodyText + resolvedAttachments.map((a) => a.bodyHtml).join(""))
    .digest("hex");
  const revision = {
    version: data.version ?? 1,
    bodyText: resolvedBodyText,
    ...(resolvedAttachments.length > 0 ? { attachments: resolvedAttachments } : {}),
    ...(data.status === "revision_requested" && data.revisionNote ? { note: data.revisionNote } : {}),
    updatedAt: Timestamp.now(),
  };

  await snap.ref.update({
    history: [...(data.history ?? []), revision],
    version: (data.version ?? 1) + 1,
    status: "sent",
    revisionNote: "",
    revisionRequestedBodyText: "",
    sentBy,
    sentAt: FieldValue.serverTimestamp(),
    sentIp: String(ip),
    sentUserAgent: String(userAgent),
    sentContentHash,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { ok: true };
});

/* ------------------------------------------------------------------ */
/* 1-3) 계약 전자서명 (로그인 없는 상대방도 호출하는 public callable)         */
/*    - contracts 컬렉션은 Firestore 규칙상 관리자만 접근 가능하므로,        */
/*      상대방(비로그인)은 아래 세 함수를 통해서만 Admin SDK로 우회 접근한다.  */
/*    - 본인확인은 contactEmail 일치 여부로만 하며(공인인증 없음), 서명 시점  */
/*      원문 스냅샷(signedBodyText) + SHA-256 해시 + 서버 타임스탬프 + IP/    */
/*      기기 정보를 함께 기록해 전자문서법상 증빙력을 보강한다.               */
/* ------------------------------------------------------------------ */
async function assertContractEmailMatch(contractId: string, email?: string) {
  if (!contractId || !email) {
    throw new HttpsError("invalid-argument", "contractId, email은 필수입니다.");
  }
  const snap = await db.collection("contracts").doc(contractId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "존재하지 않는 계약입니다.");
  }
  const data = snap.data()!;
  if (!contractEmailMatches(data.contactEmail, email)) {
    throw new HttpsError("permission-denied", "이메일이 일치하지 않습니다.");
  }
  return { snap, data };
}

function formatMoneySimple(amount: number, currency: string) {
  if (currency === "USD") {
    return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${Math.round(amount).toLocaleString("ko-KR")}원`;
}

// 프론트엔드 src/lib/contractTemplate.ts의 resolveContractTokens와 동일한 로직 — 별도 프로젝트라
// 모듈을 공유할 수 없어 여기서도 동일하게 유지한다. 서명 페이지에 보여주는 내용과 서명 완료 시
// 영구 저장되는 signedBodyText 모두 이 함수를 거쳐 토큰이 실제 값으로 치환된 최종본이어야 한다.
// f.signedAt/f.sentAt는 호출 시점에 따라 Firestore Timestamp(읽어온 원본 문서)이거나, 방금
// 계산한 Timestamp.now()/JS Date(이번 요청에서 직접 만든 값)일 수 있어 둘 다 처리한다.
function formatKoreanDateTime(v: unknown): string {
  if (!v) return "";
  if (v instanceof Timestamp) return v.toDate().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  if (v instanceof Date) return v.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  if (typeof v === "number") return new Date(v).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  return "";
}

// src/lib/tiptapSignatureBlock.ts의 buildSignatureBlockHtml과 동일한 마크업을 만든다(별도
// 프로젝트라 모듈을 공유할 수 없어 손으로 맞춰 유지) — "크게 편집"(Tiptap 에디터)의
// signatureBlock 노드가 이 div[data-signature-block] 구조를 그대로 알아보고 파싱하므로,
// 여기서 생성한 문자열이 에디터에 로드돼도 레이아웃이 깨지지 않는다.
function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// src/lib/tiptapSignatureBlock.ts의 HANDYHAND_SEAL_URL과 동일한 이미지(직인, Storage에
// 업로드해둔 고정 자산).
const HANDYHAND_SEAL_URL =
  "https://firebasestorage.googleapis.com/v0/b/handyhand-a175a.firebasestorage.app/o/assets%2Fhandyhand-seal.png?alt=media";

function buildEulSignatureHtml(f: FirebaseFirestore.DocumentData): string {
  const sentAtLabel = formatKoreanDateTime(f.sentAt);
  // 발송 전(초안·수정 단계)에는 갑과 똑같은 빈 영역으로 보여주다가, 실제로 "발송" 버튼을
  // 눌러 고객에게 서명 요청을 보내는 시점(sentAt이 채워짐)에만 진짜 직인 이미지로 바뀐다.
  // src/lib/tiptapSignatureBlock.ts와 정확히 같은 속성 집합(contenteditable="false" 포함)과
  // 태그 형식(img를 self-close하지 않음)을 써야 한다 — 이 문자열이 나중에 "크게 편집"
  // 에디터(editor.getHTML())가 뱉는 형식과 한 글자라도 다르면, 편집 중 매 타이핑마다 내용이
  // 통째로 다시 그려지면서 한글 입력기 조합이 깨지는 문제로 이어진다.
  if (!sentAtLabel) {
    return `<div data-signature-block="" data-variant="eul" class="signature-block" contenteditable="false"><div class="signature-placeholder-box">직인</div><p class="signature-line signature-line-empty">서명: (발송 대기 중)</p></div>`;
  }
  // 갑 쪽 서명란("서명: 이름 · 직책 · 일시")과 같은 포맷으로 맞춘다 — 발송자는 이미 "발송
  // 정보 (을)" 패널에 따로 나와 있어서 여기 또 넣으면 형식만 갑과 달라지고 중복이었다.
  const attrs = [
    'data-signature-block=""',
    'data-variant="eul"',
    f.sentBy ? `data-sent-by="${escapeHtmlAttr(String(f.sentBy))}"` : "",
    `data-sent-at-label="${escapeHtmlAttr(sentAtLabel)}"`,
    'class="signature-block"',
    'contenteditable="false"',
  ].filter(Boolean).join(" ");
  return `<div ${attrs}><img src="${HANDYHAND_SEAL_URL}" alt="직인" class="signature-seal-image"><p class="signature-line">서명: 최형준 · 대표 · ${sentAtLabel}</p></div>`;
}

// 갑(상대방) 서명 — 서명 전에는 빈 서명란만 보이다가, 전자서명이 완료되면 실제 서명 이미지와
// 서명자·일시로 바뀐다.
function buildGapSignatureHtml(f: FirebaseFirestore.DocumentData): string {
  const signedAtLabel = formatKoreanDateTime(f.signedAt);
  if (f.signatureUrl) {
    const who = `${f.signerName || ""}${f.signerTitle ? ` · ${f.signerTitle}` : ""}`;
    const attrs = [
      'data-signature-block=""',
      'data-variant="gap"',
      `data-signer-name="${escapeHtmlAttr(String(f.signerName || ""))}"`,
      f.signerTitle ? `data-signer-title="${escapeHtmlAttr(String(f.signerTitle))}"` : "",
      `data-signature-url="${escapeHtmlAttr(String(f.signatureUrl))}"`,
      signedAtLabel ? `data-signed-at-label="${escapeHtmlAttr(signedAtLabel)}"` : "",
      'class="signature-block"',
      'contenteditable="false"',
    ].filter(Boolean).join(" ");
    return `<div ${attrs}><img src="${escapeHtmlAttr(String(f.signatureUrl))}" alt="서명" class="signature-image"><p class="signature-line">서명: ${who} · ${signedAtLabel}</p></div>`;
  }
  return `<div data-signature-block="" data-variant="gap" class="signature-block" contenteditable="false"><div class="signature-placeholder-box">서명</div><p class="signature-line signature-line-empty">서명: (전자서명 대기 중)</p></div>`;
}

// src/lib/contractTemplate.ts의 replaceTopLevelParens와 동일 — 정규식 하나로는 괄호 중첩
// 깊이를 1단계까지만 처리할 수 있어서, 가장 바깥쪽 괄호 쌍을 문자 단위로 직접 찾는다.
function replaceTopLevelParens(text: string, replacer: (match: string, label: string) => string): string {
  let result = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] !== "(") {
      result += text[i];
      i += 1;
      continue;
    }
    let depth = 1;
    let j = i + 1;
    while (j < text.length && depth > 0) {
      if (text[j] === "(") depth += 1;
      else if (text[j] === ")") depth -= 1;
      j += 1;
    }
    if (depth !== 0) {
      result += text.slice(i);
      break;
    }
    const match = text.slice(i, j);
    const label = text.slice(i + 1, j - 1);
    result += replacer(match, label);
    i = j;
  }
  return result;
}

function resolveContractTokens(bodyText: string, f: FirebaseFirestore.DocumentData): string {
  const blank = "[미입력]";
  const tokens: Record<string, string> = {
    companyName: f.companyName || blank,
    productName: f.productName || blank,
    bizRegNumber: f.bizRegNumber || blank,
    bizCeoName: f.bizCeoName || blank,
    bizAddress: f.bizAddress || blank,
    contactName: f.contactName || blank,
    contactPhone: f.contactPhone || blank,
    amount: f.amount ? `${formatMoneySimple(f.amount, f.currency ?? "KRW")}${f.vatApplicable ? " (VAT별도)" : ""}` : blank,
    periodStart: f.periodStart || blank,
    periodEnd: f.periodEnd || blank,
    paymentTerms: f.paymentTerms || blank,
    gapSignature: buildGapSignatureHtml(f),
    eulSignature: buildEulSignatureHtml(f),
  };
  const resolved = bodyText.replace(/\{\{(\w+)\}\}/g, (match: string, key: string) => (key in tokens ? tokens[key] : match));
  // src/lib/contractTemplate.ts의 BRACKET_LABEL_TOKENS/normalizeBracketLabel과 동일 —
  // "(제품/서비스명)"이나 "(상호명 (갑))" 같은 자연어 괄호 표기로 본문을 쓴 경우도 채워준다.
  const withBrackets = replaceTopLevelParens(resolved, (match: string, label: string) => {
    const key = BRACKET_LABEL_TOKENS[normalizeBracketLabel(label)];
    return key ? tokens[key] : match;
  });
  // 관리자가 기본 템플릿을 안 쓰고 본문을 처음부터 직접 써서 {{gapSignature}}/{{eulSignature}}
  // 토큰 자체가 없는 계약서도 있다 — 그런 경우에도 서명란이 반드시 나오도록, 없으면 자동으로
  // 채워준다. 이미 signatureBlock 노드가 본문에 박혀있다면(관리자가 에디터에서 한 번 손을 대는
  // 순간 로드 시점의 토큰 치환 결과가 그대로 굳어버림) 단순히 있는지만 보고 넘어가지 않고 항상
  // 최신 값으로 통째로 교체한다 — 그래야 실제 서명 시점에 방금 그린 서명 이미지가(서명 전
  // 상태로 굳어있던) 옛 블록을 덮어쓰고 반영된다.
  let final = withBrackets;
  if (f.handyhandIsGap) {
    final = placeSignatureBlock(final, "eul", "갑", tokens.eulSignature);
    final = placeSignatureBlock(final, "gap", "을", tokens.gapSignature);
  } else {
    final = placeSignatureBlock(final, "gap", "갑", tokens.gapSignature);
    final = placeSignatureBlock(final, "eul", "을", tokens.eulSignature);
  }
  return final;
}

// src/lib/contractTemplate.ts의 placeSignatureBlock과 동일 — 서명란을 "갑"/"을" 각자의
// 대표자 줄 바로 아래에 붙인다. 이미 자리 잡은 signatureBlock 노드가 있으면 위치는 그대로
// 두고 내용만 최신화하고, 없으면 같은 party 표시("갑"/"을") 다음에 나오는 첫 "대표자" 줄
// 바로 뒤에 새로 끼워 넣는다 — 그 자리를 못 찾으면 문서 끝에 붙이는 것으로 안전하게 대체한다.
function placeSignatureBlock(html: string, variant: "gap" | "eul", partyLabel: "갑" | "을", blockHtml: string): string {
  const existingRange = findSignatureBlockRange(html, variant);
  if (existingRange) {
    return html.slice(0, existingRange.start) + blockHtml + html.slice(existingRange.end);
  }

  const headingRe = new RegExp(`<p>\\s*(?:<strong>)?\\s*${partyLabel}\\s*(?:</strong>)?\\s*</p>`);
  const headingMatch = headingRe.exec(html);
  if (headingMatch) {
    const afterHeading = headingMatch.index + headingMatch[0].length;
    const repRe = /<p>[^<]*대표자[^<]*<\/p>/;
    const repMatch = repRe.exec(html.slice(afterHeading));
    if (repMatch) {
      const insertPos = afterHeading + repMatch.index + repMatch[0].length;
      return html.slice(0, insertPos) + blockHtml + html.slice(insertPos);
    }
  }
  return html + blockHtml;
}

// src/lib/contractTemplate.ts의 findSignatureBlockRange와 동일 — 서명 블록 div 안에는(점선
// 자리표시 박스용) 중첩된 <div>가 하나 더 있어서, "가장 처음 나오는 </div>까지"로 찾는
// 정규식은 안쪽 div에서 멈춰버려 바깥쪽 블록의 나머지 절반이 안 지워지고 문서에 남는다 —
// 그 상태로 서명란을 다시 계산할 때마다 매번 새 블록을 하나씩 더 끼워 넣어(예전 잔해가
// 계속 쌓여) 저장 후 다시 열 때마다 줄이 하나씩 늘어나는 문제로 이어졌다. 여는/닫는 div
// 개수를 실제로 세어 중첩까지 정확히 짝을 맞춰 블록의 진짜 끝을 찾는다.
function findSignatureBlockRange(html: string, variant: "gap" | "eul"): { start: number; end: number } | null {
  const openTagRe = new RegExp(`<div[^>]*data-variant="${variant}"[^>]*>`);
  const openMatch = openTagRe.exec(html);
  if (!openMatch) return null;
  const start = openMatch.index;

  const tagRe = /<div\b[^>]*>|<\/div>/g;
  tagRe.lastIndex = start + openMatch[0].length;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html))) {
    if (m[0] === "</div>") {
      depth -= 1;
      if (depth === 0) return { start, end: m.index + m[0].length };
    } else {
      depth += 1;
    }
  }
  return null;
}

function normalizeBracketLabel(raw: string): string {
  // src/lib/contractTemplate.ts의 normalizeBracketLabel과 동일 — 괄호 안 라벨에 서식
  // (<span style="...">)이 입혀져 있으면 그 태그까지 라벨의 일부로 취급돼 화이트리스트와
  // 매칭이 안 됐다. 태그를 먼저 걷어내고 순수 텍스트만 남긴 뒤 비교한다.
  const withoutTags = raw.replace(/<[^>]*>/g, "");
  return withoutTags.replace(/\s*\([^()]*\)\s*$/, "").replace(/\s+/g, "");
}

// 키는 normalizeBracketLabel을 거친 뒤(공백 제거)와 비교되므로 공백 없이 적는다.
const BRACKET_LABEL_TOKENS: Record<string, string> = {
  "제품/서비스명": "productName",
  "제품서비스명": "productName",
  "서비스명": "productName",
  "제품명": "productName",
  "상호명": "companyName",
  "회사명": "companyName",
  "사업자등록번호": "bizRegNumber",
  "사업자번호": "bizRegNumber",
  "대표자": "bizCeoName",
  "사업장주소": "bizAddress",
  "담당자명": "contactName",
  "담당자연락처": "contactPhone",
  "용역기간시작": "periodStart",
  "용역기간종료": "periodEnd",
  "계약금액": "amount",
  "대금지급방식": "paymentTerms",
};

// 계정이 이미 있는 클라이언트가 로그인 후 자기 회사에 연결된(linkedClientId) 계약 목록을
// 보는 용도 — contracts 컬렉션은 firestore.rules상 완전히 관리자 전용이라 클라이언트는
// 직접 조회할 수 없으므로, 서명 화면과 마찬가지로 Admin SDK를 거치는 Cloud Function으로 우회한다.
export const getMyContracts = onCall({ invoker: "public" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  }
  const callerSnap = await db.collection("users").doc(request.auth.uid).get();
  const clientId = callerSnap.data()?.clientId as string | undefined;
  if (!clientId) return { items: [] };

  const snap = await db.collection("contracts").where("linkedClientId", "==", clientId).get();
  const items = snap.docs
    // 아직 발송 전(초안)인 계약은 관리자가 작성 중인 내부 상태라 고객에게 보이면 안 된다.
    .filter((d) => d.data().status !== "draft")
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title as string,
        companyName: data.companyName as string,
        productName: data.productName as string | undefined,
        status: data.status as string,
        amount: (data.amount as number) ?? 0,
        currency: (data.currency as string) ?? "KRW",
        createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
        signedAt: data.signedAt?.toMillis ? data.signedAt.toMillis() : (data.signedAt as number | undefined),
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  return { items };
});

export const getContractForSigning = onCall({ invoker: "public" }, async (request) => {
  const { contractId, email } = request.data as { contractId?: string; email?: string };
  const { data } = await assertContractEmailMatch(contractId ?? "", email);

  const isFinal = data.status === "signed" || data.status === "linked";
  const rawAttachments = (isFinal ? data.signedAttachments : data.attachments) ?? [];

  return {
    status: data.status,
    title: data.title,
    companyName: data.companyName,
    productName: data.productName ?? undefined,
    contactName: data.contactName,
    amount: data.amount ?? 0,
    currency: data.currency ?? "KRW",
    vatApplicable: !!data.vatApplicable,
    periodStart: data.periodStart ?? undefined,
    periodEnd: data.periodEnd ?? undefined,
    paymentTerms: data.paymentTerms ?? undefined,
    handyhandIsGap: !!data.handyhandIsGap,
    bodyText: resolveContractTokens(isFinal ? data.signedBodyText ?? data.bodyText : data.bodyText, data),
    attachments: rawAttachments.map((a: any) => ({
      id: a.id,
      title: a.title,
      bodyHtml: isFinal ? a.bodyHtml : resolveContractTokens(a.bodyHtml, data),
    })),
    version: data.version ?? 1,
    signedAt: data.signedAt?.toMillis ? data.signedAt.toMillis() : data.signedAt,
    bizRegCertUploaded: !!data.bizRegCertUrl,
    // 서명 완료본에만 존재하는 해시 — 미리보기 각 페이지 하단에 찍어서, 낱장이 다른 버전과
    // 바꿔치기되면 그 페이지의 해시가 나머지 페이지와 달라 바로 드러나게 한다.
    contentHash: isFinal ? data.contentHash ?? undefined : undefined,
    // 서명 완료 후엔 본인 서명 증빙(누가·언제·어디서 서명했는지)을 본인에게도 그대로 보여준다 —
    // 발송자(관리자) 쪽 정보는 여기 포함하지 않는다.
    signerName: isFinal ? data.signerName ?? undefined : undefined,
    signerTitle: isFinal ? data.signerTitle ?? undefined : undefined,
    signerIp: isFinal ? data.signerIp ?? undefined : undefined,
    signerUserAgent: isFinal ? data.signerUserAgent ?? undefined : undefined,
  };
});

export const submitContractSignature = onCall({ invoker: "public", secrets: [internalNotifySecret] }, async (request) => {
  const {
    contractId,
    email,
    signerName,
    signerTitle,
    authorityConfirmed,
    signatureDataUrl,
    consentAcknowledged,
    bizRegCertDataUrl,
  } = request.data as {
    contractId?: string;
    email?: string;
    signerName?: string;
    signerTitle?: string;
    authorityConfirmed?: boolean;
    signatureDataUrl?: string;
    consentAcknowledged?: boolean;
    bizRegCertDataUrl?: string;
  };
  const { snap, data } = await assertContractEmailMatch(contractId ?? "", email);

  if (data.status !== "sent") {
    throw new HttpsError("failed-precondition", "지금은 서명할 수 없는 상태입니다.");
  }
  if (!signerName?.trim() || !signatureDataUrl || !consentAcknowledged || !authorityConfirmed) {
    throw new HttpsError("invalid-argument", "서명자 이름, 서명 이미지, 동의 확인, 권한 확인은 필수입니다.");
  }

  const base64 = signatureDataUrl.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  const filePath = `contracts/${snap.id}/signature.png`;
  const bucket = storage.bucket();
  await bucket.file(filePath).save(buffer, { contentType: "image/png" });
  const signatureUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media`;

  let bizRegCertUrl: string | undefined;
  if (bizRegCertDataUrl) {
    const match = /^data:([\w/+.-]+);base64,(.*)$/.exec(bizRegCertDataUrl);
    if (match) {
      const contentType = match[1];
      const ext = contentType === "application/pdf" ? "pdf" : contentType.split("/")[1] ?? "bin";
      const certBuffer = Buffer.from(match[2], "base64");
      const certPath = `contracts/${snap.id}/bizRegCert.${ext}`;
      await bucket.file(certPath).save(certBuffer, { contentType });
      bizRegCertUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(certPath)}?alt=media`;
    }
  }

  // 서명 시점에 실제 상대방이 본 화면(토큰이 실제 값으로 치환된 최종본)을 본문+별첨 모두 그대로
  // 영구 보관한다 — 원본 템플릿(토큰)이 아니라 이 치환된 텍스트가 법적 증빙 원문이므로, 해시도
  // 본문+별첨을 합친 전체 기준으로 계산해야 증빙이 문서 전체를 커버한다.
  // data는 이번 서명 이전 상태를 읽어온 것이라 signerName/signatureUrl/signedAt이 아직 없다 —
  // {{gapSignature}} 토큰이 방금 그린 서명으로 정확히 치환되도록, 이번에 확정된 값을 합쳐 넣는다.
  const enrichedData = {
    ...data,
    signerName: signerName.trim(),
    signerTitle: signerTitle?.trim() || undefined,
    signatureUrl,
    signedAt: new Date(),
  };
  const resolvedBodyText = resolveContractTokens(data.bodyText ?? "", enrichedData);
  const resolvedAttachments = ((data.attachments ?? []) as any[]).map((a) => ({
    id: a.id,
    title: a.title,
    bodyHtml: resolveContractTokens(a.bodyHtml ?? "", enrichedData),
  }));
  const contentHash = createHash("sha256")
    .update(resolvedBodyText + resolvedAttachments.map((a) => a.bodyHtml).join(""))
    .digest("hex");
  const ip = request.rawRequest?.ip ?? request.rawRequest?.headers?.["x-forwarded-for"] ?? "";
  const userAgent = request.rawRequest?.headers?.["user-agent"] ?? "";

  await snap.ref.update({
    status: "signed",
    signedAt: FieldValue.serverTimestamp(),
    signerName: signerName.trim(),
    ...(signerTitle?.trim() ? { signerTitle: signerTitle.trim() } : {}),
    authorityConfirmed: true,
    consentAcknowledged: true,
    signerEmail: normalizeEmail(email!),
    signatureUrl,
    ...(bizRegCertUrl ? { bizRegCertUrl } : {}),
    signedBodyText: resolvedBodyText,
    signedAttachments: resolvedAttachments,
    signedVersion: data.version ?? 1,
    contentHash,
    signerIp: String(ip),
    signerUserAgent: String(userAgent),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const adminsSnap = await db.collection("users").where("role", "==", "admin").get();
  await Promise.all(
    adminsSnap.docs.map((a) =>
      db.collection("notifications").add({
        userId: a.id,
        type: "contract_signed",
        contractId: snap.id,
        message: `${data.companyName}(${data.contactName})님이 계약서(${data.title})에 서명을 완료했습니다.`,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      })
    )
  );

  // 서명자 본인 메일함에도 동일한 서명 확인 기록을 남긴다 — 저희가 통제하지 않는 제3의
  // 서버(수신자 메일함)에 독립된 사본이 남아, 서명 시점·내용 증빙력을 보강하는 효과가 있다.
  try {
    await sendContractSignedConfirmation(normalizeEmail(email!), {
      contractId: snap.id,
      companyName: data.companyName,
      title: data.title,
      signerName: signerName.trim(),
      contentHash,
    });
  } catch (e) {
    console.error("계약 서명 확인 메일 발송 실패:", e);
  }

  return { ok: true };
});

async function sendContractSignedConfirmation(
  email: string,
  info: { contractId: string; companyName: string; title: string; signerName: string; contentHash: string }
) {
  const signedAtStr = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  // 서명 완료본은 PDF를 직접 첨부하는 대신(서버에 PDF 생성 기능이 없음), 서명 페이지 링크를
  // 안내한다 — 그 페이지가 이미 서명 완료 상태에서 "계약서 본문" 미리보기·인쇄/PDF 저장 버튼을
  // 그대로 제공하므로, 클릭 한 번으로 동일한 결과(각 페이지에 해시가 찍힌 서명본 PDF)를 얻는다.
  const viewLink = `https://handyhand.co.kr/contracts/sign/${info.contractId}`;
  const html = `
    <h2 style="color: #1d1d1f; margin: 0 0 16px; font-size: 19px;">전자서명이 완료되었습니다</h2>
    <div style="background: #ffffff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 16px; font-size: 14px;">
      <p style="margin: 0 0 6px; color: #1d1d1f;">계약명: ${info.title}</p>
      <p style="margin: 0 0 6px; color: #1d1d1f;">계약 당사자: ${info.companyName}</p>
      <p style="margin: 0 0 6px; color: #1d1d1f;">서명자: ${info.signerName}</p>
      <p style="margin: 0 0 6px; color: #1d1d1f;">서명 일시: ${signedAtStr}</p>
      <p style="margin: 0; color: #86868b; word-break: break-all;">본문 해시(SHA-256): ${info.contentHash}</p>
    </div>
    <p style="margin-top: 20px; font-size: 13px; color: #86868b; line-height: 1.6;">
      아래 버튼을 눌러 서명 완료된 계약서 원문을 확인하고, 필요하면 인쇄하거나 PDF로 저장하실 수 있습니다.
    </p>
    <a href="${viewLink}" style="display: inline-block; margin-top: 8px; background: #1d1d1f; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 999px; font-size: 14px; font-weight: 600;">계약서 원문 보기 / PDF 저장</a>
    <p style="margin-top: 24px; font-size: 13px; color: #86868b; line-height: 1.6;">
      본 메일은 위 내용으로 전자서명이 완료되었음을 확인하는 기록용 메일입니다. 계약 본문은 서명 시점 그대로 보관되며,
      위 해시값으로 이후 위변조 여부를 검증할 수 있습니다. 이 메일을 보관해두시면 추후 서명 시점·내용의 독립적인
      증빙 자료로 활용하실 수 있습니다.
    </p>
  `;

  await sendNotifyEmail(email, "[HANDYWORKS] 전자서명 완료 확인", html);
}

// 계약 상대방에게 서명 페이지 링크를 안내하는 메일 — "발송" 시점(onContractSent 트리거)과
// 관리자가 누르는 "재발송" 버튼(resendContractInvite) 양쪽에서 공통으로 쓴다.
async function sendContractInviteEmail(
  email: string,
  info: { contractId: string; title: string; companyName: string; contactName: string; version?: number }
) {
  const signLink = `https://handyhand.co.kr/contracts/sign/${info.contractId}`;
  // sendContract()는 발송할 때마다 version을 1씩 올린다 — 최초 발송 후엔 2, 첫 수정요청을
  // 반영해 다시 보내면 3, 그다음은 4... 이므로 (version - 2)가 "몇 차 수정"인지를 그대로
  // 나타낸다. 0 이하(최초 발송)면 수정 표시를 안 붙인다.
  const revisionNo = (info.version ?? 0) - 2;
  const arrivedLabel = revisionNo > 0 ? `${revisionNo}차 수정 계약서가 도착했습니다` : "계약서가 도착했습니다";
  // 제목(info.title)에 이미 "계약서"가 들어있는 경우가 많아("제품개발 용역 계약서" 등),
  // 그대로 이어붙이면 "...계약서 계약서가 도착했습니다"처럼 중복돼 보였다.
  const subjectPrefix = info.title.endsWith("계약서") ? info.title : `${info.title} 계약서`;
  const html = `
    <h2 style="color: #1d1d1f; margin: 0 0 16px; font-size: 19px;">${arrivedLabel}</h2>
    <div style="background: #ffffff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 16px; font-size: 14px;">
      <p style="margin: 0 0 6px; color: #1d1d1f;">계약명: ${info.title}</p>
      <p style="margin: 0; color: #1d1d1f;">${info.companyName} · ${info.contactName}님</p>
    </div>
    <p style="margin-top: 20px; font-size: 13px; color: #86868b; line-height: 1.6;">
      아래 버튼을 눌러 계약서 내용을 확인해주세요. 그 자리에서 바로 전자서명을 진행하시거나, 수정이 필요한 부분이
      있다면 수정을 요청하실 수 있습니다.
    </p>
    <a href="${signLink}" style="display: inline-block; margin-top: 8px; background: #1d1d1f; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 999px; font-size: 14px; font-weight: 600;">계약서 확인하고 서명하기</a>
  `;

  const subject = revisionNo > 0
    ? `[HANDYWORKS] ${subjectPrefix} ${revisionNo}차 수정본이 도착했습니다`
    : `[HANDYWORKS] ${subjectPrefix}가 도착했습니다`;
  await sendNotifyEmail(email, subject, html);
}

// contracts 문서의 status가 "sent"로 바뀌는 순간(최초 발송 + 수정요청 반영 후 재발송 모두
// 포함)을 감지해 상대방에게 서명 링크 메일을 보낸다. sendContract()는 순수 클라이언트
// Firestore 쓰기라 이 트리거가 없으면 발송해도 상대방에게 아무 메일도 가지 않는다.
export const onContractSent = onDocumentUpdated(
  { document: "contracts/{contractId}", secrets: [internalNotifySecret] },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (after.status !== "sent" || before.status === "sent") return;
    if (!after.contactEmail) return;

    try {
      await sendContractInviteEmail(after.contactEmail, {
        contractId: event.params.contractId,
        title: after.title,
        companyName: after.companyName,
        contactName: after.contactName,
        version: after.version,
      });
    } catch (e) {
      console.error("계약서 발송 메일 전송 실패:", e);
    }
  }
);

// 상대방이 "메일을 못 받았다"고 할 때 관리자가 상태 변경 없이 같은 메일을 다시 보낼 수 있게
// 하는 수동 재발송 버튼용 — onContractSent는 status 전환 시점에만 반응하므로 이미 "sent"
// 상태인 계약은 다시 트리거되지 않는다.
export const resendContractInvite = onCall({ invoker: "public", secrets: [internalNotifySecret] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  }
  const callerSnap = await db.collection("users").doc(request.auth.uid).get();
  if (!callerSnap.exists || callerSnap.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "관리자만 재발송할 수 있습니다.");
  }

  const { contractId } = request.data as { contractId?: string };
  if (!contractId) {
    throw new HttpsError("invalid-argument", "contractId는 필수입니다.");
  }
  const snap = await db.collection("contracts").doc(contractId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "존재하지 않는 계약입니다.");
  }
  const data = snap.data()!;
  if (data.status !== "sent") {
    throw new HttpsError("failed-precondition", "발송된 상태의 계약만 재발송할 수 있습니다.");
  }
  if (!data.contactEmail) {
    throw new HttpsError("failed-precondition", "담당자 이메일이 없습니다.");
  }

  await sendContractInviteEmail(data.contactEmail, {
    contractId,
    title: data.title,
    companyName: data.companyName,
    contactName: data.contactName,
    version: data.version,
  });

  return { ok: true };
});

export const requestContractRevision = onCall({ invoker: "public" }, async (request) => {
  const { contractId, email, bodyText } = request.data as { contractId?: string; email?: string; bodyText?: string };
  const { snap, data } = await assertContractEmailMatch(contractId ?? "", email);

  if (data.status !== "sent") {
    throw new HttpsError("failed-precondition", "지금은 수정 요청을 보낼 수 없는 상태입니다.");
  }
  if (!bodyText || !bodyText.trim()) {
    throw new HttpsError("invalid-argument", "수정한 계약서 내용이 비어있습니다.");
  }

  await snap.ref.update({
    status: "revision_requested",
    revisionRequestedBodyText: bodyText,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const adminsSnap = await db.collection("users").where("role", "==", "admin").get();
  await Promise.all(
    adminsSnap.docs.map((a) =>
      db.collection("notifications").add({
        userId: a.id,
        type: "contract_revision_requested",
        contractId: snap.id,
        message: `${data.companyName}(${data.contactName})님이 계약서(${data.title}) 수정을 요청했습니다.`,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      })
    )
  );

  return { ok: true };
});

// 계약 서명 여부와 무관하게, 링크를 처음 열어본 시점부터 언제든 사업자등록증만 먼저
// 첨부할 수 있게 하는 별도 콜러블 — 서명 전 초안 협의 단계에서부터 받을 수 있어야 하므로
// submitContractSignature(서명 제출 시에만 호출됨)와는 별개로 둔다.
export const uploadContractBizRegCert = onCall({ invoker: "public" }, async (request) => {
  const { contractId, email, fileDataUrl } = request.data as { contractId?: string; email?: string; fileDataUrl?: string };
  const { snap, data } = await assertContractEmailMatch(contractId ?? "", email);

  if (!["sent", "revision_requested", "signed", "linked"].includes(data.status)) {
    throw new HttpsError("failed-precondition", "지금은 첨부할 수 없는 상태입니다.");
  }
  if (!fileDataUrl) {
    throw new HttpsError("invalid-argument", "파일이 필요합니다.");
  }

  const match = /^data:([\w/+.-]+);base64,(.*)$/.exec(fileDataUrl);
  if (!match) {
    throw new HttpsError("invalid-argument", "파일 형식이 올바르지 않습니다.");
  }
  const contentType = match[1];
  const ext = contentType === "application/pdf" ? "pdf" : contentType.split("/")[1] ?? "bin";
  const buffer = Buffer.from(match[2], "base64");
  const bucket = storage.bucket();
  const certPath = `contracts/${snap.id}/bizRegCert.${ext}`;
  await bucket.file(certPath).save(buffer, { contentType });
  const bizRegCertUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(certPath)}?alt=media`;

  await snap.ref.update({ bizRegCertUrl, updatedAt: FieldValue.serverTimestamp() });

  const adminsSnap = await db.collection("users").where("role", "==", "admin").get();
  await Promise.all(
    adminsSnap.docs.map((a) =>
      db.collection("notifications").add({
        userId: a.id,
        type: "contract_revision_requested",
        contractId: snap.id,
        message: `${data.companyName}(${data.contactName})님이 계약(${data.title})에 사업자등록증을 첨부했습니다.`,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      })
    )
  );

  return { ok: true, bizRegCertUrl };
});

/* ------------------------------------------------------------------ */
/* 2) 업무 상태 변경 트리거                                                */
/*    - 'done'으로 바뀐 업무를 선행 업무로 둔 'pending' 업무 중,             */
/*      모든 선행 업무가 완료된 업무를 자동으로 'todo'로 전환하고 알림 발송.   */
/*    - 클라이언트(src/lib/firestore/tasks.ts)에도 동일 로직이 있으나,       */
/*      이 트리거가 서버 측 단일 진실 공급원(authoritative) 역할을 한다.      */
/* ------------------------------------------------------------------ */
export const onTaskStatusChange = onDocumentUpdated("tasks/{taskId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  if (before.status === after.status) return;
  if (after.status !== "done") return;

  const completedTaskId = event.params.taskId;
  const projectId = after.projectId as string;

  const pendingSnap = await db
    .collection("tasks")
    .where("projectId", "==", projectId)
    .where("status", "==", "pending")
    .get();

  for (const docSnap of pendingSnap.docs) {
    const data = docSnap.data();
    const dependsOn: string[] = data.dependsOn ?? [];
    if (!dependsOn.includes(completedTaskId)) continue;
    if (dependsOn.length === 0 || dependsOn.length > 10) continue;

    const depTasksSnap = await db
      .collection("tasks")
      .where(FieldPath.documentId(), "in", dependsOn)
      .get();
    const allDone = depTasksSnap.docs.every((d) => d.data().status === "done");
    if (!allDone) continue;

    await docSnap.ref.update({
      status: "todo" as TaskStatus,
      statusHistory: FieldValue.arrayUnion({ status: "todo", enteredAt: Timestamp.now() }),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (data.assigneeId) {
      await db.collection("notifications").add({
        userId: data.assigneeId,
        projectId,
        taskId: docSnap.id,
        type: "unblocked",
        message: `선행 업무가 모두 완료되어 "${data.name}" 업무를 시작할 수 있습니다.`,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }
});

/* ------------------------------------------------------------------ */
/* 3) 코멘트 작성 시 상대방에게 자동 알림                                   */
/*    - src/components/CommentThread.tsx(클라이언트)에서 프로젝트 관련자   */
/*      전원에게 직접 알림을 생성하므로, 여기서는 중복 생성하지 않는다.       */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* 4) 마감일 임박 업무 매일 알림 (Asia/Seoul 09:00)                         */
/*    - 미완료 업무 중 마감일이 오늘~내일인 업무의 담당자에게 알림을 보낸다.     */
/*    - 같은 날 중복 알림을 막기 위해 lastDueSoonNotifiedDate 필드로 dedupe.  */
/* ------------------------------------------------------------------ */
export const dueSoonReminder = onSchedule(
  { schedule: "0 9 * * *", timeZone: "Asia/Seoul" },
  async () => {
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }); // YYYY-MM-DD
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

    const snap = await db.collection("tasks").where("status", "in", ["todo", "in_progress"]).get();

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const dueDate = data.dueDate as string;
      if (dueDate !== todayStr && dueDate !== tomorrowStr) continue;
      if (data.lastDueSoonNotifiedDate === todayStr) continue;
      if (!data.assigneeId) continue;

      await db.collection("notifications").add({
        userId: data.assigneeId,
        projectId: data.projectId,
        taskId: docSnap.id,
        type: "due_soon",
        message: `"${data.name}" 업무의 마감일이 ${dueDate === todayStr ? "오늘" : "내일"}입니다.`,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });

      await docSnap.ref.update({ lastDueSoonNotifiedDate: todayStr });
    }
  }
);

/* ------------------------------------------------------------------ */
/* 4-1) 주간 요약 리포트 (매주 월요일 Asia/Seoul 09:00)                     */
/*    - 관리자 전원에게 "이번 주 마감 예정 / 지연 중" 업무 건수를 요약해       */
/*      notifications 문서로 남긴다. 실제 발송(푸시+이메일)은 기존            */
/*      onNotificationCreated 트리거가 그대로 처리한다.                     */
/* ------------------------------------------------------------------ */
export const weeklySummaryReport = onSchedule(
  { schedule: "0 9 * * 1", timeZone: "Asia/Seoul" },
  async () => {
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    const weekLater = new Date();
    weekLater.setDate(weekLater.getDate() + 7);
    const weekLaterStr = weekLater.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

    const snap = await db.collection("tasks").where("status", "in", ["todo", "in_progress"]).get();

    let dueThisWeek = 0;
    let overdue = 0;
    for (const docSnap of snap.docs) {
      const dueDate = docSnap.data().dueDate as string;
      if (dueDate < todayStr) overdue += 1;
      else if (dueDate <= weekLaterStr) dueThisWeek += 1;
    }

    if (dueThisWeek === 0 && overdue === 0) return;

    const adminsSnap = await db.collection("users").where("role", "==", "admin").get();
    const message = `이번 주 마감 예정 ${dueThisWeek}건, 지연 중 ${overdue}건입니다.`;

    for (const adminDoc of adminsSnap.docs) {
      await db.collection("notifications").add({
        userId: adminDoc.id,
        type: "weekly_summary",
        message,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }
);

/* ------------------------------------------------------------------ */
/* 4-2) 새 견적 요청 접수 시 관리자 전원에게 알림                              */
/*    - /api/quote 라우트는 인증 없는 공개 요청이라(클라이언트 SDK, 서버)       */
/*      Firestore 규칙상 notifications를 직접 쓸 수 없다. 대신 quoteRequests   */
/*      문서 생성을 여기서 감지해 관리자 권한(Admin SDK)으로 알림을 생성한다.    */
/* ------------------------------------------------------------------ */
export const onQuoteRequestCreated = onDocumentCreated("quoteRequests/{quoteId}", async (event) => {
  const quote = event.data?.data();
  if (!quote) return;

  const adminsSnap = await db.collection("users").where("role", "==", "admin").get();
  const message = `${quote.name}${quote.company ? ` (${quote.company})` : ""}님이 견적을 요청했습니다.`;

  await Promise.all(
    adminsSnap.docs.map((a) =>
      db.collection("notifications").add({
        userId: a.id,
        type: "quote_request",
        message,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      })
    )
  );
});

/* ------------------------------------------------------------------ */
/* 5) 알림 생성 시 이메일 발송                                             */
/*    - notifications 문서가 생성되면(발생 경로 무관: 클라이언트/서버 공통)   */
/*      수신자 이메일로 알림 내용을 전송한다.                               */
/*    - Resend API 키는 Vercel 환경에만 있으므로, 공유 시크릿으로 보호된      */
/*      /api/notify-email 라우트를 통해 실제 발송을 위임한다.                */
/* ------------------------------------------------------------------ */
const NOTIFICATION_TITLE: Record<string, string> = {
  assigned: "새 업무가 배정되었습니다",
  status_change: "업무 상태가 변경되었습니다",
  comment: "새 코멘트가 등록되었습니다",
  unblocked: "업무를 시작할 수 있습니다",
  due_soon: "마감일이 임박했습니다",
  rescheduled: "일정이 자동으로 조정되었습니다",
  weekly_summary: "이번 주 업무 요약",
  decision_needed: "확인/승인이 필요합니다",
  inquiry: "새 문의가 도착했습니다",
  quote_request: "새 견적 요청이 도착했습니다",
  purchase_order: "새 발주가 접수되었습니다",
  order_status_change: "발주 상태가 변경되었습니다",
  order_cancel_request: "발주 취소 요청이 접수되었습니다",
  contract_signed: "계약서 서명이 완료되었습니다",
  contract_revision_requested: "계약서 수정 요청이 도착했습니다",
};

export const onNotificationCreated = onDocumentCreated(
  { document: "notifications/{notificationId}", secrets: [internalNotifySecret] },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const notif = snap.data();
    if (!notif) return;

    // Cloud Functions는 드물게 같은 생성 이벤트를 두 번 전달할 수 있다(at-least-once 전달).
    // 트랜잭션으로 "이미 처리됨" 플래그를 확인/기록해서 같은 알림의 푸시·이메일이
    // 중복 발송되지 않게 막는다.
    const alreadyDispatched = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(snap.ref);
      if (fresh.data()?.dispatched) return true;
      tx.update(snap.ref, { dispatched: true });
      return false;
    });
    if (alreadyDispatched) return;

    const userSnap = await db.collection("users").doc(notif.userId).get();
    const userData = userSnap.data();
    const email = userData?.email as string | undefined;
    const fcmTokens = Array.from(new Set((userData?.fcmTokens as string[] | undefined) ?? []));

    // 사용자가 이 알림 유형을 껐으면(기본값 on) 인앱 알림 기록만 남기고
    // 푸시·이메일 발송은 건너뛴다. Firestore notifications 문서 자체는 이미
    // 클라이언트에서 생성된 뒤라 알림 벨(인앱 목록)에는 그대로 남는다.
    const prefs = userData?.notificationPrefs as Record<string, boolean> | undefined;
    if (prefs?.[notif.type as string] === false) return;

    const title = NOTIFICATION_TITLE[notif.type as string] ?? "새 알림";
    // 새 발주 알림은 관리자가 바로 발주서를 볼 수 있도록, 청구서 발행 알림은 클라이언트가
    // 바로 해당 회차 청구서를 볼 수 있도록 각각 발주서/청구서 페이지로 직접 연결한다.
    const link = notif.projectId
      ? `https://handyhand.co.kr/projects/${notif.projectId}`
      : notif.type === "inquiry"
      ? "https://handyhand.co.kr/inquiries"
      : notif.type === "quote_request"
      ? "https://handyhand.co.kr/quotes"
      : notif.type === "purchase_order" && notif.orderId
      ? `https://handyhand.co.kr/orders/${notif.orderId}/print`
      : notif.type === "purchase_order"
      ? "https://handyhand.co.kr/orders"
      : notif.type === "order_cancel_request"
      ? "https://handyhand.co.kr/orders"
      : notif.type === "order_status_change" && notif.orderId && notif.invoiceIndex !== undefined
      ? `https://handyhand.co.kr/orders/${notif.orderId}/invoice/${notif.invoiceIndex}`
      : notif.type === "order_status_change"
      ? "https://handyhand.co.kr/my-orders"
      : notif.type === "contract_signed" || notif.type === "contract_revision_requested"
      ? "https://handyhand.co.kr/contracts"
      : "https://handyhand.co.kr/home";

    if (fcmTokens.length > 0) {
      // 최상위 notification 필드를 넣으면 브라우저가 자동으로 배너를 띄우는 동시에
      // 서비스워커의 onBackgroundMessage도 별도로 showNotification을 호출해서, 기기에
      // 배너가 두 번 뜨는 경우가 있다(FCM 웹 푸시의 알려진 동작). data-only 메시지로
      // 보내고 배너 표시는 서비스워커에서만 하도록 해서 중복을 막는다.
      const res = await messaging.sendEachForMulticast({
        tokens: fcmTokens,
        data: { title, body: notif.message as string, link },
        webpush: { fcmOptions: { link } },
      });
      const staleTokens = res.responses
        .map((r, i) => (!r.success && (r.error?.code === "messaging/registration-token-not-registered") ? fcmTokens[i] : null))
        .filter((t): t is string => !!t);
      if (staleTokens.length > 0) {
        await userSnap.ref.update({ fcmTokens: FieldValue.arrayRemove(...staleTokens) });
      }
    }

    if (!email) return;

    const buttonLabel =
      notif.type === "purchase_order" && notif.orderId
        ? "발주서 보기"
        : notif.type === "order_status_change" && notif.orderId && notif.invoiceIndex !== undefined
        ? "청구서 보기"
        : notif.type === "contract_signed" || notif.type === "contract_revision_requested"
        ? "계약 확인하기"
        : "HANDYWORKS에서 확인하기";

    const html = `
      <h2 style="color: #1d1d1f; margin: 0 0 16px; font-size: 19px;">${title}</h2>
      <div style="background: #ffffff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 16px; font-size: 14px;">
        <p style="margin: 0; color: #1d1d1f; line-height: 1.6;">${notif.message}</p>
      </div>
      <a href="${link}" style="display: inline-block; margin-top: 20px; background: #1d1d1f; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 999px; font-size: 14px; font-weight: 600;">${buttonLabel}</a>
      <p style="margin-top: 24px; font-size: 12px; color: #86868b;">HANDYWORKS 알림 설정에 따라 자동 발송된 이메일입니다.</p>
    `;

    await sendNotifyEmail(email, `[HANDYWORKS] ${title}`, html);
  }
);

/* ------------------------------------------------------------------ */
/* 6) 프로젝트 일정 캘린더 구독 피드 (ICS)                                  */
/*    - 구글/애플 캘린더 등에서 "URL로 캘린더 구독"하면 주기적으로 이 URL을     */
/*      다시 불러가 최신 일정을 반영한다. calendarToken으로만 인증한다.        */
/* ------------------------------------------------------------------ */
function escapeICS(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function toICSDate(dateStr: string): string {
  return (dateStr ?? "").replace(/-/g, "");
}

function addOneDayICS(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

export const projectCalendarFeed = onRequest({ invoker: "public" }, async (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  const token = req.query.token as string | undefined;
  if (!projectId || !token) {
    res.status(400).send("Bad Request");
    return;
  }

  const projectSnap = await db.collection("projects").doc(projectId).get();
  const project = projectSnap.data();
  if (!projectSnap.exists || !project || project.calendarToken !== token) {
    res.status(403).send("Forbidden");
    return;
  }

  const tasksSnap = await db.collection("tasks").where("projectId", "==", projectId).get();
  const nowStamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HANDYWORKS//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICS(`${project.name} 일정 (HANDYWORKS)`)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
  ];

  for (const doc of tasksSnap.docs) {
    const t = doc.data();
    if (!t.startDate || !t.dueDate) continue;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${doc.id}@handyhand.co.kr`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART;VALUE=DATE:${toICSDate(t.startDate)}`,
      `DTEND;VALUE=DATE:${addOneDayICS(t.dueDate)}`,
      `SUMMARY:${escapeICS(`[${project.name}] ${t.name}`)}`,
      ...(t.description ? [`DESCRIPTION:${escapeICS(t.description)}`] : []),
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");

  res.set("Content-Type", "text/calendar; charset=utf-8");
  res.send(lines.join("\r\n"));
});

