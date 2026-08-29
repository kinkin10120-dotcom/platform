"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Minus, Plus, ShoppingCart, Printer, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenClient } from "@/lib/firestore/clients";
import { listenClientProducts } from "@/lib/firestore/products";
import { listenMyPurchaseOrders, createPurchaseOrder, requestOrderCancel } from "@/lib/firestore/purchaseOrders";
import { formatMoney, calcOrderTotals } from "@/lib/orderCalc";
import OrderTotalsBox from "@/components/OrderTotalsBox";
import SignaturePad from "@/components/SignaturePad";
import PdfPageScaler from "@/components/PdfPageScaler";
import PurchaseOrderDocument from "@/components/PurchaseOrderDocument";
import { Client, ClientProduct, PurchaseOrder, PurchaseOrderStatus, PURCHASE_ORDER_STATUS_LABEL } from "@/lib/types";

const STATUS_STYLE: Record<PurchaseOrderStatus, string> = {
  received: "bg-amber-50 text-amber-600",
  confirmed: "bg-blue-50 text-blue-600",
  in_production: "bg-purple-50 text-purple-600",
  shipped: "bg-green-50 text-green-600",
  cancelled: "bg-red-50 text-red-500",
};

export default function MyOrdersPage() {
  const { appUser } = useAuth();
  const [tab, setTab] = useState<"new" | "history">("new");
  const [client, setClient] = useState<Client | null>(null);
  const [products, setProducts] = useState<ClientProduct[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [memo, setMemo] = useState("");
  const [signatureBlob, setSignatureBlob] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState("");

  const clientId = appUser?.clientId;

  // 서명 패드는 아직 업로드되지 않은 로컬 Blob이라, 미리보기에서 실제 발주서와 똑같은
  // <img>로 보여주려면 임시 object URL이 필요하다 — 발주서 본문(PurchaseOrderDocument)은
  // signatureUrl 문자열 하나만 받으므로, 제출 후 실제 업로드된 URL을 받는 것과 동일한
  // 모양으로 맞춰준다.
  useEffect(() => {
    if (!signatureBlob) {
      setSignaturePreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(signatureBlob);
    setSignaturePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [signatureBlob]);

  useEffect(() => {
    if (!clientId) return;
    return listenClient(clientId, setClient);
  }, [clientId]);

  useEffect(() => {
    if (!clientId) return;
    return listenClientProducts(clientId, (ps) => setProducts(ps.filter((p) => p.active)));
  }, [clientId]);

  useEffect(() => {
    if (!clientId) return;
    return listenMyPurchaseOrders(clientId, setOrders);
  }, [clientId]);

  const cartItems = useMemo(
    () => products.filter((p) => (cart[p.id] ?? 0) > 0).map((p) => ({ product: p, quantity: cart[p.id] })),
    [products, cart]
  );

  function setQty(id: string, qty: number) {
    setCart((prev) => ({ ...prev, [id]: Math.max(0, qty) }));
  }

  async function handleSubmit() {
    if (!appUser || !clientId || !client || cartItems.length === 0 || !signatureBlob) return;
    setSubmitting(true);
    try {
      await createPurchaseOrder({
        clientId,
        clientName: client.name,
        orderedBy: appUser.uid,
        orderedByName: appUser.name,
        items: cartItems.map(({ product, quantity }) => ({
          productId: product.id,
          productName: product.name,
          productImageUrl: product.imageUrl,
          unitPrice: product.unitPrice,
          currency: product.currency,
          vatApplicable: product.vatApplicable,
          unit: product.unit,
          quantity,
        })),
        memo: memo.trim() || undefined,
        signatureBlob: signatureBlob ?? undefined,
      });
      setCart({});
      setMemo("");
      setSignatureBlob(null);
      setPreviewOpen(false);
      setTab("history");
    } finally {
      setSubmitting(false);
    }
  }

  if (appUser?.role !== "client") {
    return <p className="text-sm text-[#86868b]">접근 권한이 없습니다.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-[#1d1d1f]">
            <span className="h-2 w-2 rounded-full bg-[#1d1d1f]" />
            발주하기
          </h1>
          <p className="mt-1 pl-4 text-sm text-[#86868b]">제품을 담아 발주를 넣고, 처리 상태를 확인합니다.</p>
        </div>
        <div className="flex rounded-full bg-[#1d1d1f] p-1">
          <button
            onClick={() => setTab("new")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${tab === "new" ? "bg-white text-[#1d1d1f] shadow-sm" : "text-white"}`}
          >
            새 발주
          </button>
          <button
            onClick={() => setTab("history")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${tab === "history" ? "bg-white text-[#1d1d1f] shadow-sm" : "text-white"}`}
          >
            발주 내역
          </button>
        </div>
      </div>

      {tab === "new" ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            {products.length === 0 && (
              <div className="rounded-3xl border border-dashed border-[#d1d1d6] bg-white p-10 text-center text-sm text-[#86868b]">
                등록된 제품이 없습니다. 담당자에게 문의해주세요.
              </div>
            )}
            {products.map((p) => {
              const qty = cart[p.id] ?? 0;
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#e5e5e5] bg-white p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    {p.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[#1d1d1f]">{p.name}</p>
                      <p className="mt-0.5 text-xs text-[#86868b]">
                        {formatMoney(p.unitPrice, p.currency)} (1{p.unit || "개"} 기준)
                        {p.currency === "KRW" && p.vatApplicable && <span className="ml-1">(VAT별도)</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => setQty(p.id, qty - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-[#d1d1d6] text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
                    >
                      <Minus size={13} />
                    </button>
                    <input
                      value={qty}
                      onChange={(e) => setQty(p.id, Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                      className="w-10 rounded-lg border border-[#d1d1d6] py-1 text-center text-sm outline-none focus:border-[#86868b]"
                    />
                    <button
                      onClick={() => setQty(p.id, qty + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-[#d1d1d6] text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="self-start space-y-4 rounded-3xl bg-white p-6">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-[#1d1d1f]">
              <ShoppingCart size={16} /> 선택한 제품
            </p>
            {cartItems.length === 0 ? (
              <p className="text-sm text-[#86868b]">선택한 제품이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {cartItems.map(({ product, quantity }) => (
                  <div key={product.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex min-w-0 items-center gap-3">
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <div className="h-16 w-16 shrink-0 rounded-xl bg-[#f5f5f7]" />
                      )}
                      <span className="truncate text-[#1d1d1f]">{product.name} × {quantity}</span>
                    </div>
                    <span className="shrink-0 text-[#86868b]">{formatMoney(product.unitPrice * quantity, product.currency)}</span>
                  </div>
                ))}
                <div className="-mx-6 overflow-hidden rounded-b-2xl">
                  <OrderTotalsBox
                    dark
                    items={cartItems.map(({ product, quantity }) => ({
                      productId: product.id,
                      productName: product.name,
                      unitPrice: product.unitPrice,
                      currency: product.currency,
                      vatApplicable: product.vatApplicable,
                      unit: product.unit,
                      quantity,
                    }))}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs text-[#86868b]">요청사항 (선택)</label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={2}
                placeholder="배송지, 납기 요청 등"
                className="w-full resize-none rounded-2xl border border-[#d1d1d6] px-3 py-2.5 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
              />
            </div>

            <SignaturePad onChange={setSignatureBlob} />
            {cartItems.length > 0 && !signatureBlob && (
              <p className="text-xs text-amber-600">서명 또는 직인을 등록해야 발주를 넣을 수 있어요.</p>
            )}

            <button
              onClick={() => setPreviewOpen(true)}
              disabled={submitting || cartItems.length === 0 || !signatureBlob}
              className="w-full rounded-full bg-[#1d1d1f] py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
            >
              발주 넣기
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.length === 0 && (
            <div className="rounded-3xl border border-dashed border-[#d1d1d6] bg-white p-10 text-center text-sm text-[#86868b]">
              발주 내역이 없습니다.
            </div>
          )}
          {orders.map((o) => (
            <MyOrderCard key={o.id} order={o} />
          ))}
        </div>
      )}

      {previewOpen && client && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#e5e5e5]">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#e5e5e5] bg-white/90 px-4 py-3 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d1d1d6] text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
                title="닫기"
              >
                <X size={16} />
              </button>
              <p className="text-sm text-[#86868b]">제출 전 마지막 확인입니다. 내용을 다시 한 번 확인해주세요.</p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-full bg-[#1d1d1f] px-5 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
            >
              {submitting ? "제출 중..." : "확정하고 제출하기"}
            </button>
          </div>
          <div className="px-4 py-8">
            <PdfPageScaler>
              <PurchaseOrderDocument
                data={{
                  clientName: client.name,
                  orderedByName: appUser?.name ?? "",
                  items: cartItems.map(({ product, quantity }) => ({
                    productName: product.name,
                    unitPrice: product.unitPrice,
                    currency: product.currency,
                    unit: product.unit,
                    quantity,
                  })),
                  memo: memo.trim() || undefined,
                  signatureUrl: signaturePreviewUrl || undefined,
                  signedByName: appUser?.name,
                  createdAt: Date.now(),
                  client,
                }}
              />
            </PdfPageScaler>
          </div>
        </div>
      )}
    </div>
  );
}

function MyOrderCard({ order: o }: { order: PurchaseOrder }) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 관리자가 "확인" 이상으로 넘긴 발주는 이미 처리에 들어간 상태라 클라이언트가 자체적으로
  // 취소 요청을 넣을 수 없다 — 접수(요청 검토 전) 단계에서만 가능.
  const canRequestCancel = o.status === "received" && !o.cancelRequested;

  async function handleRequestCancel() {
    setSubmitting(true);
    try {
      await requestOrderCancel(o, cancelReason.trim() || undefined);
      setCancelling(false);
      setCancelReason("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#e5e5e5] bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-[#1d1d1f]">{o.poNumber}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          {o.cancelRequested && o.status !== "cancelled" && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-500">취소 요청됨</span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[o.status]}`}>
            {PURCHASE_ORDER_STATUS_LABEL[o.status]}
          </span>
        </div>
      </div>
      <p className="mt-1 text-xs text-[#86868b] line-clamp-1">
        {o.items.map((i) => `${i.productName} × ${i.quantity}`).join(", ")}
      </p>
      <div className="mt-2 overflow-hidden rounded-xl border border-[#e5e5e5]">
        <OrderTotalsBox items={o.items} bordered={false} />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-[#d1d1d6]">{new Date(o.createdAt).toLocaleDateString("ko-KR")}</p>
        <Link
          href={`/orders/${o.id}/print`}
          className="flex items-center gap-1 text-xs font-medium text-[#1d1d1f] underline underline-offset-2"
        >
          <Printer size={12} /> 발주서 PDF
        </Link>
      </div>

      {o.payment && (() => {
        const orderTotals = calcOrderTotals(o.items);
        const isUsdOrder = orderTotals.hasUsd && !orderTotals.hasKrw;
        return (
        <div className="mt-3 space-y-2 rounded-xl bg-[#f5f5f7] px-3 py-2.5 text-xs">
          <p className="font-medium text-[#86868b]">결제 정보</p>
          {o.payment.installments.map((it, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[#1d1d1f]">{it.label} {formatMoney(it.amount, isUsdOrder ? "USD" : "KRW")}</span>
                <span className={it.paid ? "font-medium text-green-600" : "font-medium text-amber-600"}>
                  {it.paid ? "입금완료" : "입금대기"}
                </span>
              </div>
              {it.issuedAt && (
                <div className="flex justify-end">
                  <Link
                    href={`/orders/${o.id}/invoice/${i}`}
                    className="flex items-center gap-1 font-medium text-[#1d1d1f] underline underline-offset-2"
                  >
                    <Printer size={11} /> 청구서 PDF
                  </Link>
                </div>
              )}
            </div>
          ))}
          {o.payment.note && (
            <p className="whitespace-pre-wrap border-t border-[#e5e5e5] pt-1.5 text-[#86868b]">{o.payment.note}</p>
          )}
        </div>
        );
      })()}

      {canRequestCancel && (
        cancelling ? (
          <div className="mt-3 space-y-2 rounded-xl border border-[#e5e5e5] p-3">
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={2}
              placeholder="취소 사유 (선택 — 예: 수량을 잘못 입력했어요)"
              className="w-full resize-none rounded-lg border border-[#d1d1d6] px-2.5 py-2 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
            />
            <div className="flex gap-2">
              <button
                onClick={handleRequestCancel}
                disabled={submitting}
                className="flex-1 rounded-full bg-red-500 py-1.5 text-xs font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                취소 요청 보내기
              </button>
              <button
                onClick={() => setCancelling(false)}
                disabled={submitting}
                className="flex-1 rounded-full border border-[#d1d1d6] py-1.5 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
              >
                닫기
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCancelling(true)}
            className="mt-3 text-xs font-medium text-[#86868b] underline underline-offset-2 hover:text-red-500"
          >
            취소 요청
          </button>
        )
      )}
    </div>
  );
}
