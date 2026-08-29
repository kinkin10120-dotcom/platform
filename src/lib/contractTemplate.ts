import { formatMoney } from "@/lib/orderCalc";
import { Currency } from "@/lib/types";
import { buildSignatureBlockHtml } from "@/lib/tiptapSignatureBlock";

// 새 계약 작성 시 리치 텍스트 에디터의 기본값 — 기존에 실제로 쓰던 용역 계약서 구조를 뼈대로 하되
// 금액·기간·당사자 등 건별로 달라지는 값은 {{토큰}}으로 남겨두고, 위쪽 입력 필드(상호명/금액/기간 등)를
// 채우면 resolveContractTokens()가 미리보기·서명 페이지·서명 완료본에 실제 값으로 자동 치환해 보여준다.
// 조 제목 줄은 미리 <strong>으로 굵게 넣어두었다 — 관리자가 새로 조를 추가할 때도 툴바에서
// 직접 볼드를 줄 수 있다.
export const DEFAULT_CONTRACT_BODY_TEMPLATE = `<p>[ 계약 당사자 ]</p>
<p>갑: {{companyName}}</p>
<p>을: 주식회사 핸디핸드</p>
<p></p>
<p>용역 의뢰자 (이하 "갑"이라 한다)와 주식회사 핸디핸드(이하 "을"이라 한다)는 아래 용역에 대하여 다음과 같이 계약을 체결한다.</p>
<p></p>
<p><strong>제 1 조 (목적)</strong></p>
<p>본 계약은 "갑"이 의뢰하는 제품개발 용역을 "을"이 소유한 기술 및 설비를 사용하여 수행함에 있어 양자 간에 필요한 제반 협력사항을 정하고 이를 상호 충실하게 이행함을 목적으로 한다.</p>
<p></p>
<p><strong>제 2 조 (용역의 종류 및 범위)</strong></p>
<p>① "을"이 "갑"에게 제공하는 용역의 종류 및 범위는 다음과 같다.</p>
<ul><li><p></p></li></ul>
<p></p>
<p><strong>제 3 조 (용역기간)</strong></p>
<p>용역기간: {{periodStart}}부터 {{periodEnd}}까지 (개발 진행에 따라 연장할 수 있다.)</p>
<p></p>
<p><strong>제 4 조 (계약금 및 대금지급)</strong></p>
<p>① 총 계약금액: {{amount}}</p>
<p>② 대금 지급 방식: 계약 체결 후 7일 이내 계약금 50%, 최종 검수 완료 후 7일 이내 잔금 50% 지급</p>
<p></p>
<p><strong>제 5 조 (계약의 효력 및 계약기간)</strong></p>
<p>① 본 계약의 효력 발생은 계약 체결일(본 문서의 전자서명 완료 시점)로부터 한다.</p>
<p>② 계약의 만료일은 제3조의 용역기간 만료일로 한다.</p>
<p></p>
<p><strong>제 6 조 (상호협력)</strong></p>
<p>"갑"과 "을"은 신의를 가지고 본 계약의 각 조항을 성실히 이행하며, 용역 수행에 필요한 사항에 대해 적극 협조한다.</p>
<p></p>
<p><strong>제 7 조 (저작권 및 손해배상)</strong></p>
<p>① "갑"과 "을"은 계약이 해지된 경우, 해지 원인을 제공한 상대방에 대하여 손해배상을 청구할 수 있다.</p>
<p>② "을"이 제3자의 저작권 등 제반 권리를 침해하지 않았음을 보증하며, 이로 인해 발생한 분쟁의 책임은 "을"에게 귀속된다.</p>
<p></p>
<p><strong>제 8 조 (계약변경)</strong></p>
<p>계약 당시 예상하지 못한 사유로 용역범위·기간·비용의 조정이 필요한 경우, 상호 협의에 의하여 본 계약 내용을 변경할 수 있다.</p>
<p></p>
<p><strong>제 9 조 (계약해지)</strong></p>
<p>① "갑"과 "을"은 상호부도, 파산, 해산된 경우 상대방은 본 계약을 해지할 수 있다.</p>
<p>② "갑"과 "을"은 상호합의에 의하여 본 계약을 해지할 수 있다.</p>
<p></p>
<p><strong>제 10 조 (비밀유지)</strong></p>
<p>① "을"은 계약 이행 중에 알게 된 "갑"의 영업비밀 및 기술정보를 제3자에게 누설하거나 본 계약의 목적 외로 사용하지 아니한다.</p>
<p>② 위 비밀유지의무는 계약 해지 또는 완료 후에도 3년간 유효하다.</p>
<p></p>
<p><strong>제 11 조 (지적재산권 및 소유권)</strong></p>
<p>용역 수행 결과물의 지적재산권 귀속은 별도 협의된 바에 따른다.</p>
<p></p>
<p><strong>제 12 조 (지체상금)</strong></p>
<p>"을"이 정해진 기간 내에 용역을 완료하지 못한 경우, 지연일수에 대하여 상호 협의된 지체상금을 지급한다.</p>
<p></p>
<p><strong>제 13 조 (분쟁의 해결)</strong></p>
<p>① 계약이행 중 발생하는 분쟁은 계약당사자가 합의에 의하여 해결한다.</p>
<p>② 제1항의 합의가 이루어지지 아니한 경우, 이 계약으로부터 발생되는 모든 분쟁은 대한상사중재원에서 국내 중재규칙에 따라 중재로 해결한다.</p>
<p></p>
<p>본 계약서는 양 당사자가 전자서명 방식으로 체결하며, 전자문서 및 전자거래 기본법에 따라 서면 계약과 동일한 법적 효력을 가진다.</p>
<p></p>
<p>갑</p>
<p>상호명: {{companyName}}</p>
<p>사업자번호: {{bizRegNumber}}</p>
<p>사업장주소: {{bizAddress}}</p>
<p>대표자: {{bizCeoName}}</p>
{{gapSignature}}
<p></p>
<p>을</p>
<p>상호명: 주식회사 핸디핸드</p>
<p>사업자번호: 128-87-00105</p>
<p>사업장주소: 경기도 고양시 덕양구 삼원로63 고양아크비즈 F804호</p>
<p>대표자: 최형준</p>
{{eulSignature}}`;

