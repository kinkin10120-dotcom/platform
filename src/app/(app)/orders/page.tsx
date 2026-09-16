"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Trash2, X, Plus, Minus, Printer, Upload, Check, FilePlus, Download, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenClients } from "@/lib/firestore/clients";
import { listenUsersByClient } from "@/lib/firestore/users";
import { listenProjectsByClient } from "@/lib/firestore/projects";
import { listenTasksByProject } from "@/lib/firestore/tasks";
import { formatMoney, calcOrderTotals, DEFAULT_BANK_INFO, DEFAULT_BANK_INFO_USD } from "@/lib/orderCalc";
import { downloadCsv } from "@/lib/csvExport";
import OrderTotalsBox from "@/components/OrderTotalsBox";
import SupplierOrdersTab from "@/components/SupplierOrdersTab";
import { listenSupplierOrders, formatSupplierMoney } from "@/lib/firestore/supplierOrders";
import {
  listenClientProducts,
  createClientProduct,
  updateClientProduct,
  deleteClientProduct,
  uploadClientProductImage,
} from "@/lib/firestore/products";
import {
  listenClientProductInternals,
  setClientProductInternal,
  deleteClientProductInternal,
} from "@/lib/firestore/productInternal";
import {
  listenAllPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  updatePurchaseOrderMemo,
  deletePurchaseOrder,
  setPurchaseOrderInstallments,
  markInstallmentPaid,
  unmarkInstallmentPaid,
  issueInstallmentInvoice,
  unissueInstallmentInvoice,
  setPurchaseOrderLinkedTask,
  dismissCancelRequest,
} from "@/lib/firestore/purchaseOrders";
import {
  AppUser,
  Client,
  ClientProduct,
  ClientProductInternal,
  PurchaseType,
  ShippingTerm,
  SHIPPING_TERM_LABEL,
  Currency,
  PurchaseOrder,
  PurchaseOrderStatus,
  PURCHASE_ORDER_STATUS_LABEL,
  Project,
  Task,
  SupplierCurrency,
  SupplierCostItem,
  SupplierOrder,
} from "@/lib/types";

const STATUS_STYLE: Record<PurchaseOrderStatus, string> = {
  received: "bg-amber-50 text-amber-600",
  confirmed: "bg-blue-50 text-blue-600",
  in_production: "bg-purple-50 text-purple-600",
  shipped: "bg-green-50 text-green-600",
  cancelled: "bg-red-50 text-red-500",
};

