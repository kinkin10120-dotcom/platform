"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { X, Copy, Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenPurchaseOrder } from "@/lib/firestore/purchaseOrders";
import { listenClient } from "@/lib/firestore/clients";
import { Client, PurchaseOrder } from "@/lib/types";
import { isIosDevice, isStandaloneMode } from "@/lib/pwa";
import PdfPageScaler from "@/components/PdfPageScaler";
import PurchaseOrderDocument from "@/components/PurchaseOrderDocument";

export default function PurchaseOrderPrintPage() {
  const { orderId } = useParams<{ orderId: string }>();
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
  // 여기서 발주번호-발주처명 형태로 지정해둔다.
  useEffect(() => {
    if (!order) return;
    document.title = `${order.poNumber}-${order.clientName}`;
  }, [order]);

  if (loading || order === undefined) return null;

  if (!order) {
    return <p className="p-10 text-center text-sm text-[#86868b]">발주 정보를 찾을 수 없습니다.</p>;
  }

  const allowed = appUser?.role === "admin" || appUser?.clientId === order.clientId;
  if (!allowed) {
    return <p className="p-10 text-center text-sm text-[#86868b]">접근 권한이 없습니다.</p>;
  }

  return (
    <div className="min-h-screen bg-[#e5e5e5] py-10 print:bg-white print:py-0">
      <style>{`
        @page { size: 210mm 297mm; margin: 0; }
        @media print {
          /* iOS Safari(AirPrint)는 @page margin:0을 무시하고 자체 여백을 적용하는 경우가 있어,
             210mm 고정폭 대신 실제 인쇄 가능 영역 100%를 쓰도록 강제한다 — 안 그러면 그 여백
             만큼 오른쪽 내용이 잘려나간다. min-height는 그대로 둔다 — 이 페이지는 한 장짜리라
             min-height를 0으로 풀면 하단 서명란이 flex(mt-auto)로 페이지 맨 아래에 붙지 못하고
             내용 바로 밑으로 떠올라, 화면 미리보기와 실제 인쇄 결과의 위치가 어긋난다. */
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
            <p className="text-sm text-[#86868b]">발주서 미리보기 — 인쇄 시 배경/여백이 자동 조정됩니다.</p>
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
        <PurchaseOrderDocument
          data={{
            poNumber: order.poNumber,
            clientName: order.clientName,
            orderedByName: order.orderedByName,
            items: order.items,
            memo: order.memo,
            signatureUrl: order.signatureUrl,
            signedByName: order.signedByName,
            status: order.status,
            createdAt: order.createdAt,
            confirmedAt: order.confirmedAt,
            client,
          }}
        />
      </PdfPageScaler>
    </div>
  );
}
