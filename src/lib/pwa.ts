export function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !("MSStream" in window);
}

export function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

// 아이폰·아이패드의 크롬·파이어폭스·엣지 등은 내부적으로 Safari(WebKit) 엔진을 쓰지만,
// 애플이 Push API를 사파리에만 허용해서 이 브라우저들로는 "홈 화면에 추가"해도 알림을
// 받을 수 없다. 사파리로 열도록 안내해야 하는 경우를 구분하기 위한 판별 함수.
export function isIosNonSafariBrowser(): boolean {
  if (typeof window === "undefined") return false;
  return /CriOS|FxiOS|EdgiOS|OPiOS|mercury/i.test(window.navigator.userAgent);
}

// 네이버/카카오톡/인스타그램 등 앱 안에 내장된 인앱 브라우저(WebView)는 화면에 보이는
// 축소된 레이아웃을 그대로 캡처해서 인쇄하는 등 @media print를 온전히 반영하지 못하는
// 경우가 많다 — 문서(견적서/청구서/발주서 등) 인쇄 버튼이 있는 화면에서는 이 경우도
// iOS 홈 화면 앱과 마찬가지로 "링크 복사 → 사파리에서 열기"로 안내해야 한다.
export function isInAppBrowser(): boolean {
  if (typeof window === "undefined") return false;
  return /NAVER|KAKAOTALK|Instagram|FBAN|FBAV|Line\//i.test(window.navigator.userAgent);
}
