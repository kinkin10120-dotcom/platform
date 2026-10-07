import { SupplierInvoiceLineItem, SupplierCurrency } from "@/lib/types";
import { formatSupplierMoney } from "@/lib/firestore/supplierOrders";

// 협력사(공급사) → HANDYHAND 방향 청구서 — SupplierOrderDocument(우리가 협력사에게 내는
// 발주서)와 발행 주체가 정반대다. 여기서는 협력사가 발행처, HANDYHAND가 수신처(청구 대상)라
// 직인은 넣지 않는다 — 실제 날인은 협력사가 자기 쪽에서 하는 것이라 우리 문서에 빈 칸을
// 둘 이유가 없다(발주서에서 공급사 직인란을 안 두는 것과 같은 이유).
export interface SupplierInvoiceDocumentData {
  invoiceNumber: string;
  partnerName: string;
  currency: SupplierCurrency;
  items: SupplierInvoiceLineItem[];
  totalAmount: number;
  memo?: string;
  submittedAt: number;
}

const KR_COMPANY = {
  nameKo: "주식회사 핸디핸드",
  bizNo: "128-87-00105",
};

export default function SupplierInvoiceDocument({ data }: { data: SupplierInvoiceDocumentData }) {
  const issuedDate = new Date(data.submittedAt).toLocaleDateString("en-CA");

  return (
    <div className="po-page flex w-[210mm] min-h-[297mm] flex-col bg-white p-[16mm] text-[#1d1d1f] shadow-xl print:w-full">
      <div className="flex items-start justify-between border-b-2 border-[#1d1d1f] pb-6">
        <div>
          <p className="text-3xl font-bold tracking-tight">청구서</p>
          <p className="mt-1 text-xs tracking-wide text-[#86868b]">INVOICE</p>
        </div>
        <div className="text-right text-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-handyhand-trim.png" alt="HANDYHAND" className="ml-auto h-[22px] object-contain" style={{ filter: "brightness(0)" }} />
          <p className="mt-1.5 text-xs text-[#86868b]">제품기획 · 설계 · 개발 · 금형 · 양산</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
        <div className="space-y-1.5">
          <Row label="발행처" value={data.partnerName || "-"} />
          <Row label="청구서 번호" value={data.invoiceNumber} />
          <Row label="제출일" value={issuedDate} />
        </div>
        <div className="space-y-1.5">
          <Row label="청구 대상" value={KR_COMPANY.nameKo} />
          <Row label="사업자번호" value={KR_COMPANY.bizNo} />
        </div>
      </div>

      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y-2 border-[#1d1d1f] text-xs">
            <th className="w-8 py-2.5 pr-2 text-left font-semibold">순번</th>
            <th className="py-2.5 pr-2 text-left font-semibold">내용</th>
            <th className="w-28 py-2.5 pl-2 text-right font-semibold">금액</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((it, i) => (
            <tr key={it.id} className="border-b border-[#e5e5e5] align-top">
              <td className="py-3 pr-2 text-[#86868b]">{i + 1}</td>
              <td className="py-3 pr-2">
                <p className="font-medium">{it.description}</p>
                {it.linkedProjectName && (
                  <p className="mt-0.5 text-xs text-[#86868b]">{it.linkedProjectName}{it.soNumber ? ` · ${it.soNumber}` : ""}</p>
                )}
              </td>
              <td className="whitespace-nowrap py-3 pl-2 text-right font-medium">{formatSupplierMoney(it.amount, data.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex justify-end">
        <div className="w-72 space-y-1 text-sm">
          <div className="flex items-center justify-between border-t-2 border-[#1d1d1f] pt-2 text-base font-bold">
            <span>합 계</span>
            <span>{formatSupplierMoney(data.totalAmount, data.currency)}</span>
          </div>
        </div>
      </div>

      {data.memo && (
        <div className="mt-6">
          <p className="mb-1.5 text-xs font-semibold text-[#86868b]">비고</p>
          <p className="rounded-xl bg-[#f5f5f7] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">{data.memo}</p>
        </div>
      )}

      <div className="mt-auto text-xs text-[#86868b]">
        <div className="mt-3 flex items-end justify-between border-t border-[#e5e5e5] pt-3">
          <p>HANDYWORKS 플랫폼에서 생성되었습니다.</p>
          <p>{data.partnerName}</p>
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
