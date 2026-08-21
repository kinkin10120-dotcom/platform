// A4(210mm x 297mm) 문서 레이아웃 공통 상수 — 96dpi CSS 환산값.
// 계약서 미리보기(ContractPreviewDocument)와 편집기(ContractBodyEditor)가 동일한 기준으로
// "한 페이지 분량"을 계산해야 미리보기와 실제 편집 화면의 쪽 나눔이 서로 어긋나지 않는다.
export const MM_TO_PX = 96 / 25.4;
export const PAGE_WIDTH_PX = 210 * MM_TO_PX;
export const PAGE_HEIGHT_PX = 297 * MM_TO_PX;
export const PAGE_PADDING_PX = 20 * MM_TO_PX;
export const CONTENT_WIDTH_PX = PAGE_WIDTH_PX - PAGE_PADDING_PX * 2;
export const CONTENT_HEIGHT_PX = PAGE_HEIGHT_PX - PAGE_PADDING_PX * 2;
// 크게 편집 화면에 떠 있는 흰 박스 자체가 곧 "A4 기준 여백을 뺀 실제 본문 영역"이어야
// 한다 — 그 영역을 넘치면 그대로 2페이지·3페이지가 되는 게 맞고, 그래야 인쇄 결과와 1:1로
// 맞는다. 인쇄 시 폰트 렌더링이 화면 측정과 미세하게 다를 수 있어 한때 여기에 여유값(최대
// 48px)을 뒀었지만, 그건 진짜 원인(.po-page의 min-height:297mm를 인쇄 시 안 풀어준 버그,
// 지금은 고정됨)을 다른 증상과 착각해서 생긴 군더더기였고, 결과적으로 실제 A4 여백보다
// 작게 잡혀서 "분명 한 줄 더 들어가는데 안 들어간다"는 문제만 만들었다 — 0으로 없앤다.
export const SAFETY_BUFFER_PX = 0;
// 헤더(제목/당사자/금액)가 있는 첫 페이지에서, 헤더와 본문 사이에 주는 여백(pt-8 = 32px) —
// 미리보기(ContractPreviewDocument)의 첫 페이지 예산 계산과 "크게 편집"(ContractBodyEditor)의
// 쪽 나눔 계산이 똑같이 이 값을 더해야 두 화면의 쪽 나눔 위치가 어긋나지 않는다.
export const HEADER_BODY_GAP_PX = 32;
