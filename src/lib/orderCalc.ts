import { Currency, PurchaseOrderItem } from "@/lib/types";

export const DEFAULT_BANK_INFO = "하나은행 871-910012-21104 주식회사 핸디핸드";

export function formatMoney(amount: number, currency: Currency): string {
  if (currency === "USD") {
    return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${Math.round(amount).toLocaleString("ko-KR")}원`;
}

export interface OrderTotals {
  krwSupply: number; // KRW 항목 공급가액(부가세 제외) 합계
  krwVat: number; // KRW 항목 중 부가세 별도 대상의 부가세 합계 (10%)
  krwTotal: number; // krwSupply + krwVat
  usdTotal: number; // USD 항목 합계
  hasKrw: boolean;
  hasUsd: boolean;
}

export function calcOrderTotals(
  items: Pick<PurchaseOrderItem, "unitPrice" | "quantity" | "currency" | "vatApplicable">[]
): OrderTotals {
  let krwSupply = 0;
  let krwVat = 0;
  let usdTotal = 0;

  for (const it of items) {
    const lineTotal = it.unitPrice * it.quantity;
    if (it.currency === "USD") {
      usdTotal += lineTotal;
    } else {
      krwSupply += lineTotal;
      if (it.vatApplicable) krwVat += Math.round(lineTotal * 0.1);
    }
  }

  return {
    krwSupply,
    krwVat,
    krwTotal: krwSupply + krwVat,
    usdTotal,
    hasKrw: krwSupply > 0,
    hasUsd: usdTotal > 0,
  };
}
