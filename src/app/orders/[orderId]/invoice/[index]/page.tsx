"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { X, Copy, Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenPurchaseOrder } from "@/lib/firestore/purchaseOrders";
import { listenClient } from "@/lib/firestore/clients";
import { formatMoney, calcOrderTotals, DEFAULT_BANK_INFO, DEFAULT_BANK_INFO_USD } from "@/lib/orderCalc";
import { Client, PurchaseOrder } from "@/lib/types";
import { isIosDevice, isStandaloneMode, isInAppBrowser } from "@/lib/pwa";
import PdfPageScaler from "@/components/PdfPageScaler";

export default function PurchaseOrderInvoicePage() {
  const { orderId, index } = useParams<{ orderId: string; index: string }>();
  const searchParams = useSearchParams();
  const { firebaseUser, appUser, loading } = useAuth();
  const router = useRouter();
  const [order, setOrder] = useState<PurchaseOrder | null | undefined>(undefined);
  const [client, setClient] = useState<Client | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [copied, setCopied] = useState(false);
  // 같은 회차 금액을 거래처가 요구하는 형식에 맞게 청구서/영수증과 거래명세서 사이에서
  // 바로 바꿔 보여준다 — 별도 발행 절차 없이 같은 데이터를 다른 양식으로만 찍는다.
  const [docType, setDocType] = useState<"invoice" | "statement">(searchParams.get("doc") === "statement" ? "statement" : "invoice");

  useEffect(() => {
    setStandalone(isInAppBrowser() || (isIosDevice() && isStandaloneMode()));
  }, []);

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) router.replace(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
  }, [loading, firebaseUser, router]);

  useEffect(() => {
    if (!orderId) return;
    return listenPurchaseOrder(orderId, setOrder);
  }, [orderId]);

  useEffect(() => {
    if (!order) return;
    return listenClient(order.clientId, setClient);
  }, [order?.clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 모바일 "인쇄/PDF 저장"에서 제안되는 파일명은 document.title을 그대로 따르므로,
  // 여기서 청구서번호(INV-/RCP-)-품목명 형태로 지정해둔다.
  useEffect(() => {
    if (!order?.payment) return;
    const installment = order.payment.installments[Number(index)];
    if (!installment?.issuedAt) return;
    const itemSummary = order.items.map((it) => it.productName).join(",");
    const prefix = docType === "statement" ? "거래명세서-" : installment.paid ? "RCP-" : "INV-";
    document.title = `${order.poNumber.replace(/^(PO|INV|RCP)-/, prefix)}-${itemSummary}`;
  }, [order, index, docType]);

  if (loading || order === undefined) return null;

  if (!order) {
    return <p className="p-10 text-center text-sm text-[#86868b]">발주 정보를 찾을 수 없습니다.</p>;
  }

  const allowed = appUser?.role === "admin" || appUser?.clientId === order.clientId;
  if (!allowed) {
    return <p className="p-10 text-center text-sm text-[#86868b]">접근 권한이 없습니다.</p>;
  }

  const installmentIndex = Number(index);
  const installment = order.payment?.installments[installmentIndex];

  if (!order.payment || !installment || !installment.issuedAt) {
    return <p className="p-10 text-center text-sm text-[#86868b]">아직 발행되지 않은 청구서입니다.</p>;
  }

  const totalInstallments = order.payment.installments.length;
  const issuedDate = new Date(installment.issuedAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  // 문서를 발행하는 시점이 아니라 "지금 이 회차가 입금 확인된 상태인지"를 매번 다시 계산한다 —
  // 청구서 발행 전에 입금부터 확인된 경우(무통장입금을 먼저 받고 나중에 서류를 챙기는 경우 등)
  // "청구서"(아직 안 받은 돈을 청구하는 문서)라고 찍히면 앞뒤가 안 맞는다. 반대로 청구서를
  // 먼저 발행하고 나중에 입금이 확인돼도, 그 시점부터는 같은 문서가 곧 입금 증빙이 되므로
  // 영수증으로 자동 전환한다.
  const isReceipt = !!installment.paid;
  // 이 화면은 발주서가 아니라 청구서/영수증이다 — 원 발주가 클라이언트가 보낸 것이든(PO-) 관리자가
  // 직접 등록한 것이든(INV-) 상관없이, 찍히는 번호는 항상 INV/RCP로 보여준다.
  // poNumber 필드 자체(발주서 쪽에서 쓰는 진짜 발주번호)는 그대로 두고 화면 표시만 바꾼다.
  const invoiceNumber = order.poNumber.replace(/^(PO|INV|RCP)-/, isReceipt ? "RCP-" : "INV-");
  const totals = calcOrderTotals(order.items);
  // 달러(USD) 항목만으로 구성된 청구는 홍콩 법인(AIM TECHNOLOGY (HK) COMPANY) 명의로 발행한다.
  const isHk = totals.hasUsd && !totals.hasKrw;

  return (
    <div className="min-h-screen bg-[#e5e5e5] py-10 print:bg-white print:py-0">
      <style>{`
        @page { size: 210mm 297mm; margin: 0; }
        @media print {
          /* iOS Safari(AirPrint)는 @page margin:0을 무시하고 자체 여백을 적용하는 경우가 있어,
             210mm 고정폭 대신 실제 인쇄 가능 영역 100%를 쓰도록 강제한다 — 안 그러면 그 여백
             만큼 오른쪽 내용이 잘려나간다. min-height는 그대로 둔다 — 이 페이지는 한 장짜리라
             (계약서 미리보기처럼 여러 .po-page를 이어 붙이는 구조가 아니다) min-height를 0으로
             풀어버리면 하단 직인/푸터가 flex(mt-auto)로 페이지 맨 아래에 붙지 못하고 내용
             바로 밑으로 떠올라 썸네일(정상 크기 A4)과 실제 인쇄 결과의 푸터 위치가 어긋난다. */
          .po-page { box-shadow: none !important; margin: 0 !important; width: 100% !important; }
          .pdf-scale-wrapper { width: auto !important; height: auto !important; }
          .pdf-scale-inner { transform: none !important; width: auto !important; }
        }
      `}</style>

      <div className="mx-auto mb-6 w-full max-w-[210mm] px-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d1d1d6] text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
              title="닫기"
            >
              <X size={16} />
            </button>
            <p className="text-sm text-[#86868b]">{docType === "statement" ? "거래명세서" : isReceipt ? "영수증" : "청구서"} 미리보기 — 인쇄 시 배경/여백이 자동 조정됩니다.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-full border border-[#d1d1d6]">
              <button
                onClick={() => setDocType("invoice")}
                className={`px-3 py-1.5 text-xs font-medium ${docType === "invoice" ? "bg-[#1d1d1f] text-white" : "text-[#1d1d1f]"}`}
              >
                {isReceipt ? "영수증" : "청구서"}
              </button>
              <button
                onClick={() => setDocType("statement")}
                className={`px-3 py-1.5 text-xs font-medium ${docType === "statement" ? "bg-[#1d1d1f] text-white" : "text-[#1d1d1f]"}`}
              >
                거래명세서
              </button>
            </div>
          </div>
          {standalone ? (
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 rounded-full bg-[#1d1d1f] px-5 py-2 text-sm font-medium text-white transition hover:bg-black"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "복사됨" : "링크 복사"}
            </button>
          ) : (
            <button
              onClick={() => window.print()}
              className="rounded-full bg-[#1d1d1f] px-5 py-2 text-sm font-medium text-white transition hover:bg-black"
            >
              인쇄 / PDF 저장
            </button>
          )}
        </div>
        {standalone && (
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
            이 화면(홈 화면 추가 앱 또는 카카오톡·네이버 등 인앱 브라우저)에서는 인쇄/PDF 저장이 동작하지 않아요. 위 &quot;링크 복사&quot; 버튼으로 링크를 복사해서 사파리 브라우저에 붙여넣어 열어주세요.
          </p>
        )}
      </div>

      <PdfPageScaler>
        {docType === "statement" ? (
          <TransactionStatementBody
            order={order}
            client={client}
            installment={installment}
            installmentIndex={installmentIndex}
            totalInstallments={totalInstallments}
            invoiceNumber={invoiceNumber}
            issuedDate={issuedDate}
            isHk={isHk}
            totals={totals}
          />
        ) : (
        <div className="po-page flex w-[210mm] min-h-[297mm] flex-col bg-white p-[16mm] text-[#1d1d1f] shadow-xl print:w-full">
        <div className="flex items-start justify-between border-b-2 border-[#1d1d1f] pb-6">
          <div>
            <p className="text-3xl font-bold tracking-tight">{isReceipt ? "영수증" : "청구서"}</p>
            <p className="mt-1 text-xs text-[#86868b]">{isReceipt ? "RECEIPT" : "INVOICE"}</p>
          </div>
          <div className="text-right text-sm">
            {isHk ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/logo-aim-technology-hk.png" alt="AIM TECHNOLOGY (HK) COMPANY" className="ml-auto h-[30px] object-contain" />
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
            <Row label={isReceipt ? "영수증번호" : "청구번호"} value={invoiceNumber} />
            <Row label="발행일" value={issuedDate} />
            <Row label="청구 회차" value={`${installmentIndex + 1}/${totalInstallments}회차 (${installment.label})`} />
          </div>
          <div className="space-y-1.5">
            <Row label="청구 대상" value={order.clientName} />
            <Row label="담당자" value={order.orderedByName} />
            {client?.bizCompanyName && <Row label="기업명" value={client.bizCompanyName} />}
            {client?.bizCeoName && <Row label="대표자" value={client.bizCeoName} />}
            {client?.bizRegNumber && <Row label="사업자등록번호" value={client.bizRegNumber} />}
          </div>
        </div>

        <div className="mt-8">
          <p className="mb-1.5 text-xs font-semibold text-[#86868b]">품목</p>
          <p className="text-sm text-[#1d1d1f]">{order.items.map((it) => it.productName).join(", ")}</p>
        </div>

        {(() => {
          const grandTotal = isHk ? totals.usdTotal : totals.krwTotal;
          const grandCurrency = isHk ? "USD" : "KRW";
          const grandHasVat = grandCurrency === "KRW" && totals.krwVat > 0;

          const vatRatio = totals.krwSupply > 0 ? totals.krwVat / totals.krwSupply : 0;
          const installmentVat = Math.round(installment.amount * vatRatio);
          const installmentPayable = installment.amount + installmentVat;

          const percentage = grandTotal > 0 ? Math.round((installmentPayable / grandTotal) * 100) : 0;

          return (
            <table className="mt-8 w-full border-collapse text-sm">
              <tbody>
                {grandHasVat ? (
                  <>
                    <tr className="border-t-2 border-[#1d1d1f]">
                      <td className="py-2.5 text-[#86868b]">발주 공급가액 (VAT 별도)</td>
                      <td className="py-2.5 text-right text-[#86868b]">{formatMoney(totals.krwSupply, "KRW")}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 text-[#86868b]">부가세</td>
                      <td className="py-2.5 text-right text-[#86868b]">{formatMoney(totals.krwVat, "KRW")}</td>
                    </tr>
                    <tr className="border-t border-[#e5e5e5]">
                      <td className="py-2.5 text-[#86868b]">발주 총액 (VAT 포함)</td>
                      <td className="py-2.5 text-right text-[#86868b]">{formatMoney(grandTotal, grandCurrency)}</td>
                    </tr>
                  </>
                ) : (
                  <tr className="border-t-2 border-[#1d1d1f]">
                    <td className="py-2.5 text-[#86868b]">발주 총액{grandCurrency === "KRW" ? " (VAT 없음)" : ""}</td>
                    <td className="py-2.5 text-right text-[#86868b]">{formatMoney(grandTotal, grandCurrency)}</td>
                  </tr>
                )}
                <tr className="border-t border-[#e5e5e5]">
                  <td className="py-2.5 text-[#86868b]">청구 비율 · {installment.label} ({installmentIndex + 1}/{totalInstallments}회차)</td>
                  <td className="py-2.5 text-right text-[#86868b]">{percentage}%</td>
                </tr>
                {installmentVat > 0 && (
                  <>
                    <tr className="border-t border-[#e5e5e5]">
                      <td className="py-2.5 text-[#86868b]">청구 공급가액 (VAT 별도)</td>
                      <td className="py-2.5 text-right text-[#86868b]">{installment.amount.toLocaleString()}원</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 text-[#86868b]">부가세</td>
                      <td className="py-2.5 text-right text-[#86868b]">{installmentVat.toLocaleString()}원</td>
                    </tr>
                  </>
                )}
                <tr className="border-t-2 border-[#1d1d1f]">
                  <td className="py-3 text-lg font-bold">청구 금액 {installmentVat > 0 ? "(VAT 포함)" : ""}</td>
                  <td className="py-3 text-right text-lg font-bold">{formatMoney(installmentPayable, grandCurrency)}</td>
                </tr>
              </tbody>
            </table>
          );
        })()}

        <div className="mt-4">
          <p className="mb-1 text-xs font-semibold text-[#86868b]">입금계좌 안내</p>
          <p className="whitespace-pre-wrap text-xs text-[#86868b]">
            {order.payment.note || (isHk ? DEFAULT_BANK_INFO_USD : DEFAULT_BANK_INFO)}
          </p>
        </div>

        <div className="mt-auto text-xs text-[#86868b]">
          <div className="flex justify-end">
            <div className="w-40 text-center">
              {isHk ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/stamp-aim-technology-hk.png" alt="AIM TECHNOLOGY (HK) COMPANY 직인" className="mx-auto h-[65px] object-contain" />
                  <p className="mt-1 text-xs leading-relaxed text-[#86868b]">AIM TECHNOLOGY (HK) COMPANY</p>
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

          {/* 발주/청구서는 계약서처럼 IP·기기 정보까지 남길 필요는 없다(이미 로그인된 계정이
              하는 동작이라 누가 했는지는 인증으로 확인됨) — 핵심 시점만 문서에 그대로 남겨서,
              나중에 "언제 확인·발행·입금됐는지" 분쟁이 생기면 인쇄물 자체가 근거가 되게 한다. */}
          <p className="mb-1.5 mt-3 text-[10px] text-[#d1d1d6]">
            등록 {new Date(order.createdAt).toLocaleDateString("ko-KR")}
            {order.confirmedAt && ` · 확인 ${new Date(order.confirmedAt).toLocaleDateString("ko-KR")}`}
            {` · 발행 ${issuedDate}`}
            {installment.paidAt && ` · 입금확인 ${new Date(installment.paidAt).toLocaleDateString("ko-KR")}`}
          </p>
          <div className="flex items-end justify-between border-t border-[#e5e5e5] pt-3">
            <p>본 {isReceipt ? "영수증" : "청구서"}는 HANDYWORKS 플랫폼에서 생성되었습니다.</p>
            <p>{isHk ? "AIM TECHNOLOGY (HK) COMPANY" : "HANDYHAND"}</p>
          </div>
        </div>
        </div>
        )}
      </PdfPageScaler>
    </div>
  );
}

// 거래처에 따라 청구서·영수증 대신 거래명세서 양식이 필요한 경우가 있다 — 공급자/공급받는자
// 두 박스와 품목별 공급가액·세액 줄로 구성되는 표준 양식으로, 같은 회차 금액(installment)만
// 담는다(여러 회차로 나뉘어도 거래명세서는 항상 그 회차 금액 기준 1장).
function TransactionStatementBody({
  order,
  client,
  installment,
  installmentIndex,
  totalInstallments,
  invoiceNumber,
  issuedDate,
  isHk,
  totals,
}: {
  order: PurchaseOrder;
  client: Client | null;
  installment: { label: string; amount: number };
  installmentIndex: number;
  totalInstallments: number;
  invoiceNumber: string;
  issuedDate: string;
  isHk: boolean;
  totals: ReturnType<typeof calcOrderTotals>;
}) {
  const grandCurrency = isHk ? "USD" : "KRW";
  const vatRatio = totals.krwSupply > 0 ? totals.krwVat / totals.krwSupply : 0;
  const installmentVat = grandCurrency === "KRW" ? Math.round(installment.amount * vatRatio) : 0;
  const installmentPayable = installment.amount + installmentVat;
  const statementNumber = invoiceNumber.replace(/^(PO|INV|RCP)-/, "STMT-");
  const itemSummary = order.items.map((it) => it.productName).join(", ");

  return (
    <div className="po-page flex w-[210mm] min-h-[297mm] flex-col bg-white p-[16mm] text-[#1d1d1f] shadow-xl print:w-full">
      <div className="flex items-start justify-between border-b-2 border-[#1d1d1f] pb-6">
        <div>
          <p className="text-3xl font-bold tracking-tight">거래명세서</p>
          <p className="mt-1 text-xs text-[#86868b]">TRANSACTION STATEMENT · 공급받는자 보관용</p>
        </div>
        {isHk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/logo-aim-technology-hk.png" alt="AIM TECHNOLOGY (HK) COMPANY" className="h-[30px] object-contain" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/logo-handyhand-trim.png" alt="HANDYHAND" className="h-[22px] object-contain" style={{ filter: "brightness(0)" }} />
        )}
      </div>

      <div className="mt-6 flex items-center justify-between text-sm">
        <Row label="문서번호" value={statementNumber} />
        <Row label="작성일자" value={issuedDate} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div className="rounded-xl border border-[#e5e5e5] p-3">
          <p className="mb-1.5 text-xs font-semibold text-[#86868b]">공급자</p>
          <div className="space-y-1">
            {isHk ? (
              <>
                <Row label="상호" value="AIM TECHNOLOGY (HK) COMPANY" />
                <Row label="주소" value="11/F, CNT House, 120 Johnston Rd., Wanchai, Hong Kong" />
              </>
            ) : (
              <>
                <Row label="등록번호" value="128-87-00105" />
                <Row label="상호" value="주식회사 핸디핸드" />
                <Row label="성명" value="최형준" />
                <Row label="사업장주소" value="경기도 고양시 덕양구 삼원로63 고양아크비즈지식산업센터 F804호" />
              </>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-[#e5e5e5] p-3">
          <p className="mb-1.5 text-xs font-semibold text-[#86868b]">공급받는자</p>
          <div className="space-y-1">
            {client?.bizRegNumber && <Row label="등록번호" value={client.bizRegNumber} />}
            <Row label="상호" value={client?.bizCompanyName || order.clientName} />
            {client?.bizCeoName && <Row label="성명" value={client.bizCeoName} />}
            <Row label="담당자" value={order.orderedByName} />
            {client?.bizAddress && <Row label="사업장주소" value={client.bizAddress} />}
          </div>
        </div>
      </div>

      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y-2 border-[#1d1d1f] text-xs">
            <th className="py-2.5 pr-2 text-left font-semibold">품목</th>
            <th className="w-20 py-2.5 pr-2 text-center font-semibold">수량</th>
            <th className="w-28 py-2.5 pr-2 text-right font-semibold">공급가액</th>
            <th className="w-24 py-2.5 pl-2 text-right font-semibold">세액</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-[#e5e5e5] align-top">
            <td className="py-3 pr-2">
              <p className="font-medium">{itemSummary}</p>
              <p className="mt-0.5 text-xs text-[#86868b]">{installment.label} ({installmentIndex + 1}/{totalInstallments}회차)</p>
            </td>
            <td className="whitespace-nowrap py-3 pr-2 text-center text-[#86868b]">1</td>
            <td className="whitespace-nowrap py-3 pr-2 text-right text-[#86868b]">{formatMoney(installment.amount, grandCurrency)}</td>
            <td className="whitespace-nowrap py-3 pl-2 text-right text-[#86868b]">{installmentVat > 0 ? formatMoney(installmentVat, grandCurrency) : "-"}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-3 flex justify-end">
        <div className="w-72 space-y-1 text-sm">
          <div className="flex items-center justify-between border-t-2 border-[#1d1d1f] pt-2 text-base font-bold">
            <span>합계금액</span>
            <span>{formatMoney(installmentPayable, grandCurrency)}</span>
          </div>
        </div>
      </div>

      <div className="mt-auto text-xs text-[#86868b]">
        <div className="flex justify-end">
          <div className="w-40 text-center">
            {isHk ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/stamp-aim-technology-hk.png" alt="AIM TECHNOLOGY (HK) COMPANY 직인" className="mx-auto h-[65px] object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/stamp.PNG" alt="HANDYHAND 직인" className="mx-auto h-[65px] object-contain" />
            )}
          </div>
        </div>
        <div className="flex items-end justify-between border-t border-[#e5e5e5] pt-3 mt-3">
          <p>본 거래명세서는 HANDYWORKS 플랫폼에서 생성되었습니다.</p>
          <p>{isHk ? "AIM TECHNOLOGY (HK) COMPANY" : "HANDYHAND"}</p>
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
