import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { createHash } from "crypto";
import { normalizeEmail, contractEmailMatches } from "./emailMatch";
import { db, storage, internalNotifySecret, sendNotifyEmail, formatMoneySimple } from "./shared";

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
  // 관리자 계정이 있어도 발송자 표기는 흔들리지 않는다. 계약금액이 달러(USD)면 을이 홍콩
  // 법인(AIM)이므로 발송자 표기(관리자 화면 전용, 고객에게는 안 보임)도 그에 맞춘다.
  const sentBy = data.currency === "USD" ? "AIM TECHNOLOGY (HK) COMPANY 최형준 대표" : "주식회사 핸디핸드 최형준 대표";

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

// src/lib/tiptapSignatureBlock.ts의 HANDYHAND_SEAL_URL/AIM_SEAL_URL과 동일한 이미지(직인,
// Storage에 업로드해둔 고정 자산). 계약금액이 달러(USD)면 홍콩 법인(AIM) 직인을 쓴다.
const HANDYHAND_SEAL_URL =
  "https://firebasestorage.googleapis.com/v0/b/handyhand-a175a.firebasestorage.app/o/assets%2Fhandyhand-seal.png?alt=media";
const AIM_SEAL_URL =
  "https://firebasestorage.googleapis.com/v0/b/handyhand-a175a.firebasestorage.app/o/assets%2Fhandyhand-aim-seal.png?alt=media";

