// 계약 서명 페이지의 본인확인(계약 담당자 이메일 대조)에 쓰는 순수 비교 로직.
// firebase-admin에 전혀 의존하지 않는 별도 모듈로 분리해, Admin SDK 초기화(자격증명 필요) 없이
// 이 판단 로직만 단위 테스트할 수 있게 한다.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function contractEmailMatches(contactEmail: string | undefined, inputEmail: string | undefined): boolean {
  return normalizeEmail(contactEmail ?? "") === normalizeEmail(inputEmail ?? "");
}
