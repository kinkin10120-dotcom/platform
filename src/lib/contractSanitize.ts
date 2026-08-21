import DOMPurify from "dompurify";
// isomorphic-dompurify(jsdom 기반 서버 폴백)를 시도했으나, 그 의존성인 whatwg-url이 Node 22+를
// 요구해서 배포 런타임(Node 20)에서 매 요청마다 500 에러가 났다. 이 함수는 실제로 항상 클라이언트
// 쪽 렌더링(데이터를 다 받아온 뒤)에서만 호출되므로, 순수 dompurify + window 존재 여부 가드로
// 충분하다 — 서버에서 호출되면(내용이 준비되기 전) 안전하게 원본을 그대로 반환한다.

// 계약서 본문/별첨은 관리자가 작성하지만, 로그인 없는 상대방 브라우저(서명 페이지)에도 그대로
// 주입되므로 dangerouslySetInnerHTML 직전에 항상 이 함수를 거친다. 표/이미지/서식까지 써야 하므로
// 필요한 태그만 명시적으로 허용한다.
export function sanitizeContractHtml(html: string): string {
  // 서버 렌더링 시점엔 정화되지 않은 원본을 그대로 내보내지 않는다 — 지금 이 함수를 쓰는 화면은
  // 전부 데이터를 클라이언트에서 받아온 뒤에만 실제 내용을 채우므로(서버 렌더링 시점엔 항상
  // 비어있거나 아직 안 쓰임), 빈 문자열을 반환해도 실사용에는 영향이 없다.
  if (typeof window === "undefined") return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "u", "s", "span", "div",
      "h1", "h2", "h3",
      "ul", "ol", "li",
      "table", "thead", "tbody", "tr", "th", "td",
      "img",
    ],
    // class: signatureBlock 노드 등 인라인 style 대신 CSS 클래스로 꾸미는 요소용.
    // data-* 속성(예: data-signature-block)은 DOMPurify가 기본으로 허용하므로 따로 안 넣어도 된다.
    ALLOWED_ATTR: ["style", "src", "alt", "width", "height", "colspan", "rowspan", "class"],
  });
}
