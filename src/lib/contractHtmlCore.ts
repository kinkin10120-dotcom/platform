// 계약서 본문 문자열 처리(서명란 위치 찾기, 괄호 라벨 매칭, 기간 계산)의 순수 로직만 모아둔
// 파일. contractDateCore.ts와 같은 이유·같은 규칙이다 — functions/src/contractHtmlCore.ts에
// 완전히 동일한 사본이 있고, src/lib/contractDateCore.sync.test.ts가 두 파일(과 이 파일)을
// 텍스트로 직접 비교해서 한쪽만 고치면 바로 실패한다.
//
// >>> 이 파일을 고치면 반드시 functions/src/contractHtmlCore.ts도 똑같이 고칠 것. <<<
// DOM이나 firebase-admin 같은 한쪽에만 있는 API를 쓰지 않는다 — 순수 문자열/정규식 로직만.

// 서명란 div 안에는(점선 자리표시 박스용) 중첩된 <div>가 하나 더 들어있다 — "가장 처음
// 나오는 </div>까지"로 찾는 정규식은 이 안쪽 div에서 멈춰버려 바깥쪽 블록의 나머지 절반
// (<p>...</p></div>)이 안 지워지고 문서에 그대로 남는다. 그 상태로 저장 후 다시 열 때마다
// resolveContractTokens가 또 실행되면서 매번 새 블록을 하나씩 더 끼워 넣어(예전 잔해가 계속
// 쌓여) "지워도 지워도 늘어난다"는 문제로 이어졌다 — 여는/닫는 div 개수를 실제로 세어
// 중첩까지 정확히 짝을 맞춰 블록의 진짜 끝을 찾는다.
export function findSignatureBlockRangeCore(html: string, variant: "gap" | "eul"): { start: number; end: number } | null {
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

// 서명란을 "갑"/"을" 각자의 대표자 줄 바로 아래에 붙인다 — 문서 맨 끝에 두 서명란을 몰아서
// 붙이면(예전 방식) 갑 서명란이 을 정보 뒤에 나오는 등 위치가 어색해진다. 이미 자리 잡은
// signatureBlock 노드가 있으면 위치는 그대로 두고 내용만 최신화하고, 없으면 같은 party
// 표시("갑"/"을") 다음에 나오는 첫 "대표자" 줄 바로 뒤에 새로 끼워 넣는다 — 그 자리를 못
// 찾으면(완전히 자유 형식의 본문 등) 문서 끝에 붙이는 것으로 안전하게 대체한다.
//
// 주의: 별첨(스펙 문서 등)에는 "갑"/"을" 제목이 없어서 이 마지막 "문서 끝에 붙이는" 대체가
// 발동해 서명란이 엉뚱하게 붙는 사고가 있었다 — 별첨을 처리할 때는 이 함수 자체를 호출하지
// 않는 쪽(resolveContractTokens의 skipSignatureBlocks 옵션)으로 막는다.
export function placeSignatureBlockCore(html: string, variant: "gap" | "eul", partyLabel: "갑" | "을", blockHtml: string): string {
  const existingRange = findSignatureBlockRangeCore(html, variant);
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

// "상호명 (갑)"처럼 뒤에 "(갑)"/"(을)" 같은 보충 힌트가 덧붙은 경우 그 부분은 떼고, 공백
// 차이(사업장주소 vs 사업장 주소)도 무시하고 비교할 수 있게 정규화한다.
export function normalizeBracketLabelCore(raw: string): string {
  // 괄호 안 라벨에 글자 크기 등 서식(<span style="...">)이 입혀져 있으면, 그 태그까지
  // 라벨의 일부로 취급돼 화이트리스트와 매칭이 안 됐다 — 태그를 먼저 걷어내고 순수
  // 텍스트만 남긴 뒤 비교한다.
  const withoutTags = raw.replace(/<[^>]*>/g, "");
  return withoutTags.replace(/\s*\([^()]*\)\s*$/, "").replace(/\s+/g, "");
}

// 관리자가 {{토큰}} 대신 "(제품/서비스명)"이나 "(상호명 (갑))"처럼 자연어 괄호 표기로 직접
// 본문을 쓰는 경우도 있어, 정규식 하나로는 처리 못 하는 괄호 중첩(1단계 초과)을 문자 단위로
// 직접 찾아 치환한다.
export function replaceTopLevelParensCore(text: string, replacer: (match: string, label: string) => string): string {
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

// 값은 resolveContractTokens 안의 tokens(Record<string, string>) 딕셔너리 키와 맞춘다.
// 키는 normalizeBracketLabelCore를 거친 뒤(공백 제거)와 비교되므로 공백 없이 적는다.
export const BRACKET_LABEL_TOKENS: Record<string, string> = {
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
  // "용역기간"은 여기 넣으면 안 된다 — 기본 템플릿의 조 제목이 "제 3 조 (용역기간)"이라,
  // 괄호 라벨 치환이 그 제목까지 잡아서 "제 3 조 112일"로 바꿔버린다. 조 제목과 겹치는
  // 라벨은 화이트리스트에 넣지 않는다.
  "계약일자": "contractDate",
  "계약체결일": "contractDate",
  "계약금액": "amount",
  "대금지급방식": "paymentTerms",
};

// {{periodDays}}용 — 시작일·종료일로 잡아둔 기간을 "일수"로 환산한다.
export function diffDaysCore(start?: string, end?: string): number | null {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return null;
  return Math.round((e - s) / 86400000);
}
