// Cloud Functions 엔트리포인트. 실제 구현은 도메인별 모듈로 나뉘어 있고, 여기서는 전부
// 다시 export만 한다 — Firebase는 이 파일(build 후 lib/index.js)에서 top-level export된
// 이름을 그대로 배포된 함수 이름으로 쓰므로, 각 모듈의 export 이름은 절대 바뀌면 안 된다
// (바뀌면 기존 함수는 삭제되고 새 이름으로 다시 생성되어 배포가 disruptive해진다).
export * from "./accounts";
export * from "./contracts";
export * from "./tasks";
export * from "./inquiries";
export * from "./quotes";
export * from "./notifications";
export * from "./calendar";
export * from "./purchaseOrders";
export * from "./supplierOrders";
