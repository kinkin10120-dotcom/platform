import { formatMoney, calcOrderTotals } from "@/lib/orderCalc";
import { QuoteLineItem } from "@/lib/firestore/quotes";

export interface QuoteDocumentData {
  quoteId: string;
  name: string;
  company?: string;
  items: QuoteLineItem[];
  quoteMemo?: string;
  quoteIssuedAt: number;
  quoteIssuedBy?: string;
}

export default function QuoteDocument({ data }: { data: QuoteDocumentData }) {
  const issuedDate = new Date(data.quoteIssuedAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  const totals = calcOrderTotals(data.items);

  return (
    <div className="po-page flex w-[210mm] min-h-[297mm] flex-col bg-white p-[16mm] text-[#1d1d1f] shadow-xl print:w-full">
      <div className="flex items-start justify-between border-b-2 border-[#1d1d1f] pb-6">
        <div>
          <p className="text-3xl font-bold tracking-tight">견적서</p>
          <p className="mt-1 text-xs text-[#86868b]">QUOTATION</p>
        </div>
        <div className="text-right text-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-handyhand-trim.png" alt="HANDYHAND" className="ml-auto h-[22px] object-contain" style={{ filter: "brightness(0)" }} />
          <p className="mt-1.5 text-xs text-[#86868b]">제품기획 · 설계 · 개발 · 금형 · 양산</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
        <div className="space-y-1.5">
          <Row label="수신" value={data.name} />
          {data.company && <Row label="기업명" value={data.company} />}
        </div>
        <div className="space-y-1.5">
          <Row label="발행일" value={issuedDate} />
          <Row label="발행" value="주식회사 핸디핸드" />
          <Row label="대표자" value="최형준" />
          <Row label="사업자번호" value="128-87-00105" />
          <Row label="주소" value="경기도 고양시 덕양구 삼원로63 고양아크비즈지식산업센터 F804호" />
        </div>
      </div>

      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y-2 border-[#1d1d1f] text-xs">
            <th className="py-2.5 pr-2 text-left font-semibold">No</th>
            <th className="py-2.5 pr-2 text-left font-semibold">품명</th>
            <th className="py-2.5 pr-2 text-right font-semibold">단가</th>
            <th className="py-2.5 pr-2 text-right font-semibold">수량</th>
            <th className="py-2.5 pl-2 text-right font-semibold">금액</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((it, i) => (
            <tr key={i} className="border-b border-[#e5e5e5]">
              <td className="py-3 pr-2 text-[#86868b]">{i + 1}</td>
              <td className="py-3 pr-2">{it.name}</td>
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
            <div className="flex items-center justify-between border-t-2 border-[#1d1d1f] pt-2 text-base font-bold">
              <span>{totals.hasUsd ? "합계 (KRW)" : "합계"}{totals.krwVat > 0 ? " (VAT별도)" : ""}</span>
              <span>{formatMoney(totals.krwSupply, "KRW")}</span>
            </div>
          )}
          {totals.hasUsd && (
            <div className="flex items-center justify-between border-t-2 border-[#1d1d1f] pt-2 text-base font-bold">
              <span>{totals.hasKrw ? "합계 (USD)" : "합계"}</span>
              <span>{formatMoney(totals.usdTotal, "USD")}</span>
            </div>
          )}
        </div>
      </div>

      {data.quoteMemo && (
        <div className="mt-8">
          <p className="mb-1.5 text-xs font-semibold text-[#86868b]">견적 조건 · 비고</p>
          <p className="rounded-xl bg-[#f5f5f7] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">{data.quoteMemo}</p>
        </div>
      )}

      <div className="mt-auto text-xs text-[#86868b]">
        <div className="flex justify-end">
          <div className="w-40 shrink-0 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/stamp.PNG" alt="HANDYHAND 직인" className="mx-auto h-[65px] object-contain" />
            <p className="mt-1 text-xs leading-relaxed text-[#86868b]">
              주식회사 핸디핸드
              <br />
              대표 최형준
            </p>
          </div>
        </div>

        <div className="flex items-end justify-between border-t border-[#e5e5e5] pt-3 mt-3">
          <p>본 견적서는 HANDYWORKS 플랫폼에서 생성되었습니다.</p>
          <p>HANDYHAND</p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-20 shrink-0 text-[#86868b]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
