"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { X, Copy, Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenPurchaseOrder } from "@/lib/firestore/purchaseOrders";
import { listenClient } from "@/lib/firestore/clients";
import { formatMoney, calcOrderTotals, DEFAULT_BANK_INFO } from "@/lib/orderCalc";
import { Client, PurchaseOrder } from "@/lib/types";
import { isIosDevice, isStandaloneMode } from "@/lib/pwa";
import PdfPageScaler from "@/components/PdfPageScaler";

export default function PurchaseOrderInvoicePage() {
  const { orderId, index } = useParams<{ orderId: string; index: string }>();
  const { firebaseUser, appUser, loading } = useAuth();
  const router = useRouter();
  const [order, setOrder] = useState<PurchaseOrder | null | undefined>(undefined);
  const [client, setClient] = useState<Client | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setStandalone(isIosDevice() && isStandaloneMode());
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
  // 여기서 청구서번호(INV-, 발주번호가 PO-여도 청구서는 항상 INV)-품목명 형태로 지정해둔다.
  useEffect(() => {
    if (!order?.payment) return;
    const installment = order.payment.installments[Number(index)];
    if (!installment?.issuedAt) return;
    const itemSummary = order.items.map((it) => it.productName).join(",");
    document.title = `${order.poNumber.replace(/^(PO|INV)-/, "INV-")}-${itemSummary}`;
  }, [order, index]);

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
  // 이 화면은 발주서가 아니라 청구서다 — 원 발주가 클라이언트가 보낸 것이든(PO-) 관리자가
  // 직접 등록한 것이든(INV-) 상관없이, 청구서에 찍히는 번호는 항상 INV로 보여준다.
  // poNumber 필드 자체(발주서 쪽에서 쓰는 진짜 발주번호)는 그대로 두고 화면 표시만 바꾼다.
  const invoiceNumber = order.poNumber.replace(/^(PO|INV)-/, "INV-");

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
            <p className="text-sm text-[#86868b]">청구서 미리보기 — 인쇄 시 배경/여백이 자동 조정됩니다.</p>
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
            홈 화면에 추가한 앱에서는 iOS 제한으로 인쇄/PDF 저장이 동작하지 않아요. 위 &quot;링크 복사&quot; 버튼으로 링크를 복사해서 사파리 브라우저에 붙여넣어 열어주세요.
          </p>
        )}
      </div>

      <PdfPageScaler>
        <div className="po-page flex w-[210mm] min-h-[297mm] flex-col bg-white p-[16mm] text-[#1d1d1f] shadow-xl print:w-full">
        <div className="flex items-start justify-between border-b-2 border-[#1d1d1f] pb-6">
          <div>
            <p className="text-3xl font-bold tracking-tight">청구서</p>
            <p className="mt-1 text-xs text-[#86868b]">INVOICE</p>
          </div>
          <div className="text-right text-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-handyhand-trim.png" alt="HANDYHAND" className="ml-auto h-[22px] object-contain" style={{ filter: "brightness(0)" }} />
            <p className="mt-1.5 text-xs text-[#86868b]">제품기획 · 설계 · 개발 · 금형 · 양산</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
          <div className="space-y-1.5">
            <Row label="청구번호" value={invoiceNumber} />
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
          const totals = calcOrderTotals(order.items);
          const grandTotal = totals.hasUsd && !totals.hasKrw ? totals.usdTotal : totals.krwTotal;
          const grandCurrency = totals.hasUsd && !totals.hasKrw ? "USD" : "KRW";
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
                  <td className="py-3 text-right text-lg font-bold">{installmentPayable.toLocaleString()}원</td>
                </tr>
              </tbody>
            </table>
          );
        })()}

        <div className="mt-4">
          <p className="mb-1 text-xs font-semibold text-[#86868b]">입금계좌 안내</p>
          <p className="whitespace-pre-wrap text-xs text-[#86868b]">
            {order.payment.note || DEFAULT_BANK_INFO}
          </p>
        </div>

        <div className="mt-8 flex justify-end">
          <div className="w-40 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/stamp.PNG" alt="HANDYHAND 직인" className="mx-auto h-[65px] object-contain" />
            <p className="mt-1 text-xs leading-relaxed text-[#86868b]">
              주식회사 핸디핸드
              <br />
              대표 최형준
            </p>
          </div>
        </div>

        <div className="mt-auto text-xs text-[#86868b]">
          {/* 발주/청구서는 계약서처럼 IP·기기 정보까지 남길 필요는 없다(이미 로그인된 계정이
              하는 동작이라 누가 했는지는 인증으로 확인됨) — 핵심 시점만 문서에 그대로 남겨서,
              나중에 "언제 확인·발행·입금됐는지" 분쟁이 생기면 인쇄물 자체가 근거가 되게 한다. */}
          <p className="mb-1.5 text-[10px] text-[#d1d1d6]">
            등록 {new Date(order.createdAt).toLocaleDateString("ko-KR")}
            {order.confirmedAt && ` · 확인 ${new Date(order.confirmedAt).toLocaleDateString("ko-KR")}`}
            {` · 발행 ${issuedDate}`}
            {installment.paidAt && ` · 입금확인 ${new Date(installment.paidAt).toLocaleDateString("ko-KR")}`}
          </p>
          <div className="flex items-end justify-between border-t border-[#e5e5e5] pt-3">
            <p>본 청구서는 HANDYWORKS 플랫폼에서 생성되었습니다.</p>
            <p>HANDYHAND</p>
          </div>
        </div>
        </div>
      </PdfPageScaler>
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
