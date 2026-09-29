"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenSupplierOrder, setSupplierOrderStatus } from "@/lib/firestore/supplierOrders";
import { SupplierOrder } from "@/lib/types";
import PdfPageScaler from "@/components/PdfPageScaler";
import SupplierOrderDocument from "@/components/SupplierOrderDocument";
import { zh, usePartnerZh } from "@/lib/i18n";

// 구매발주서 인쇄 전용 페이지.
//
// 처음엔 발주 관리 화면 안에서 그대로 인쇄하려고 "나머지 요소를 숨기는" 방식을 썼는데, 그
// 방식은 숨긴 요소들이 자리는 그대로 차지해서 빈 두 번째 장이 계속 생겼다. 잘 동작하는
// 발주서·청구서 인쇄가 전부 이렇게 (app) 레이아웃 바깥의 독립 라우트인 이유가 그것이다 —
// 사이드바·상단바가 아예 없으니 숨길 것도, 높이를 억지로 맞출 것도 없다.
//
// 그래서 인쇄 CSS도 저쪽과 똑같이 최소한만 둔다. 특히 .po-page의 min-height(297mm)는 절대
// 건드리지 않는다 — 0으로 풀면 하단 직인이 mt-auto로 페이지 맨 아래에 붙지 못하고 총계
// 바로 밑으로 떠올라, 화면 미리보기와 인쇄 결과가 어긋난다.
export default function SupplierOrderPrintPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { firebaseUser, appUser, loading } = useAuth();
  const isZh = usePartnerZh();
  const router = useRouter();
  const [order, setOrder] = useState<SupplierOrder | null | undefined>(undefined);

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) router.replace(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
  }, [loading, firebaseUser, router]);

  useEffect(() => {
    if (!orderId) return;
    return listenSupplierOrder(orderId, setOrder);
  }, [orderId]);

  // 발주서를 뽑는 시점이 곧 공장에 보내는 시점이라, 이 페이지를 열면 "발행됨"으로 올린다 —
  // 별도 "발행 처리" 버튼을 두면 누르는 걸 잊어버려 상태가 실제와 어긋난다.
  useEffect(() => {
    if (!order || order.status !== "draft") return;
    if (appUser?.role !== "admin") return;
    setSupplierOrderStatus(order.id, "issued").catch(() => {});
  }, [order, appUser?.role]);

  // 인쇄/PDF 저장 대화상자가 제안하는 파일명은 document.title을 그대로 따른다.
  useEffect(() => {
    if (!order) return;
    document.title = `${order.soNumber}-${order.supplierName}`;
  }, [order]);

  if (loading || order === undefined) return null;

  // 매입 원가가 담긴 문서라 원래는 관리자만 볼 수 있었는데, 이 발주서를 실제로 받는
  // 협력사 계정(partnerId로 연동됨)에게는 자기 발주서 열람만 예외로 허용한다. Firestore
  // 규칙(supplierOrders — partnerId == 본인 uid)이 이미 막지만, 화면에서도 한 번 더 막는다.
  const canView = appUser?.role === "admin" || (appUser?.role === "partner" && !!order && order.partnerId === appUser.uid);
  if (!canView) {
    return <p className="p-10 text-center text-sm text-[#86868b]">{zh(isZh, "접근 권한이 없습니다.")}</p>;
  }

  if (!order) {
    return <p className="p-10 text-center text-sm text-[#86868b]">{zh(isZh, "구매발주 정보를 찾을 수 없습니다.")}</p>;
  }

  return (
    <div className="min-h-screen bg-[#e5e5e5] py-10 print:bg-white print:py-0">
      <style>{`
        @page { size: 210mm 297mm; margin: 0; }
        @media print {
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
              title={zh(isZh, "닫기")}
            >
              <X size={16} />
            </button>
            <p className="text-sm text-[#86868b]">{order.soNumber} — {zh(isZh, "인쇄 시 A4 크기로 저장됩니다.")}</p>
          </div>
          <button
            onClick={() => window.print()}
            className="rounded-full bg-[#1d1d1f] px-5 py-2 text-sm font-medium text-white transition hover:bg-black"
          >
            {zh(isZh, "인쇄 / PDF 저장")}
          </button>
        </div>
      </div>

      <PdfPageScaler>
        <SupplierOrderDocument data={{ ...order, createdAt: order.createdAt }} />
      </PdfPageScaler>
    </div>
  );
}
