"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X, Printer, Upload, Check, FileText } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenAllClientProducts } from "@/lib/firestore/products";
import { listenAllClientProductInternals } from "@/lib/firestore/productInternal";
import { listenClients } from "@/lib/firestore/clients";
import { listenAllPurchaseOrders } from "@/lib/firestore/purchaseOrders";
import {
  calcSupplierItemTotal,
  calcSupplierOrderTotal,
  createSupplierOrder,
  deleteSupplierOrder,
  formatSupplierMoney,
  listenSupplierOrders,
  setSupplierOrderStatus,
  uploadSupplierOrderConfirmation,
} from "@/lib/firestore/supplierOrders";
import SupplierOrderDocument from "@/components/SupplierOrderDocument";
import PdfPageScaler from "@/components/PdfPageScaler";
import { usePrintFileName } from "@/lib/usePrintFileName";
import {
  Client,
  ClientProduct,
  ClientProductInternal,
  PurchaseOrder,
  SUPPLIER_ORDER_STATUS_LABEL,
  SupplierCostItem,
  SupplierCurrency,
  SupplierOrder,
  SupplierOrderItem,
} from "@/lib/types";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-[#f5f5f7] text-[#86868b]",
  issued: "bg-amber-50 text-amber-600",
  confirmed: "bg-green-50 text-green-600",
  closed: "bg-[#f5f5f7] text-[#86868b]",
};

const NO_SUPPLIER = "미지정";

// 카탈로그에서 제품을 담을 때 만들어지는 발주 품목. 제품의 기본 부대비용은 전부 담되 체크는
// 꺼둔 상태로 시작한다 — 로트마다 붙는 항목이 달라서, 기본으로 켜두면 실수로 딸려 들어간다.
interface DraftItem extends SupplierOrderItem {
  key: string;
  costOptions: { cost: SupplierCostItem; checked: boolean }[];
}

