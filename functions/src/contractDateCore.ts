// 계약서 관련 날짜 포맷의 순수 로직만 모아둔 파일.
//
// functions/src/contractDateCore.ts에 이 파일과 완전히 동일한 내용이 하나 더 있다. 이
// 프로젝트(Next.js 앱)와 Cloud Functions는 서로 다른 빌드·배포 단위라 파일을 실제로
// import해서 공유할 수 없다 — 그래서 "두 파일은 항상 완전히 같은 내용이어야 한다"는 규칙으로
// 관리한다. src/lib/contractDateCore.sync.test.ts가 두 파일을 텍스트로 직접 비교해서, 한쪽만
// 고치고 반대쪽을 깜빡하면 테스트가 바로 실패한다.
//
// 실제로 이 파일을 만들게 된 계기: 같은 로직이 두 곳에 따로 있다 보니 한쪽만 고쳐서, 관리자
// 화면(정상 "오후")과 고객이 보는 서명 페이지(서버를 거침, "PM")가 같은 데이터를 다르게
// 보여준 적이 있었다.
//
// >>> 이 파일을 고치면 반드시 functions/src/contractDateCore.ts도 똑같이 고칠 것. <<<
// 브라우저와 Cloud Functions 양쪽에서 그대로 동작해야 하므로, 어느 한쪽에만 있는 API(DOM,
// firebase-admin 등)를 쓰지 않는다 — 표준 JS/Intl API만 사용한다.

// 실제 배포된 Cloud Functions 런타임에서 확인된 문제: `.toLocaleString("ko-KR", {...})`가
// 날짜(년.월.일)는 한국어 표기로 내놓으면서 오전/오후만 영문 "AM"/"PM"으로 새는 경우가 있다
// (그 런타임의 ICU 데이터가 "ko" 로케일의 일부 구성요소만 갖고 있는 것으로 보인다). 로케일
// 이름에 기대는 대신, 항상 존재를 보장할 수 있는 "en-US" + 숫자 전용 옵션으로 그 타임존의
// 실제 년/월/일/시/분/초만 뽑아내고, "년/월/일" 표기와 "오전/오후" 판정은 직접 조립한다 —
// 어떤 Node/브라우저 런타임에서 돌아가도 결과가 달라지지 않는다.
//
// timeZone을 안 주면(undefined) 실행 환경의 로컬 타임존을 그대로 쓴다 — 관리자 브라우저는
// 항상 한국에서 접속하므로 이 기본값으로 충분하고, 서버(Cloud Functions 컨테이너는 한국이
// 아닌 곳에서 돌 수 있다)만 "Asia/Seoul"을 명시로 넘긴다. 이 한 가지가 두 호출부의 유일한
// 차이이고, 그 차이는 의도된 것이라 통일하지 않는다.
export function formatKoreanDateTimeCore(date: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const hour24 = Number(get("hour"));
  const period = hour24 < 12 ? "오전" : "오후";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${get("year")}. ${get("month")}. ${get("day")}. ${period} ${hour12}:${get("minute")}:${get("second")}`;
}

// {{contractDate}}용 — "YYYY년 M월 D일" 형식. 위 formatKoreanDateTimeCore와 같은 이유로
// Intl.DateTimeFormat.formatToParts를 쓴다 — 예전 서버 쪽 구현은 "toLocaleString으로 문자열을
// 만든 뒤 그 문자열을 다시 Date로 파싱해 시/분/초를 읽는" 우회 방식을 썼는데, 로케일 문자열을
// 다시 날짜로 파싱하는 건 엔진마다 결과가 달라질 수 있는 잘 알려진 취약 패턴이라 정리했다
// (날짜 자체는 두 방식 모두 실제로는 같은 값을 냈다 — 요일/오전오후 표기처럼 깨지는 부분이
// 아니었다. 다만 같은 부류의 문제가 나중에 나타나는 걸 미리 막아둔다).
export function formatContractDateCore(date: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return `${get("year")}년 ${get("month")}월 ${get("day")}일`;
}
