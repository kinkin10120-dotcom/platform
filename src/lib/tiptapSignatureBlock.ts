import { Node } from "@tiptap/core";

// Tiptap의 기본 스키마는 등록되지 않은 태그(div)나 선언되지 않은 속성(style)을 HTML 파싱
// 시점에 조용히 버린다 — 그래서 서명/직인 영역을 <div style="..."> 문자열로만 만들어 넣으면
// "미리보기"에서는 정상으로 보여도 "크게 편집"(실제 Tiptap 에디터)에 불러오는 순간 레이아웃이
// 깨졌다. 이 노드는 서명/직인 영역 전용 커스텀 블록으로 등록해, 데이터(누가·언제 서명·발송했는지)를
// 노드 속성으로 들고 다니면서 에디터 화면과 읽기전용 렌더링 양쪽에서 항상 같은 모양으로 그려지게 한다.
export interface SignatureBlockAttrs {
  variant: "gap" | "eul";
  signerName: string | null;
  signerTitle: string | null;
  signatureUrl: string | null;
  signedAtLabel: string | null;
  sentBy: string | null;
  sentAtLabel: string | null;
  // 을 쪽 직인이 어느 법인 것인지 — 계약금액이 달러(USD)면 홍콩 법인(AIM) 명의로 나간다.
  // 기본값(null)은 기존 문서와의 호환을 위해 항상 핸디핸드로 취급한다.
  entity: "handyhand" | "aim" | null;
}

type DomChild = readonly [string, Record<string, string>, ...(string | DomChild)[]];

// 을(핸디핸드) 직인 — 관리자가 파일로 전달해준 실제 직인 이미지, Storage에 업로드해두었다.
// 매번 다시 올릴 필요 없이 고정 이미지를 재사용한다(직인은 모든 계약서에서 항상 동일).
export const HANDYHAND_SEAL_URL =
  "https://firebasestorage.googleapis.com/v0/b/handyhand-a175a.firebasestorage.app/o/assets%2Fhandyhand-seal.png?alt=media";

// 을(AIM TECHNOLOGY (HK) COMPANY) 직인 — 달러 계약금액일 때만 쓴다.
export const AIM_SEAL_URL =
  "https://firebasestorage.googleapis.com/v0/b/handyhand-a175a.firebasestorage.app/o/assets%2Fhandyhand-aim-seal.png?alt=media";

// resolveContractTokens(문자열 치환 경로, Tiptap을 거치지 않는 미리보기/서명 페이지용)와
// 이 노드의 renderHTML(에디터 렌더링용) 양쪽이 똑같은 모양을 만들도록, 자식 요소 구성을
// 이 한 함수에서만 정의해서 공유한다.
export function buildSignatureBlockChildren(attrs: SignatureBlockAttrs): DomChild[] {
  if (attrs.variant === "eul") {
    // 발송 전(초안·수정 단계)에는 갑과 똑같은 빈 영역으로 보여주다가, 실제로 "발송" 버튼을
    // 눌러 고객에게 서명 요청을 보내는 시점에만 진짜 직인 이미지로 바뀐다 — 편집 중에 미리
    // 직인이 노출될 필요는 없다는 요청에 따라, sentAtLabel(발송 시점에만 채워짐)로 구분한다.
    if (!attrs.sentAtLabel) {
      return [
        ["div", { class: "signature-placeholder-box" }, "직인"],
        ["p", { class: "signature-line signature-line-empty" }, "서명: (발송 대기 중)"],
      ];
    }
    // 갑 쪽 서명란("서명: 이름 · 직책 · 일시")과 같은 포맷으로 맞춘다 — 발송자는 이미 "발송
    // 정보 (을)" 패널에 따로 나와 있어서 여기 또 넣으면 형식만 갑과 달라지고 중복이었다.
    const sealUrl = attrs.entity === "aim" ? AIM_SEAL_URL : HANDYHAND_SEAL_URL;
    return [
      ["img", { src: sealUrl, alt: "직인", class: "signature-seal-image" }],
      ["p", { class: "signature-line" }, `서명: 최형준 · 대표 · ${attrs.sentAtLabel}`],
    ];
  }
  if (attrs.signatureUrl) {
    const who = `${attrs.signerName || ""}${attrs.signerTitle ? ` · ${attrs.signerTitle}` : ""}`;
    return [
      ["img", { src: attrs.signatureUrl, alt: "서명", class: "signature-image" }],
      ["p", { class: "signature-line" }, `서명: ${who} · ${attrs.signedAtLabel || ""}`],
    ];
  }
  // 서명 전에는 을(직인 이미지, 64x64)과 달리 갑 쪽엔 아무 이미지가 없어서, 문장 속에 묻힌
  // 회색 텍스트 한 줄만으로는 "여기에 서명이 들어간다"는 영역 자체가 눈에 안 띈다 — 을의
  // 직인 이미지와 정확히 같은 크기(64x64)의 점선 박스를 넣어 서명이 들어올 자리를 보여준다.
  return [
    ["div", { class: "signature-placeholder-box" }, "서명"],
    ["p", { class: "signature-line signature-line-empty" }, "서명: (전자서명 대기 중)"],
  ];
}

