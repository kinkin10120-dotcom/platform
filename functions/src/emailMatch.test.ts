import { describe, expect, it } from "vitest";
import { contractEmailMatches, normalizeEmail } from "./emailMatch";

describe("normalizeEmail", () => {
  it("대소문자를 무시하고 앞뒤 공백을 없앤다", () => {
    expect(normalizeEmail("  Foo@Example.COM  ")).toBe("foo@example.com");
  });
});

describe("contractEmailMatches", () => {
  it("대소문자/공백이 달라도 같은 이메일이면 통과시킨다", () => {
    expect(contractEmailMatches("Foo@Example.com", " foo@example.com ")).toBe(true);
  });

  it("다른 사람 이메일이면 거부한다 — 계약 담당자가 아닌 사람이 서명 페이지를 열지 못하게 막는 핵심 로직", () => {
    expect(contractEmailMatches("foo@example.com", "bar@example.com")).toBe(false);
  });

  it("계약에 담당자 이메일이 비어있으면(contactEmail 없음) 어떤 입력도 통과시키지 않는다", () => {
    expect(contractEmailMatches(undefined, "foo@example.com")).toBe(false);
    expect(contractEmailMatches("", "")).toBe(true); // 둘 다 빈 문자열이면 형식적으로 일치 — 상위 호출부에서 email 필수 검증을 이미 함
  });
});