export default function SupplierOrdersTab() {
  const { appUser } = useAuth();
  const [products, setProducts] = useState<ClientProduct[]>([]);
  const [internals, setInternals] = useState<Record<string, ClientProductInternal>>({});
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [clientOrders, setClientOrders] = useState<PurchaseOrder[]>([]);
  const [selected, setSelected] = useState<SupplierOrder | null>(null);
  const [composing, setComposing] = useState(false);

  useEffect(() => listenAllClientProducts(setProducts), []);
  useEffect(() => listenAllClientProductInternals(setInternals), []);
  useEffect(() => listenClients(setClients), []);
  useEffect(() => listenSupplierOrders(setOrders), []);
  useEffect(() => listenAllPurchaseOrders(setClientOrders), []);

  useEffect(() => {
    if (!selected) return;
    const fresh = orders.find((o) => o.id === selected.id);
    setSelected(fresh ?? null);
  }, [orders]); // eslint-disable-line react-hooks/exhaustive-deps

  const clientNameById = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((c) => { map[c.id] = c.name; });
    return map;
  }, [clients]);

  // 업체별 묶음 — 매입 정보가 하나라도 채워진 제품만 구매 카탈로그에 올린다(고객 판매용으로만
  // 등록해둔 제품까지 전부 나오면 목록이 쓸모없어진다).
  const grouped = useMemo(() => {
    const map = new Map<string, { product: ClientProduct; internal: ClientProductInternal }[]>();
    for (const p of products) {
      const internal = internals[p.id];
      if (!internal) continue;
      if (!internal.supplierName && internal.purchasePrice == null) continue;
      const key = internal.supplierName || NO_SUPPLIER;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ product: p, internal });
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "ko"));
  }, [products, internals]);

  if (composing) {
    return (
      <SupplierOrderComposer
        grouped={grouped}
        clientNameById={clientNameById}
        clientOrders={clientOrders}
        onClose={() => setComposing(false)}
        onCreated={() => setComposing(false)}
        createdBy={appUser?.uid ?? ""}
      />
    );
  }

  if (selected) {
    return <SupplierOrderDetail order={selected} onClose={() => setSelected(null)} />;
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* 왼쪽 — 업체별 구매 카탈로그 */}
      <div className="space-y-3">
        <button
          onClick={() => setComposing(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[#d1d1d6] py-2.5 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
        >
          <FileText size={14} /> 구매발주서 작성
        </button>

        {grouped.length === 0 && (
          <div className="rounded-3xl border border-dashed border-[#d1d1d6] bg-white p-10 text-center text-sm leading-relaxed text-[#86868b]">
            매입 정보가 등록된 제품이 없습니다.
            <br />
            <span className="text-xs">제품 카탈로그에서 제품을 열고 &quot;매입 정보&quot;에 공급 업체와 매입 단가를 입력해 주세요.</span>
          </div>
        )}

        {grouped.map(([supplier, rows]) => (
          <div key={supplier} className="overflow-hidden rounded-3xl bg-white">
            <div className="flex items-center justify-between border-b border-[#f0f0f0] px-5 py-3">
              <p className="font-semibold text-[#1d1d1f]">{supplier}</p>
              <span className="text-xs text-[#86868b]">{rows.length}개 품목</span>
            </div>
            {rows.map(({ product, internal }) => {
              const costTotal = (internal.costItems ?? []).reduce((s, c) => s + (c.amount || 0), 0);
              const cur = internal.purchaseCurrency ?? "USD";
              return (
                <div key={product.id} className="flex items-start justify-between gap-3 border-b border-[#f5f5f7] px-5 py-3 last:border-b-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#1d1d1f]">{product.name}</p>
                    <p className="mt-0.5 truncate text-xs text-[#86868b]">
                      {clientNameById[product.clientId] ?? "-"}
                      {internal.nameEn ? ` · ${internal.nameEn}` : ""}
                    </p>
                    {(internal.costItems ?? []).length > 0 && (
                      <p className="mt-0.5 text-xs text-[#d1d1d6]">
                        부대비용 {internal.costItems!.length}건 · 최대 {formatSupplierMoney(costTotal, cur)}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-[#1d1d1f]">
                      {internal.purchasePrice != null ? formatSupplierMoney(internal.purchasePrice, cur) : "단가 미입력"}
                    </p>
                    <p className="mt-0.5 text-xs text-[#d1d1d6]">매입 단가</p>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* 오른쪽 — 발행한 구매발주 목록 */}
      <div className="space-y-2">
        {orders.length === 0 && (
          <div className="rounded-3xl border border-dashed border-[#d1d1d6] bg-white p-10 text-center text-sm text-[#86868b]">
            발행한 구매발주가 없습니다.
          </div>
        )}
        {orders.map((o) => (
          <div
            key={o.id}
            onClick={() => setSelected(o)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") setSelected(o); }}
            className="w-full cursor-pointer rounded-2xl border border-[#e5e5e5] bg-white p-4 text-left transition hover:border-[#86868b]"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate font-medium text-[#1d1d1f]">{o.supplierName || "-"}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[o.status]}`}>
                {SUPPLIER_ORDER_STATUS_LABEL[o.status]}
              </span>
            </div>
            <p className="mt-1 truncate text-xs text-[#86868b]">
              {o.soNumber}
              {o.lotNo ? ` · Lot ${o.lotNo}` : ""}
              {o.linkedPurchaseOrderNo ? ` · 고객발주 ${o.linkedPurchaseOrderNo}` : ""}
            </p>
            <p className="mt-1.5 text-xs text-[#d1d1d6]">
              {formatSupplierMoney(o.totalAmount, o.currency)} · {new Date(o.createdAt).toLocaleDateString("ko-KR")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- 발주서 작성 ----

function SupplierOrderComposer({
  grouped,
  clientNameById,
  clientOrders,
  onClose,
  onCreated,
  createdBy,
}: {
  grouped: [string, { product: ClientProduct; internal: ClientProductInternal }[]][];
  clientNameById: Record<string, string>;
  clientOrders: PurchaseOrder[];
  onClose: () => void;
  onCreated: () => void;
  createdBy: string;
}) {
  const [supplierName, setSupplierName] = useState(grouped[0]?.[0] ?? "");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [currency, setCurrency] = useState<SupplierCurrency>("USD");
  const [exchangeRate, setExchangeRate] = useState("");
  const [incoterms, setIncoterms] = useState("");
  const [portOfLoading, setPortOfLoading] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("T/T 30% deposit, 70% before shipment");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [packingNote, setPackingNote] = useState("");
  const [memo, setMemo] = useState("");
  const [lotNo, setLotNo] = useState("");
  const [linkedPoId, setLinkedPoId] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const rows = grouped.find(([s]) => s === supplierName)?.[1] ?? [];

  // 저장할 때 넘기는 최종 품목 — 체크된 부대비용만 담는다.
  const finalItems: SupplierOrderItem[] = items.map((it) => ({
    name: it.name,
    nameEn: it.nameEn,
    spec: it.spec,
    unitPrice: it.unitPrice,
    quantity: it.quantity,
    unit: it.unit,
    sourceProductId: it.sourceProductId,
    costs: it.costOptions.filter((c) => c.checked).map((c) => c.cost),
  }));

  const total = calcSupplierOrderTotal(finalItems);
  const linkedPo = clientOrders.find((o) => o.id === linkedPoId);

  usePrintFileName([supplierName, "구매발주서", items.map((it) => it.name).filter(Boolean).join(",")], previewOpen);

  function addProduct(product: ClientProduct, internal: ClientProductInternal) {
    setItems((prev) => [
      ...prev,
      {
        key: `${product.id}-${Date.now()}`,
        name: product.name,
        nameEn: internal.nameEn || undefined,
        unitPrice: internal.purchasePrice ?? 0,
        quantity: 1,
        unit: product.unit || "PCS",
        sourceProductId: product.id,
        costOptions: (internal.costItems ?? []).map((cost) => ({ cost: { ...cost }, checked: false })),
      },
    ]);
    // 제품에 저장된 통화를 발주 통화로 따라간다 — 첫 품목을 담을 때만 맞춰주고, 이후엔
    // 관리자가 고른 값을 존중한다(한 발주서 안에서 통화를 섞을 수는 없다).
    if (items.length === 0 && internal.purchaseCurrency) setCurrency(internal.purchaseCurrency);
  }

  function patchItem(key: string, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  async function handleSave() {
    if (!supplierName.trim() || finalItems.length === 0) return;
    setSaving(true);
    try {
      await createSupplierOrder({
        supplierName: supplierName.trim(),
        items: finalItems,
        currency,
        exchangeRate: exchangeRate.trim() ? Number(exchangeRate) : undefined,
        incoterms: incoterms.trim() || undefined,
        portOfLoading: portOfLoading.trim() || undefined,
        paymentTerms: paymentTerms.trim() || undefined,
        leadTimeDays: leadTimeDays.trim() ? Number(leadTimeDays) : undefined,
        packingNote: packingNote.trim() || undefined,
        memo: memo.trim() || undefined,
        lotNo: lotNo.trim() || undefined,
        linkedPurchaseOrderId: linkedPo?.id,
        linkedPurchaseOrderNo: linkedPo?.poNumber,
        createdBy,
      });
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  if (previewOpen) {
    return (
      <PrintablePreview onClose={() => setPreviewOpen(false)} label="발행 전 미리보기 — 실제 발주서와 동일합니다.">
        <SupplierOrderDocument
          data={{
            supplierName,
            items: finalItems,
            currency,
            exchangeRate: exchangeRate.trim() ? Number(exchangeRate) : undefined,
            incoterms,
            portOfLoading,
            paymentTerms,
            leadTimeDays: leadTimeDays.trim() ? Number(leadTimeDays) : undefined,
            packingNote,
            memo,
            lotNo,
            createdAt: Date.now(),
          }}
        />
      </PrintablePreview>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* 왼쪽 — 담을 제품 고르기 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d1d1d6] text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
            title="닫기"
          >
            <X size={16} />
          </button>
          <select
            value={supplierName}
            onChange={(e) => { setSupplierName(e.target.value); setItems([]); }}
            className="flex-1 rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-sm outline-none focus:border-[#86868b]"
          >
            {grouped.length === 0 && <option value="">등록된 공급 업체 없음</option>}
            {grouped.map(([s]) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="overflow-hidden rounded-3xl bg-white">
          <p className="border-b border-[#f0f0f0] px-5 py-3 text-xs font-semibold text-[#86868b]">제품을 눌러 발주에 담기</p>
          {rows.length === 0 && <p className="px-5 py-6 text-center text-sm text-[#86868b]">이 업체의 제품이 없습니다.</p>}
          {rows.map(({ product, internal }) => (
            <button
              key={product.id}
              onClick={() => addProduct(product, internal)}
              className="flex w-full items-center justify-between gap-3 border-b border-[#f5f5f7] px-5 py-3 text-left transition last:border-b-0 hover:bg-[#f5f5f7]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[#1d1d1f]">{product.name}</p>
                <p className="mt-0.5 truncate text-xs text-[#86868b]">{clientNameById[product.clientId] ?? "-"}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm text-[#86868b]">
                  {internal.purchasePrice != null ? formatSupplierMoney(internal.purchasePrice, internal.purchaseCurrency ?? "USD") : "-"}
                </span>
                <Plus size={14} className="text-[#d1d1d6]" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 오른쪽 — 담긴 품목 + 발주 조건 */}
      <div className="space-y-4 self-start rounded-3xl bg-white p-6">
        <p className="font-semibold text-[#1d1d1f]">구매발주서 작성</p>

        {items.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[#d1d1d6] px-4 py-8 text-center text-sm text-[#86868b]">
            왼쪽에서 제품을 눌러 담아주세요.
          </p>
        )}

        {items.map((it) => (
          <div key={it.key} className="space-y-2 rounded-2xl bg-[#f5f5f7] p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[#1d1d1f]">{it.name}</p>
                <input
                  value={it.nameEn ?? ""}
                  onChange={(e) => patchItem(it.key, { nameEn: e.target.value })}
                  placeholder="영문/중문 품명 (발주서에 찍힘)"
                  className="mt-1 w-full rounded-lg border border-[#d1d1d6] bg-white px-2.5 py-1 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
                />
                <input
                  value={it.spec ?? ""}
                  onChange={(e) => patchItem(it.key, { spec: e.target.value })}
                  placeholder="사양 (재질·캐비티·치수 등)"
                  className="mt-1 w-full rounded-lg border border-[#d1d1d6] bg-white px-2.5 py-1 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
                />
              </div>
              <button
                onClick={() => setItems((prev) => prev.filter((x) => x.key !== it.key))}
                className="shrink-0 rounded-full p-1.5 text-[#d1d1d6] transition hover:bg-red-50 hover:text-red-500"
                title="빼기"
              >
                <Trash2 size={13} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                value={it.unitPrice || ""}
                onChange={(e) => patchItem(it.key, { unitPrice: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })}
                inputMode="decimal"
                placeholder="단가"
                className="w-24 rounded-lg border border-[#d1d1d6] bg-white px-2.5 py-1 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
              />
              <span className="text-xs text-[#86868b]">×</span>
              <input
                value={it.quantity || ""}
                onChange={(e) => patchItem(it.key, { quantity: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })}
                inputMode="numeric"
                className="w-16 rounded-lg border border-[#d1d1d6] bg-white px-2.5 py-1 text-xs outline-none focus:border-[#86868b]"
              />
              <input
                value={it.unit ?? ""}
                onChange={(e) => patchItem(it.key, { unit: e.target.value })}
                placeholder="SET"
                className="w-16 rounded-lg border border-[#d1d1d6] bg-white px-2.5 py-1 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
              />
              <span className="ml-auto text-sm font-semibold text-[#1d1d1f]">
                {formatSupplierMoney(calcSupplierItemTotal({ ...it, costs: it.costOptions.filter((c) => c.checked).map((c) => c.cost) }), currency)}
              </span>
            </div>

            {/* 로트별 부대비용 — 체크한 것만 이번 발주에 들어간다. */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#86868b]">이번 로트 부대비용</p>
              {it.costOptions.length === 0 && <p className="text-xs text-[#d1d1d6]">등록된 부대비용이 없습니다. 아래에서 직접 추가할 수 있습니다.</p>}
              {it.costOptions.map((opt, ci) => (
                <div key={ci} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={opt.checked}
                    onChange={(e) =>
                      patchItem(it.key, {
                        costOptions: it.costOptions.map((o, idx) => (idx === ci ? { ...o, checked: e.target.checked } : o)),
                      })
                    }
                  />
                  <input
                    value={opt.cost.name}
                    onChange={(e) =>
                      patchItem(it.key, {
                        costOptions: it.costOptions.map((o, idx) => (idx === ci ? { ...o, cost: { ...o.cost, name: e.target.value } } : o)),
                      })
                    }
                    placeholder="항목명"
                    className="flex-1 rounded-lg border border-[#d1d1d6] bg-white px-2.5 py-1 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
                  />
                  <input
                    value={opt.cost.amount || ""}
                    onChange={(e) =>
                      patchItem(it.key, {
                        costOptions: it.costOptions.map((o, idx) =>
                          idx === ci ? { ...o, cost: { ...o.cost, amount: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 } } : o
                        ),
                      })
                    }
                    inputMode="decimal"
                    placeholder="금액"
                    className="w-20 rounded-lg border border-[#d1d1d6] bg-white px-2.5 py-1 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
                  />
                  <button
                    onClick={() => patchItem(it.key, { costOptions: it.costOptions.filter((_, idx) => idx !== ci) })}
                    className="rounded-full p-1 text-[#d1d1d6] transition hover:bg-red-50 hover:text-red-500"
                    title="삭제"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => patchItem(it.key, { costOptions: [...it.costOptions, { cost: { name: "", amount: 0 }, checked: true }] })}
                className="flex items-center gap-1 text-xs font-medium text-[#86868b] transition hover:text-[#1d1d1f]"
              >
                <Plus size={12} /> 항목 추가
              </button>
            </div>
          </div>
        ))}

        {/* 발주 조건 */}
        <div className="space-y-2 border-t border-[#f0f0f0] pt-4">
          <div className="flex flex-wrap gap-2">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as SupplierCurrency)}
              className="rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs outline-none focus:border-[#86868b]"
            >
              <option value="USD">USD $</option>
              <option value="CNY">CNY ¥</option>
              <option value="KRW">KRW 원</option>
            </select>
            {currency !== "KRW" && (
              <input
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder={`환율 (1 ${currency} = ?원)`}
                className="w-40 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
              />
            )}
            <input
              value={lotNo}
              onChange={(e) => setLotNo(e.target.value)}
              placeholder="로트 번호"
              className="w-28 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={incoterms}
              onChange={(e) => setIncoterms(e.target.value)}
              className="rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs outline-none focus:border-[#86868b]"
            >
              <option value="">인코텀즈</option>
              <option value="EXW">EXW</option>
              <option value="FOB">FOB</option>
              <option value="CIF">CIF</option>
              <option value="DDP">DDP</option>
            </select>
            <input
              value={portOfLoading}
              onChange={(e) => setPortOfLoading(e.target.value)}
              placeholder="출항지 (Shenzhen 등)"
              className="w-40 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
            />
            <input
              value={leadTimeDays}
              onChange={(e) => setLeadTimeDays(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="납기(선금 입금 후 N일)"
              className="w-44 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
            />
          </div>

          <input
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            placeholder="결제조건"
            className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
          />
          <input
            value={packingNote}
            onChange={(e) => setPackingNote(e.target.value)}
            placeholder="포장·검수 조건"
            className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
          />

          {/* 고객 발주와의 연결 — 이 참조는 구매발주 문서에만 저장되고 고객 발주 문서는 건드리지
              않는다(고객이 읽을 수 있는 컬렉션이라 원가 문서의 존재가 새면 안 된다). */}
          <select
            value={linkedPoId}
            onChange={(e) => setLinkedPoId(e.target.value)}
            className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs outline-none focus:border-[#86868b]"
          >
            <option value="">연결할 고객 발주 없음</option>
            {clientOrders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.poNumber} · {o.clientName}
              </option>
            ))}
          </select>

          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
            placeholder="비고 (Remarks)"
            className="w-full resize-none rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
          />
        </div>

        <div className="flex items-center justify-between border-t border-[#f0f0f0] pt-4">
          <span className="text-sm text-[#86868b]">합계</span>
          <span className="text-lg font-bold text-[#1d1d1f]">{formatSupplierMoney(total, currency)}</span>
        </div>
        {exchangeRate.trim() && currency !== "KRW" && (
          <p className="-mt-2 text-right text-xs text-[#86868b]">약 {Math.round(total * Number(exchangeRate)).toLocaleString("ko-KR")}원</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setPreviewOpen(true)}
            disabled={finalItems.length === 0}
            className="rounded-full border border-[#d1d1d6] px-4 py-2 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f] disabled:opacity-40"
          >
            미리보기
          </button>
          <button
            onClick={handleSave}
            disabled={saving || finalItems.length === 0 || !supplierName.trim()}
            className="rounded-full bg-[#1d1d1f] px-5 py-2 text-xs font-medium text-white transition hover:bg-black disabled:opacity-50"
          >
            {saving ? "저장 중..." : "발주서 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- 발행된 구매발주 상세 ----

function SupplierOrderDetail({ order, onClose }: { order: SupplierOrder; onClose: () => void }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  usePrintFileName([order.supplierName, "구매발주서", order.soNumber], previewOpen);

  async function handleUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      await uploadSupplierOrderConfirmation(order.id, file);
    } finally {
      setUploading(false);
    }
  }

  if (previewOpen) {
    return (
      <PrintablePreview onClose={() => setPreviewOpen(false)} label={`${order.soNumber} — 인쇄해서 공장에 보내세요.`}>
        <SupplierOrderDocument data={{ ...order, createdAt: order.createdAt }} />
      </PrintablePreview>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 rounded-3xl bg-white p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[#1d1d1f]">{order.supplierName}</p>
          <p className="mt-0.5 text-xs text-[#86868b]">
            {order.soNumber}
            {order.lotNo ? ` · Lot ${order.lotNo}` : ""} · {new Date(order.createdAt).toLocaleDateString("ko-KR")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[order.status]}`}>
            {SUPPLIER_ORDER_STATUS_LABEL[order.status]}
          </span>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#d1d1d6] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]" title="닫기">
            <X size={15} />
          </button>
        </div>
      </div>

      {order.linkedPurchaseOrderNo && (
        <div className="rounded-2xl bg-[#f5f5f7] px-4 py-3 text-xs text-[#1d1d1f]">
          고객 발주 <span className="font-semibold">{order.linkedPurchaseOrderNo}</span> 건으로 발행한 구매발주입니다.
        </div>
      )}

      <div className="space-y-2">
        {order.items.map((it, i) => (
          <div key={i} className="rounded-2xl bg-[#f5f5f7] p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[#1d1d1f]">{it.name}</p>
                {it.nameEn && <p className="mt-0.5 truncate text-xs text-[#86868b]">{it.nameEn}</p>}
                <p className="mt-0.5 text-xs text-[#86868b]">
                  {formatSupplierMoney(it.unitPrice, order.currency)} × {it.quantity} {it.unit || "PCS"}
                </p>
                {(it.costs ?? []).map((c, ci) => (
                  <p key={ci} className="mt-0.5 pl-3 text-xs text-[#86868b]">
                    + {c.name} {formatSupplierMoney(c.amount, order.currency)}
                  </p>
                ))}
              </div>
              <span className="shrink-0 text-sm font-semibold text-[#1d1d1f]">
                {formatSupplierMoney(calcSupplierItemTotal(it), order.currency)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-[#f0f0f0] pt-4">
        <span className="text-sm text-[#86868b]">합계</span>
        <div className="text-right">
          <p className="text-lg font-bold text-[#1d1d1f]">{formatSupplierMoney(order.totalAmount, order.currency)}</p>
          {order.exchangeRate ? (
            <p className="text-xs text-[#86868b]">약 {Math.round(order.totalAmount * order.exchangeRate).toLocaleString("ko-KR")}원</p>
          ) : null}
        </div>
      </div>

      {/* 공장 회신본 */}
      <div className="space-y-2 border-t border-[#f0f0f0] pt-4">
        <p className="text-xs font-semibold text-[#86868b]">공장 회신본 (도장 스캔본)</p>
        {order.confirmationFileUrl ? (
          <a
            href={order.confirmationFileUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-2.5 text-xs font-medium text-green-700 transition hover:bg-green-100"
          >
            <Check size={14} /> {order.confirmationFileName || "회신본"} 열기
          </a>
        ) : (
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[#d1d1d6] px-4 py-2.5 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]">
            <Upload size={14} /> {uploading ? "업로드 중..." : "회신본 업로드"}
            <input type="file" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0] ?? null)} disabled={uploading} />
          </label>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-[#f0f0f0] pt-4">
        <button
          onClick={() => setPreviewOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-[#1d1d1f] px-5 py-2 text-xs font-medium text-white transition hover:bg-black"
        >
          <Printer size={14} /> 발주서 보기 / PDF
        </button>
        {order.status === "draft" && (
          <button
            onClick={() => setSupplierOrderStatus(order.id, "issued")}
            className="rounded-full border border-[#d1d1d6] px-4 py-2 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
          >
            발행 처리
          </button>
        )}
        {order.status === "confirmed" && (
          <button
            onClick={() => setSupplierOrderStatus(order.id, "closed")}
            className="rounded-full border border-[#d1d1d6] px-4 py-2 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
          >
            종료 처리
          </button>
        )}
        {deleteConfirm ? (
          <button
            onClick={async () => { await deleteSupplierOrder(order.id); onClose(); }}
            className="ml-auto rounded-full bg-red-500 px-4 py-2 text-xs font-medium text-white transition hover:bg-red-600"
          >
            정말 삭제
          </button>
        ) : (
          <button
            onClick={() => setDeleteConfirm(true)}
            className="ml-auto rounded-full p-2 text-[#d1d1d6] transition hover:bg-red-50 hover:text-red-500"
            title="삭제"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

// 견적서 미리보기와 같은 구조 — 화면에 보이는 것을 그대로 인쇄한다(인쇄용 사본을 따로 두면
// 페이지 나눔이 어긋난다는 걸 계약서 쪽에서 이미 겪었다).
function PrintablePreview({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  return (
    <div className="-mx-4 -my-4 bg-[#e5e5e5] py-6 print:m-0 print:bg-white print:py-0">
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
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d1d1d6] text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
              title="닫기"
            >
              <X size={16} />
            </button>
            <p className="text-sm text-[#86868b]">{label}</p>
          </div>
          <button
            onClick={() => window.print()}
            className="rounded-full bg-[#1d1d1f] px-5 py-2 text-sm font-medium text-white transition hover:bg-black"
          >
            인쇄 / PDF 저장
          </button>
        </div>
      </div>
      <PdfPageScaler>{children}</PdfPageScaler>
    </div>
  );
}