// "크게 편집" 에디터에 로드된 뒤 편집기 자신이 다시 뱉어내는 HTML(editor.getHTML())과, 여기
// 문자열 버전이 만들어내는 HTML이 한 글자도 안 틀리고 완전히 같아야 한다 — 조금이라도 다르면
// (예: 이 속성 하나가 빠지는 것만으로도) 편집 중 매 타이핑마다 "지금 내용과 다르다"고 오판해
// 에디터 내용을 통째로 다시 그리게 되고, 그 순간 한글 입력기(IME) 조합이 깨지면서 지운 글자가
// 다시 생기는 것처럼 보이는 문제로 이어진다. contenteditable="false"는 원래 렌더HTML에서만
// 따로 붙였었는데, 문자열 버전에는 빠져있어 실제로 이 문제가 있었다 — 여기 공통 함수로 옮겨
// 두 경로가 항상 같은 속성 집합을 갖게 한다.
function attrToDataAttrs(attrs: SignatureBlockAttrs): Record<string, string> {
  return {
    "data-signature-block": "",
    "data-variant": attrs.variant,
    ...(attrs.signerName ? { "data-signer-name": attrs.signerName } : {}),
    ...(attrs.signerTitle ? { "data-signer-title": attrs.signerTitle } : {}),
    ...(attrs.signatureUrl ? { "data-signature-url": attrs.signatureUrl } : {}),
    ...(attrs.signedAtLabel ? { "data-signed-at-label": attrs.signedAtLabel } : {}),
    ...(attrs.sentBy ? { "data-sent-by": attrs.sentBy } : {}),
    ...(attrs.sentAtLabel ? { "data-sent-at-label": attrs.sentAtLabel } : {}),
    ...(attrs.entity ? { "data-entity": attrs.entity } : {}),
    class: "signature-block",
    contenteditable: "false",
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function domChildToHtml(child: DomChild): string {
  const [tag, attrs, ...rest] = child;
  const attrStr = Object.entries(attrs)
    .map(([k, v]) => `${k}="${escapeHtml(v)}"`)
    .join(" ");
  const inner = rest.map((c) => (typeof c === "string" ? escapeHtml(c) : domChildToHtml(c))).join("");
  // 브라우저가 실제 DOM을 outerHTML로 직렬화할 때 img/br 같은 void 요소는 닫는 슬래시 없이
  // 나온다(editor.getHTML()도 내부적으로 이 방식) — 여기서 " />"로 닫으면 매번 서로 다른
  // 문자열로 비교되어 위 attrToDataAttrs 주석과 같은 문제가 생긴다.
  const voidTags = new Set(["img", "br"]);
  if (voidTags.has(tag)) return `<${tag}${attrStr ? " " + attrStr : ""}>`;
  return `<${tag}${attrStr ? " " + attrStr : ""}>${inner}</${tag}>`;
}

// resolveContractTokens(문자열 치환, Tiptap을 거치지 않는 미리보기·서명 페이지 경로)에서 쓰는
// HTML 문자열 버전 — 자식 구성은 buildSignatureBlockChildren과 완전히 동일한 함수를 그대로
// 재사용하므로, 에디터에 불러왔을 때와 읽기 전용으로 볼 때가 항상 같은 모양이 된다.
export function buildSignatureBlockHtml(attrs: SignatureBlockAttrs): string {
  const outerAttrs = attrToDataAttrs(attrs);
  const attrStr = Object.entries(outerAttrs)
    .map(([k, v]) => `${k}="${escapeHtml(v)}"`)
    .join(" ");
  const inner = buildSignatureBlockChildren(attrs).map(domChildToHtml).join("");
  return `<div ${attrStr}>${inner}</div>`;
}

export const SignatureBlock = Node.create({
  name: "signatureBlock",
  group: "block",
  atom: true,
  // 관리자가 클릭해서 선택한 뒤 삭제/재배치할 수 있어야 한다 — selectable:false였을 때는
  // 자동으로 끼워 넣어진 서명란을 지우고 원하는 위치에 툴바 버튼으로 다시 넣는 게 불가능했다.
  selectable: true,

  addAttributes() {
    return {
      variant: { default: "gap" },
      signerName: { default: null },
      signerTitle: { default: null },
      signatureUrl: { default: null },
      signedAtLabel: { default: null },
      sentBy: { default: null },
      sentAtLabel: { default: null },
      entity: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-signature-block]",
        getAttrs: (el) => {
          if (typeof el === "string") return false;
          return {
            variant: el.getAttribute("data-variant") || "gap",
            signerName: el.getAttribute("data-signer-name"),
            signerTitle: el.getAttribute("data-signer-title"),
            signatureUrl: el.getAttribute("data-signature-url"),
            signedAtLabel: el.getAttribute("data-signed-at-label"),
            sentBy: el.getAttribute("data-sent-by"),
            sentAtLabel: el.getAttribute("data-sent-at-label"),
            entity: el.getAttribute("data-entity"),
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const attrs = node.attrs as SignatureBlockAttrs;
    return ["div", attrToDataAttrs(attrs), ...buildSignatureBlockChildren(attrs)];
  },
});
