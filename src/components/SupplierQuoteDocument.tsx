import { SupplierQuoteItem, SupplierCurrency, SupplierOrderKind, SUPPLIER_ORDER_KIND_CN, SUPPLIER_ORDER_KIND_LABEL } from "@/lib/types";
import { formatSupplierMoney } from "@/lib/firestore/supplierOrders";

// 협력사(공급사) → HANDYHAND 방향 견적서 — SupplierInvoiceDocument와 같은 이유로 직인은
// 넣지 않는다(협력사가 발행처, HANDYHAND가 수신처).
//
// 중국 협력사는 내용을 중국어로 적는다 — 관리자는 항상 한국어로 읽어야 하므로, 제출 시점에
// 미리 번역해둔 nameKo/memoKo를 lang="ko"일 때 우선 쓴다. lang 자체는 호출하는 쪽이 정한다 —
// 관리자는 항상 "ko"만 쓰고(토글 자체를 안 보여줌), 협력사 쪽 화면에서만 중문/한글 토글을 보여준다.
export interface SupplierQuoteDocumentData {
  quoteNumber: string;
  partnerName: string;
  currency: SupplierCurrency;
  items: SupplierQuoteItem[];
  totalAmount: number;
  orderKind?: SupplierOrderKind;
  linkedProjectName?: string;
  memo?: string;
  memoKo?: string;
  submittedAt: number;
}

const KR_COMPANY = {
  nameKo: "주식회사 핸디핸드",
  bizNo: "128-87-00105",
};

export default function SupplierQuoteDocument({ data, lang = "ko" }: { data: SupplierQuoteDocumentData; lang?: "ko" | "zh" }) {
  const issuedDate = new Date(data.submittedAt).toLocaleDateString("en-CA");
  const ko = lang === "ko";
  const L = (cn: string, kr: string) => (ko ? kr : cn);
  const memo = ko ? data.memoKo || data.memo : data.memo;

  return (
    <div className="po-page flex w-[210mm] min-h-[297mm] flex-col bg-white p-[16mm] text-[#1d1d1f] shadow-xl print:w-full">
      <div className="flex items-start justify-between border-b-2 border-[#1d1d1f] pb-6">
        <div>
          <p className="text-3xl font-bold tracking-tight">{L("报价单", "견적서")}</p>
          <p className="mt-1 text-xs tracking-wide text-[#86868b]">QUOTATION</p>
        </div>
        <div className="text-right text-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-handyhand-trim.png" alt="HANDYHAND" className="ml-auto h-[22px] object-contain" style={{ filter: "brightness(0)" }} />
          <p className="mt-1.5 text-xs text-[#86868b]">{L("产品规划·设计·开发·模具·量产", "제품기획 · 설계 · 개발 · 금형 · 양산")}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
        <div className="space-y-1.5">
          <Row label={L("报价方", "견적처")} value={data.partnerName || "-"} />
          <Row label={L("报价单号", "견적서 번호")} value={data.quoteNumber} />
          {data.linkedProjectName && <Row label={L("相关项目", "관련 프로젝트")} value={data.linkedProjectName} />}
          {data.orderKind && (
            <Row label={L("类别", "구분")} value={ko ? SUPPLIER_ORDER_KIND_LABEL[data.orderKind] : SUPPLIER_ORDER_KIND_CN[data.orderKind]} />
          )}
          <Row label={L("提交日期", "제출일")} value={issuedDate} />
        </div>
        <div className="space-y-1.5">
          <Row label={L("收件方", "제출 대상")} value={KR_COMPANY.nameKo} />
          <Row label={L("营业执照号", "사업자번호")} value={KR_COMPANY.bizNo} />
        </div>
      </div>

      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y-2 border-[#1d1d1f] text-xs">
            <th className="w-10 whitespace-nowrap py-2.5 pr-2 text-left font-semibold">{L("序号", "순번")}</th>
            <th className="py-2.5 pr-2 text-left font-semibold">{L("品名", "품명")}</th>
            <th className="w-20 py-2.5 pr-2 text-right font-semibold">{L("数量", "수량")}</th>
            <th className="w-24 py-2.5 pr-2 text-right font-semibold">{L("单价", "단가")}</th>
            <th className="w-28 py-2.5 pl-2 text-right font-semibold">{L("金额", "금액")}</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((it, i) => (
            <tr key={it.id} className="border-b border-[#e5e5e5] align-top">
              <td className="whitespace-nowrap py-3 pr-2 text-[#86868b]">{i + 1}</td>
              <td className="py-3 pr-2">
                <p className="font-medium">{ko ? it.nameKo || it.name : it.name}</p>
                {it.spec && <p className="mt-0.5 text-xs text-[#86868b]">{it.spec}</p>}
              </td>
              <td className="whitespace-nowrap py-3 pr-2 text-right text-[#86868b]">{it.quantity.toLocaleString()}{it.unit ?? "EA"}</td>
              <td className="whitespace-nowrap py-3 pr-2 text-right text-[#86868b]">{formatSupplierMoney(it.unitPrice, data.currency)}</td>
              <td className="whitespace-nowrap py-3 pl-2 text-right font-medium">{formatSupplierMoney(it.unitPrice * it.quantity, data.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex justify-end">
        <div className="w-72 space-y-1 text-sm">
          <div className="flex items-center justify-between border-t-2 border-[#1d1d1f] pt-2 text-base font-bold">
            <span>{L("合计", "합 계")}</span>
            <span>{formatSupplierMoney(data.totalAmount, data.currency)}</span>
          </div>
        </div>
      </div>

      {memo && (
        <div className="mt-6">
          <p className="mb-1.5 text-xs font-semibold text-[#86868b]">{L("备注", "비고")}</p>
          <p className="rounded-xl bg-[#f5f5f7] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">{memo}</p>
        </div>
      )}

      <div className="mt-auto text-xs text-[#86868b]">
        <div className="mt-3 flex items-end justify-between border-t border-[#e5e5e5] pt-3">
          <p>{L("由 HANDYWORKS 平台生成。", "HANDYWORKS 플랫폼에서 생성되었습니다.")}</p>
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
