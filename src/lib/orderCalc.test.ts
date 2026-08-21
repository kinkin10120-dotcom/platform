import { describe, expect, it } from "vitest";
import { calcOrderTotals, formatMoney } from "@/lib/orderCalc";

describe("formatMoney", () => {
  it("KRW는 반올림 후 천단위 콤마와 '원'을 붙인다", () => {
    expect(formatMoney(1234567.4, "KRW")).toBe("1,234,567원");
    expect(formatMoney(1234567.5, "KRW")).toBe("1,234,568원");
  });

  it("USD는 소수점 둘째 자리까지 달러 표기", () => {
    expect(formatMoney(1234.5, "USD")).toBe("$1,234.50");
  });
});

describe("calcOrderTotals", () => {
  it("KRW 부가세 별도 항목은 10% VAT를 더한다", () => {
    const totals = calcOrderTotals([
      { unitPrice: 10000, quantity: 2, currency: "KRW", vatApplicable: true },
    ]);
    expect(totals.krwSupply).toBe(20000);
    expect(totals.krwVat).toBe(2000);
    expect(totals.krwTotal).toBe(22000);
    expect(totals.hasKrw).toBe(true);
    expect(totals.hasUsd).toBe(false);
  });

  it("부가세 미적용 항목은 VAT를 더하지 않는다", () => {
    const totals = calcOrderTotals([
      { unitPrice: 10000, quantity: 1, currency: "KRW", vatApplicable: false },
    ]);
    expect(totals.krwVat).toBe(0);
    expect(totals.krwTotal).toBe(10000);
  });

  it("KRW와 USD 항목이 섞여 있으면 통화별로 따로 합산한다", () => {
    const totals = calcOrderTotals([
      { unitPrice: 10000, quantity: 1, currency: "KRW", vatApplicable: false },
      { unitPrice: 100, quantity: 2, currency: "USD", vatApplicable: false },
    ]);
    expect(totals.krwSupply).toBe(10000);
    expect(totals.usdTotal).toBe(200);
    expect(totals.hasKrw).toBe(true);
    expect(totals.hasUsd).toBe(true);
  });

  it("항목이 없으면 전부 0이다", () => {
    const totals = calcOrderTotals([]);
    expect(totals).toEqual({
      krwSupply: 0,
      krwVat: 0,
      krwTotal: 0,
      usdTotal: 0,
      hasKrw: false,
      hasUsd: false,
    });
  });
});