export default function OrdersPage() {
  const { appUser } = useAuth();
  const [tab, setTab] = useState<"orders" | "catalog" | "supplier" | "unpaid">("orders");
  // 구매발주서 미리보기 중에는 아래 헤더·탭을 감춰서 A4 문서만 꽉 차게 보이게 한다.
  const [supplierPreviewing, setSupplierPreviewing] = useState(false);

  if (appUser?.role !== "admin") {
    return <p className="text-sm text-[#86868b]">접근 권한이 없습니다.</p>;
  }

  return (
    <div className="space-y-6">
      <div className={`flex flex-wrap items-center justify-between gap-3 ${supplierPreviewing ? "hidden" : ""}`}>
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-[#1d1d1f]">
            <span className="h-2 w-2 rounded-full bg-[#1d1d1f]" />
            발주 관리
          </h1>
          <p className="mt-1 pl-4 text-sm text-[#86868b]">클라이언트 발주를 확인하고, 제품 카탈로그와 해외 구매발주를 관리합니다.</p>
        </div>
        <div className="flex rounded-full bg-[#1d1d1f] p-1">
          <button
            onClick={() => setTab("orders")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${tab === "orders" ? "bg-white text-[#1d1d1f] shadow-sm" : "text-white"}`}
          >
            고객 발주 목록
          </button>
          <button
            onClick={() => setTab("catalog")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${tab === "catalog" ? "bg-white text-[#1d1d1f] shadow-sm" : "text-white"}`}
          >
            제품 카탈로그
          </button>
          {/* 구매 발주(매입)는 이 관리자 전용 화면 안에만 둔다 — 고객이 들어올 수 있는 프로젝트
              화면에는 원가를 그리는 코드 자체를 만들지 않는다. */}
          <button
            onClick={() => setTab("supplier")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${tab === "supplier" ? "bg-white text-[#1d1d1f] shadow-sm" : "text-white"}`}
          >
            구매 발주
          </button>
          <button
            onClick={() => setTab("unpaid")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${tab === "unpaid" ? "bg-white text-[#1d1d1f] shadow-sm" : "text-white"}`}
          >
            미수금
          </button>
        </div>
      </div>

      {tab === "orders" ? (
        <OrdersTab />
      ) : tab === "catalog" ? (
        <CatalogTab />
      ) : tab === "supplier" ? (
        <SupplierOrdersTab onPreview={setSupplierPreviewing} />
      ) : (
        <UnpaidInstallmentsTab />
      )}
    </div>
  );
}

function OrdersTab() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => listenAllPurchaseOrders(setOrders), []);

  useEffect(() => {
    if (!selected) return;
    const fresh = orders.find((o) => o.id === selected.id);
    if (fresh) setSelected(fresh);
  }, [orders]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleStatus(status: PurchaseOrderStatus) {
    if (!selected) return;
    setSaving(true);
    try {
      await updatePurchaseOrderStatus(selected, status);
    } finally {
      setSaving(false);
    }
  }

  async function handleMemoSave() {
    if (!selected) return;
    setSaving(true);
    try {
      await updatePurchaseOrderMemo(selected.id, memo);
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!selected || deleteConfirmText !== DELETE_KEYWORD) return;
    await deletePurchaseOrder(selected.id);
    setSelected(null);
    setDeleteConfirmOpen(false);
    setDeleteConfirmText("");
  }

  const active = orders.filter((o) => o.status !== "shipped" && o.status !== "cancelled");
  const done = orders.filter((o) => o.status === "shipped" || o.status === "cancelled");

  // 세무/회계 처리용 — 화면에 보이는 발주 상태와 무관하게 전체 발주를 회차(installment) 단위로
  // 한 줄씩 뽑는다. 발주 총액이 아니라 회차별로 나누는 이유는, 실제 입금/미입금은 회차 단위로
  // 갈리기 때문에(선금 입금됐는데 잔금은 아직인 경우 등) 그래야 회계상 바로 쓸 수 있다.
  function handleExportCsv() {
    const rows: (string | number)[][] = [];
    for (const o of orders) {
      const totals = calcOrderTotals(o.items);
      const currency: Currency = totals.hasUsd && !totals.hasKrw ? "USD" : "KRW";
      const installments = o.payment?.installments ?? [];
      if (installments.length === 0) {
        rows.push([
          o.poNumber,
          o.clientName,
          o.orderedByName,
          o.items.map((it) => it.productName).join(" / "),
          PURCHASE_ORDER_STATUS_LABEL[o.status],
          currency,
          "", "", "", "", "",
          new Date(o.createdAt).toLocaleDateString("ko-KR"),
        ]);
        continue;
      }
      for (const it of installments) {
        rows.push([
          o.poNumber,
          o.clientName,
          o.orderedByName,
          o.items.map((i) => i.productName).join(" / "),
          PURCHASE_ORDER_STATUS_LABEL[o.status],
          currency,
          it.label,
          it.amount,
          it.paid ? "입금완료" : "미입금",
          it.issuedAt ? new Date(it.issuedAt).toLocaleDateString("ko-KR") : "",
          it.paidAt ? new Date(it.paidAt).toLocaleDateString("ko-KR") : "",
          new Date(o.createdAt).toLocaleDateString("ko-KR"),
        ]);
      }
    }
    downloadCsv(
      `발주내역_${new Date().toISOString().slice(0, 10)}.csv`,
      ["발주번호", "클라이언트", "담당자", "품목", "발주상태", "통화", "회차명", "회차금액", "입금상태", "청구발행일", "입금일", "발주등록일"],
      rows
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="space-y-2">
        <button
          onClick={() => setCreateOpen(true)}
          className="mb-1 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[#d1d1d6] py-2.5 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
        >
          <FilePlus size={14} /> 발주 없이 직접 등록 (청구서 전용)
        </button>
        {orders.length > 0 && (
          <button
            onClick={handleExportCsv}
            className="mb-1 flex w-full items-center justify-center gap-1.5 rounded-full border border-[#d1d1d6] py-2 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
          >
            <Download size={12} /> 전체 발주 내역 CSV 다운로드
          </button>
        )}

        {active.length > 0 && (
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">진행중 ({active.length})</p>
        )}
        {active.map((o) => (
          <OrderCard key={o.id} order={o} selected={selected?.id === o.id}
            onClick={() => { setSelected(o); setMemo(o.memo ?? ""); }} />
        ))}

        {done.length > 0 && (
          <button
            onClick={() => setShowDone((v) => !v)}
            className="mt-4 block text-xs font-medium text-[#86868b] underline underline-offset-2 hover:text-[#1d1d1f]"
          >
            {showDone ? "발행완료 숨기기" : `발행완료 ${done.length}건 숨겨짐 · 보기`}
          </button>
        )}
        {showDone && done.map((o) => (
          <OrderCard key={o.id} order={o} selected={selected?.id === o.id}
            onClick={() => { setSelected(o); setMemo(o.memo ?? ""); }} />
        ))}

        {orders.length === 0 && (
          <div className="rounded-3xl border border-dashed border-[#d1d1d6] bg-white p-10 text-center text-sm text-[#86868b]">
            접수된 발주가 없습니다.
          </div>
        )}
      </div>

      {selected && (
        <div className="rounded-3xl bg-white p-6 space-y-4 self-start">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-[#1d1d1f]">{selected.clientName}</p>
              <p className="mt-0.5 text-xs text-[#86868b]">
                {selected.poNumber} · {new Date(selected.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[selected.status]}`}>
                {PURCHASE_ORDER_STATUS_LABEL[selected.status]}
              </span>
              <button onClick={() => setDeleteConfirmOpen(true)} className="rounded-full p-1.5 text-[#d1d1d6] transition hover:bg-red-50 hover:text-red-500" title="삭제">
                <Trash2 size={15} />
              </button>
              <button onClick={() => { setSelected(null); setMemo(""); }} className="rounded-full p-1.5 text-[#d1d1d6] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]" title="닫기">
                <X size={15} />
              </button>
            </div>
          </div>

          {selected.cancelRequested && selected.status !== "cancelled" && (
            <CancelRequestBanner order={selected} />
          )}

          <LinkedSupplierOrders purchaseOrderId={selected.id} />

          <div className="overflow-hidden rounded-2xl border border-[#e5e5e5]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e5e5e5] bg-[#f5f5f7] text-xs text-[#86868b]">
                  <th className="px-3 py-2 text-left font-medium">제품명</th>
                  <th className="px-3 py-2 text-right font-medium">단가</th>
                  <th className="px-3 py-2 text-right font-medium">수량</th>
                  <th className="px-3 py-2 text-right font-medium">금액</th>
                </tr>
              </thead>
              <tbody>
                {selected.items.map((it, i) => (
                  <tr key={i} className={i > 0 ? "border-t border-[#f0f0f0]" : ""}>
                    <td className="px-3 py-2 text-[#1d1d1f]">
                      <div className="flex items-center gap-2">
                        {it.productImageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.productImageUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                        )}
                        <span>
                          {it.productName}
                          {it.vatApplicable && <span className="ml-1 text-[10px] text-[#86868b]">(VAT별도)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-[#86868b]">{formatMoney(it.unitPrice, it.currency)}</td>
                    <td className="px-3 py-2 text-right text-[#86868b]">{it.quantity} {it.unit || "개"}</td>
                    <td className="px-3 py-2 text-right font-medium text-[#1d1d1f]">{formatMoney(it.unitPrice * it.quantity, it.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <OrderTotalsBox items={selected.items} />
          </div>

          <PaymentSection order={selected} />
          <LinkedTaskPicker order={selected} />

          <div>
            <label className="mb-1.5 block text-xs text-[#86868b]">내부 메모</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              onBlur={handleMemoSave}
              rows={2}
              placeholder="담당자 메모 (고객에게 노출되지 않음)"
              className="w-full resize-none rounded-2xl border border-[#d1d1d6] px-3 py-2.5 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
            />
          </div>

          {selected.status !== "cancelled" && (
            <button
              onClick={() => handleStatus("confirmed")}
              disabled={saving || selected.status !== "received"}
              className={`flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-medium transition disabled:opacity-100 ${
                selected.status === "received"
                  ? "bg-black text-white hover:bg-[#1d1d1f]"
                  : "cursor-default bg-[#f5f5f7] text-[#1d1d1f]"
              }`}
            >
              {selected.status === "received" ? "확인 처리" : (
                <>
                  <Check size={15} /> 확인 완료
                  {selected.confirmedAt && (
                    <span className="font-normal text-[#86868b]">
                      ({new Date(selected.confirmedAt).toLocaleString("ko-KR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })})
                    </span>
                  )}
                </>
              )}
            </button>
          )}

          {/* "발주 없이 직접 등록"(청구서)은 회차별로 이미 정식 포맷의 청구서 PDF 링크가
              따로 있어서(위 결제 정보의 "청구서 발행하기"), 회차 구분 없이 뭉뚱그린 발주서
              출력 화면을 또 보여줄 필요가 없다 — 실제 클라이언트가 보낸 발주에서만 남긴다. */}
          {!selected.createdByAdmin && (
            <div className="border-t border-[#f0f0f0] pt-4">
              <Link
                href={`/orders/${selected.id}/print`}
                className="flex items-center justify-center gap-1.5 rounded-full border border-[#1d1d1f] py-2.5 text-xs font-medium text-[#1d1d1f] transition hover:bg-[#1d1d1f] hover:text-white"
              >
                <Printer size={14} /> 발주서 PDF
              </Link>
            </div>
          )}
        </div>
      )}

      {deleteConfirmOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setDeleteConfirmOpen(false)}>
          <div className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div>
              <h2 className="text-lg font-semibold text-[#1d1d1f]">발주 삭제</h2>
              <p className="mt-1.5 text-sm text-[#86868b]">
                <span className="font-medium text-[#1d1d1f]">{selected.poNumber}</span> 발주를 삭제합니다. 이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[#86868b]">
                삭제하려면 <span className="font-semibold text-[#1d1d1f]">{DELETE_KEYWORD}</span>를 입력하세요
              </label>
              <input
                autoFocus
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleConfirmDelete(); }}
                placeholder={DELETE_KEYWORD}
                className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setDeleteConfirmOpen(false); setDeleteConfirmText(""); }}
                className="rounded-full border border-[#d1d1d6] px-4 py-2 text-sm text-[#1d1d1f] hover:bg-[#f5f5f7]"
              >
                취소
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteConfirmText !== DELETE_KEYWORD}
                className="rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <AdminCreateOrderModal
          onClose={() => setCreateOpen(false)}
          onCreated={(order) => { setSelected(order); setMemo(order.memo ?? ""); setCreateOpen(false); }}
        />
      )}
    </div>
  );
}

function AdminCreateOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: (order: PurchaseOrder) => void }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [products, setProducts] = useState<ClientProduct[]>([]);
  const [clientUsers, setClientUsers] = useState<AppUser[]>([]);
  const [orderedByUid, setOrderedByUid] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  // 클라이언트를 자동으로 첫 번째 항목으로 선택해두면, 확인 안 하고 바로 등록·발송 버튼을
  // 눌러 엉뚱한 클라이언트에게 청구서가 나갈 위험이 있다 — 반드시 직접 선택하게 한다.
  useEffect(() => listenClients(setClients), []);

  useEffect(() => {
    if (!clientId) { setProducts([]); setClientUsers([]); setCart({}); return; }
    const unsubProducts = listenClientProducts(clientId, (ps) => setProducts(ps.filter((p) => p.active)));
    const unsubUsers = listenUsersByClient(clientId, (us) => {
      setClientUsers(us);
      setOrderedByUid((prev) => (us.some((u) => u.uid === prev) ? prev : us[0]?.uid ?? ""));
    });
    setCart({});
    return () => { unsubProducts(); unsubUsers(); };
  }, [clientId]);

  const client = clients.find((c) => c.id === clientId) ?? null;
  const orderedByUser = clientUsers.find((u) => u.uid === orderedByUid) ?? null;
  const cartItems = products.filter((p) => (cart[p.id] ?? 0) > 0).map((p) => ({ product: p, quantity: cart[p.id] }));

  function setQty(id: string, qty: number) {
    setCart((prev) => ({ ...prev, [id]: Math.max(0, qty) }));
  }

  async function handleSubmit() {
    if (!client || !orderedByUser || cartItems.length === 0) return;
    setSubmitting(true);
    setActionError("");
    try {
      const ref = await createPurchaseOrder({
        clientId: client.id,
        clientName: client.name,
        orderedBy: orderedByUser.uid,
        orderedByName: orderedByUser.name,
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
        createdByAdmin: true,
      });
      const created: PurchaseOrder = {
        id: ref.id,
        poNumber: "",
        clientId: client.id,
        clientName: client.name,
        orderedBy: orderedByUser.uid,
        orderedByName: orderedByUser.name,
        items: [],
        totalAmount: 0,
        status: "confirmed",
        createdByAdmin: true,
        memo: memo.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      onCreated(created);
    } catch (e: any) {
      setActionError(e?.message ?? "등록 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-3xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#1d1d1f]">발주 없이 직접 등록</h2>
            <p className="mt-1 text-xs text-[#86868b]">클라이언트 발주 없이 청구서를 보내야 할 때 씁니다. 서명 없이 바로 확인 완료 상태로 생성됩니다.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#d1d1d6] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]">
            <X size={15} />
          </button>
        </div>

        <div>
          <label className="mb-1.5 block text-xs text-[#86868b]">클라이언트</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
          >
            {/* clientId 초기값이 빈 문자열이어도 이 옵션이 없으면 브라우저가 첫 번째 클라이언트를
                자동 선택된 것처럼 보여준다 — 실수로 엉뚱한 클라이언트에게 청구서가 나갈 수 있어
                처음엔 반드시 아무것도 선택 안 된 상태로 보이게 한다. */}
            <option value="">선택 없음</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {clientId && (
          <div>
            <label className="mb-1.5 block text-xs text-[#86868b]">주문자로 기록할 담당자</label>
            {clientUsers.length === 0 ? (
              <p className="text-xs text-amber-600">이 클라이언트에 등록된 계정이 없습니다. 계정을 먼저 만들어주세요.</p>
            ) : (
              <select
                value={orderedByUid}
                onChange={(e) => setOrderedByUid(e.target.value)}
                className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
              >
                {clientUsers.map((u) => <option key={u.uid} value={u.uid}>{u.name} ({u.email})</option>)}
              </select>
            )}
          </div>
        )}

        {clientId && (
          <div className="space-y-2">
            <label className="block text-xs text-[#86868b]">품목</label>
            {products.length === 0 && (
              <p className="text-xs text-[#86868b]">등록된 제품이 없습니다. 제품 카탈로그에서 먼저 추가해주세요.</p>
            )}
            {products.map((p) => {
              const qty = cart[p.id] ?? 0;
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#e5e5e5] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-[#1d1d1f]">{p.name}</p>
                    <p className="mt-0.5 text-xs text-[#86868b]">{formatMoney(p.unitPrice, p.currency)} (1{p.unit || "개"} 기준)</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button onClick={() => setQty(p.id, qty - 1)} className="flex h-7 w-7 items-center justify-center rounded-full border border-[#d1d1d6] text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]">
                      <Minus size={13} />
                    </button>
                    <input
                      value={qty}
                      onChange={(e) => setQty(p.id, Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                      className="w-10 rounded-lg border border-[#d1d1d6] py-1 text-center text-sm outline-none focus:border-[#86868b]"
                    />
                    <button onClick={() => setQty(p.id, qty + 1)} className="flex h-7 w-7 items-center justify-center rounded-full border border-[#d1d1d6] text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]">
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {cartItems.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-[#e5e5e5]">
            <OrderTotalsBox
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
        )}

        <div>
          <label className="mb-1.5 block text-xs text-[#86868b]">내부 메모 (선택)</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
            placeholder="예: 초기 세팅비 별도 청구"
            className="w-full resize-none rounded-2xl border border-[#d1d1d6] px-3 py-2.5 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
          />
        </div>

        {actionError && <p className="text-xs text-red-500">{actionError}</p>}
        <button
          onClick={handleSubmit}
          disabled={submitting || !orderedByUser || cartItems.length === 0}
          className="w-full rounded-full bg-[#1d1d1f] py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
        >
          {submitting ? "등록 중..." : "등록하고 결제 정보 입력하기"}
        </button>
      </div>
    </div>
  );
}

function OrderCard({ order, selected, onClick }: { order: PurchaseOrder; selected: boolean; onClick: () => void }) {
  const totals = calcOrderTotals(order.items);
  const amountLabel = [
    totals.hasKrw ? formatMoney(totals.krwTotal, "KRW") : null,
    totals.hasUsd ? formatMoney(totals.usdTotal, "USD") : null,
  ].filter(Boolean).join(" + ");

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        selected ? "border-[#1d1d1f] bg-[#e5e5e5]" : "border-[#e5e5e5] bg-white hover:border-[#86868b]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-[#1d1d1f] truncate">
          {order.clientName}
          <span className="ml-1.5 text-xs font-normal text-[#86868b]">{order.poNumber}</span>
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          {order.cancelRequested && order.status !== "cancelled" && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-500">취소요청</span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[order.status]}`}>
            {PURCHASE_ORDER_STATUS_LABEL[order.status]}
          </span>
        </div>
      </div>
      <p className="mt-1 text-xs text-[#86868b] line-clamp-1">
        {order.items.map((i) => i.productName).join(", ")}
      </p>
      <p className="mt-1.5 text-xs text-[#d1d1d6]">
        {amountLabel} · {new Date(order.createdAt).toLocaleDateString("ko-KR")}
      </p>
    </button>
  );
}

function defaultInstallmentRows(order: PurchaseOrder) {
  return order.payment?.installments.map((it) => ({ label: it.label, amount: String(it.amount) }))
    ?? (() => {
      const half = Math.round(order.totalAmount / 2);
      return [
        { label: "선금", amount: String(half) },
        { label: "잔금", amount: String(order.totalAmount - half) },
      ];
    })();
}

function PaymentSection({ order }: { order: PurchaseOrder }) {
  const { appUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<{ label: string; amount: string }[]>(() => defaultInstallmentRows(order));
  // 달러(USD) 항목만으로 구성된 발주는 홍콩 법인(AIM TECHNOLOGY (HK) COMPANY) 해외송금 계좌가
  // 기본값이어야 한다 — 국내계좌로는 실제 USD 해외송금을 받을 수 없다.
  const orderIsHk = (() => {
    const t = calcOrderTotals(order.items);
    return t.hasUsd && !t.hasKrw;
  })();
  const defaultBankInfo = orderIsHk ? DEFAULT_BANK_INFO_USD : DEFAULT_BANK_INFO;
  const [note, setNote] = useState(order.payment?.note || defaultBankInfo);
  const [saving, setSaving] = useState(false);

  const rowsTotal = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  function startEdit() {
    setRows(defaultInstallmentRows(order));
    setNote(order.payment?.note || defaultBankInfo);
    setEditing(true);
  }

  function applyPreset(labels: string[]) {
    const even = Math.floor(order.totalAmount / labels.length);
    setRows(
      labels.map((label, i) => ({
        label,
        amount: String(i === labels.length - 1 ? order.totalAmount - even * (labels.length - 1) : even),
      }))
    );
  }

  function updateRow(i: number, patch: Partial<{ label: string; amount: string }>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addRow() {
    setRows((prev) => [...prev, { label: "", amount: "0" }]);
  }

  async function handleSave() {
    if (rows.length === 0 || rows.some((r) => !r.label.trim() || !r.amount)) return;
    // 회차를 저장하면 배열을 통째로 새로 만들어서, 이미 있던 입금확인·발행 기록이 전부
    // 초기화된다 — 라벨 하나만 고치려다 다른 회차의 입금확인까지 날리는 실수를 막기 위해
    // 지울 기록이 실제로 있을 때만 확인을 받는다.
    const hasExistingRecords = (order.payment?.installments ?? []).some((it) => it.paid || it.issuedAt);
    if (hasExistingRecords && !confirm("결제 정보를 저장하면 지금까지의 입금확인·발행 기록이 모두 초기화됩니다. 계속하시겠습니까?")) {
      return;
    }
    setSaving(true);
    try {
      await setPurchaseOrderInstallments(order, {
        installments: rows.map((r) => ({ label: r.label.trim(), amount: Number(r.amount) || 0 })),
        note: note.trim() || undefined,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkPaid(index: number) {
    if (!appUser) return;
    setSaving(true);
    try {
      await markInstallmentPaid(order, index, { uid: appUser.uid, name: appUser.name });
    } finally {
      setSaving(false);
    }
  }

  async function handleUnmarkPaid(index: number) {
    if (!confirm("입금 확인을 취소하시겠습니까? (잘못 누른 경우 되돌리는 용도입니다)")) return;
    setSaving(true);
    try {
      await unmarkInstallmentPaid(order, index);
    } finally {
      setSaving(false);
    }
  }

  async function handleIssue(index: number) {
    if (!confirm("이 회차 청구서를 발행하시겠습니까? 발행 후 PDF 다운로드가 가능합니다.")) return;
    setSaving(true);
    try {
      await issueInstallmentInvoice(order, index);
    } finally {
      setSaving(false);
    }
  }

  async function handleUnissue(index: number) {
    if (!confirm("발행을 취소하시겠습니까? 고객에게 취소 알림이 발송되고, 더 이상 문서를 열람할 수 없게 됩니다.")) return;
    setSaving(true);
    try {
      await unissueInstallmentInvoice(order, index);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="space-y-3 rounded-2xl border border-[#e5e5e5] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#86868b]">결제 정보 설정</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => applyPreset(["완납"])}
            className="rounded-full border border-[#d1d1d6] px-3 py-1.5 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
          >
            완납(1회)
          </button>
          <button
            type="button"
            onClick={() => applyPreset(["선금", "잔금"])}
            className="rounded-full border border-[#d1d1d6] px-3 py-1.5 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
          >
            2회 분할
          </button>
          <button
            type="button"
            onClick={() => applyPreset(["선금", "중도금", "잔금"])}
            className="rounded-full border border-[#d1d1d6] px-3 py-1.5 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
          >
            3회 분할
          </button>
        </div>

        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={r.label}
                onChange={(e) => updateRow(i, { label: e.target.value })}
                placeholder="회차명 (예: 선금)"
                className="w-24 shrink-0 rounded-xl border border-[#d1d1d6] px-2.5 py-2 text-sm outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
              />
              <input
                value={r.amount}
                onChange={(e) => updateRow(i, { amount: e.target.value.replace(/[^0-9]/g, "") })}
                inputMode="numeric"
                className="min-w-0 flex-1 rounded-xl border border-[#d1d1d6] px-2.5 py-2 text-sm outline-none focus:border-[#86868b]"
              />
              <span className="shrink-0 text-xs text-[#86868b]">원</span>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="shrink-0 rounded-full p-1.5 text-[#d1d1d6] transition hover:bg-red-50 hover:text-red-500"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addRow} className="flex items-center gap-1 text-xs font-medium text-[#86868b] hover:text-[#1d1d1f]">
            <Plus size={12} /> 회차 추가
          </button>
        </div>

        <p className={`text-xs ${rowsTotal === order.totalAmount ? "text-[#86868b]" : "text-amber-600"}`}>
          합계 {formatMoney(rowsTotal, orderIsHk ? "USD" : "KRW")} / 발주 총액 {formatMoney(order.totalAmount, orderIsHk ? "USD" : "KRW")}
          {rowsTotal !== order.totalAmount && ` (차이 ${formatMoney(order.totalAmount - rowsTotal, orderIsHk ? "USD" : "KRW")})`}
        </p>

        <div>
          <label className="mb-1 block text-xs text-[#86868b]">입금 계좌 안내 (클라이언트에게 표시됨)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || rows.length === 0 || rows.some((r) => !r.label.trim() || !r.amount)}
            className="flex-1 rounded-full bg-[#1d1d1f] py-2 text-xs font-medium text-white transition hover:bg-black disabled:opacity-50"
          >
            저장
          </button>
          <button
            onClick={() => setEditing(false)}
            disabled={saving}
            className="flex-1 rounded-full border border-[#d1d1d6] py-2 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
          >
            취소
          </button>
        </div>
      </div>
    );
  }

  if (!order.payment) {
    return (
      <button
        onClick={startEdit}
        className="w-full rounded-2xl border border-dashed border-[#d1d1d6] py-3 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
      >
        결제 정보 설정 (회차별 금액)
      </button>
    );
  }

  const { payment } = order;
  const orderTotals = calcOrderTotals(order.items);
  const vatRatio = orderTotals.krwSupply > 0 ? orderTotals.krwVat / orderTotals.krwSupply : 0;

  return (
    <div className="space-y-2.5 rounded-2xl border border-[#e5e5e5] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#86868b]">결제 정보</p>
        <button onClick={startEdit} className="text-xs font-medium text-[#86868b] underline underline-offset-2 hover:text-[#1d1d1f]">
          수정
        </button>
      </div>

      {payment.installments.map((it, i) => {
        const vat = Math.round(it.amount * vatRatio);
        return (
        <div key={i} className="space-y-1.5 rounded-xl bg-[#f5f5f7] p-3">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm">
            <span className="text-[#1d1d1f]">
              {it.label} {formatMoney(it.amount, orderIsHk ? "USD" : "KRW")}
              {vat > 0 && <span className="ml-1 text-xs text-[#86868b]">(VAT 별도 {vat.toLocaleString()}원, 합계 {(it.amount + vat).toLocaleString()}원)</span>}
            </span>
            {it.paid ? (
              <button
                onClick={() => handleUnmarkPaid(i)}
                disabled={saving}
                title="잘못 눌렀다면 다시 눌러 취소"
                className="shrink-0 whitespace-nowrap rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
              >
                입금확인
              </button>
            ) : (
              <button
                onClick={() => handleMarkPaid(i)}
                disabled={saving}
                className="shrink-0 whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-600 transition hover:bg-amber-100 disabled:opacity-50"
              >
                입금 확인
              </button>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            {it.issuedAt ? (
              <>
                <Link href={`/orders/${order.id}/invoice/${i}`} className="text-xs font-medium text-[#1d1d1f] underline underline-offset-2">
                  {it.paid ? "영수증 PDF" : "청구서 PDF"}
                </Link>
                <button
                  onClick={() => handleUnissue(i)}
                  disabled={saving}
                  className="text-xs font-medium text-[#86868b] underline underline-offset-2 hover:text-red-500 disabled:opacity-50"
                >
                  발행취소
                </button>
              </>
            ) : (
              <button
                onClick={() => handleIssue(i)}
                disabled={saving}
                className="text-xs font-medium text-[#86868b] underline underline-offset-2 hover:text-[#1d1d1f] disabled:opacity-50"
              >
                {it.paid ? "영수증 발행하기" : "청구서 발행하기"}
              </button>
            )}
          </div>
        </div>
        );
      })}

      {payment.note && (
        <p className="rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-xs leading-relaxed text-[#86868b] whitespace-pre-wrap">{payment.note}</p>
      )}
    </div>
  );
}

function CancelRequestBanner({ order }: { order: PurchaseOrder }) {
  const [saving, setSaving] = useState(false);

  async function handleApprove() {
    if (!confirm("발주 취소를 승인하시겠습니까? 상태가 '취소됨'으로 변경됩니다.")) return;
    setSaving(true);
    try {
      await updatePurchaseOrderStatus(order, "cancelled");
    } finally {
      setSaving(false);
    }
  }

  async function handleDismiss() {
    setSaving(true);
    try {
      await dismissCancelRequest(order);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 rounded-2xl border border-red-200 bg-red-50 p-4">
      <p className="text-xs font-semibold text-red-500">클라이언트가 이 발주의 취소를 요청했습니다</p>
      {order.cancelReason && <p className="text-sm text-[#1d1d1f]">사유: {order.cancelReason}</p>}
      {order.cancelRequestedAt && (
        <p className="text-xs text-[#86868b]">{new Date(order.cancelRequestedAt).toLocaleString("ko-KR")}</p>
      )}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleApprove}
          disabled={saving}
          className="flex-1 rounded-full bg-red-500 py-2 text-xs font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
        >
          취소 승인
        </button>
        <button
          onClick={handleDismiss}
          disabled={saving}
          className="flex-1 rounded-full border border-[#d1d1d6] py-2 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f] disabled:opacity-50"
        >
          요청 반려
        </button>
      </div>
    </div>
  );
}

function LinkedTaskPicker({ order }: { order: PurchaseOrder }) {
  const [editing, setEditing] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectId, setProjectId] = useState(order.linkedProjectId ?? "");
  const [taskId, setTaskId] = useState(order.linkedTaskId ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    return listenProjectsByClient(order.clientId, setProjects);
  }, [editing, order.clientId]);

  useEffect(() => {
    if (!editing || !projectId) { setTasks([]); return; }
    return listenTasksByProject(projectId, setTasks);
  }, [editing, projectId]);

  function startEdit() {
    setProjectId(order.linkedProjectId ?? "");
    setTaskId(order.linkedTaskId ?? "");
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const task = tasks.find((t) => t.id === taskId);
      await setPurchaseOrderLinkedTask(order, {
        projectId: projectId || undefined,
        taskId: taskId || undefined,
        taskName: task?.name,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlink() {
    setSaving(true);
    try {
      await setPurchaseOrderLinkedTask(order, {});
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="space-y-2 rounded-2xl border border-[#e5e5e5] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#86868b]">연결 업무 (계약금 확인 시 자동 착수 처리)</p>
        <div className="flex flex-wrap gap-2">
          <select
            value={projectId}
            onChange={(e) => { setProjectId(e.target.value); setTaskId(""); }}
            className="min-w-[140px] flex-1 rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm outline-none focus:border-[#86868b]"
          >
            <option value="">프로젝트 선택</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            disabled={!projectId}
            className="min-w-[140px] flex-1 rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm outline-none focus:border-[#86868b] disabled:opacity-50"
          >
            <option value="">업무 선택</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !taskId}
            className="flex-1 rounded-full bg-[#1d1d1f] py-2 text-xs font-medium text-white transition hover:bg-black disabled:opacity-50"
          >
            저장
          </button>
          {order.linkedTaskId && (
            <button
              onClick={handleUnlink}
              disabled={saving}
              className="rounded-full border border-[#d1d1d6] px-4 py-2 text-xs font-medium text-[#86868b] transition hover:border-red-300 hover:text-red-500"
            >
              연결 해제
            </button>
          )}
          <button
            onClick={() => setEditing(false)}
            disabled={saving}
            className="flex-1 rounded-full border border-[#d1d1d6] py-2 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
          >
            취소
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={startEdit}
      className="flex w-full items-center justify-between rounded-2xl border border-dashed border-[#d1d1d6] px-4 py-3 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
    >
      <span>연결 업무 (계약금 확인 시 자동 착수 처리)</span>
      <span className="font-semibold text-[#1d1d1f]">{order.linkedTaskName ?? "설정 안 함"}</span>
    </button>
  );
}

// ---- 미수금 한눈에 보기 ----
//
// 지금까지는 청구서(회차)의 입금 여부를 확인하려면 발주를 하나씩 열어봐야 했다. 여기는
// 전체 고객을 통틀어 "발행은 됐는데 아직 입금 확인이 안 된 회차"만 모아서 보여준다 —
// 데이터 자체는 이미 있던 payment.installments를 그대로 훑을 뿐이고, 새로 저장하는 값은 없다.
interface UnpaidRow {
  order: PurchaseOrder;
  index: number;
  label: string;
  amount: number;
  currency: Currency;
  issuedAt: number;
  daysSinceIssued: number;
}

function UnpaidInstallmentsTab() {
  const { appUser } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [marking, setMarking] = useState<string | null>(null);

  useEffect(() => listenAllPurchaseOrders(setOrders), []);

  const rows = useMemo(() => {
    const now = Date.now();
    const out: UnpaidRow[] = [];
    for (const order of orders) {
      if (order.status === "cancelled" || !order.payment) continue;
      // 발주 품목이 전부 USD면 그 발주는 달러로 청구한다 — 기존 미수금 리마인더
      // (checkOverdueInvoices)와 같은 판단 기준을 그대로 쓴다.
      const isUsd = order.items.length > 0 && order.items.every((it) => it.currency === "USD");
      order.payment.installments.forEach((it, i) => {
        if (!it.issuedAt || it.paid) return;
        out.push({
          order,
          index: i,
          label: it.label,
          amount: it.amount,
          currency: isUsd ? "USD" : "KRW",
          issuedAt: it.issuedAt,
          daysSinceIssued: Math.floor((now - it.issuedAt) / 86400000),
        });
      });
    }
    // 가장 오래 밀린 것부터 — 놓치기 쉬운 순서대로 위에 오게 한다.
    return out.sort((a, b) => b.daysSinceIssued - a.daysSinceIssued);
  }, [orders]);

  const totalsByCurrency = useMemo(() => {
    const totals: Record<Currency, number> = { KRW: 0, USD: 0 };
    for (const r of rows) totals[r.currency] += r.amount;
    return totals;
  }, [rows]);

  async function handleMarkPaid(row: UnpaidRow) {
    if (!appUser) return;
    const key = `${row.order.id}-${row.index}`;
    setMarking(key);
    try {
      await markInstallmentPaid(row.order, row.index, { uid: appUser.uid, name: appUser.name });
    } finally {
      setMarking(null);
    }
  }

  return (
    <div className="space-y-4">
      {rows.length > 0 && (
        <div className="flex flex-wrap gap-4 rounded-3xl bg-white p-5">
          <div>
            <p className="text-xs text-[#86868b]">미수금 합계</p>
            <p className="mt-0.5 text-xl font-bold text-[#1d1d1f]">
              {totalsByCurrency.KRW > 0 && formatMoney(totalsByCurrency.KRW, "KRW")}
              {totalsByCurrency.KRW > 0 && totalsByCurrency.USD > 0 && " · "}
              {totalsByCurrency.USD > 0 && formatMoney(totalsByCurrency.USD, "USD")}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#86868b]">
            <AlertTriangle size={13} className="text-amber-500" />
            미확인 {rows.length}건
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#d1d1d6] bg-white p-10 text-center text-sm text-[#86868b]">
          미확인 청구가 없습니다.
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl bg-white">
          {rows.map((r) => {
            const key = `${r.order.id}-${r.index}`;
            const overdue = r.daysSinceIssued >= 7;
            return (
              <div
                key={key}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f5f5f7] px-5 py-3.5 last:border-b-0"
              >
                <Link href={`/orders/${r.order.id}/invoice/${r.index}`} className="min-w-0 flex-1 hover:opacity-70">
                  <p className="truncate text-sm font-medium text-[#1d1d1f]">
                    {r.order.clientName} · {r.label}
                  </p>
                  <p className="mt-0.5 text-xs text-[#86868b]">
                    {r.order.poNumber} · 발행일 {new Date(r.issuedAt).toLocaleDateString("ko-KR")}
                  </p>
                </Link>
                <div className="flex shrink-0 items-center gap-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${overdue ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-600"}`}>
                    {r.daysSinceIssued}일 경과
                  </span>
                  <span className="text-sm font-semibold text-[#1d1d1f]">{formatMoney(r.amount, r.currency)}</span>
                  <button
                    onClick={() => handleMarkPaid(r)}
                    disabled={marking === key}
                    className="rounded-full bg-[#1d1d1f] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-black disabled:opacity-50"
                  >
                    {marking === key ? "처리 중..." : "입금 확인"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CatalogTab() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [products, setProducts] = useState<ClientProduct[]>([]);
  const [internals, setInternals] = useState<Record<string, ClientProductInternal>>({});
  const [name, setName] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [unit, setUnit] = useState("");
  const [purchaseType, setPurchaseType] = useState<PurchaseType>("domestic");
  const [vatApplicable, setVatApplicable] = useState(false);
  const [shippingTerm, setShippingTerm] = useState<ShippingTerm | "">("");
  const [customsNote, setCustomsNote] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);
  const currency: Currency = purchaseType === "overseas" ? "USD" : "KRW";

  useEffect(() => listenClients((cs) => {
    setClients(cs);
    setClientId((prev) => prev || cs[0]?.id || "");
  }), []);

  useEffect(() => {
    if (!clientId) { setProducts([]); setInternals({}); return; }
    const unsubProducts = listenClientProducts(clientId, setProducts);
    const unsubInternals = listenClientProductInternals(clientId, setInternals);
    return () => { unsubProducts(); unsubInternals(); };
  }, [clientId]);

  function handlePriceInput(value: string) {
    // 해외결제(USD)는 소수점 입력 허용, 국내결제(KRW)는 정수만
    const cleaned = currency === "USD" ? value.replace(/[^0-9.]/g, "") : value.replace(/[^0-9]/g, "");
    setUnitPrice(cleaned);
  }

  async function handleAdd() {
    if (!clientId || !name.trim() || !unitPrice) return;
    setAdding(true);
    try {
      const ref = await createClientProduct({
        clientId,
        name: name.trim(),
        unitPrice: Number(unitPrice),
        currency,
        vatApplicable: purchaseType === "domestic" ? vatApplicable : false,
        unit: unit.trim() || undefined,
      });
      if (imageFile) {
        await uploadClientProductImage(ref.id, imageFile);
      }
      if (purchaseType || shippingTerm || customsNote.trim()) {
        await setClientProductInternal(ref.id, clientId, {
          purchaseType,
          shippingTerm: shippingTerm || undefined,
          customsNote: customsNote.trim() || undefined,
        });
      }
      setName("");
      setUnitPrice("");
      setUnit("");
      setVatApplicable(false);
      setShippingTerm("");
      setCustomsNote("");
      setImageFile(null);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("이 제품을 삭제하시겠습니까?")) return;
    await deleteClientProduct(id);
    await deleteClientProductInternal(id);
  }

  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-5">
      <div className="rounded-3xl bg-white p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[#1d1d1f]">제품 추가</h2>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <label className="flex h-28 w-28 shrink-0 cursor-pointer items-center justify-center self-center overflow-hidden rounded-2xl border border-dashed border-[#d1d1d6] bg-[#f5f5f7] text-[#86868b] hover:border-[#86868b] sm:self-auto">
            {imageFile ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={URL.createObjectURL(imageFile)} alt="" className="h-full w-full object-cover" />
            ) : (
              <Upload size={22} />
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <label className="mb-1 block text-xs text-[#86868b]">클라이언트 선택</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="제품명"
                className="w-full min-w-0 flex-1 rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
              />
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="단위(개)"
                className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b] sm:w-24"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <select
            value={purchaseType}
            onChange={(e) => setPurchaseType(e.target.value as PurchaseType)}
            className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b] sm:w-auto"
          >
            <option value="domestic">국내결제</option>
            <option value="overseas">해외결제</option>
          </select>
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-[#86868b]">{currency === "USD" ? "$" : ""}</span>
            <input
              value={unitPrice}
              onChange={(e) => handlePriceInput(e.target.value)}
              placeholder={currency === "USD" ? "단가 (예: 12.50)" : "단가"}
              inputMode="decimal"
              className="w-full min-w-0 flex-1 rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b] sm:w-28 sm:flex-none"
            />
            {currency === "KRW" && <span className="text-sm text-[#86868b]">원</span>}
          </div>
          {purchaseType === "domestic" && (
            <label className="flex items-center gap-1.5 rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f]">
              <input type="checkbox" checked={vatApplicable} onChange={(e) => setVatApplicable(e.target.checked)} />
              부가세 별도
            </label>
          )}
          {purchaseType === "overseas" && (
            <select
              value={shippingTerm}
              onChange={(e) => setShippingTerm(e.target.value as ShippingTerm | "")}
              className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b] sm:ml-auto sm:w-auto"
            >
              <option value="">선적조건</option>
              {(Object.keys(SHIPPING_TERM_LABEL) as ShippingTerm[]).map((t) => (
                <option key={t} value={t}>{SHIPPING_TERM_LABEL[t]}</option>
              ))}
            </select>
          )}
        </div>

        {purchaseType === "domestic" && vatApplicable && Number(unitPrice) > 0 && (
          <p className="text-xs text-[#86868b]">
            공급가액 {Number(unitPrice).toLocaleString()}원 + 부가세 {Math.round(Number(unitPrice) * 0.1).toLocaleString()}원
            = 단가 합계 {Math.round(Number(unitPrice) * 1.1).toLocaleString()}원
          </p>
        )}

        <div className="border-t border-[#f0f0f0] pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#d1d1d6]">내부 정보 (관리자 전용 · 클라이언트에게 노출되지 않음)</p>
          <textarea
            value={customsNote}
            onChange={(e) => setCustomsNote(e.target.value)}
            rows={2}
            placeholder="수입통관 메모 (HS코드, 관세율, 통관 수수료 등)"
            className="w-full resize-none rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
          />
        </div>

        <button
          onClick={handleAdd}
          disabled={adding || !name.trim() || !unitPrice}
          className="flex items-center gap-1 rounded-xl bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
        >
          <Plus size={14} /> 추가
        </button>
      </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-[#1d1d1f]">전체 카탈로그</h2>
        {clients.map((c) => (
          <ClientCatalogSection key={c.id} client={c} />
        ))}
      </div>
    </div>
  );
}

const DELETE_KEYWORD = "바로삭제";

function ClientCatalogSection({ client }: { client: Client }) {
  const [products, setProducts] = useState<ClientProduct[]>([]);
  const [internals, setInternals] = useState<Record<string, ClientProductInternal>>({});
  const [deleteTarget, setDeleteTarget] = useState<ClientProduct | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  useEffect(() => {
    const unsubProducts = listenClientProducts(client.id, setProducts);
    const unsubInternals = listenClientProductInternals(client.id, setInternals);
    return () => { unsubProducts(); unsubInternals(); };
  }, [client.id]);

  async function handleConfirmDelete() {
    if (!deleteTarget || deleteConfirmText !== DELETE_KEYWORD) return;
    await deleteClientProduct(deleteTarget.id);
    await deleteClientProductInternal(deleteTarget.id);
    setDeleteTarget(null);
    setDeleteConfirmText("");
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-white">
      <div className="flex items-center justify-between border-b border-[#f0f0f0] px-5 py-3">
        <p className="text-sm font-semibold text-[#1d1d1f]">{client.name}</p>
        <p className="text-xs text-[#86868b]">{products.length}개 제품</p>
      </div>
      {products.length === 0 ? (
        <p className="p-6 text-center text-sm text-[#86868b]">등록된 제품이 없습니다.</p>
      ) : (
        products.map((p, i) => (
          <ProductRow
            key={p.id}
            product={p}
            internal={internals[p.id]}
            clientId={client.id}
            bordered={i > 0}
            onDelete={() => setDeleteTarget(p)}
          />
        ))
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div>
              <h2 className="text-lg font-semibold text-[#1d1d1f]">제품 삭제</h2>
              <p className="mt-1.5 text-sm text-[#86868b]">
                <span className="font-medium text-[#1d1d1f]">{deleteTarget.name}</span> 제품을 삭제합니다. 이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[#86868b]">
                삭제하려면 <span className="font-semibold text-[#1d1d1f]">{DELETE_KEYWORD}</span>를 입력하세요
              </label>
              <input
                autoFocus
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleConfirmDelete(); }}
                placeholder={DELETE_KEYWORD}
                className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-full border border-[#d1d1d6] px-4 py-2 text-sm text-[#1d1d1f] hover:bg-[#f5f5f7]"
              >
                취소
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteConfirmText !== DELETE_KEYWORD}
                className="rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 이 고객 발주 때문에 나간 구매발주를 보여준다. 참조는 구매발주 문서에만 있고(고객이 읽는
// purchaseOrders에는 아무것도 안 붙인다), 이 화면 자체가 관리자 전용이라 원가가 새지 않는다.
function LinkedSupplierOrders({ purchaseOrderId }: { purchaseOrderId: string }) {
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  useEffect(() => listenSupplierOrders(setOrders), []);
  const linked = orders.filter((o) => o.linkedPurchaseOrderId === purchaseOrderId);
  if (linked.length === 0) return null;
  return (
    <div className="space-y-1.5 rounded-2xl bg-[#f5f5f7] px-4 py-3">
      <p className="text-xs font-semibold text-[#86868b]">이 발주로 발행한 구매발주 (관리자만 보임)</p>
      {linked.map((o) => (
        <p key={o.id} className="text-xs text-[#1d1d1f]">
          {o.soNumber} · {o.supplierName}
          {o.lotNo ? ` · Lot ${o.lotNo}` : ""} · {formatSupplierMoney(o.totalAmount, o.currency)}
        </p>
      ))}
    </div>
  );
}

function ProductRow({
  product,
  internal,
  clientId,
  bordered,
  onDelete,
}: {
  product: ClientProduct;
  internal?: ClientProductInternal;
  clientId: string;
  bordered: boolean;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(product.name);
  const [purchaseType, setPurchaseType] = useState<PurchaseType>(product.currency === "USD" ? "overseas" : "domestic");
  const [vatApplicable, setVatApplicable] = useState(!!product.vatApplicable);
  const [customsNote, setCustomsNote] = useState(internal?.customsNote ?? "");
  const [unitPrice, setUnitPrice] = useState(String(product.unitPrice));
  const [unit, setUnit] = useState(product.unit ?? "");
  const [shippingTerm, setShippingTerm] = useState<ShippingTerm | "">(internal?.shippingTerm ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const currency: Currency = purchaseType === "overseas" ? "USD" : "KRW";

  function startEdit() {
    setName(product.name);
    setPurchaseType(product.currency === "USD" ? "overseas" : "domestic");
    setVatApplicable(!!product.vatApplicable);
    setCustomsNote(internal?.customsNote ?? "");
    setUnitPrice(String(product.unitPrice));
    setUnit(product.unit ?? "");
    setShippingTerm(internal?.shippingTerm ?? "");
    setExpanded(true);
  }

  function handlePriceInput(value: string) {
    const cleaned = currency === "USD" ? value.replace(/[^0-9.]/g, "") : value.replace(/[^0-9]/g, "");
    setUnitPrice(cleaned);
  }

  async function handleImageChange(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      await uploadClientProductImage(product.id, file);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await updateClientProduct(product.id, {
        name: name.trim(),
        unitPrice: Number(unitPrice) || 0,
        currency,
        vatApplicable: purchaseType === "domestic" ? vatApplicable : false,
        unit: unit.trim() || "",
      });
      await setClientProductInternal(product.id, clientId, {
        purchaseType,
        shippingTerm: shippingTerm || undefined,
        customsNote: customsNote.trim() || undefined,
      });
      setExpanded(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`px-5 py-3.5 ${bordered ? "border-t border-[#f0f0f0]" : ""} ${product.active ? "" : "opacity-40"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <label className="flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-[#e5e5e5] bg-[#f5f5f7] text-[#d1d1d6]">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Upload size={18} />
            )}
            <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)} />
          </label>
          <div className="min-w-0">
            <p className="truncate font-medium text-[#1d1d1f]">{product.name}</p>
            <p className="mt-0.5 text-xs text-[#86868b]">
              {formatMoney(product.unitPrice, product.currency)} (1{product.unit || "개"} 기준)
              {product.currency === "KRW" && product.vatApplicable && <span className="ml-1">(VAT별도)</span>}
              {internal?.shippingTerm && <span className="ml-1">· {internal.shippingTerm}</span>}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {expanded ? (
            <button onClick={() => setExpanded(false)} className="text-xs font-medium text-[#86868b] underline underline-offset-2 hover:text-[#1d1d1f]">
              숨기기
            </button>
          ) : (
            <button onClick={startEdit} className="text-xs font-medium text-[#86868b] underline underline-offset-2 hover:text-[#1d1d1f]">
              수정
            </button>
          )}
          <button onClick={onDelete} className="rounded-full p-1.5 text-[#d1d1d6] transition hover:bg-red-50 hover:text-red-500">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 rounded-2xl bg-[#f5f5f7] p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="제품명"
            className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={purchaseType}
              onChange={(e) => setPurchaseType(e.target.value as PurchaseType)}
              className="rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs text-[#1d1d1f] outline-none focus:border-[#86868b]"
            >
              <option value="domestic">국내결제</option>
              <option value="overseas">해외결제</option>
            </select>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[#86868b]">{currency === "USD" ? "$" : ""}</span>
              <input
                value={unitPrice}
                onChange={(e) => handlePriceInput(e.target.value)}
                inputMode="decimal"
                className="w-24 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs text-[#1d1d1f] outline-none focus:border-[#86868b]"
              />
              {currency === "KRW" && <span className="text-xs text-[#86868b]">원</span>}
            </div>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="단위(개)"
              className="w-20 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
            />
            {purchaseType === "domestic" && (
              <label className="flex items-center gap-1.5 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs text-[#1d1d1f]">
                <input type="checkbox" checked={vatApplicable} onChange={(e) => setVatApplicable(e.target.checked)} />
                부가세 별도
              </label>
            )}
            {purchaseType === "overseas" && (
              <select
                value={shippingTerm}
                onChange={(e) => setShippingTerm(e.target.value as ShippingTerm | "")}
                className="ml-auto rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs text-[#1d1d1f] outline-none focus:border-[#86868b]"
              >
                <option value="">선적조건</option>
                {(Object.keys(SHIPPING_TERM_LABEL) as ShippingTerm[]).map((t) => (
                  <option key={t} value={t}>{SHIPPING_TERM_LABEL[t]}</option>
                ))}
              </select>
            )}
          </div>
          {purchaseType === "domestic" && vatApplicable && Number(unitPrice) > 0 && (
            <p className="text-xs text-[#86868b]">
              공급가액 {Number(unitPrice).toLocaleString()}원 + 부가세 {Math.round(Number(unitPrice) * 0.1).toLocaleString()}원
              = 단가 합계 {Math.round(Number(unitPrice) * 1.1).toLocaleString()}원
            </p>
          )}
          <textarea
            value={customsNote}
            onChange={(e) => setCustomsNote(e.target.value)}
            rows={2}
            placeholder="수입통관 메모 (HS코드, 관세율, 통관 수수료 등)"
            className="w-full resize-none rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
          />

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="rounded-full bg-[#1d1d1f] px-4 py-1.5 text-xs font-medium text-white transition hover:bg-black disabled:opacity-50"
            >
              저장
            </button>
            <button
              onClick={() => setExpanded(false)}
              disabled={saving}
              className="rounded-full border border-[#d1d1d6] px-4 py-1.5 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
