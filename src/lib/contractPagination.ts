// "크게 편집"(ContractBodyEditor)과 "미리보기/인쇄"(ContractPreviewDocument)가 각자 따로
// 쪽 나눔을 계산하다 보니(하나는 실제 편집기 DOM을 직접 측정, 하나는 안 보이는 사본을
// 다시 그려서 측정) 서로 미묘하게 어긋나는 문제가 반복됐다 — 두 화면이 항상 똑같은
// 결과를 내도록, 쪽 나눔 알고리즘 자체를 이 파일 하나로 합쳤다. 두 화면 모두 여기 있는
// 함수를 그대로 가져다 쓴다(같은 코드 = 같은 결과, 상수를 맞춰서 우연히 같아지는 게 아니라
// 구조적으로 같다).
import { sanitizeContractHtml } from "@/lib/contractSanitize";
import { plainTextToHtml } from "@/lib/contractTemplate";

// "갑"/"을"처럼 아주 짧은 텍스트만 담은 <p>는 계약서에서 서명란을 여는 제목 줄로 쓰인다 —
// 이 줄만 페이지 맨 끝에 남고 정작 상호명/서명 같은 실제 내용이 다음 페이지로 밀려나면,
// 서명 영역이 통째로 빈 것처럼 보이는 문제가 있다(고아 제목, orphan heading).
export function isShortHeadingBlock(html: string): boolean {
  const el = document.createElement("div");
  el.innerHTML = html;
  const node = el.firstElementChild;
  if (!node || node.tagName !== "P") return false;
  const text = (node.textContent || "").trim();
  return text.length > 0 && text.length <= 4;
}

// sanitize된 HTML을 최상위 블록 요소(문단/제목/리스트/표/이미지 등) 단위로 쪼갠 뒤, 숨김
// 측정 요소에 실제로 렌더링해 누적 높이를 재면서 한 페이지 예산을 넘기 직전까지 그리디하게
// 묶는다 — 페이지 1장은 budgets.first, 그 이후 페이지들은 budgets.rest를 예산으로 쓴다.
export function paginateHtml(html: string, budgets: { first: number; rest: number }, measureEl: HTMLDivElement): string[] {
  const safe = sanitizeContractHtml(plainTextToHtml(html));
  const wrapper = document.createElement("div");
  wrapper.innerHTML = safe;
  const rawBlocks = Array.from(wrapper.children).map((el) => el.outerHTML);
  if (rawBlocks.length === 0) return [""];

  // 고아 제목을 막기 위해, 짧은 제목 블록은 바로 다음 블록과 하나로 묶어서 항상 같은 페이지에
  // 붙어있게 한다(둘이 합쳐도 어차피 몇 줄 안 되는 분량이라 페이지 예산에 영향은 미미하다).
  const blocks: string[] = [];
  for (let i = 0; i < rawBlocks.length; i++) {
    if (isShortHeadingBlock(rawBlocks[i]) && i + 1 < rawBlocks.length) {
      blocks.push(rawBlocks[i] + rawBlocks[i + 1]);
      i += 1;
    } else {
      blocks.push(rawBlocks[i]);
    }
  }

  const pages: string[] = [];
  let current: string[] = [];
  let budget = budgets.first;

  for (const block of blocks) {
    const candidate = [...current, block].join("");
    measureEl.innerHTML = candidate;
    if (current.length > 0 && measureEl.scrollHeight > budget) {
      pages.push(current.join(""));
      current = [block];
      budget = budgets.rest;
    } else {
      current.push(block);
    }
  }
  if (current.length > 0) pages.push(current.join(""));
  return pages.length > 0 ? pages : [""];
}

// 한 페이지 분량 HTML 문자열이 실제로 예산 중 얼마를 썼는지 잰다 — 크게 편집 화면에서
// "이 페이지에 아직 남은 여백"을 흰 스페이서로 채워, 미리보기처럼 항상 A4 한 장 전체
// 높이로 보이게 하는 데 쓴다.
export function measurePageHeight(pageHtml: string, measureEl: HTMLDivElement): number {
  measureEl.innerHTML = pageHtml;
  const height = measureEl.scrollHeight;
  measureEl.innerHTML = "";
  return height;
}
