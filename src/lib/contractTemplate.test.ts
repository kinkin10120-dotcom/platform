import { describe, expect, it } from "vitest";
import { resolveContractTokens, ContractTokenFields } from "@/lib/contractTemplate";

const baseFields: ContractTokenFields = {
  companyName: "테스트 주식회사",
  contactName: "홍길동",
  amount: 1000000,
  currency: "KRW",
};

describe("resolveContractTokens", () => {
  it("{{토큰}}을 실제 값으로 치환한다", () => {
    const result = resolveContractTokens("갑: {{companyName}}, 담당자: {{contactName}}", baseFields);
    expect(result).toContain("갑: 테스트 주식회사");
    expect(result).toContain("담당자: 홍길동");
  });

  it("입력되지 않은 필드는 [미입력]으로 표시한다", () => {
    const result = resolveContractTokens("사업자번호: {{bizRegNumber}}", baseFields);
    expect(result).toContain("사업자번호: [미입력]");
  });

  it("모르는 토큰은 그대로 남겨둔다", () => {
    const result = resolveContractTokens("{{unknownToken}}", baseFields);
    expect(result).toContain("{{unknownToken}}");
  });

  it("금액은 통화 포맷과 VAT별도 표기를 반영한다", () => {
    const result = resolveContractTokens("총 계약금액: {{amount}}", {
      ...baseFields,
      vatApplicable: true,
    });
    expect(result).toContain("총 계약금액: 1,000,000원 (VAT별도)");
  });

  it("자연어 괄호 표기(화이트리스트 라벨)도 같은 값으로 채운다", () => {
    const result = resolveContractTokens("상호명: (상호명)", baseFields);
    expect(result).toContain("상호명: 테스트 주식회사");
  });

  it("목록에 없는 괄호 라벨은 그대로 둔다", () => {
    const result = resolveContractTokens("(목적)", baseFields);
    expect(result).toContain("(목적)");
  });

  it("괄호 라벨 끝의 (갑)/(을) 같은 부가 표기는 떼고 매칭한다", () => {
    const result = resolveContractTokens("(상호명 (갑))", baseFields);
    expect(result).toContain("테스트 주식회사");
    expect(result).not.toContain("(상호명");
  });

  it("2단계 이상 중첩된 괄호도 바깥쪽 기준으로 안전하게 처리하고, 화이트리스트에 없으면 그대로 둔다", () => {
    const result = resolveContractTokens("(목적 (상세))", baseFields);
    expect(result).toContain("(목적 (상세))");
  });
});
