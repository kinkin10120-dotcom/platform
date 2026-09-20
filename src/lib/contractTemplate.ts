import { formatMoney } from "@/lib/orderCalc";
import { Currency } from "@/lib/types";
import { buildSignatureBlockHtml } from "@/lib/tiptapSignatureBlock";
import { formatKoreanDateTimeCore, formatContractDateCore } from "@/lib/contractDateCore";
import {
  placeSignatureBlockCore,
  normalizeBracketLabelCore,
  replaceTopLevelParensCore,
  BRACKET_LABEL_TOKENS,
  diffDaysCore,
} from "@/lib/contractHtmlCore";

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
<p>용역기간: 계약 체결일로부터 {{periodDays}} (개발 진행에 따라 연장할 수 있다.)</p>
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
<p>계약일자: {{contractDate}}</p>
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

// 실제 포맷 로직은 contractDateCore.ts(functions/src에 완전히 동일한 사본이 있다)에 있다 —
// 클라이언트는 시스템 로컬 타임존(관리자는 항상 한국에서 접속)을 그대로 쓰고, 서버만
// "Asia/Seoul"을 명시로 넘긴다. 그 한 줄만 다르고 나머지 조립 로직은 완전히 같아야 하므로,
// 그 부분을 공용 파일로 빼서 sync 테스트(contractDateCore.sync.test.ts)로 강제한다.
function formatKoreanDateTime(millis?: number): string {
  if (!millis) return "";
  return formatKoreanDateTimeCore(new Date(millis));
}

// {{contractDate}}용 — 계약 체결일은 곧 전자서명 완료일이다(템플릿 제5조와 동일한 기준).
// 아직 서명 전이면 확정된 날짜가 없으므로 그 사실을 그대로 적어, 고객이 보는 문서와
// 서명 시점에 동결되는 문서가 어긋나지 않게 한다.
function formatContractDate(millis?: number): string {
  if (!millis) return "전자서명 완료 시 자동 기입";
  return formatContractDateCore(new Date(millis));
}

// {{periodDays}}용 실제 계산은 diffDaysCore(contractHtmlCore.ts)가 한다 — 용역기간을 고정
// 날짜가 아니라 "체결일로부터 N일"로 쓰면, 서명이 늦어져도 문구가 저절로 맞고 서명 순간에
// 내용이 바뀌지 않는다(고정 날짜로 자동 이동시키면 고객이 본 문서와 서명한 문서가 달라질 수
// 있어 해시로 동결하는 지금 구조와 충돌한다).

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
    periodDays: (() => {
      const d = diffDaysCore(f.periodStart, f.periodEnd);
      return d === null ? blank : `${d}일`;
    })(),
    contractDate: formatContractDate(f.signedAt),
    paymentTerms: f.paymentTerms || blank,
    gapSignature: buildGapSignatureHtml(f),
    eulSignature: buildEulSignatureHtml(f),
  };
}

// 계약서 본문에 남아있는 {{토큰}}을 위쪽 입력 필드 값으로 치환한다. 아직 안 채워진 필드는
// "[미입력]"으로 표시해, 발송 전 관리자가 빠진 항목을 한눈에 알아챌 수 있게 한다.
// bodyText가 HTML이어도 토큰은 태그 밖 텍스트로 타이핑되므로 문자열 치환이 그대로 동작한다.
// keepContractDateToken: "본문에 적용" 버튼 전용. 이 버튼은 치환 결과를 실제 저장값으로
// 굳히는데, 서명 전에 {{contractDate}}까지 굳혀버리면 자리표시 문구("전자서명 완료 시 자동
// 기입")가 본문에 박혀서 정작 서명 시점에 실제 날짜로 바뀔 토큰이 사라진다. 화면에 보여주기만
// 하는 경로(미리보기·서명 페이지)에서는 자리표시 문구를 그대로 보여주는 게 맞으므로, 굳히는
// 경로에서만 이 옵션으로 토큰을 남겨둔다.
export function resolveContractTokens(
  bodyText: string,
  f: ContractTokenFields,
  opts?: {
    keepContractDateToken?: boolean;
    // 별첨(스펙 문서·도면 등)에는 "갑"/"을" 당사자도, 서명란도 있을 이유가 없다. 그런데 이
    // 함수를 별첨 bodyHtml에도 그대로 돌리면(과거 submitContractSignature가 그렇게 했다)
    // 아래 placeSignatureBlock이 "갑"/"을" 제목을 못 찾고 문서 맨 끝에 서명란을 억지로
    // 붙여버린다 — 별첨 끝에 계약서 서명란이 통째로 하나 더 나타나던 사고의 원인이었다.
    // 별첨을 처리할 땐 이 옵션으로 서명란 삽입 단계 자체를 건너뛴다.
    skipSignatureBlocks?: boolean;
  }
): string {
  const tokens = buildContractTokenValues(f);
  if (opts?.keepContractDateToken && !f.signedAt) tokens.contractDate = "{{contractDate}}";
  const resolved = bodyText.replace(/\{\{(\w+)\}\}/g, (match, key) => (key in tokens ? tokens[key] : match));
  // 관리자가 {{토큰}} 대신 "(제품/서비스명)"이나 "(상호명 (갑))"처럼 자연어 괄호 표기로 직접
  // 본문을 쓰는 경우도 있어, 알려진 라벨과 일치하는 괄호 텍스트만(화이트리스트) 같은 값으로
  // 채워준다 — "(목적)" 같은 조 제목의 괄호는 목록에 없는 라벨이라 그대로 남는다.
  const withBrackets = replaceTopLevelParensCore(resolved, (match, label) => {
    const key = BRACKET_LABEL_TOKENS[normalizeBracketLabelCore(label)];
    return key ? tokens[key] : match;
  });
  if (opts?.skipSignatureBlocks) return withBrackets;
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
    final = placeSignatureBlockCore(final, "eul", "갑", tokens.eulSignature);
    final = placeSignatureBlockCore(final, "gap", "을", tokens.gapSignature);
  } else {
    final = placeSignatureBlockCore(final, "gap", "갑", tokens.gapSignature);
    final = placeSignatureBlockCore(final, "eul", "을", tokens.eulSignature);
  }
  return final;
}

// 서명란 위치 찾기(placeSignatureBlockCore)·괄호 라벨 매칭(normalizeBracketLabelCore/
// BRACKET_LABEL_TOKENS)의 실제 로직은 contractHtmlCore.ts에 있다(functions/src에 완전히
// 동일한 사본이 있고, sync 테스트로 강제한다).

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
