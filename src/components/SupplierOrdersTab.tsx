"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, X, Printer, FileText, Pencil, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenAllClientProducts, uploadClientProductImage } from "@/lib/firestore/products";
import { listenAllClientProductInternals, setClientProductInternal } from "@/lib/firestore/productInternal";
import {
  createSupplierProduct,
  deleteSupplierProduct,
  listenSupplierProducts,
  updateSupplierProduct,
  uploadSupplierProductImage,
} from "@/lib/firestore/supplierProducts";
import { listenClients } from "@/lib/firestore/clients";
import { listenAllPurchaseOrders } from "@/lib/firestore/purchaseOrders";
import {
  calcCostsTotal,
  calcSupplierItemTotal,
  calcSupplierOrderTotal,
  createSupplierOrder,
  deleteSupplierOrder,
  formatSupplierMoney,
  listenSupplierOrders,
  updateSupplierOrder,
} from "@/lib/firestore/supplierOrders";
import SupplierOrderDocument from "@/components/SupplierOrderDocument";
import PdfPageScaler from "@/components/PdfPageScaler";
import NumberInput from "@/components/NumberInput";
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
  SupplierPartItem,
  SupplierProduct,
} from "@/lib/types";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-[#f5f5f7] text-[#86868b]",
  issued: "bg-green-50 text-green-600",
};

const NO_SUPPLIER = "미지정";

// 결제조건 기본 문구 — 원화(국내) 발주서는 한글로 나가므로 기본값도 한글로 맞춘다.
const DEFAULT_PAYMENT_FOREIGN = "T/T 30% deposit, 70% before shipment";
const DEFAULT_PAYMENT_KRW = "계약금 30%, 출고 전 잔금 70%";

// 구매 카탈로그 한 줄. 출처가 둘(고객에게도 파는 제품 / 매입 전용 품목)이라, 화면과 발주
// 담기 로직이 출처를 신경 쓰지 않도록 공통 모양으로 한 번 펴서 쓴다.
export interface CatalogEntry {
  kind: "client" | "supplier";
  id: string;
  name: string;
  nameEn?: string;
  spec?: string;
  imageUrl?: string;
  supplierName: string;
  purchasePrice?: number;
  currency: SupplierCurrency;
  unit?: string;
  parts?: SupplierPartItem[];
  costItems?: SupplierCostItem[];
  subtitle: string;
  // 고객 제품일 때의 고객사명 — 발주서에 표기한다(매입 전용 품목은 없다).
  clientName?: string;
  // kind === "client"일 때만 — 매입 정보를 clientProductInternal에 저장할 때 필요하다.
  clientId?: string;
}

// 카탈로그에서 제품을 담을 때 만들어지는 발주 품목. 제품의 기본 부대비용은 전부 담되 체크는
// 꺼둔 상태로 시작한다 — 로트마다 붙는 항목이 달라서, 기본으로 켜두면 실수로 딸려 들어간다.
interface DraftItem extends SupplierOrderItem {
  key: string;
  costOptions: { cost: SupplierCostItem; checked: boolean }[];
  // 부품 수량은 "실제로 발주할 개수"다. 보통은 발주 수량을 따라가므로(2000세트면 부품도 2000개),
  // 카탈로그에 등록된 "완제품 1개당 수량"을 여기 들고 있다가 발주 수량이 바뀔 때마다 곱해서
  // 다시 맞춘다 — 세트당 자석이 2개면 2000세트에서 4000개가 되어야 하기 때문이다.
  partsPerUnit: number[];
  // 사용자가 그 부품 수량을 직접 고쳤으면 더는 자동으로 건드리지 않는다 — 어떤 부품만 여유분을
  // 더 발주하는 경우가 있어서다.
  partsOverridden: boolean[];
}

