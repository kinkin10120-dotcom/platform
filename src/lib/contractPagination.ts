// "크게 편집"(ContractBodyEditor)과 "미리보기/인쇄"(ContractPreviewDocument)가 각자 따로
// 쪽 나눔을 계산하다 보니(하나는 실제 편집기 DOM을 직접 측정, 하나는 안 보이는 사본을
// 다시 그려서 측정) 서로 미묘하게 어긋나는 문제가 반복됐다 — 두 화면이 항상 똑같은
// 결과를 내도록, 쪽 나눔 알고리즘 자체를 이 파일 하나로 합쳤다. 두 화면 모두 여기 있는
// 함수를 그대로 가져다 쓴다(같은 코드 = 같은 결과, 상수를 맞춰서 우연히 같아지는 게 아니라
// 구조적으로 같다).
import { sanitizeContractHtml } from "@/lib/contractSanitize";
import { plainTextToHtml } from "@/lib/contractTemplate";

// 조 사이 여백으로 쓰는 빈 문단(<p></p>, <p><br></p>, &nbsp;만 있는 문단).
// 문서 중간에서는 한 줄 여백 역할을 하지만, 페이지 경계에 걸려 다음 장 맨 위로 넘어가면
// 그 페이지가 빈 줄로 시작해서 위쪽이 통째로 비어 보인다 — 인쇄물에서 특히 어색하고,
// "크게 편집"과 미리보기의 첫 줄 위치가 달라 보이는 원인이었다.
export function isBlankBlock(html: string): boolean {
  const el = document.createElement("div");
  el.innerHTML = html;
  const node = el.firstElementChild;
  if (!node || node.tagName !== "P") return false;
  // 이미지/표가 들어 있으면 글자가 없어도 내용이 있는 블록이다.
  if (node.querySelector("img, table")) return false;
  // &nbsp;( )는 공백으로 취급해야 "빈 줄"로 잡힌다.
  return (node.textContent || "").replace(/ /g, " ").trim() === "";
}

// 제목 줄만 페이지 맨 끝에 남고 정작 내용은 다음 장으로 밀려나는 문제(고아 제목)를 막기
// 위해 "제목처럼 보이는 블록"을 판별한다. 이 계약서들에서 제목은 세 형태로 나타난다:
//   - "갑"/"을"처럼 아주 짧은 <p> — 서명란을 여는 줄
//   - 문단 전체가 굵게 표시된 <p> — "제 9 조 (계약변경)" 같은 조 제목이 이 형태다
//   - <h1>~<h3>
// 예전에는 4글자 이하만 제목으로 봐서 조 제목이 걸리지 않았고, 실제로 "제 9 조 (계약변경)"만
// 2쪽 맨 끝에 남고 본문은 3쪽으로 넘어가는 문제가 있었다.
export function isHeadingLikeBlock(html: string): boolean {
  const el = document.createElement("div");
  el.innerHTML = html;
  const node = el.firstElementChild;
  if (!node) return false;
  if (/^H[1-3]$/.test(node.tagName)) return true;
  if (node.tagName !== "P") return false;
  const text = (node.textContent || "").trim();
  if (text.length === 0) return false;
  if (text.length <= 4) return true;
  const strong = node.querySelector("strong, b");
  return !!strong && (strong.textContent || "").trim() === text;
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

  // 블록을 "쪼개면 안 되는 덩어리"로 묶는다. 여기서 블록을 버리거나 순서를 바꾸면 안 된다 —
  // "크게 편집"은 각 페이지 HTML의 최상위 자식 개수를 세서 문서상 어느 위치에 회색 띠를 넣을지
  // 정하므로, 블록이 하나라도 사라지면 띠가 엉뚱한 곳에 찍힌다. 아래 두 단계는 순서만 유지한
  // 채 인접 블록을 이어 붙이기만 한다.
  //
  // 1단계 — 고아 제목 방지: 제목 블록은 뒤따르는 첫 실제 내용까지 한 덩어리로 묶어 항상 같은
  // 페이지에 붙어있게 한다(제목과 내용 사이에 빈 문단이 끼어 있으면 그것까지 함께 흡수한다 —
  // 제목 + 빈 줄만 묶으면 여전히 제목만 페이지 끝에 남는다).
  const merged: string[] = [];
  for (let i = 0; i < rawBlocks.length; i++) {
    if (!isHeadingLikeBlock(rawBlocks[i])) {
      merged.push(rawBlocks[i]);
      continue;
    }
    let unit = rawBlocks[i];
    let j = i + 1;
    while (j < rawBlocks.length && isBlankBlock(rawBlocks[j])) {
      unit += rawBlocks[j];
      j++;
    }
    if (j < rawBlocks.length) {
      unit += rawBlocks[j];
      i = j;
    } else {
      i = j - 1; // 문서 맨 끝의 제목 — 뒤에 붙일 내용이 없다.
    }
    merged.push(unit);
  }

  // 2단계 — 페이지가 빈 줄로 시작하는 것 방지: 남은 빈 문단은 앞 덩어리 꼬리에 붙인다.
  // 조 사이 여백은 "앞 조의 끝"이지 "다음 조의 시작"이 아니므로, 페이지 경계에 걸리면
  // 앞 페이지에 남아야 한다. 이렇게 묶어두면 빈 문단이 단독으로 페이지 첫머리에 오는 일이
  // 구조적으로 불가능해지고, 덩어리째 높이를 재므로 앞 페이지가 넘치지도 않는다.
  const blocks: string[] = [];
  for (const block of merged) {
    if (isBlankBlock(block) && blocks.length > 0) {
      blocks[blocks.length - 1] += block;
    } else {
      blocks.push(block);
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
