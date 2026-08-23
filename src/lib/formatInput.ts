// 전화번호/사업자등록번호 입력창에 타이핑하는 동안 자동으로 "-"를 붙여 보여준다 — 실제로
// 저장되는 값도 이 형식(하이픈 포함) 그대로다. 금액 입력(formatAmountInput)과 달리 이
// 값들은 이후에 산술 연산을 하지 않고 그대로 표시·출력되므로, 표준 표기 형식인 하이픈
// 포함 문자열을 저장값 자체로 써도 문제가 없다.

// 서울(02)은 지역번호가 2자리, 그 외 지역/휴대폰은 3자리라 자리수 구성이 다르다.
export function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "").slice(0, 11);
  if (digits.startsWith("02")) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

// 금액 입력창에 타이핑하는 동안에도 천단위 콤마를 보여준다 — 실제로 저장되는 값(state)은
// 콤마 없는 순수 숫자 문자열 그대로라, onChange에서 숫자/소수점 외 문자를 걸러낼 때 이
// 함수가 표시용으로 붙인 콤마도 같이 걸러진다(그래서 저장 로직은 손댈 필요가 없다).
export function formatAmountInput(raw: string): string {
  if (!raw) return "";
  const [intPart, ...rest] = raw.split(".");
  const formattedInt = intPart === "" ? "" : Number(intPart).toLocaleString("en-US");
  return rest.length > 0 ? `${formattedInt}.${rest.join(".")}` : formattedInt;
}

// 사업자등록번호는 항상 10자리, 3-2-5 자리로 고정 구성된다(예: 128-87-00105).
export function formatBizRegNumberInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 10)}`;
}
