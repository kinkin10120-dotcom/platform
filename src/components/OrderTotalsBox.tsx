import { PurchaseOrderItem } from "@/lib/types";
import { calcOrderTotals, formatMoney } from "@/lib/orderCalc";

export default function OrderTotalsBox({ items, dark, bordered = true }: { items: PurchaseOrderItem[]; dark?: boolean; bordered?: boolean }) {
  const totals = calcOrderTotals(items);
  const muted = dark ? "text-white/60" : "text-[#86868b]";
  const strong = dark ? "text-white" : "text-[#1d1d1f]";

  return (
    <div className={`space-y-1 px-3 py-2.5 text-sm ${bordered ? "border-t" : ""} ${dark ? "border-[#1d1d1f] bg-[#1d1d1f]" : "border-[#e5e5e5] bg-[#f5f5f7]"}`}>
      {totals.hasKrw && (
        <>
          <div className={`flex items-center justify-between text-xs ${muted}`}>
            <span>공급가액</span>
            <span>{formatMoney(totals.krwSupply, "KRW")}</span>
          </div>
          <div className={`flex items-center justify-between text-xs ${muted}`}>
            <span>부가세</span>
            <span>{totals.krwVat > 0 ? formatMoney(totals.krwVat, "KRW") : "포함가"}</span>
          </div>
          <div className={`flex items-center justify-between font-semibold ${strong}`}>
            <span>{totals.hasUsd ? "합계 (KRW)" : "합계"}</span>
            <span>{formatMoney(totals.krwTotal, "KRW")}</span>
          </div>
        </>
      )}
      {totals.hasUsd && (
        <div className={`flex items-center justify-between font-semibold ${strong}`}>
          <span>{totals.hasKrw ? "합계 (USD)" : "합계"}</span>
          <span>{formatMoney(totals.usdTotal, "USD")}</span>
        </div>
      )}
    </div>
  );
}