function buildEulSignatureHtml(f: FirebaseFirestore.DocumentData): string {
  const sentAtLabel = formatKoreanDateTime(f.sentAt);
  const entity = f.currency === "USD" ? "aim" : "handyhand";
  // 발송 전(초안·수정 단계)에는 갑과 똑같은 빈 영역으로 보여주다가, 실제로 "발송" 버튼을
  // 눌러 고객에게 서명 요청을 보내는 시점(sentAt이 채워짐)에만 진짜 직인 이미지로 바뀐다.
  // src/lib/tiptapSignatureBlock.ts와 정확히 같은 속성 집합(contenteditable="false" 포함)과
  // 태그 형식(img를 self-close하지 않음)을 써야 한다 — 이 문자열이 나중에 "크게 편집"
  // 에디터(editor.getHTML())가 뱉는 형식과 한 글자라도 다르면, 편집 중 매 타이핑마다 내용이
  // 통째로 다시 그려지면서 한글 입력기 조합이 깨지는 문제로 이어진다.
  if (!sentAtLabel) {
    return `<div data-signature-block="" data-variant="eul" data-entity="${entity}" class="signature-block" contenteditable="false"><div class="signature-placeholder-box">직인</div><p class="signature-line signature-line-empty">서명: (발송 대기 중)</p></div>`;
  }
  // 갑 쪽 서명란("서명: 이름 · 직책 · 일시")과 같은 포맷으로 맞춘다 — 발송자는 이미 "발송
  // 정보 (을)" 패널에 따로 나와 있어서 여기 또 넣으면 형식만 갑과 달라지고 중복이었다.
  const attrs = [
    'data-signature-block=""',
    'data-variant="eul"',
    f.sentBy ? `data-sent-by="${escapeHtmlAttr(String(f.sentBy))}"` : "",
    `data-sent-at-label="${escapeHtmlAttr(sentAtLabel)}"`,
    `data-entity="${entity}"`,
    'class="signature-block"',
    'contenteditable="false"',
  ].filter(Boolean).join(" ");
  const sealUrl = entity === "aim" ? AIM_SEAL_URL : HANDYHAND_SEAL_URL;
  return `<div ${attrs}><img src="${sealUrl}" alt="직인" class="signature-seal-image"><p class="signature-line">서명: 최형준 · 대표 · ${sentAtLabel}</p></div>`;
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
        details: [
          `계약명: ${data.title}`,
          ...(data.productName ? [`제품/서비스명: ${data.productName}`] : []),
          `계약금액: ${formatMoneySimple(data.amount ?? 0, data.currency ?? "KRW")}${data.vatApplicable ? " (VAT별도)" : ""}`,
        ],
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
    <p style="font-size: 13px; color: #86868b; line-height: 1.6;">
      안녕하세요. ${info.companyName} ${info.signerName}님<br/><br/>
      먼저, 저희 HANDYHAND를 믿고 계약을 체결해 주셔서 진심으로 감사드립니다. 이렇게 소중한 인연으로
      함께하게 되어 정말 기쁘게 생각하며, 좋은 결과로 보답해 드릴 수 있도록 최선을 다하겠습니다.<br/><br/>
      계약이 정상적으로 체결되었음을 안내드립니다. 아래 버튼을 눌러 서명 완료된 계약서 원문을 확인하고,
      필요하면 인쇄하거나 PDF로 저장하실 수 있습니다. 진행 중 궁금하신 점이나 필요하신 부분이 있으시면
      언제든 편하게 연락 주시기 바랍니다.
    </p>
    <div style="background: #ffffff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 16px; font-size: 14px; margin: 20px 0 0;">
      <p style="margin: 0 0 6px; color: #1d1d1f;">계약명: ${info.title}</p>
      <p style="margin: 0 0 6px; color: #1d1d1f;">계약 당사자: ${info.companyName}</p>
      <p style="margin: 0 0 6px; color: #1d1d1f;">서명자: ${info.signerName}</p>
      <p style="margin: 0 0 6px; color: #1d1d1f;">서명 일시: ${signedAtStr}</p>
      <p style="margin: 0; color: #86868b; word-break: break-all;">본문 해시(SHA-256): ${info.contentHash}</p>
    </div>
    <div style="text-align: center; margin-top: 20px;"><a href="${viewLink}" style="display: inline-block; background: #1d1d1f; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 999px; font-size: 14px; font-weight: 600;">계약서 원문 보기 / PDF 저장</a></div>
    <p style="margin-top: 24px; font-size: 13px; color: #86868b; line-height: 1.6;">
      본 메일은 위 내용으로 전자서명이 완료되었음을 확인하는 기록용 메일입니다. 계약 본문은 서명 시점 그대로 보관되며,
      위 해시값으로 이후 위변조 여부를 검증할 수 있습니다. 이 메일을 보관해두시면 추후 서명 시점·내용의 독립적인
      증빙 자료로 활용하실 수 있습니다.
    </p>
  `;

  await sendNotifyEmail(email, "[HANDYWORKS] 전자서명이 완료되었습니다.", html);
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
    <p style="font-size: 13px; color: #86868b; line-height: 1.6;">
      안녕하세요. ${info.companyName} ${info.contactName}님<br/><br/>
      ${revisionNo > 0
        ? "요청해 주신 내용을 반영하여 수정된 계약서를 다시 보내드립니다. 아래 버튼을 눌러 변경된 내용을 확인해 주시기 바랍니다."
        : "저희 HANDYHAND와 함께해 주셔서 감사드립니다. 논의된 내용을 바탕으로 계약서를 보내드리오니 확인 부탁드립니다."}
      <br/><br/>
      아래 버튼을 눌러 계약서 내용을 확인해주세요. 그 자리에서 바로 전자서명을 진행하시거나, 수정이 필요한 부분이
      있다면 수정을 요청하실 수 있습니다. 궁금하신 점이 있으시면 언제든 편하게 연락 주시기 바랍니다.
    </p>
    <div style="background: #ffffff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 16px; font-size: 14px; margin: 20px 0 0;">
      <p style="margin: 0 0 6px; color: #1d1d1f;">계약명: ${info.title}</p>
      <p style="margin: 0; color: #1d1d1f;">${info.companyName} · ${info.contactName}님</p>
    </div>
    <div style="text-align: center; margin-top: 20px;"><a href="${signLink}" style="display: inline-block; background: #1d1d1f; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 999px; font-size: 14px; font-weight: 600;">계약서 확인하고 서명하기</a></div>
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
        details: [
          `계약명: ${data.title}`,
          ...(data.productName ? [`제품/서비스명: ${data.productName}`] : []),
          `계약금액: ${formatMoneySimple(data.amount ?? 0, data.currency ?? "KRW")}${data.vatApplicable ? " (VAT별도)" : ""}`,
        ],
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
        details: [
          `계약명: ${data.title}`,
          ...(data.productName ? [`제품/서비스명: ${data.productName}`] : []),
        ],
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      })
    )
  );

  return { ok: true, bizRegCertUrl };
});
