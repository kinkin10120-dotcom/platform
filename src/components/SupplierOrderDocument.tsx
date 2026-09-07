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

// 외화(USD/CNY) 결제는 홍콩 법인(AIM TECHNOLOGY (HK) COMPANY) 명의로 발행한다 — 견적서·청구서와
// 같은 기준이다. 해외송금 계좌가 홍콩 법인 앞으로 되어 있어 원화 문서와 발행 주체를 분리한다.
const HK_COMPANY = {
  nameEn: "AIM TECHNOLOGY (HK) COMPANY",
  ceo: "CHOI HYUNGJUN",
};

const KR_COMPANY = {
  nameEn: "HANDYHAND CO., LTD.",
  nameKo: "주식회사 핸디핸드",
  bizNo: "128-87-00105",
  ceo: "CHOI HYUNGJUN",
};

export default function SupplierOrderDocument({ data }: { data: SupplierOrderDocumentData }) {
  const issuedDate = new Date(data.createdAt).toLocaleDateString("en-CA"); // YYYY-MM-DD
  const total = calcSupplierOrderTotal(data.items);
  const isHk = data.currency !== "KRW";
  const buyer = isHk ? HK_COMPANY : KR_COMPANY;

  return (
    <div className="po-page flex w-[210mm] min-h-[297mm] flex-col bg-white p-[16mm] text-[#1d1d1f] shadow-xl print:w-full">
      <div className="flex items-start justify-between border-b-2 border-[#1d1d1f] pb-6">
        <div>
          <p className="text-3xl font-bold tracking-tight">采购订单</p>
          <p className="mt-1 text-xs tracking-wide text-[#86868b]">PURCHASE ORDER</p>
        </div>
        {/* 견적서·청구서 헤더와 같은 구성 — 홍콩 법인은 로고만, 국내는 로고 + 사업 소개 한 줄. */}
        <div className="text-right text-sm">
          {isHk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/logo-aim-technology-hk.png" alt={HK_COMPANY.nameEn} className="ml-auto h-[30px] object-contain" />
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-handyhand-trim.png" alt="HANDYHAND" className="ml-auto h-[22px] object-contain" style={{ filter: "brightness(0)" }} />
              <p className="mt-1.5 text-xs text-[#86868b]">제품기획 · 설계 · 개발 · 금형 · 양산</p>
            </>
          )}
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
          <Row label="买方 / Buyer" value={buyer.nameEn} />
          <Row label="联系人 / Contact" value={buyer.ceo} />
          {!isHk && <Row label="税号 / Biz No." value={KR_COMPANY.bizNo} />}
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
                <div className="flex items-start gap-2.5">
                  {/* 사진이 있으면 함께 싣는다 — 공장이 품명만 보고 헷갈리는 걸 줄인다.
                      제품 이미지는 공개 읽기가 열린 경로라 인쇄 시에도 그대로 나온다. */}
                  {it.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded border border-[#e5e5e5] object-cover" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium">{it.nameEn || it.name}</p>
                    {it.spec && <p className="mt-0.5 text-xs text-[#86868b]">{it.spec}</p>}
                    {/* 조립품은 부품별 단가로 협의하므로 그 내역을 그대로 보여준다. 합계는 이미
                        오른쪽 단가에 반영되어 있어 따로 더하지 않는다. */}
                    {(it.parts ?? []).map((pt, pi) => (
                      <p key={pi} className="mt-0.5 pl-2 text-xs text-[#86868b]">
                        · {pt.nameEn || pt.name} {formatSupplierMoney(pt.unitPrice, data.currency)} × {pt.quantity}
                      </p>
                    ))}
                    {(it.costs ?? []).map((c, ci) => (
                      <p key={ci} className="mt-0.5 pl-2 text-xs text-[#86868b]">
                        + {c.name} : {formatSupplierMoney(c.amount, data.currency)}
                      </p>
                    ))}
                  </div>
                </div>
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

      <div className="mt-auto text-xs text-[#86868b]">
        {/* 발행 주체 직인 — 견적서·청구서와 같은 위치·같은 크기다. 공급사(공장) 직인란은 두지
            않는다: 도장은 공장이 회신본에 자기 양식대로 찍어 보내오므로 우리 문서에 빈 칸을
            만들어 둘 이유가 없다. */}
        <div className="flex justify-end">
          <div className="w-40 shrink-0 text-center">
            {isHk ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/stamp-aim-technology-hk.png" alt={`${HK_COMPANY.nameEn} 직인`} className="mx-auto h-[65px] object-contain" />
                <p className="mt-1.5 text-xs leading-relaxed text-[#86868b]">{HK_COMPANY.nameEn}</p>
              </>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/stamp.PNG" alt="HANDYHAND 직인" className="mx-auto h-[65px] object-contain" />
                <p className="mt-1 text-xs leading-relaxed text-[#86868b]">
                  주식회사 핸디핸드
                  <br />
                  대표 최형준
                </p>
              </>
            )}
          </div>
        </div>

        {/* 견적서·청구서와 달리 "HANDYWORKS 플랫폼에서 생성되었습니다" 문구는 넣지 않는다 —
            받는 쪽이 우리 고객이 아니라 해외 공장이라 우리 플랫폼 안내가 의미가 없다. */}
        <div className="mt-3 flex items-end justify-end border-t border-[#e5e5e5] pt-3">
          <p>{isHk ? HK_COMPANY.nameEn : "HANDYHAND"}</p>
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
