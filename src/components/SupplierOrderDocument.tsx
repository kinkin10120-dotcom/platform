import { SupplierCurrency, SupplierOrderItem } from "@/lib/types";
import { calcSupplierItemTotal, calcSupplierOrderTotal, formatSupplierMoney } from "@/lib/firestore/supplierOrders";

// 발주서를 받는 쪽이 중국 공장이라 라벨을 전부 중문/영문 병기로 쓴다. 우리 쪽 발주서(매출)는
// PurchaseOrderDocument가 그리고, 이건 나가는 발주(매입) 전용이다 — 서명란 대신 공장이 도장을
// 찍어 회신할 자리를 비워둔다.
export interface SupplierOrderDocumentData {
  soNumber?: string;
  supplierName: string;
  items: SupplierOrderItem[];
  currency: SupplierCurrency;
  exchangeRate?: number;
  incoterms?: string;
  portOfLoading?: string;
  paymentTerms?: string;
  leadTimeDays?: number;
  packingNote?: string;
  memo?: string;
  lotNo?: string;
  createdAt: number;
}

const OUR_COMPANY = {
  nameEn: "HANDYHAND CO., LTD.",
  nameKo: "주식회사 핸디핸드",
  address: "F804, Goyang Arc-Biz, 63 Samwon-ro, Deogyang-gu, Goyang-si, Gyeonggi-do, Korea",
  bizNo: "128-87-00105",
  ceo: "CHOI HYUNGJUN",
};

export default function SupplierOrderDocument({ data }: { data: SupplierOrderDocumentData }) {
  const issuedDate = new Date(data.createdAt).toLocaleDateString("en-CA"); // YYYY-MM-DD
  const total = calcSupplierOrderTotal(data.items);

  return (
    <div className="po-page flex w-[210mm] min-h-[297mm] flex-col bg-white p-[16mm] text-[#1d1d1f] shadow-xl print:w-full">
      <div className="flex items-start justify-between border-b-2 border-[#1d1d1f] pb-6">
        <div>
          <p className="text-3xl font-bold tracking-tight">采购订单</p>
          <p className="mt-1 text-xs tracking-wide text-[#86868b]">PURCHASE ORDER</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold">{OUR_COMPANY.nameEn}</p>
          <p className="mt-0.5 max-w-[80mm] text-xs leading-relaxed text-[#86868b]">{OUR_COMPANY.address}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
        <div className="space-y-1.5">
          <Row label="供应商 / Supplier" value={data.supplierName || "-"} />
          <Row label="订单号 / PO No." value={data.soNumber ?? "발행 시 자동 발급"} />
          {data.lotNo && <Row label="批次 / Lot" value={data.lotNo} />}
          <Row label="日期 / Date" value={issuedDate} />
        </div>
        <div className="space-y-1.5">
          <Row label="买方 / Buyer" value={OUR_COMPANY.nameEn} />
          <Row label="联系人 / Contact" value={OUR_COMPANY.ceo} />
          <Row label="税号 / Biz No." value={OUR_COMPANY.bizNo} />
          <Row label="币种 / Currency" value={data.currency} />
        </div>
      </div>

      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y-2 border-[#1d1d1f] text-xs">
            <th className="w-8 py-2.5 pr-2 text-left font-semibold">No</th>
            <th className="py-2.5 pr-2 text-left font-semibold">品名 / Description</th>
            <th className="w-24 py-2.5 pr-2 text-right font-semibold">单价 / Price</th>
            <th className="w-20 py-2.5 pr-2 text-right font-semibold">数量 / Qty</th>
            <th className="w-28 py-2.5 pl-2 text-right font-semibold">金额 / Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((it, i) => (
            <tr key={i} className="border-b border-[#e5e5e5] align-top">
              <td className="py-3 pr-2 text-[#86868b]">{i + 1}</td>
              <td className="py-3 pr-2">
                <p className="font-medium">{it.nameEn || it.name}</p>
                {it.spec && <p className="mt-0.5 text-xs text-[#86868b]">{it.spec}</p>}
                {/* 이번 로트에 담은 부대비용은 품목 아래에 들여쓰기로 나열한다 — 공장이 어떤
                    항목까지 포함된 금액인지 바로 확인할 수 있어야 나중에 말이 안 나온다. */}
                {(it.costs ?? []).map((c, ci) => (
                  <p key={ci} className="mt-0.5 pl-3 text-xs text-[#86868b]">
                    + {c.name} : {formatSupplierMoney(c.amount, data.currency)}
                  </p>
                ))}
              </td>
              <td className="py-3 pr-2 text-right text-[#86868b]">{formatSupplierMoney(it.unitPrice, data.currency)}</td>
              <td className="py-3 pr-2 text-right text-[#86868b]">{it.quantity} {it.unit || "PCS"}</td>
              <td className="py-3 pl-2 text-right font-medium">{formatSupplierMoney(calcSupplierItemTotal(it), data.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex justify-end">
        <div className="w-72 space-y-1 text-sm">
          <div className="flex items-center justify-between border-t-2 border-[#1d1d1f] pt-2 text-base font-bold">
            <span>合计 / Total</span>
            <span>{formatSupplierMoney(total, data.currency)}</span>
          </div>
          {/* 환율은 우리 원가 관리용이라 참고값으로만 작게 남긴다 — 공장이 받을 금액은 위 합계다. */}
          {data.exchangeRate ? (
            <p className="pt-1 text-right text-[10px] text-[#d1d1d6]">
              참고 환율 1 {data.currency} = {data.exchangeRate.toLocaleString("ko-KR")}원 · 약{" "}
              {Math.round(total * data.exchangeRate).toLocaleString("ko-KR")}원
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-8 space-y-1.5 text-sm">
        {data.incoterms && <Row label="贸易条款 / Incoterms" value={`${data.incoterms}${data.portOfLoading ? ` ${data.portOfLoading}` : ""}`} />}
        {data.paymentTerms && <Row label="付款方式 / Payment" value={data.paymentTerms} />}
        {typeof data.leadTimeDays === "number" && (
          <Row label="交货期 / Lead time" value={`定金到账后 ${data.leadTimeDays} 天 / ${data.leadTimeDays} days after deposit received`} />
        )}
        {data.packingNote && <Row label="包装 / Packing" value={data.packingNote} />}
      </div>

      {data.memo && (
        <div className="mt-6">
          <p className="mb-1.5 text-xs font-semibold text-[#86868b]">备注 / Remarks</p>
          <p className="rounded-xl bg-[#f5f5f7] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">{data.memo}</p>
        </div>
      )}

      <div className="mt-auto pt-10 text-xs text-[#86868b]">
        <div className="grid grid-cols-2 gap-10">
          <div className="text-center">
            <p className="mb-1.5 text-xs font-semibold text-[#86868b]">买方 / Buyer</p>
            <div className="h-20" />
            <p className="border-t border-[#d1d1d6] pt-1.5">{OUR_COMPANY.nameEn}</p>
          </div>
          {/* 공장은 여기에 공장 도장(公章)을 찍어 스캔본으로 회신한다. */}
          <div className="text-center">
            <p className="mb-1.5 text-xs font-semibold text-[#86868b]">供应商盖章 / Supplier Stamp</p>
            <div className="h-20" />
            <p className="border-t border-[#d1d1d6] pt-1.5">{data.supplierName || "-"}</p>
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between border-t border-[#e5e5e5] pt-3 text-[10px] text-[#d1d1d6]">
          <p>Please sign, stamp and return this purchase order.</p>
          <p>{OUR_COMPANY.nameKo}</p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-40 shrink-0 text-[#86868b]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