export default function SupplierOrdersTab({ onPreview }: { onPreview: (open: boolean) => void }) {
  const { appUser } = useAuth();
  const [products, setProducts] = useState<ClientProduct[]>([]);
  const [internals, setInternals] = useState<Record<string, ClientProductInternal>>({});
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [clientOrders, setClientOrders] = useState<PurchaseOrder[]>([]);
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]);
  const [selected, setSelected] = useState<SupplierOrder | null>(null);
  const [composing, setComposing] = useState(false);
  // 저장된 발주를 다시 열어 고칠 때 — 작성 화면을 그대로 재사용하고 저장만 갱신으로 바꾼다.
  const [editingOrder, setEditingOrder] = useState<SupplierOrder | null>(null);
  // 매입 정보를 편집 중인 제품 id — 고객 판매 정보(제품 카탈로그 탭)와 화면을 완전히 분리해서,
  // 파는 가격과 사오는 가격을 같은 칸에서 만지다 헷갈리는 일이 없게 한다.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);

  useEffect(() => listenAllClientProducts(setProducts), []);
  useEffect(() => listenAllClientProductInternals(setInternals), []);
  useEffect(() => listenClients(setClients), []);
  useEffect(() => listenSupplierOrders(setOrders), []);
  useEffect(() => listenAllPurchaseOrders(setClientOrders), []);
  useEffect(() => listenSupplierProducts(setSupplierProducts), []);

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

  // 발주처별 묶음 — 매입 정보가 하나라도 채워진 제품만 구매 카탈로그에 올린다(고객 판매용으로만
  // 등록해둔 제품까지 전부 나오면 목록이 쓸모없어진다).
  const entries = useMemo<CatalogEntry[]>(() => {
    const list: CatalogEntry[] = [];
    // 고객에게도 파는 제품 — 매입 정보가 하나라도 채워진 것만 구매 카탈로그에 올린다
    // (판매용으로만 등록해둔 제품까지 전부 나오면 목록이 쓸모없어진다).
    for (const p of products) {
      const internal = internals[p.id];
      if (!internal) continue;
      if (!internal.supplierName && internal.purchasePrice == null) continue;
      list.push({
        kind: "client",
        id: p.id,
        name: p.name,
        nameEn: internal.nameEn,
        imageUrl: p.imageUrl,
        supplierName: internal.supplierName || NO_SUPPLIER,
        purchasePrice: internal.purchasePrice,
        currency: internal.purchaseCurrency ?? "USD",
        unit: p.unit,
        parts: internal.parts,
        costItems: internal.costItems,
        subtitle: clientNameById[p.clientId] ?? "-",
        clientName: clientNameById[p.clientId],
        clientId: p.clientId,
      });
    }
    // 매입 전용 품목(금형·부자재 등) — 고객 제품과 무관하게 여기서 직접 등록한 것들.
    for (const sp of supplierProducts) {
      list.push({
        kind: "supplier",
        id: sp.id,
        name: sp.name,
        nameEn: sp.nameEn,
        spec: sp.spec,
        imageUrl: sp.imageUrl,
        supplierName: sp.supplierName || NO_SUPPLIER,
        purchasePrice: sp.purchasePrice,
        currency: sp.purchaseCurrency ?? "USD",
        unit: sp.unit,
        parts: sp.parts,
        costItems: sp.costItems,
        clientName: sp.clientName,
        subtitle: sp.clientName ? `매입 전용 · ${sp.clientName}` : "매입 전용",
      });
    }
    return list;
  }, [products, internals, supplierProducts, clientNameById]);

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogEntry[]>();
    for (const e of entries) {
      if (!map.has(e.supplierName)) map.set(e.supplierName, []);
      map.get(e.supplierName)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "ko"));
  }, [entries]);

  const clientNameOptions = useMemo(
    () => Array.from(new Set([...clients.map((c) => c.name), ...supplierProducts.map((p) => p.clientName).filter((n): n is string => !!n)])).sort((a, b) => a.localeCompare(b, "ko")),
    [clients, supplierProducts]
  );

  const supplierNames = useMemo(
    () => Array.from(new Set(entries.map((e) => e.supplierName).filter((n) => n !== NO_SUPPLIER))).sort((a, b) => a.localeCompare(b, "ko")),
    [entries]
  );

  // 아직 매입 정보가 없는 제품들 — "구매 품목으로 등록" 목록에 뜬다.
  const unregistered = useMemo(
    () => products.filter((p) => {
      const internal = internals[p.id];
      return !internal || (!internal.supplierName && internal.purchasePrice == null);
    }),
    [products, internals]
  );

  if (composing || editingOrder) {
    return (
      <SupplierOrderComposer
        editing={editingOrder}
        grouped={grouped}
        clientNameById={clientNameById}
        clientOrders={clientOrders}
        existingOrders={orders}
        onClose={() => { setComposing(false); setEditingOrder(null); }}
        onCreated={() => { setComposing(false); setEditingOrder(null); }}
        createdBy={appUser?.uid ?? ""}
        onPreview={onPreview}
      />
    );
  }

  if (selected) {
    return (
      <SupplierOrderDetail
        order={selected}
        onClose={() => setSelected(null)}
        onEdit={() => { setEditingOrder(selected); setSelected(null); }}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* 왼쪽 — 발주처별 구매 카탈로그 */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <button
            onClick={() => setComposing(true)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[#d1d1d6] py-2.5 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
          >
            <FileText size={14} /> 구매발주서 작성
          </button>
          <button
            onClick={() => { setCreatingNew(true); setPickerOpen(false); setEditingId(null); }}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[#d1d1d6] px-4 py-2.5 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
          >
            <Plus size={14} /> 새 품목 등록
          </button>
        </div>

        {/* 고객에게도 파는 제품은 이미 제품 카탈로그에 있으므로, 새로 만들지 않고 거기에 매입
            정보만 채운다 — 같은 물건을 두 군데 만들면 단가가 갈라진다. */}
        <button
          onClick={() => { setPickerOpen((v) => !v); setCreatingNew(false); }}
          className="w-full text-center text-xs font-medium text-[#86868b] underline underline-offset-4 transition hover:text-[#1d1d1f]"
        >
          고객 제품에 매입 정보 넣기
        </button>

        {pickerOpen && (
          <div className="overflow-hidden rounded-3xl bg-white">
            <div className="flex items-center justify-between border-b border-[#f0f0f0] px-5 py-3">
              <p className="text-xs font-semibold text-[#86868b]">매입 정보를 넣을 고객 제품 고르기</p>
              <button onClick={() => setPickerOpen(false)} className="rounded-full p-1 text-[#d1d1d6] transition hover:text-[#1d1d1f]">
                <X size={14} />
              </button>
            </div>
            {unregistered.length === 0 && (
              <p className="px-5 py-6 text-center text-sm text-[#86868b]">모든 제품에 매입 정보가 들어가 있습니다.</p>
            )}
            {unregistered.map((p) => (
              <button
                key={p.id}
                onClick={() => { setEditingId(p.id); setPickerOpen(false); }}
                className="flex w-full items-center justify-between gap-3 border-b border-[#f5f5f7] px-5 py-3 text-left transition last:border-b-0 hover:bg-[#f5f5f7]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#1d1d1f]">{p.name}</p>
                  <p className="mt-0.5 truncate text-xs text-[#86868b]">{clientNameById[p.clientId] ?? "-"}</p>
                </div>
                <Plus size={14} className="shrink-0 text-[#d1d1d6]" />
              </button>
            ))}
          </div>
        )}

        {/* 매입 전용 품목 새로 만들기 */}
        {creatingNew && (
          <div className="rounded-3xl bg-white p-5">
            <PurchaseInfoEditor
              entry={null}
              supplierNames={supplierNames}
              clientNameOptions={clientNameOptions}
              onDone={() => setCreatingNew(false)}
            />
          </div>
        )}

        {/* 아직 매입 정보가 없는 고객 제품을 고른 직후 — 목록에는 아직 안 뜨므로 여기서 바로 편집한다. */}
        {editingId && !entries.some((e) => e.id === editingId) && products.some((p) => p.id === editingId) && (
          <div className="rounded-3xl bg-white p-5">
            <PurchaseInfoEditor
              entry={{
                kind: "client",
                id: editingId,
                name: products.find((p) => p.id === editingId)!.name,
                imageUrl: products.find((p) => p.id === editingId)!.imageUrl,
                supplierName: "",
                currency: "USD",
                subtitle: "",
                clientId: products.find((p) => p.id === editingId)!.clientId,
              }}
              supplierNames={supplierNames}
              clientNameOptions={clientNameOptions}
              onDone={() => setEditingId(null)}
            />
          </div>
        )}

        {grouped.length === 0 && (
          <div className="rounded-3xl border border-dashed border-[#d1d1d6] bg-white p-10 text-center text-sm leading-relaxed text-[#86868b]">
            등록된 구매 품목이 없습니다.
            <br />
            <span className="text-xs">위 &quot;새 품목 등록&quot;에서 만들거나, 고객 제품에 발주처·매입 단가를 넣어주세요.</span>
          </div>
        )}

        {grouped.map(([supplier, rows]) => (
          <div key={supplier} className="overflow-hidden rounded-3xl bg-white">
            <div className="flex items-center justify-between border-b border-[#f0f0f0] px-5 py-3">
              <p className="font-semibold text-[#1d1d1f]">{supplier}</p>
              <span className="text-xs text-[#86868b]">{rows.length}개 품목</span>
            </div>
            {rows.map((e) => {
              const costTotal = (e.costItems ?? []).reduce((sum, c) => sum + (c.amount || 0), 0);
              return (
                <div key={`${e.kind}-${e.id}`} className="border-b border-[#f5f5f7] px-5 py-3 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    {e.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-[#e5e5e5] object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#1d1d1f]">{e.name}</p>
                      <p className="mt-0.5 truncate text-xs text-[#86868b]">
                        {e.subtitle}
                        {e.nameEn ? ` · ${e.nameEn}` : ""}
                      </p>
                      {(e.costItems ?? []).length > 0 && (
                        <p className="mt-0.5 text-xs text-[#d1d1d6]">
                          부대비용 {e.costItems!.length}건 · 최대 {formatSupplierMoney(costTotal, e.currency)}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-start gap-2">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[#1d1d1f]">
                          {e.purchasePrice != null ? formatSupplierMoney(e.purchasePrice, e.currency) : "단가 미입력"}
                        </p>
                        <p className="mt-0.5 text-xs text-[#d1d1d6]">매입 단가</p>
                      </div>
                      <button
                        onClick={() => setEditingId((prev) => (prev === e.id ? null : e.id))}
                        className="rounded-full p-1.5 text-[#d1d1d6] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                        title="매입 정보 수정"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                  </div>
                  {editingId === e.id && (
                    <div className="mt-3 border-t border-[#f0f0f0] pt-3">
                      <PurchaseInfoEditor entry={e} supplierNames={supplierNames} clientNameOptions={clientNameOptions} onDone={() => setEditingId(null)} />
                    </div>
                  )}
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
            {/* 목록에서 눌러보지 않고도 "아, 그 건이구나" 하고 알아볼 수 있어야 하므로
                고객명과 품목명을 맨 앞에 둔다. 발주번호·로트는 식별자라 아래로 내린다. */}
            <div className="flex items-center justify-between gap-2">
              <p className="truncate font-medium text-[#1d1d1f]">{o.supplierName || "-"}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[o.status]}`}>
                {SUPPLIER_ORDER_STATUS_LABEL[o.status]}
              </span>
            </div>
            {/* 눌러보지 않고도 어느 건인지 알 수 있게 품목명과 고객사를 나란히 둔다. */}
            <p className="mt-0.5 truncate text-sm text-[#1d1d1f]">
              {o.items.map((it) => it.name).filter(Boolean).join(", ") || "품목 없음"}
              {(() => {
                const clients = Array.from(new Set(o.items.map((it) => it.clientName).filter(Boolean)));
                return clients.length > 0 ? <span className="text-[#86868b]"> · {clients.join(", ")}</span> : null;
              })()}
            </p>
            <p className="mt-1 truncate text-xs text-[#86868b]">
              {formatSupplierMoney(o.totalAmount, o.currency)} · {new Date(o.createdAt).toLocaleDateString("ko-KR")}
            </p>
            <p className="mt-0.5 truncate text-xs text-[#d1d1d6]">
              {o.soNumber}
              {o.lotNo ? ` · Lot ${o.lotNo}` : ""}
              {o.linkedPurchaseOrderNo ? ` · 고객발주 ${o.linkedPurchaseOrderNo}` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- 매입 정보 편집 ----
//
// 고객에게 파는 가격(제품 카탈로그 탭)과 내가 사오는 가격을 같은 칸에서 만지면 헷갈린다는
// 피드백에 따라, 매입 정보 입력은 전부 이 구매 발주 탭 안으로 옮겼다. 저장 위치는 그대로
// clientProductInternal이라(관리자 전용 컬렉션) 고객 노출 위험은 달라지지 않고, 제품과
// 이어져 있어서 나중에 판매가 대비 매입가를 비교하는 것도 그대로 가능하다.
function PurchaseInfoEditor({
  entry,
  supplierNames,
  clientNameOptions,
  onDone,
}: {
  // null이면 "매입 전용 품목 새로 만들기" — 고객 제품과 무관하게 supplierProducts에 저장한다.
  entry: CatalogEntry | null;
  supplierNames: string[];
  clientNameOptions: string[];
  onDone: () => void;
}) {
  const isNew = entry === null;
  const [name, setName] = useState(entry?.name ?? "");
  const [supplierName, setSupplierName] = useState(entry && entry.supplierName !== NO_SUPPLIER ? entry.supplierName : "");
  const [purchasePrice, setPurchasePrice] = useState(entry?.purchasePrice != null ? String(entry.purchasePrice) : "");
  const [purchaseCurrency, setPurchaseCurrency] = useState<SupplierCurrency>(entry?.currency ?? "USD");
  const [nameEn, setNameEn] = useState(entry?.nameEn ?? "");
  const [spec, setSpec] = useState(entry?.spec ?? "");
  const [unit, setUnit] = useState(entry?.unit ?? "");
  const [clientName, setClientName] = useState(entry?.clientName ?? "");
  const [costItems, setCostItems] = useState<SupplierCostItem[]>(entry?.costItems ?? []);
  const [parts, setParts] = useState<SupplierPartItem[]>(entry?.parts ?? []);
  const [imageUrl, setImageUrl] = useState(entry?.imageUrl);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 부품이 하나라도 있으면 완제품 단가는 부품 합계로 고정한다 — 두 값을 따로 관리하면
  // 언젠가 반드시 어긋나고, 어느 쪽이 진짜인지 알 수 없게 된다.
  const partsTotal = parts.reduce((sum, p) => sum + (p.unitPrice || 0) * (p.quantity || 0), 0);
  const hasParts = parts.length > 0;
  const effectivePrice = hasParts ? partsTotal : purchasePrice.trim() ? Number(purchasePrice) : null;

  // 여기서도 undefined를 넣으면 Firestore가 저장을 거부한다(위 finalItems와 같은 이유) —
  // 영문명을 비워두면 그 키를 아예 빼서 보낸다.
  const cleanParts: SupplierPartItem[] = parts
    .filter((p) => p.name.trim())
    .map((p) => {
      const part: SupplierPartItem = { name: p.name.trim(), unitPrice: Number(p.unitPrice) || 0, quantity: Number(p.quantity) || 0 };
      if (p.nameEn?.trim()) part.nameEn = p.nameEn.trim();
      return part;
    });
  const cleanCosts: SupplierCostItem[] = costItems
    .filter((c) => c.name.trim())
    .map((c) => {
      const cost: SupplierCostItem = { name: c.name.trim(), amount: Number(c.amount) || 0, quantity: c.quantity ?? 1 };
      if (c.nameEn?.trim()) cost.nameEn = c.nameEn.trim();
      return cost;
    });

  async function handleImageChange(file: File | null) {
    if (!file) return;
    // 새로 만드는 중이면 문서가 아직 없어서 올릴 곳이 없다 — 저장할 때 함께 올린다.
    if (isNew) {
      setPendingImage(file);
      setImageUrl(URL.createObjectURL(file));
      return;
    }
    setUploading(true);
    try {
      if (entry!.kind === "client") await uploadClientProductImage(entry!.id, file);
      else await uploadSupplierProductImage(entry!.id, file);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (isNew && !name.trim()) return;
    setSaving(true);
    try {
      if (isNew) {
        const ref = await createSupplierProduct({
          supplierName: supplierName.trim(),
          name: name.trim(),
          clientName: clientName.trim() || undefined,
          nameEn: nameEn.trim() || undefined,
          spec: spec.trim() || undefined,
          purchasePrice: effectivePrice ?? undefined,
          purchaseCurrency,
          unit: unit.trim() || undefined,
          parts: cleanParts,
          costItems: cleanCosts,
        });
        if (pendingImage) await uploadSupplierProductImage(ref.id, pendingImage);
      } else if (entry!.kind === "client") {
        await setClientProductInternal(entry!.id, entry!.clientId!, {
          supplierName: supplierName.trim(),
          purchasePrice: effectivePrice,
          purchaseCurrency,
          nameEn: nameEn.trim(),
          costItems: cleanCosts,
          parts: cleanParts,
        });
      } else {
        await updateSupplierProduct(entry!.id, {
          supplierName: supplierName.trim(),
          name: name.trim(),
          clientName: clientName.trim() || undefined,
          nameEn: nameEn.trim() || undefined,
          spec: spec.trim() || undefined,
          purchasePrice: effectivePrice ?? undefined,
          purchaseCurrency,
          unit: unit.trim() || undefined,
          parts: cleanParts,
          costItems: cleanCosts,
        });
      }
      onDone();
    } finally {
      setSaving(false);
    }
  }

  // 고객 제품은 품명·사양·단위를 제품 카탈로그에서 관리하므로 여기서는 안 건드린다 —
  // 매입 전용 품목만 여기서 전부 입력한다.
  const editableIdentity = isNew || entry!.kind === "supplier";

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-[#86868b]">
        {isNew ? "새 구매 품목 (금형·부자재 등 — 고객에게는 보이지 않습니다)" : `${entry!.name} — 매입 정보`}
      </p>
      <datalist id="supplier-name-options">
        {supplierNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <datalist id="client-name-options">
        {clientNameOptions.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      {editableIdentity && (
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="품명 *"
            className="min-w-[9rem] flex-1 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
          />
          <input
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            placeholder="사양 (선택 — 재질·캐비티 등)"
            className="min-w-[9rem] flex-1 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
          />
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="단위(SET)"
            className="w-24 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
          />
          {/* 고객 제품은 어느 고객 건인지 자동으로 알지만, 매입 전용 품목은 알 길이 없어서
              여기서 적어둔다 — 발주에 담을 때 이 값이 그대로 따라가 발주서에 찍힌다. */}
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            list="client-name-options"
            placeholder="고객명 (선택 — 발주서에 표기)"
            className="min-w-[9rem] flex-1 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          value={supplierName}
          onChange={(e) => setSupplierName(e.target.value)}
          list="supplier-name-options"
          placeholder="발주처명 (공장)"
          className="w-40 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
        />
        <select
          value={purchaseCurrency}
          onChange={(e) => setPurchaseCurrency(e.target.value as SupplierCurrency)}
          className="rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs outline-none focus:border-[#86868b]"
        >
          <option value="USD">USD $</option>
          <option value="CNY">CNY ¥</option>
          <option value="KRW">KRW 원</option>
        </select>
        {hasParts ? (
          <div className="flex w-40 items-center gap-1.5 rounded-xl bg-[#f5f5f7] px-3 py-1.5 text-xs text-[#86868b]">
            <span className="shrink-0">단가</span>
            <span className="truncate font-semibold text-[#1d1d1f]">{formatSupplierMoney(partsTotal, purchaseCurrency)}</span>
            <span className="shrink-0 text-[10px] text-[#d1d1d6]">부품 합계</span>
          </div>
        ) : (
          <input
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            placeholder="매입 단가"
            className="w-28 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
          />
        )}
        <input
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          placeholder="영문/중문 품명 (발주서용)"
          className="min-w-[10rem] flex-1 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
        />
      </div>

      {/* 사진 — 발주서에도 함께 실려서 공장이 어떤 물건인지 바로 알아본다. */}
      <label className="flex cursor-pointer items-center gap-3">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#e5e5e5] bg-[#f5f5f7] text-[10px] text-[#d1d1d6]">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            "사진"
          )}
        </span>
        <span className="text-xs text-[#86868b]">{uploading ? "올리는 중..." : "눌러서 사진 등록/변경"}</span>
        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)} disabled={uploading} />
      </label>

      {/* 조립품 구성 부품 — 부품별 단가로 공장과 이야기하므로 그 내역을 그대로 들고 있는다. */}
      <div className="space-y-1.5">
        <p className="text-xs text-[#86868b]">구성 부품 (조립품이면 부품별 단가를 넣으세요 — 합계가 매입 단가가 됩니다)</p>
        {parts.map((pt, i) => (
          <div key={i} className="flex flex-wrap gap-2">
            <input
              value={pt.name}
              onChange={(e) => setParts((prev) => prev.map((it, idx) => (idx === i ? { ...it, name: e.target.value } : it)))}
              placeholder="부품명"
              className="min-w-[7rem] flex-1 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
            />
            <input
              value={pt.nameEn ?? ""}
              onChange={(e) => setParts((prev) => prev.map((it, idx) => (idx === i ? { ...it, nameEn: e.target.value } : it)))}
              placeholder="영문/중문"
              className="min-w-[7rem] flex-1 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
            />
            <NumberInput
              value={pt.unitPrice}
              onChange={(n) => setParts((prev) => prev.map((it, idx) => (idx === i ? { ...it, unitPrice: n } : it)))}
              placeholder="단가"
              className="w-20 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
            />
            <NumberInput
              value={pt.quantity}
              onChange={(n) => setParts((prev) => prev.map((it, idx) => (idx === i ? { ...it, quantity: n } : it)))}
              decimal={false}
              placeholder="수량"
              className="w-16 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
            />
            <button
              onClick={() => setParts((prev) => prev.filter((_, idx) => idx !== i))}
              className="rounded-full p-1.5 text-[#d1d1d6] transition hover:bg-red-50 hover:text-red-500"
              title="삭제"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setParts((prev) => [...prev, { name: "", unitPrice: 0, quantity: 1 }])}
            className="flex items-center gap-1 text-xs font-medium text-[#86868b] transition hover:text-[#1d1d1f]"
          >
            <Plus size={13} /> 부품 추가
          </button>
          {hasParts && (
            <span className="text-xs text-[#86868b]">
              부품 합계 <span className="font-semibold text-[#1d1d1f]">{formatSupplierMoney(partsTotal, purchaseCurrency)}</span>
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs text-[#86868b]">부대비용 기본 목록 (발주할 때 로트별로 골라 담습니다)</p>
        {costItems.map((c, i) => (
          <div key={i} className="flex flex-wrap gap-2">
            <input
              value={c.name}
              onChange={(e) => setCostItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, name: e.target.value } : it)))}
              placeholder="항목 (조립비·포장비 등)"
              className="min-w-[7rem] flex-1 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
            />
            <input
              value={c.nameEn ?? ""}
              onChange={(e) => setCostItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, nameEn: e.target.value } : it)))}
              placeholder="영문/중문"
              className="min-w-[7rem] flex-1 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
            />
            <NumberInput
              value={c.amount}
              onChange={(n) => setCostItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, amount: n } : it)))}
              placeholder="금액"
              className="w-20 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
            />
            <NumberInput
              value={c.quantity ?? 1}
              onChange={(n) => setCostItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, quantity: n } : it)))}
              decimal={false}
              placeholder="개수"
              className="w-16 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
            />
            <button
              onClick={() => setCostItems((prev) => prev.filter((_, idx) => idx !== i))}
              className="rounded-full p-1.5 text-[#d1d1d6] transition hover:bg-red-50 hover:text-red-500"
              title="삭제"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCostItems((prev) => [...prev, { name: "", amount: 0, quantity: 1 }])}
            className="flex items-center gap-1 text-xs font-medium text-[#86868b] transition hover:text-[#1d1d1f]"
          >
            <Plus size={13} /> 부대비용 항목 추가
          </button>
          {costItems.length > 0 && (
            <span className="text-xs text-[#86868b]">
              부대비용 합계 <span className="font-semibold text-[#1d1d1f]">{formatSupplierMoney(calcCostsTotal(cleanCosts), purchaseCurrency)}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saving || (isNew && !name.trim())}
          className="rounded-full bg-[#1d1d1f] px-4 py-1.5 text-xs font-medium text-white transition hover:bg-black disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
        <button
          onClick={onDone}
          disabled={saving}
          className="rounded-full border border-[#d1d1d6] px-4 py-1.5 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
        >
          취소
        </button>
        {/* 매입 전용 품목만 삭제할 수 있다 — 고객 제품은 제품 카탈로그에서 관리한다. */}
        {!isNew && entry!.kind === "supplier" && (
          <button
            onClick={async () => { await deleteSupplierProduct(entry!.id); onDone(); }}
            disabled={saving}
            className="ml-auto rounded-full p-1.5 text-[#d1d1d6] transition hover:bg-red-50 hover:text-red-500"
            title="품목 삭제"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ---- 발주서 작성 ----

function SupplierOrderComposer({
  grouped,
  clientNameById,
  clientOrders,
  existingOrders,
  onClose,
  onCreated,
  createdBy,
  onPreview,
  editing,
}: {
  grouped: [string, CatalogEntry[]][];
  clientNameById: Record<string, string>;
  clientOrders: PurchaseOrder[];
  existingOrders: SupplierOrder[];
  onClose: () => void;
  onCreated: () => void;
  createdBy: string;
  onPreview: (open: boolean) => void;
  // 있으면 새로 만드는 게 아니라 이 발주를 고치는 중이다.
  editing: SupplierOrder | null;
}) {
  const [supplierName, setSupplierName] = useState(editing?.supplierName ?? grouped[0]?.[0] ?? "");
  // 저장된 품목을 작성용 형태로 되돌린다 — 담겨 있던 부대비용은 전부 "체크된" 상태로 본다
  // (저장된 건 실제로 이번 발주에 들어간 것들뿐이다).
  const [items, setItems] = useState<DraftItem[]>(() =>
    (editing?.items ?? []).map((it, i) => ({
      ...it,
      key: `edit-${i}`,
      costOptions: (it.costs ?? []).map((c) => ({ cost: { ...c }, checked: true })),
      partsPerUnit: (it.parts ?? []).map((p) => (it.quantity > 0 ? p.quantity / it.quantity : p.quantity || 1)),
      partsOverridden: (it.parts ?? []).map(() => false),
    }))
  );
  const [currency, setCurrency] = useState<SupplierCurrency>(editing?.currency ?? "USD");
  const [exchangeRate, setExchangeRate] = useState(editing?.exchangeRate != null ? String(editing.exchangeRate) : "");
  const [rateDate, setRateDate] = useState("");
  const [rateLoading, setRateLoading] = useState(false);
  const [incoterms, setIncoterms] = useState(editing?.incoterms ?? "");
  const [portOfLoading, setPortOfLoading] = useState(editing?.portOfLoading ?? "");
  const [paymentTerms, setPaymentTerms] = useState(editing?.paymentTerms ?? DEFAULT_PAYMENT_FOREIGN);
  const [leadTimeDays, setLeadTimeDays] = useState(editing?.leadTimeDays != null ? String(editing.leadTimeDays) : "");
  const [packingNote, setPackingNote] = useState(editing?.packingNote ?? "");
  const [memo, setMemo] = useState(editing?.memo ?? "");
  // 로트 번호는 직접 안 적어도 되게 자동으로 만든다 — LOT-날짜-그날순번. 비워두면 계속
  // 자동값이 쓰이고, 공장이 자기 번호 체계를 요구하면 그 자리에 덮어쓰면 된다.
  const [lotNo, setLotNo] = useState(editing?.lotNo ?? "");
  const autoLotNo = useMemo(() => {
    const d = new Date();
    const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const prefix = `LOT-${dateStr}`;
    const todayCount = existingOrders.filter((o) => o.lotNo?.startsWith(prefix)).length;
    return `${prefix}-${String(todayCount + 1).padStart(2, "0")}`;
  }, [existingOrders]);
  const effectiveLotNo = lotNo.trim() || autoLotNo;
  const [linkedPoId, setLinkedPoId] = useState(editing?.linkedPurchaseOrderId ?? "");
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const rows = grouped.find(([s]) => s === supplierName)?.[1] ?? [];

  // 환율은 오늘 시세로 자동으로 채워준다 — 직접 찾아 입력하지 않아도 되게. 이미 값을 넣어둔
  // 상태에서 통화만 바꾼 경우에도 새 통화 기준으로 다시 받아온다(예전 통화의 환율이 남으면
  // 원가가 엉뚱하게 계산된다).
  const fetchRate = useCallback(async (cur: SupplierCurrency) => {
    if (cur === "KRW") {
      setExchangeRate("");
      setRateDate("");
      return;
    }
    setRateLoading(true);
    try {
      const res = await fetch(`/api/fx?base=${cur}`);
      if (!res.ok) throw new Error("fx");
      const data = (await res.json()) as { rate: number; date: string };
      setExchangeRate(String(data.rate));
      setRateDate(data.date);
    } catch {
      // 조회에 실패해도 발주 작성 자체는 막지 않는다 — 직접 입력하면 된다.
      setRateDate("");
    } finally {
      setRateLoading(false);
    }
  }, []);

  // 저장된 발주를 열 때는 그때 박아둔 환율을 그대로 둔다 — 지금 시세로 덮으면 그 건의
  // 원가가 나중에 바뀌어버린다. 통화를 실제로 바꿨을 때만 새로 받아온다.
  const rateInitialized = useRef(false);
  // 통화를 바꾸면 결제조건 기본 문구도 그 언어로 바꿔준다 — 직접 고쳐 쓴 문구는 건드리지 않는다.
  useEffect(() => {
    setPaymentTerms((prev) => {
      if (prev === DEFAULT_PAYMENT_FOREIGN && currency === "KRW") return DEFAULT_PAYMENT_KRW;
      if (prev === DEFAULT_PAYMENT_KRW && currency !== "KRW") return DEFAULT_PAYMENT_FOREIGN;
      return prev;
    });
  }, [currency]);

  useEffect(() => {
    if (!rateInitialized.current) {
      rateInitialized.current = true;
      if (editing) return;
    }
    fetchRate(currency);
  }, [currency, fetchRate, editing]);

  // 저장할 때 넘기는 최종 품목 — 체크된 부대비용만 담는다.
  // Firestore는 undefined를 값으로 받지 않고 예외를 던진다 — 배열 안에 든 객체도 마찬가지다.
  // 그래서 사양처럼 선택 항목을 비워두면(spec: undefined) 저장이 통째로 실패했다. 값이 없는
  // 키는 아예 빼서 보낸다.
  const finalItems: SupplierOrderItem[] = items.map((it) => {
    const item: SupplierOrderItem = {
      name: it.name,
      unitPrice: it.unitPrice,
      quantity: it.quantity,
      costs: it.costOptions
        .filter((c) => c.checked)
        .map((c) => {
          const cost: SupplierCostItem = { name: c.cost.name, amount: c.cost.amount, quantity: c.cost.quantity ?? 1 };
          if (c.cost.nameEn) cost.nameEn = c.cost.nameEn;
          return cost;
        }),
    };
    if (it.nameEn) item.nameEn = it.nameEn;
    if (it.spec) item.spec = it.spec;
    if (it.unit) item.unit = it.unit;
    if (it.sourceProductId) item.sourceProductId = it.sourceProductId;
    if (it.imageUrl) item.imageUrl = it.imageUrl;
    if (it.clientName) item.clientName = it.clientName;
    if (it.parts && it.parts.length > 0) {
      item.parts = it.parts.map((p) => {
        const part: SupplierPartItem = { name: p.name, unitPrice: p.unitPrice, quantity: p.quantity };
        if (p.nameEn) part.nameEn = p.nameEn;
        return part;
      });
    }
    return item;
  });

  const total = calcSupplierOrderTotal(finalItems);
  const linkedPo = clientOrders.find((o) => o.id === linkedPoId);

  usePrintFileName([supplierName, "구매발주서", items.map((it) => it.name).filter(Boolean).join(",")], previewOpen);
  // 미리보기 중에는 위쪽 "발주 관리" 헤더·탭을 감춰서 문서만 꽉 차게 보이게 한다.
  useEffect(() => {
    onPreview(previewOpen);
    return () => onPreview(false);
  }, [previewOpen, onPreview]);

  function addEntry(e: CatalogEntry) {
    setItems((prev) => [
      ...prev,
      {
        key: `${e.id}-${Date.now()}`,
        name: e.name,
        nameEn: e.nameEn,
        spec: e.spec,
        unitPrice: e.purchasePrice ?? 0,
        quantity: 1,
        unit: e.unit || "PCS",
        sourceProductId: e.id,
        // 부품 내역과 사진은 값을 복사해 둔다 — 나중에 품목 쪽이 바뀌어도 이미 나간 발주서는
        // 그대로여야 한다(부대비용을 복사해 담는 것과 같은 이유).
        parts: e.parts?.map((pt) => ({ ...pt })),
        partsPerUnit: (e.parts ?? []).map((pt) => pt.quantity || 1),
        partsOverridden: (e.parts ?? []).map(() => false),
        imageUrl: e.imageUrl,
        clientName: e.clientName,
        costOptions: (e.costItems ?? []).map((cost) => ({ cost: { ...cost }, checked: false })),
      },
    ]);
    // 품목에 저장된 통화를 발주 통화로 따라간다 — 첫 품목을 담을 때만 맞춰주고, 이후엔
    // 관리자가 고른 값을 존중한다(한 발주서 안에서 통화를 섞을 수는 없다).
    if (items.length === 0) setCurrency(e.currency);
  }

  // 금형비처럼 고객에게 파는 제품이 아니라 카탈로그에 없는 일회성 품목도 발주에 담아야 한다 —
  // 그런 것까지 제품으로 등록하게 만들면 고객 카탈로그가 지저분해진다.
  function addBlankItem() {
    setItems((prev) => [
      ...prev,
      { key: `blank-${Date.now()}`, name: "직접 입력 품목", unitPrice: 0, quantity: 1, unit: "SET", costOptions: [], partsPerUnit: [], partsOverridden: [] },
    ]);
  }

  // 부품이 있으면 그 합계가 곧 이 품목의 금액이다. 금액 계산(calcSupplierItemTotal)은
  // unitPrice × quantity를 쓰므로, 부품 합계를 발주 수량으로 나눈 값을 unitPrice에 넣어두면
  // 다시 곱해졌을 때 정확히 부품 합계가 된다 — 화면에 보이는 단가도 "세트당 얼마"가 되어 맞다.
  function syncedUnitPrice(parts: SupplierPartItem[], quantity: number, fallback: number) {
    if (parts.length === 0) return fallback;
    const sum = parts.reduce((acc, p) => acc + (p.unitPrice || 0) * (p.quantity || 0), 0);
    return quantity > 0 ? sum / quantity : sum;
  }

  function patchParts(key: string, nextParts: SupplierPartItem[], opts?: { overriddenIndex?: number }) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it;
        const partsOverridden = [...it.partsOverridden];
        if (opts?.overriddenIndex != null) partsOverridden[opts.overriddenIndex] = true;
        // 부품이 새로 추가·삭제되면 보조 배열 길이도 맞춰준다.
        const partsPerUnit = nextParts.map((p, i) => it.partsPerUnit[i] ?? (it.quantity > 0 ? (p.quantity || 0) / it.quantity : p.quantity || 1));
        return {
          ...it,
          parts: nextParts,
          partsPerUnit,
          partsOverridden: nextParts.map((_, i) => partsOverridden[i] ?? false),
          unitPrice: syncedUnitPrice(nextParts, it.quantity, it.unitPrice),
        };
      })
    );
  }

  // 발주 수량을 바꾸면 부품 수량도 함께 따라간다(직접 고친 부품은 그대로 둔다).
  function patchQuantity(key: string, quantity: number) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it;
        const parts = (it.parts ?? []).map((p, i) =>
          it.partsOverridden[i] ? p : { ...p, quantity: Math.round((it.partsPerUnit[i] ?? 1) * quantity) }
        );
        return { ...it, quantity, parts, unitPrice: syncedUnitPrice(parts, quantity, it.unitPrice) };
      })
    );
  }

  function patchItem(key: string, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  async function handleSave() {
    if (!supplierName.trim() || finalItems.length === 0) return;
    setSaving(true);
    try {
      if (editing) {
        // 발주번호·상태·회신본은 그대로 두고 내용만 갱신한다.
        await updateSupplierOrder(editing.id, {
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
          lotNo: effectiveLotNo,
          linkedPurchaseOrderId: linkedPo?.id,
          linkedPurchaseOrderNo: linkedPo?.poNumber,
        });
        onCreated();
        return;
      }
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
        lotNo: effectiveLotNo,
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
            lotNo: effectiveLotNo,
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
            {grouped.length === 0 && <option value="">등록된 발주처 없음</option>}
            {grouped.map(([s]) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="overflow-hidden rounded-3xl bg-white">
          <p className="border-b border-[#f0f0f0] px-5 py-3 text-xs font-semibold text-[#86868b]">제품을 눌러 발주에 담기</p>
          {rows.length === 0 && <p className="px-5 py-6 text-center text-sm text-[#86868b]">이 발주처의 품목이 없습니다.</p>}
          {rows.map((e) => (
            <button
              key={`${e.kind}-${e.id}`}
              onClick={() => addEntry(e)}
              className="flex w-full items-center justify-between gap-3 border-b border-[#f5f5f7] px-5 py-3 text-left transition last:border-b-0 hover:bg-[#f5f5f7]"
            >
              {e.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-[#e5e5e5] object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#1d1d1f]">{e.name}</p>
                <p className="mt-0.5 truncate text-xs text-[#86868b]">{e.subtitle}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm text-[#86868b]">
                  {e.purchasePrice != null ? formatSupplierMoney(e.purchasePrice, e.currency) : "-"}
                </span>
                <Plus size={14} className="text-[#d1d1d6]" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 오른쪽 — 담긴 품목 + 발주 조건 */}
      <div className="space-y-4 self-start rounded-3xl bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold text-[#1d1d1f]">{editing ? `${editing.soNumber} 수정` : "구매발주서 작성"}</p>
          <button
            onClick={() => setPreviewOpen(true)}
            disabled={finalItems.length === 0}
            className="flex items-center gap-1.5 rounded-full border border-[#d1d1d6] px-4 py-1.5 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f] disabled:opacity-40"
          >
            <Printer size={13} /> 미리보기
          </button>
        </div>

        {items.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[#d1d1d6] px-4 py-8 text-center text-sm text-[#86868b]">
            왼쪽에서 제품을 눌러 담거나, 아래에서 직접 입력하세요.
          </p>
        )}

        {items.map((it) => (
          <div key={it.key} className="space-y-2 rounded-2xl bg-[#f5f5f7] p-3">
            <div className="flex items-start justify-between gap-2">
              {it.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-[#e5e5e5] object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <input
                  value={it.name}
                  onChange={(e) => patchItem(it.key, { name: e.target.value })}
                  placeholder="품명 (내부용)"
                  className="w-full rounded-lg border border-[#d1d1d6] bg-white px-2.5 py-1 text-xs font-medium outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
                />
                <input
                  value={it.nameEn ?? ""}
                  onChange={(e) => patchItem(it.key, { nameEn: e.target.value })}
                  placeholder="영문/중문 품명 (발주서에 찍힘)"
                  className="mt-1 w-full rounded-lg border border-[#d1d1d6] bg-white px-2.5 py-1 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
                />
                <input
                  value={it.spec ?? ""}
                  onChange={(e) => patchItem(it.key, { spec: e.target.value })}
                  placeholder="사양 (선택 — 재질·캐비티·치수 등)"
                  className="mt-1 w-full rounded-lg border border-[#d1d1d6] bg-white px-2.5 py-1 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
                />
                {/* 고객 제품에서 담으면 자동으로 채워지고, 매입 전용·직접 입력 품목은 여기서
                    직접 적는다 — 어느 고객 건인지가 발주서에 찍혀야 라벨·포장 구분이 된다. */}
                <input
                  value={it.clientName ?? ""}
                  onChange={(e) => patchItem(it.key, { clientName: e.target.value })}
                  placeholder="고객명 (선택 — 발주서에 표기)"
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
              {(it.parts ?? []).length > 0 ? (
                <span className="rounded-lg bg-white px-2.5 py-1 text-xs text-[#1d1d1f]" title="부품 합계로 자동 계산됩니다">
                  {formatSupplierMoney(it.unitPrice, currency)}
                </span>
              ) : (
                <NumberInput
                  value={it.unitPrice}
                  onChange={(n) => patchItem(it.key, { unitPrice: n })}
                  placeholder="단가"
                  className="w-24 rounded-lg border border-[#d1d1d6] bg-white px-2.5 py-1 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
                />
              )}
              <span className="text-xs text-[#86868b]">×</span>
              <NumberInput
                value={it.quantity}
                onChange={(n) => patchQuantity(it.key, n)}
                decimal={false}
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

            {/* 구성 부품 — 카탈로그에서 담아온 것도, 직접 입력 품목도 여기서 바로 고칠 수 있다.
                부품이 하나라도 있으면 위 단가는 부품 합계로 자동 계산된다. */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#86868b]">구성 부품 (수량은 발주 수량을 따라갑니다)</p>
                {(it.parts ?? []).length > 0 && (
                  <span className="text-xs text-[#86868b]">
                    부품 합계{" "}
                    <span className="font-semibold text-[#1d1d1f]">
                      {formatSupplierMoney((it.parts ?? []).reduce((sum, p) => sum + p.unitPrice * p.quantity, 0), currency)}
                    </span>
                  </span>
                )}
              </div>
              {(it.parts ?? []).map((pt, pi) => (
                /* 줄바꿈을 허용하면 삭제 버튼만 다음 줄로 밀린다 — 한 줄에 고정하고, 대신
                   이름 칸이 좁은 화면에서 줄어들도록 최소 폭을 두지 않는다. */
                <div key={pi} className="flex items-center gap-1.5">
                  <input
                    value={pt.name}
                    onChange={(e) => patchParts(it.key, (it.parts ?? []).map((x, xi) => (xi === pi ? { ...x, name: e.target.value } : x)))}
                    placeholder="부품명"
                    className="min-w-0 flex-1 rounded-lg border border-[#d1d1d6] bg-white px-2.5 py-1 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
                  />
                  <input
                    value={pt.nameEn ?? ""}
                    onChange={(e) => patchParts(it.key, (it.parts ?? []).map((x, xi) => (xi === pi ? { ...x, nameEn: e.target.value } : x)))}
                    placeholder="영문/중문"
                    className="min-w-0 flex-1 rounded-lg border border-[#d1d1d6] bg-white px-2.5 py-1 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
                  />
                  <NumberInput
                    value={pt.unitPrice}
                    onChange={(n) => patchParts(it.key, (it.parts ?? []).map((x, xi) => (xi === pi ? { ...x, unitPrice: n } : x)))}
                    placeholder="단가"
                    className="w-20 shrink-0 rounded-lg border border-[#d1d1d6] bg-white px-2.5 py-1 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
                  />
                  <NumberInput
                    value={pt.quantity}
                    onChange={(n) =>
                      patchParts(it.key, (it.parts ?? []).map((x, xi) => (xi === pi ? { ...x, quantity: n } : x)), { overriddenIndex: pi })
                    }
                    decimal={false}
                    placeholder="수량"
                    title={it.partsOverridden[pi] ? "직접 지정한 수량 — 발주 수량을 바꿔도 그대로 유지됩니다." : "발주 수량을 따라갑니다."}
                    className={`w-16 shrink-0 rounded-lg border bg-white px-2.5 py-1 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b] ${
                      it.partsOverridden[pi] ? "border-[#1d1d1f]" : "border-[#d1d1d6]"
                    }`}
                  />
                  <span className="w-20 shrink-0 text-right text-xs font-medium text-[#1d1d1f]">
                    {formatSupplierMoney(pt.unitPrice * pt.quantity, currency)}
                  </span>
                  <button
                    onClick={() => patchParts(it.key, (it.parts ?? []).filter((_, xi) => xi !== pi))}
                    className="shrink-0 rounded-full p-1 text-[#d1d1d6] transition hover:bg-red-50 hover:text-red-500"
                    title="삭제"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => patchParts(it.key, [...(it.parts ?? []), { name: "", unitPrice: 0, quantity: it.quantity || 1 }])}
                className="flex items-center gap-1 text-xs font-medium text-[#86868b] transition hover:text-[#1d1d1f]"
              >
                <Plus size={12} /> 부품 추가
              </button>
            </div>

            {/* 로트별 부대비용 — 체크한 것만 이번 발주에 들어간다. */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#86868b]">이번 로트 부대비용</p>
              {it.costOptions.length === 0 && <p className="text-xs text-[#d1d1d6]">등록된 부대비용이 없습니다. 아래에서 직접 추가할 수 있습니다.</p>}
              {it.costOptions.map((opt, ci) => (
                <div key={ci} className="flex items-center gap-1.5">
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
                    className="min-w-0 flex-1 rounded-lg border border-[#d1d1d6] bg-white px-2.5 py-1 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
                  />
                  <input
                    value={opt.cost.nameEn ?? ""}
                    onChange={(e) =>
                      patchItem(it.key, {
                        costOptions: it.costOptions.map((o, idx) => (idx === ci ? { ...o, cost: { ...o.cost, nameEn: e.target.value } } : o)),
                      })
                    }
                    placeholder="영문/중문"
                    className="min-w-0 flex-1 rounded-lg border border-[#d1d1d6] bg-white px-2.5 py-1 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
                  />
                  <NumberInput
                    value={opt.cost.amount}
                    onChange={(n) =>
                      patchItem(it.key, {
                        costOptions: it.costOptions.map((o, idx) => (idx === ci ? { ...o, cost: { ...o.cost, amount: n } } : o)),
                      })
                    }
                    placeholder="금액"
                    className="w-20 shrink-0 rounded-lg border border-[#d1d1d6] bg-white px-2.5 py-1 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
                  />
                  <NumberInput
                    value={opt.cost.quantity ?? 1}
                    onChange={(n) =>
                      patchItem(it.key, {
                        costOptions: it.costOptions.map((o, idx) => (idx === ci ? { ...o, cost: { ...o.cost, quantity: n } } : o)),
                      })
                    }
                    decimal={false}
                    placeholder="개수"
                    className="w-14 shrink-0 rounded-lg border border-[#d1d1d6] bg-white px-2.5 py-1 text-xs outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
                  />
                  <button
                    onClick={() => patchItem(it.key, { costOptions: it.costOptions.filter((_, idx) => idx !== ci) })}
                    className="shrink-0 rounded-full p-1 text-[#d1d1d6] transition hover:bg-red-50 hover:text-red-500"
                    title="삭제"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => patchItem(it.key, { costOptions: [...it.costOptions, { cost: { name: "", amount: 0, quantity: 1 }, checked: true }] })}
                  className="flex items-center gap-1 text-xs font-medium text-[#86868b] transition hover:text-[#1d1d1f]"
                >
                  <Plus size={12} /> 항목 추가
                </button>
                {it.costOptions.some((c) => c.checked) && (
                  <span className="text-xs text-[#86868b]">
                    부대비용 합계{" "}
                    <span className="font-semibold text-[#1d1d1f]">
                      {formatSupplierMoney(calcCostsTotal(it.costOptions.filter((c) => c.checked).map((c) => c.cost)), currency)}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={addBlankItem}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[#d1d1d6] py-2 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
        >
          <Plus size={13} /> 직접 입력 품목 추가 (금형비 등)
        </button>

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
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-1 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs">
                  <span className="shrink-0 text-[#86868b]">1 {currency} =</span>
                  <input
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value.replace(/[^0-9.]/g, ""))}
                    inputMode="decimal"
                    placeholder={rateLoading ? "불러오는 중" : "직접 입력"}
                    className="w-16 bg-transparent text-right outline-none placeholder:text-[#d1d1d6]"
                  />
                  <span className="shrink-0 text-[#86868b]">원</span>
                </div>
                <button
                  onClick={() => fetchRate(currency)}
                  disabled={rateLoading}
                  title="오늘 시세로 다시 불러오기"
                  className="rounded-full p-1.5 text-[#d1d1d6] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f] disabled:opacity-40"
                >
                  <RefreshCw size={13} className={rateLoading ? "animate-spin" : ""} />
                </button>
              </div>
            )}
            <input
              value={lotNo || autoLotNo}
              onChange={(e) => setLotNo(e.target.value)}
              title="자동으로 매겨집니다. 공장이 쓰는 번호가 따로 있으면 덮어쓰세요."
              className="w-40 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs outline-none focus:border-[#86868b]"
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
          <p className="-mt-2 text-right text-xs text-[#86868b]">
            약 {Math.round(total * Number(exchangeRate)).toLocaleString("ko-KR")}원
            {rateDate && <span className="ml-1 text-[#d1d1d6]">· 시장 환율 {rateDate.slice(0, 16)}</span>}
          </p>
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
            {saving ? "저장 중..." : editing ? "수정 저장" : "발주서 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- 발행된 구매발주 상세 ----

function SupplierOrderDetail({
  order,
  onClose,
  onEdit,
}: {
  order: SupplierOrder;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [deleteConfirm, setDeleteConfirm] = useState(false);

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
                {(it.parts ?? []).map((pt, pi) => (
                  <p key={pi} className="mt-0.5 pl-3 text-xs text-[#86868b]">
                    · {pt.name} {formatSupplierMoney(pt.unitPrice, order.currency)} × {pt.quantity}
                  </p>
                ))}
                {(it.costs ?? []).map((c, ci) => (
                  <p key={ci} className="mt-0.5 pl-3 text-xs text-[#86868b]">
                    + {c.name} {formatSupplierMoney(c.amount, order.currency)}
                    {(c.quantity ?? 1) !== 1 && ` × ${c.quantity} = ${formatSupplierMoney(c.amount * (c.quantity ?? 1), order.currency)}`}
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
            <p className="text-xs text-[#86868b]">
              약 {Math.round(order.totalAmount * order.exchangeRate).toLocaleString("ko-KR")}원
              {/* 발행 당시 환율을 함께 남긴다 — 나중에 시세가 움직여도 이 건의 원가가 어떤
                  기준으로 계산된 값인지 알 수 있어야 한다. */}
              <span className="ml-1 text-[#d1d1d6]">
                (1 {order.currency} = {order.exchangeRate.toLocaleString("ko-KR")}원)
              </span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-[#f0f0f0] pt-4">
        {/* 인쇄는 (app) 레이아웃 바깥의 전용 페이지에서 한다 — 사이드바·상단바가 있는 화면
            안에서 인쇄하면 숨긴 요소들이 자리를 차지해 빈 두 번째 장이 생긴다(발주서·청구서가
            전부 전용 라우트인 이유). */}
        <Link
          href={`/supplier-orders/${order.id}/print`}
          className="flex items-center gap-1.5 rounded-full bg-[#1d1d1f] px-5 py-2 text-xs font-medium text-white transition hover:bg-black"
        >
          <Printer size={14} /> 발주서 보기 / PDF
        </Link>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 rounded-full border border-[#d1d1d6] px-4 py-2 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
        >
          <Pencil size={13} /> 수정
        </button>
        {/* 발행 처리 버튼은 두지 않는다 — 발주서를 실제로 뽑는 시점이 곧 보내는 시점이라,
            인쇄 페이지를 열면 자동으로 "발행됨"이 된다. 버튼을 따로 누르게 하면 누르는 걸
            잊어버려서 상태가 실제와 어긋난다. */}
        {/* 이미 공장에 나간 발주서는 지울 수 없다 — 서명 완료된 계약서를 못 지우는 것과 같은
            이유로, 실제로 주고받은 문서가 기록에서 사라지면 안 된다. 작성만 해둔 건은 지운다. */}
        {order.status === "draft" &&
          (deleteConfirm ? (
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
          ))}
      </div>
    </div>
  );
}

// 견적서 미리보기와 같은 구조 — 화면에 보이는 것을 그대로 인쇄한다(인쇄용 사본을 따로 두면
// 페이지 나눔이 어긋난다는 걸 계약서 쪽에서 이미 겪었다).
// 작성 중인 발주서를 화면에서 확인하는 용도. 인쇄는 여기서 하지 않는다 — 사이드바·상단바가
// 있는 (app) 레이아웃 안에서 인쇄하면 숨긴 요소들이 자리를 그대로 차지해서 빈 두 번째 장이
// 생긴다. 저장한 뒤 /supplier-orders/[id]/print 전용 페이지에서 뽑는다.
function PrintablePreview({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  // 바 높이는 화면 폭에 따라 줄바꿈되며 달라지므로 고정값 대신 실제로 잰다.
  useLayoutEffect(() => {
    function measure() {
      if (headerRef.current) setHeaderHeight(headerRef.current.offsetHeight);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div
      className="-mx-4 -mb-4 -mt-[calc(4.5rem+env(safe-area-inset-top))] min-h-screen bg-[#e5e5e5] md:-mx-6 md:-mb-6 md:-mt-[calc(5.5rem+env(safe-area-inset-top))]"
    >
      {/* 앱 상단바(h-14, fixed) 바로 아래에 이어붙인다 — 덮지 않고 그 밑에 붙어야 한다. */}
      <div
        ref={headerRef}
        className="fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-10 border-b border-[#e5e5e5] bg-white/90 px-4 py-3 backdrop-blur-xl print:hidden md:left-56"
      >
        <div className="mx-auto flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-3">
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
          {/* 여기서 바로 인쇄하지 않는다 — 사이드바·상단바가 있는 화면 안에서 인쇄하면
              숨긴 요소들이 자리를 차지해 빈 두 번째 장이 생긴다. 저장한 뒤 전용 인쇄
              페이지에서 뽑는다. */}
          <p className="text-xs text-[#86868b]">저장한 뒤 &quot;발주서 보기 / PDF&quot;에서 인쇄할 수 있습니다.</p>
        </div>
      </div>

      <div className="px-4 pb-10" style={{ paddingTop: 56 + headerHeight }}>
        <PdfPageScaler>{children}</PdfPageScaler>
      </div>
    </div>
  );
}
