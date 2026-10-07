"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Package } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenSupplierOrdersByPartner, formatSupplierMoney, calcSupplierItemTotal, calcSupplierOrderBilledAmount } from "@/lib/firestore/supplierOrders";
import { SupplierOrder, SUPPLIER_ORDER_STATUS_LABEL, SUPPLIER_ORDER_INSTALLMENT_LABEL } from "@/lib/types";
import { zh, usePartnerZh, useZhAutoTranslate } from "@/lib/i18n";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-[#f5f5f7] text-[#86868b]",
  issued: "bg-green-50 text-green-600",
};

// 협력사(파트너) 계정 전용 — 관리자가 자기 앞으로 연동해둔(partnerId) 발주서만 보여준다.
// 금액·품목 등 내용은 어차피 본인이 받는 발주서라 그대로 보여준다 — 협력사에게 절대
// 노출하면 안 되는 건 클라이언트(고객)의 계약·견적이지, 협력사 자신의 발주 내역이 아니다.
export default function MySupplierOrdersPage() {
  const { appUser } = useAuth();
  const isPartner = appUser?.role === "partner";
  const isZh = usePartnerZh();
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!appUser || !isPartner) return;
    return listenSupplierOrdersByPartner(
      appUser.uid,
      (o) => {
        setLoadError("");
        setOrders(o);
        setLoaded(true);
      },
      (e) => {
        setLoadError(e.message);
        setLoaded(true);
      }
    );
  }, [appUser, isPartner]);

  // 아직 발행 전(작성중)인 발주는 관리자가 검토 중인 내부 문서라 협력사에게 보여줄 필요가
  // 없다 — "발행하기"를 눌러야 비로소 여기 목록에 나타난다.
  const visibleOrders = orders.filter((o) => o.status === "issued");

  const zhNotes = useZhAutoTranslate(isZh, visibleOrders.flatMap((o) => [o.memo ?? "", o.packingNote ?? ""]));

  if (appUser && !isPartner) {
    return <p className="text-sm text-[#86868b]">접근 권한이 없습니다.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-[#1d1d1f]">
          <span className="h-2 w-2 rounded-full bg-[#1d1d1f]" />
          {zh(isZh, "발주 목록")}
        </h1>
        <p className="mt-1 pl-4 text-sm text-[#86868b]">
          {zh(isZh, "HANDYHAND에서 발행한 발주서 내역입니다.")}
        </p>
      </div>

      {!loaded && <p className="text-sm text-[#86868b]">{zh(isZh, "불러오는 중...")}</p>}

      {loadError && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-xs text-red-600">
          {zh(isZh, "불러오지 못했습니다")}: {loadError}
        </p>
      )}

      {loaded && !loadError && visibleOrders.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#d1d1d6] bg-white py-16 text-center">
          <Package size={32} className="mb-3 text-[#d1d1d6]" />
          <p className="text-sm text-[#86868b]">{zh(isZh, "등록된 발주서가 없습니다.")}</p>
        </div>
      )}

      <div className="space-y-4">
        {visibleOrders.map((o) => (
          <div key={o.id} className="rounded-3xl bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 font-semibold text-[#1d1d1f]">
                  {o.soNumber}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[o.status]}`}>
                    {zh(isZh, SUPPLIER_ORDER_STATUS_LABEL[o.status])}
                  </span>
                  {o.installmentType && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${o.installmentType === "full" ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-600"}`}>
                      {zh(isZh, SUPPLIER_ORDER_INSTALLMENT_LABEL[o.installmentType])}
                    </span>
                  )}
                </p>
                {o.linkedProjectName && (
                  <p className="mt-0.5 text-xs text-[#86868b]">{o.linkedProjectName}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <p className="text-xs text-[#86868b]">
                  {new Date(o.issuedAt ?? o.createdAt).toLocaleDateString(isZh ? "zh-CN" : "ko-KR")}
                </p>
                {/* 새 탭이 아니라 같은 탭에서 연다 — 전용 인쇄 페이지의 "닫기" 버튼이
                    router.back()이라, 같은 탭 히스토리로 들어가야 닫을 때 이 목록으로
                    그대로 돌아온다. */}
                <Link
                  href={`/supplier-orders/${o.id}/print`}
                  className="flex items-center gap-1 rounded-full border border-[#d1d1d6] px-3 py-1.5 text-xs font-medium text-[#1d1d1f] transition hover:border-[#86868b]"
                >
                  <FileText size={12} />
                  {zh(isZh, "미리보기 / PDF")}
                </Link>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {o.items.map((it, i) => (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#f5f5f7] px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-[#1d1d1f]">{it.nameEn || it.name}</p>
                    {it.spec && <p className="text-xs text-[#86868b]">{it.spec}</p>}
                  </div>
                  <div className="shrink-0 text-right text-xs text-[#86868b]">
                    <p>{it.quantity.toLocaleString()}{it.unit ?? "EA"} × {formatSupplierMoney(it.unitPrice, o.currency)}</p>
                    <p className="font-semibold text-[#1d1d1f]">{formatSupplierMoney(calcSupplierItemTotal(it), o.currency)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#f0f0f0] pt-4">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#86868b]">
                {o.incoterms && <span>Incoterms: {o.incoterms}</span>}
                {o.portOfLoading && <span>{zh(isZh, "선적항")}: {o.portOfLoading}</span>}
                {o.leadTimeDays != null && <span>{zh(isZh, "납기")}: {o.leadTimeDays}{zh(isZh, "일")}</span>}
                {o.paymentTerms && <span>{zh(isZh, "결제조건")}: {o.paymentTerms}</span>}
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-[#1d1d1f]">{formatSupplierMoney(o.totalAmount, o.currency)}</p>
                {(o.installmentPercent ?? 100) < 100 && (
                  <p className="text-xs font-semibold text-blue-600">
                    {zh(isZh, "이번 청구")} ({o.installmentType ? zh(isZh, SUPPLIER_ORDER_INSTALLMENT_LABEL[o.installmentType]) : ""} {o.installmentPercent}%): {formatSupplierMoney(calcSupplierOrderBilledAmount(o), o.currency)}
                  </p>
                )}
              </div>
            </div>

            {o.packingNote && (
              <p className="mt-2 text-xs text-[#86868b]">
                {zh(isZh, "포장")}: {zhNotes[o.packingNote] || o.packingNote}
              </p>
            )}
            {o.memo && (
              <p className="mt-1 whitespace-pre-wrap text-xs text-[#86868b]">{zhNotes[o.memo] || o.memo}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