export interface ContractTokenFields {
  companyName: string;
  productName?: string;
  bizRegNumber?: string;
  bizCeoName?: string;
  bizAddress?: string;
  contactName: string;
  contactPhone?: string;
  amount: number;
  currency: Currency;
  vatApplicable?: boolean;
  periodStart?: string;
  periodEnd?: string;
  paymentTerms?: string;
  // 갑 서명(제출 전엔 빈 칸으로 표시) — 계약서 본문 안 "갑" 정보 바로 아래에 위치한다.
  signerName?: string;
  signerTitle?: string;
  signatureUrl?: string;
  signedAt?: number;
  // 을(핸디핸드) 서명 — 상시 노출되며, "발송" 시점(누가·언제)이 함께 표시된다.
  sentBy?: string;
  sentAt?: number;
  // true면 핸디핸드가 갑, 상대방이 을인 계약 — 상단 갑/을 표와 서명란(직인/서명패드) 위치가 뒤바뀐다.
  handyhandIsGap?: boolean;
}

function formatKoreanDateTime(millis?: number): string {
  return millis ? new Date(millis).toLocaleString("ko-KR") : "";
}

// 서명/직인 영역은 커스텀 Tiptap 노드(signatureBlock)로 관리한다 — 여기서는 그 노드가
// "미리보기"·서명 페이지처럼 Tiptap을 거치지 않는 화면에서도 똑같은 모양으로 보이도록,
// 같은 자식 구성 함수(buildSignatureBlockHtml)로 문자열 HTML을 만든다. "크게 편집"(실제
// 에디터)에서는 이 문자열이 로드되는 순간 signatureBlock 노드로 파싱되어, 이후 저장·재열람
// 시에도 데이터 속성(누가·언제 서명/발송했는지)이 그대로 유지된다.
function buildEulSignatureHtml(f: ContractTokenFields): string {
  return buildSignatureBlockHtml({
    variant: "eul",
    signerName: null,
    signerTitle: null,
    signatureUrl: null,
    signedAtLabel: null,
    sentBy: f.sentBy || null,
    sentAtLabel: f.sentAt ? formatKoreanDateTime(f.sentAt) : null,
    // 계약금액이 달러(USD)면 을이 홍콩 법인(AIM)이라 직인도 그쪽 걸로 나가야 한다.
    entity: f.currency === "USD" ? "aim" : "handyhand",
  });
}

