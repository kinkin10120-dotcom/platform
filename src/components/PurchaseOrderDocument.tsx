import { formatMoney, calcOrderTotals } from "@/lib/orderCalc";
import { Client, Currency, PURCHASE_ORDER_STATUS_LABEL, PurchaseOrderStatus } from "@/lib/types";
import { toProxiedUrl } from "@/lib/storageProxy";

export interface PurchaseOrderDocumentItem {
  productName: string;
  unitPrice: number;
  currency: Currency;
  quantity: number;
  unit?: string;
}

// 발주 제출 전 미리보기와 제출 후 실제 발주서(print 페이지)가 100% 같은 모양이어야 하므로,
// 문서 자체를 이 한 컴포넌트로만 그린다 — poNumber/status/confirmedAt처럼 아직 제출 전에는
// 존재하지 않는 값은 optional로 두고 그 자리에 자연스러운 안내 문구를 대신 넣는다.
export interface PurchaseOrderDocumentData {
  poNumber?: string;
  clientName: string;
  orderedByName: string;
  items: PurchaseOrderDocumentItem[];
  memo?: string;
  signatureUrl?: string;
  signedByName?: string;
  status?: PurchaseOrderStatus;
  createdAt: number;
  confirmedAt?: number;
  client?: Client | null;
}

export default function PurchaseOrderDocument({ data }: { data: PurchaseOrderDocumentData }) {
  const orderedDate = new Date(data.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  const totals = calcOrderTotals(data.items);

  return (
    <div className="po-page flex w-[210mm] min-h-[297mm] flex-col bg-white p-[16mm] text-[#1d1d1f] shadow-xl print:w-full">
      <div className="flex items-start justify-between border-b-2 border-[#1d1d1f] pb-6">
        <div>
          <p className="text-3xl font-bold tracking-tight">발주서</p>
          <p className="mt-1 text-xs text-[#86868b]">PURCHASE ORDER</p>
        </div>
        <div className="text-right text-sm">
          {data.client?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={toProxiedUrl(data.client.logoUrl)} alt={data.clientName} className="ml-auto h-[62px] max-w-[286px] object-contain object-right" />
          ) : (
            <p className="font-semibold">{data.clientName}</p>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
        <div className="space-y-1.5">
          <Row label="발주번호" value={data.poNumber ?? "발주 확정 시 자동 발급"} />
          <Row label="요청일" value={orderedDate} />
          <Row label="상태" value={data.status ? PURCHASE_ORDER_STATUS_LABEL[data.status] : "제출 예정"} />
        </div>
        <div className="space-y-1.5">
          <Row label="발주 고객" value={data.clientName} />
          <Row label="담당자" value={data.orderedByName} />
          {data.client?.bizCompanyName && <Row label="기업명" value={data.client.bizCompanyName} />}
          {data.client?.bizCeoName && <Row label="대표자" value={data.client.bizCeoName} />}
          {data.client?.bizRegNumber && <Row label="사업자등록번호" value={data.client.bizRegNumber} />}
          {data.client?.bizAddress && <Row label="사업장주소" value={data.client.bizAddress} />}
        </div>
      </div>

      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y-2 border-[#1d1d1f] text-xs">
            <th className="py-2.5 pr-2 text-left font-semibold">No</th>
            <th className="py-2.5 pr-2 text-left font-semibold">제품명</th>
            <th className="py-2.5 pr-2 text-right font-semibold">단가</th>
            <th className="py-2.5 pr-2 text-right font-semibold">수량</th>
            <th className="py-2.5 pl-2 text-right font-semibold">금액</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((it, i) => (
            <tr key={i} className="border-b border-[#e5e5e5]">
              <td className="py-3 pr-2 text-[#86868b]">{i + 1}</td>
              <td className="py-3 pr-2">{it.productName}</td>
              <td className="py-3 pr-2 text-right text-[#86868b]">{formatMoney(it.unitPrice, it.currency)}</td>
              <td className="py-3 pr-2 text-right text-[#86868b]">{it.quantity} {it.unit || "개"}</td>
              <td className="py-3 pl-2 text-right font-medium">{formatMoney(it.unitPrice * it.quantity, it.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex justify-end">
        <div className="w-72 space-y-1 text-sm">
          {totals.hasKrw && (
            <>
              <div className="flex items-center justify-between text-[#86868b]">
                <span>공급가액</span>
                <span>{formatMoney(totals.krwSupply, "KRW")}</span>
              </div>
              {totals.krwVat > 0 && (
                <div className="flex items-center justify-between text-[#86868b]">
                  <span>부가세</span>
                  <span>{formatMoney(totals.krwVat, "KRW")}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t-2 border-[#1d1d1f] pt-2 text-base font-bold">
                <span>{totals.hasUsd ? "합계 (KRW)" : "합계"}</span>
                <span>{formatMoney(totals.krwTotal, "KRW")}</span>
              </div>
            </>
          )}
          {totals.hasUsd && (
            <div className="flex items-center justify-between border-t-2 border-[#1d1d1f] pt-2 text-base font-bold">
              <span>{totals.hasKrw ? "합계 (USD)" : "합계"}</span>
              <span>{formatMoney(totals.usdTotal, "USD")}</span>
            </div>
          )}
        </div>
      </div>

      {data.memo && (
        <div className="mt-8">
          <p className="mb-1.5 text-xs font-semibold text-[#86868b]">요청사항</p>
          <p className="rounded-xl bg-[#f5f5f7] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">{data.memo}</p>
        </div>
      )}

      <div className="mt-auto text-xs text-[#86868b]">
        <div className="flex justify-end">
          <div className="w-56 text-center">
            <p className="mb-1.5 text-xs font-semibold text-[#86868b]">발주처 서명 / 직인</p>
            <div className="flex h-20 items-center justify-center">
              {data.signatureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={toProxiedUrl(data.signatureUrl)} alt="서명" className="h-full object-contain" />
              ) : (
                <span className="text-xs text-[#d1d1d6]">서명 없음</span>
              )}
            </div>
            <p className="mt-1.5 text-xs text-[#86868b]">{data.signedByName ?? data.orderedByName}</p>
          </div>
        </div>

        <p className="mb-1.5 mt-3 text-[10px] text-[#d1d1d6]">
          등록 {new Date(data.createdAt).toLocaleDateString("ko-KR")}
          {data.confirmedAt && ` · 확인 ${new Date(data.confirmedAt).toLocaleDateString("ko-KR")}`}
        </p>
        <div className="flex items-end justify-between border-t border-[#e5e5e5] pt-3">
          <p>본 발주서는 HANDYWORKS 플랫폼에서 생성되었습니다.</p>
          <p>{data.clientName}</p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-24 shrink-0 text-[#86868b]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