// 갑(상대방) 서명 — 서명 전에는 빈 서명란만 보이다가, 전자서명이 완료되면 실제 서명 이미지와
// 서명자·일시로 바뀐다. "미리보기"·"크게 편집"·서명 페이지 어디서나 항상 이 자리에 노출된다.
function buildGapSignatureHtml(f: ContractTokenFields): string {
  return buildSignatureBlockHtml({
    variant: "gap",
    signerName: f.signerName || null,
    signerTitle: f.signerTitle || null,
    signatureUrl: f.signatureUrl || null,
    signedAtLabel: f.signedAt ? formatKoreanDateTime(f.signedAt) : null,
    sentBy: null,
    sentAtLabel: null,
    entity: null,
  });
}

// resolveContractTokens와 "본문에 적용" 버튼(재적용 시 직전 값을 찾아 새 값으로 바꿔치기하는
// 용도, src/app/(app)/contracts/page.tsx의 handleApplyTokens)이 똑같은 값 딕셔너리를 써야
// 서로 어긋나지 않는다 — 계산 자체를 이 함수 하나로 공유한다.
export function buildContractTokenValues(f: ContractTokenFields): Record<string, string> {
  const blank = "[미입력]";
  return {
    companyName: f.companyName || blank,
    productName: f.productName || blank,
    bizRegNumber: f.bizRegNumber || blank,
    bizCeoName: f.bizCeoName || blank,
    bizAddress: f.bizAddress || blank,
    contactName: f.contactName || blank,
    contactPhone: f.contactPhone || blank,
    amount: f.amount ? `${formatMoney(f.amount, f.currency)}${f.vatApplicable ? " (VAT별도)" : ""}` : blank,
    periodStart: f.periodStart || blank,
    periodEnd: f.periodEnd || blank,
    paymentTerms: f.paymentTerms || blank,
    gapSignature: buildGapSignatureHtml(f),
    eulSignature: buildEulSignatureHtml(f),
  };
}

// 문자열 전체를 훑으면서 "가장 바깥쪽" 괄호 쌍(중첩 깊이 몇 단계든 상관없이)을 찾아 각각에
// replacer를 적용한다 — 정규식 하나로는 중첩 깊이를 딱 1단계까지만 처리할 수 있어서
// "(사업장주소 (본사 (등록지)))"처럼 2단계 이상 중첩되면 놓치는 문제가 있었다. 괄호 안에
// 또 괄호가 있어도(예: "(상호명 (갑))") 가장 바깥쪽 여는 괄호부터 그와 짝이 맞는 닫는 괄호
// 까지를 통째로 label로 넘긴다.
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
      // 짝이 안 맞는 괄호(열기만 있고 안 닫힘) — 더 처리할 수 없으니 그대로 둔다.
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

// 계약서 본문에 남아있는 {{토큰}}을 위쪽 입력 필드 값으로 치환한다. 아직 안 채워진 필드는
// "[미입력]"으로 표시해, 발송 전 관리자가 빠진 항목을 한눈에 알아챌 수 있게 한다.
// bodyText가 HTML이어도 토큰은 태그 밖 텍스트로 타이핑되므로 문자열 치환이 그대로 동작한다.
export function resolveContractTokens(bodyText: string, f: ContractTokenFields): string {
  const tokens = buildContractTokenValues(f);
  const resolved = bodyText.replace(/\{\{(\w+)\}\}/g, (match, key) => (key in tokens ? tokens[key] : match));
  // 관리자가 {{토큰}} 대신 "(제품/서비스명)"이나 "(상호명 (갑))"처럼 자연어 괄호 표기로 직접
  // 본문을 쓰는 경우도 있어, 알려진 라벨과 일치하는 괄호 텍스트만(화이트리스트) 같은 값으로
  // 채워준다 — "(목적)" 같은 조 제목의 괄호는 목록에 없는 라벨이라 그대로 남는다.
  const withBrackets = replaceTopLevelParens(resolved, (match, label) => {
    const key = BRACKET_LABEL_TOKENS[normalizeBracketLabel(label)];
    return key ? tokens[key] : match;
  });
  // 관리자가 기본 템플릿을 안 쓰고 본문을 처음부터 직접 써서 {{gapSignature}}/{{eulSignature}}
  // 토큰 자체가 없는 계약서도 있다 — 그런 경우에도 서명란이 반드시 나오도록, 없으면 자동으로
  // 채워준다. 이미 signatureBlock 노드가 본문에 박혀있다면(관리자가 에디터에서 한 번 손을 대는
  // 순간 로드 시점의 토큰 치환 결과가 그대로 굳어버림) 단순히 있는지만 보고 넘어가지 않고 항상
  // 최신 값으로 통째로 교체한다 — 그래야 실제 서명 시점에 방금 그린 서명 이미지가(서명 전
  // 상태로 굳어있던) 옛 블록을 덮어쓰고 반영된다.
  // variant("gap"=상대방 서명패드, "eul"=핸디핸드 직인)는 항상 그 내용 그대로지만, 그걸 본문의
  // "갑"/"을" 어느 라벨 아래에 꽂을지는 handyhandIsGap에 따라 뒤바뀐다.
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

// 서명란을 "갑"/"을" 각자의 대표자 줄 바로 아래에 붙인다 — 문서 맨 끝에 두 서명란을 몰아서
// 붙이면(예전 방식) 갑 서명란이 을 정보 뒤에 나오는 등 위치가 어색해진다. 이미 자리 잡은
// signatureBlock 노드가 있으면 위치는 그대로 두고 내용만 최신화하고, 없으면 같은 party
// 표시("갑"/"을") 다음에 나오는 첫 "대표자" 줄 바로 뒤에 새로 끼워 넣는다 — 그 자리를 못
// 찾으면(완전히 자유 형식의 본문 등) 문서 끝에 붙이는 것으로 안전하게 대체한다.
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

// 서명 블록 div 안에는(점선 자리표시 박스용) 중첩된 <div>가 하나 더 들어있다 — "가장 처음
// 나오는 </div>까지"로 찾는 정규식은 이 안쪽 div에서 멈춰버려 바깥쪽 블록의 나머지 절반
// (<p>...</p></div>)이 안 지워지고 문서에 그대로 남는다. 그 상태로 저장 후 다시 열 때마다
// resolveContractTokens가 또 실행되면서 매번 새 블록을 하나씩 더 끼워 넣어(예전 잔해가 계속
// 쌓여) "지워도 지워도 늘어난다"는 문제로 이어졌다 — 여는/닫는 div 개수를 실제로 세어
// 중첩까지 정확히 짝을 맞춰 블록의 진짜 끝을 찾는다.
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

// "상호명 (갑)"처럼 뒤에 "(갑)"/"(을)" 같은 보충 힌트가 덧붙은 경우 그 부분은 떼고, 공백
// 차이(사업장주소 vs 사업장 주소)도 무시하고 비교할 수 있게 정규화한다.
function normalizeBracketLabel(raw: string): string {
  // 괄호 안 라벨에 글자 크기 등 서식(<span style="...">)이 입혀져 있으면, 그 태그까지
  // 라벨의 일부로 취급돼 화이트리스트와 매칭이 안 됐다 — 태그를 먼저 걷어내고 순수
  // 텍스트만 남긴 뒤 비교한다.
  const withoutTags = raw.replace(/<[^>]*>/g, "");
  return withoutTags.replace(/\s*\([^()]*\)\s*$/, "").replace(/\s+/g, "");
}

// 값은 resolveContractTokens 안의 tokens(Record<string, string>) 딕셔너리 키와 맞춘다.
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

// 리치 에디터 도입 이전(순수 텍스트, "\n" 기준)에 만들어진 계약이 있을 수 있어, 태그가 하나도
// 없는 문자열이면 줄 단위로 <p>에 담아 HTML로 변환해준다. 에디터 초기값과 미리보기 렌더링
// 양쪽에서 이 함수를 거치면 과거 데이터도 자연스럽게 표시된다.
export function plainTextToHtml(text: string): string {
  if (text.includes("<")) return text; // 이미 HTML
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split("\n")
    .map((line) => `<p>${line ? escape(line) : ""}</p>`)
    .join("");
}
