"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, documentId, getDocs, query, where } from "firebase/firestore";
import { Eye, FileText, Plus, Receipt, Trash2, CheckSquare } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { listenSupplierOrdersByPartner, formatSupplierMoney } from "@/lib/firestore/supplierOrders";
import {
  listenSupplierInvoicesByPartner,
  createSupplierInvoice,
  deleteSupplierInvoice,
} from "@/lib/firestore/supplierInvoices";
import {
  SupplierOrder,
  SupplierOrderKind,
  SupplierInvoice,
  SupplierInvoiceLineItem,
  SupplierCurrency,
  SUPPLIER_INVOICE_STATUS_LABEL,
  SUPPLIER_ORDER_INSTALLMENT_LABEL,
  SUPPLIER_ORDER_KIND_LABEL,
  SUPPLIER_ORDER_KIND_BADGE_CLASS,
} from "@/lib/types";
import { zh, usePartnerZh, useZhAutoTranslate, translateToKoreanForCache } from "@/lib/i18n";
import NumberInput from "@/components/NumberInput";
import PrintablePreview from "@/components/PrintablePreview";
import SupplierInvoiceDocument from "@/components/SupplierInvoiceDocument";
import { takeAiAssistantDraft } from "@/lib/aiAssistantHandoff";
import { toProxiedUrl } from "@/lib/storageProxy";
import { getCached, setCached } from "@/lib/queryCache";

const STATUS_STYLE: Record<string, string> = {
  submitted: "bg-amber-50 text-amber-600",
  paid: "bg-green-50 text-green-600",
};

function newId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// 협력사(파트너) 계정 전용 — HANDYHAND가 발행한 발주서 중 아직 청구서에 담지 않은 것(미수금)을
// 보여주고, 그걸 골라(또는 발주서와 무관한 비용을 직접 입력해) 청구서를 제출한다.
export default function MyInvoicesPage() {
  const { appUser } = useAuth();
  const isPartner = appUser?.role === "partner";
  const isZh = usePartnerZh();
  // 메뉴 전환 때마다 리스너를 새로 맺고 첫 응답을 기다리느라 "불러오는 중..."이 매번
  // 길게 보였다 — 직전에 받아온 값을 캐시에서 먼저 꺼내 보여주고, 리스너는 그대로
  // 백그라운드에서 다시 맺어 최신값으로 조용히 갱신한다.
  const ordersCacheKey = `my-invoices:orders:${appUser?.uid}`;
  const invoicesCacheKey = `my-invoices:invoices:${appUser?.uid}`;
  const [orders, setOrders] = useState<SupplierOrder[]>(() => getCached(ordersCacheKey) ?? []);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>(() => getCached(invoicesCacheKey) ?? []);
  const [loaded, setLoaded] = useState(() => getCached(invoicesCacheKey) !== undefined);
  const [projects, setProjects] = useState<{ id: string; name: string; nameZh?: string }[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [currencyChoice, setCurrencyChoice] = useState<SupplierCurrency>("USD");
  // 중국 협력사 계정은 결국 위안화로 받으므로 고를 필요 없이 고정한다 — 선택지를 보여주면
  // 실수로 USD/KRW를 고를 위험만 생긴다.
  const currency: SupplierCurrency = isZh ? "CNY" : currencyChoice;
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  // 발주 하나를 선금/잔금으로 나눠 여러 번 청구할 수 있어서, "이번 청구가 어느 차수인지"는
  // 발주에 저장된 값이 아니라 청구서를 쓸 때마다 여기서 고른다(기본값은 defaultBilling이
  // 제안). 사용자가 직접 고른 것만 여기 담긴다 — 안 고른 발주는 defaultBilling을 그대로 쓴다.
  const [orderBillingOverrides, setOrderBillingOverrides] = useState<Record<string, { type: "deposit" | "balance" | "full"; percent: number }>>({});
  const [customItems, setCustomItems] = useState<{ id: string; description: string; amount: number; projectId: string }[]>([]);
  // 청구서를 월별로 모아 만드는 경우가 많아서, 이력 목록에서 "몇 월 청구서인지" 제목만
  // 보고 바로 알아볼 수 있게 한다. 항상 월별인 건 아니라 자유 입력 + 이번 달 제목을
  // 기본값으로 미리 채워주는 정도로만 돕는다.
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{ items: SupplierInvoiceLineItem[]; titleKo?: string; memoKo?: string } | null>(null);
  const [previewLang, setPreviewLang] = useState<"zh" | "ko">("zh");

  useEffect(() => {
    if (!appUser || !isPartner) return;
    return listenSupplierOrdersByPartner(appUser.uid, (o) => {
      setOrders(o);
      setCached(ordersCacheKey, o);
    });
  }, [appUser, isPartner, ordersCacheKey]);

  // /organize의 AI 비서가 "청구서 작성"으로 판단한 결과를 여기로 넘겨받는다. 자유 품목은
  // 직접 추가 항목(설명·금액)으로 채우고, orderNumbers(이미 발행된 발주서를 그대로 담으라는
  // 지시)가 있으면 그 발주들의 체크박스를 자동으로 선택한다 — 잔금/선금 비율 계산은 이
  // 화면의 기존 로직(getBilling/billedAmountForOrder)을 그대로 쓴다. 실제 제출은 사람이
  // 확인하고 직접 눌러야 한다.
  const [pendingOrderNumbers, setPendingOrderNumbers] = useState<string[] | null>(null);
  useEffect(() => {
    if (!isPartner) return;
    const draft = takeAiAssistantDraft("invoice");
    if (!draft) return;
    setSelectedOrderIds([]);
    setOrderBillingOverrides({});
    if (draft.currency) setCurrencyChoice(draft.currency);
    const now = new Date();
    setTitle(isZh ? `${now.getMonth() + 1}月账单` : `${now.getMonth() + 1}월 청구서`);
    setCustomItems(
      draft.items.map((it) => {
        const qtyLabel = it.quantity > 1 ? ` ${it.quantity}${it.unit || "EA"} × ${it.unitPrice.toLocaleString()}` : "";
        const amount = it.quantity > 0 ? it.quantity * it.unitPrice : it.unitPrice;
        return { id: newId(), description: `${it.name}${it.spec ? ` (${it.spec})` : ""}${qtyLabel}`, amount, projectId: "" };
      })
    );
    setMemo(draft.memo ?? "");
    setSubmitError("");
    setShowForm(true);
    if (draft.orderNumbers && draft.orderNumbers.length > 0) setPendingOrderNumbers(draft.orderNumbers);
  }, [isPartner, isZh]);

  // orders 목록은 별도 실시간 리스너로 들어와서, 위 효과가 실행되는 시점엔 아직 비어있을
  // 수 있다 — orders가 채워진 뒤에 soNumber로 매칭해 체크박스를 선택한다.
  useEffect(() => {
    if (!pendingOrderNumbers || orders.length === 0) return;
    const matchedIds = orders.filter((o) => pendingOrderNumbers.includes(o.soNumber)).map((o) => o.id);
    if (matchedIds.length > 0) setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...matchedIds])));
    setPendingOrderNumbers(null);
  }, [orders, pendingOrderNumbers]);

  useEffect(() => {
    if (!appUser || !isPartner) return;
    return listenSupplierInvoicesByPartner(appUser.uid, (inv) => {
      setInvoices(inv);
      setCached(invoicesCacheKey, inv);
      setLoaded(true);
    });
  }, [appUser, isPartner, invoicesCacheKey]);

  useEffect(() => {
    const ids = appUser?.projectIds ?? [];
    if (ids.length === 0) return;
    (async () => {
      const list: { id: string; name: string; nameZh?: string }[] = [];
      for (const part of chunk(ids, 10)) {
        const snap = await getDocs(query(collection(db, "projects"), where(documentId(), "in", part)));
        snap.docs.forEach((d) => list.push({ id: d.id, name: d.data().name, nameZh: d.data().nameZh || undefined }));
      }
      setProjects(list);
    })();
  }, [appUser?.projectIds]);

  // 프로젝트명은 관리자가 직접 입력한 자유 텍스트라 기계 번역으로 처리한다 — 다른 화면과
  // 같은 방식(미리 번역된 nameZh 우선, 없으면 즉석 번역).
  const zhProjectNames = useZhAutoTranslate(isZh, [
    ...projects.map((p) => p.name),
    ...orders.map((o) => o.linkedProjectName || "").filter(Boolean),
  ]);
  function trProjectName(name: string, nameZh?: string): string {
    return (isZh && nameZh) || zhProjectNames[name] || name;
  }

  // 발주 하나가 선금→잔금처럼 여러 번 나눠 청구될 수 있어서, "청구서에 한 번이라도 담겼는지"가
  // 아니라 "총액 중 이미 청구된 금액이 얼마인지"로 추적해야 한다 — 선금을 청구했다고 그
  // 발주가 더 이상 안 보이면 나중에 잔금을 청구할 방법이 없어진다.
  const invoicedAmountByOrderId = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of invoices) {
      for (const it of inv.items) {
        if (it.source !== "order" || !it.supplierOrderId) continue;
        map.set(it.supplierOrderId, (map.get(it.supplierOrderId) ?? 0) + it.amount);
      }
    }
    return map;
  }, [invoices]);

  function remainingOf(o: SupplierOrder): number {
    const invoiced = invoicedAmountByOrderId.get(o.id) ?? 0;
    return Math.max(0, Math.round((o.totalAmount - invoiced) * 100) / 100);
  }

  // 지급완료된 과거 청구서 중, 실제 입금액이 청구액과 달랐는데 아직 다음 청구서에 반영 안 된
  // 것들 — 같은 통화끼리만 합산한다(통화가 섞이면 "하나의 금액"으로 더할 수 없다). 양수면
  // 미납(이번에 더 받아야 함), 음수면 초과입금(이번에 덜 받아야 함).
  const unreconciled = useMemo(() => {
    const matches = invoices.filter(
      (inv) => inv.status === "paid" && typeof inv.paidAmount === "number" && !inv.carriedForward && inv.currency === currency
    );
    const amount = matches.reduce((sum, inv) => sum + (inv.totalAmount - (inv.paidAmount ?? inv.totalAmount)), 0);
    return { invoiceIds: matches.map((inv) => inv.id), amount: Math.round(amount * 100) / 100 };
  }, [invoices, currency]);
  const [includeAdjustment, setIncludeAdjustment] = useState(true);

  // 선금/잔금 구분을 쓰는 발주이거나, 이미 일부 청구된 적 있는 발주만 "이번 청구 차수"
  // 선택지를 보여준다 — 그 기능을 전혀 안 쓰는 평범한 단일 발주는 예전처럼 깔끔하게 전액만 보인다.
  function needsPhaseSelector(o: SupplierOrder): boolean {
    return !!o.installmentType || (invoicedAmountByOrderId.get(o.id) ?? 0) > 0.009;
  }

  function defaultBilling(o: SupplierOrder): { type: "deposit" | "balance" | "full"; percent: number } {
    const invoiced = invoicedAmountByOrderId.get(o.id) ?? 0;
    if (invoiced <= 0.009) {
      // 아직 한 번도 청구 안 한 발주 — 발주 작성 시 관리자가 걸어둔 구분을 그대로 제안한다.
      return o.installmentType
        ? { type: o.installmentType, percent: o.installmentType === "full" ? 100 : (o.installmentPercent ?? 50) }
        : { type: "full", percent: 100 };
    }
    // 이미 일부(보통 선금) 청구된 적 있다 — 남은 전액(잔금)을 기본값으로 제안한다.
    const remainPercent = Math.round(((o.totalAmount - invoiced) / o.totalAmount) * 100);
    return { type: "balance", percent: Math.min(100, Math.max(1, remainPercent)) };
  }

  function getBilling(o: SupplierOrder): { type: "deposit" | "balance" | "full"; percent: number } {
    return orderBillingOverrides[o.id] ?? defaultBilling(o);
  }

  function billedAmountForOrder(o: SupplierOrder): number {
    const billing = getBilling(o);
    const pct = billing.type === "full" ? 100 : billing.percent;
    const raw = Math.round(o.totalAmount * (pct / 100) * 100) / 100;
    return Math.min(remainingOf(o), raw);
  }

  // 아직 발행 전(작성중)인 발주는 협력사 쪽엔 애초에 노출되지 않는다(my-supplier-orders에서도
  // issued만 보여준다) — 여기서도 같은 기준으로 걸러야 "안 보이던 게 갑자기 청구서에 뜨는"
  // 일이 없다.
  const outstandingOrders = orders.filter((o) => o.status === "issued" && remainingOf(o) > 0.009);
  const outstandingByCurrency = useMemo(() => {
    const map = new Map<SupplierCurrency, SupplierOrder[]>();
    outstandingOrders.forEach((o) => map.set(o.currency, [...(map.get(o.currency) ?? []), o]));
    return map;
  }, [outstandingOrders]);

  // 프로젝트별 미수금 — 청구서 작성 폼 없이도 전체 현황을 한눈에 보여준다. 이번에 청구할
  // 금액(선금 50%만 등)이 아니라 그 발주에서 아직 못 받은 전체 금액을 보여줘야 "미수금"이라는
  // 말과 맞는다.
  const outstandingByProject = useMemo(() => {
    const map = new Map<string, { name: string; totals: Partial<Record<SupplierCurrency, number>>; kinds: Set<SupplierOrderKind> }>();
    outstandingOrders.forEach((o) => {
      const key = o.linkedProjectId || "__none__";
      const entry = map.get(key) ?? {
        name: o.linkedProjectName ? trProjectName(o.linkedProjectName) : zh(isZh, "프로젝트 미지정"),
        totals: {},
        kinds: new Set<SupplierOrderKind>(),
      };
      entry.totals[o.currency] = (entry.totals[o.currency] ?? 0) + remainingOf(o);
      o.items.forEach((it) => entry.kinds.add(it.orderKind ?? "production"));
      map.set(key, entry);
    });
    return Array.from(map.values());
  }, [outstandingOrders, isZh, zhProjectNames]);

  function openForm() {
    setSelectedOrderIds([]);
    setOrderBillingOverrides({});
    setCustomItems([]);
    setIncludeAdjustment(true);
    const now = new Date();
    setTitle(isZh ? `${now.getMonth() + 1}月账单` : `${now.getMonth() + 1}월 청구서`);
    setMemo("");
    setSubmitError("");
    setShowForm(true);
  }

  function toggleOrder(id: string) {
    setSelectedOrderIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function addCustomItem() {
    setCustomItems((prev) => [...prev, { id: newId(), description: "", amount: 0, projectId: "" }]);
  }

  const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o.id));
  const adjustmentApplied = includeAdjustment && unreconciled.invoiceIds.length > 0 && unreconciled.amount !== 0;
  const total =
    selectedOrders.reduce((sum, o) => sum + billedAmountForOrder(o), 0) +
    customItems.reduce((sum, c) => sum + (c.amount || 0), 0) +
    (adjustmentApplied ? unreconciled.amount : 0);
  // 미납금 반영 조정 항목 때문에 합계가 0 이하로 내려갈 수 있다(초과입금이 이번 신규 청구액보다
  // 큰 경우) — 그럴 땐 금액이 아니라 "청구할 내용이 있는지"로 제출 가능 여부를 판단한다.
  const hasItems = selectedOrders.length > 0 || customItems.some((c) => c.description.trim() && c.amount > 0) || adjustmentApplied;

  function buildItems(): SupplierInvoiceLineItem[] {
    return [
      ...(adjustmentApplied
        ? [
            {
              id: newId(),
              source: "adjustment" as const,
              description: zh(isZh, unreconciled.amount > 0 ? "이전 청구서 미납금 반영" : "이전 청구서 초과입금 반영"),
              descriptionKo: unreconciled.amount > 0 ? "이전 청구서 미납금 반영" : "이전 청구서 초과입금 반영",
              amount: unreconciled.amount,
            },
          ]
        : []),
      ...selectedOrders.map((o) => {
        const billing = getBilling(o);
        const showBracket = needsPhaseSelector(o);
        return {
          id: newId(),
          source: "order" as const,
          supplierOrderId: o.id,
          soNumber: o.soNumber,
          linkedProjectId: o.linkedProjectId,
          linkedProjectName: o.linkedProjectName,
          description: `${showBracket ? `[${SUPPLIER_ORDER_INSTALLMENT_LABEL[billing.type]}] ` : ""}${o.items.map((it) => it.name).join(", ") || o.soNumber}`,
          amount: billedAmountForOrder(o),
        };
      }),
      ...customItems
        .filter((c) => c.description.trim() && c.amount > 0)
        .map((c) => ({
          id: c.id,
          source: "custom" as const,
          linkedProjectId: c.projectId || undefined,
          linkedProjectName: projects.find((p) => p.id === c.projectId)?.name,
          description: c.description.trim(),
          amount: c.amount,
        })),
    ];
  }

  // 중국 협력사가 직접 입력한 내용(직접 추가한 항목의 내용, 제목, 비고)만 한국어로 미리
  // 번역해둔다 — 발주서에서 가져온 항목의 설명은 이미 한국어(관리자가 입력한 품명)라
  // 번역이 필요 없다.
  async function buildItemsWithTranslation(): Promise<{ items: SupplierInvoiceLineItem[]; titleKo?: string; memoKo?: string }> {
    const items = buildItems();
    if (!isZh) return { items };
    const customIndexes = items
      .map((it, i) => (it.source === "custom" ? i : -1))
      .filter((i) => i >= 0);
    const texts = [...customIndexes.map((i) => items[i].description), title.trim(), memo.trim()];
    const translations = await translateToKoreanForCache(texts);
    const translatedItems = items.map((it, i) => {
      const idx = customIndexes.indexOf(i);
      if (idx === -1) return it;
      const ko = translations[idx];
      return ko ? { ...it, descriptionKo: ko } : it;
    });
    const titleKo = translations[translations.length - 2] ?? undefined;
    const memoKo = translations[translations.length - 1] ?? undefined;
    return { items: translatedItems, titleKo: titleKo ?? undefined, memoKo: memoKo ?? undefined };
  }

  async function handleSubmit() {
    if (!appUser) return;
    if (buildItems().length === 0) {
      setSubmitError(zh(isZh, "청구할 항목이 없습니다."));
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const { items, titleKo, memoKo } = await buildItemsWithTranslation();
      await createSupplierInvoice({
        partnerId: appUser.uid,
        partnerName: appUser.name,
        currency,
        items,
        title: title.trim() || undefined,
        titleKo,
        memo: memo.trim() || undefined,
        memoKo,
        createdBy: appUser.uid,
        adjustmentSourceInvoiceIds: adjustmentApplied ? unreconciled.invoiceIds : undefined,
      });
      setShowForm(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : zh(isZh, "청구서 제출에 실패했습니다."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteInvoice(inv: SupplierInvoice) {
    if (inv.status !== "submitted") return;
    if (!confirm(zh(isZh, "이 청구서를 삭제할까요?"))) return;
    await deleteSupplierInvoice(inv.id);
  }

  if (appUser && !isPartner) {
    return <p className="text-sm text-[#86868b]">접근 권한이 없습니다.</p>;
  }

  // 관리자 발주 작성 화면과 같은 방식 — 아직 제출 전인 내용이라 전용 인쇄 페이지가 없다.
  // 모달 대신 화면 전체로 보여주고, 실제 인쇄는 제출한 뒤 "미리보기 / PDF"에서 한다(사이드바·
  // 상단바가 있는 화면 안에서 인쇄하면 빈 두 번째 장이 생기는 문제 때문).
  if (showPreview && previewData) {
    return (
      <PrintablePreview
        onClose={() => setShowPreview(false)}
        label={zh(isZh, "제출 전 미리보기 — 실제 청구서와 동일합니다.")}
        right={
          <div className="flex items-center gap-3">
            {/* 중국 협력사만 의미가 있는 토글 — 본인이 쓴 중국어 원문과, 관리자가 실제로 볼
                한국어 번역본을 둘 다 확인할 수 있게 한다. */}
            {isZh && (
              <div className="flex overflow-hidden rounded-full border border-[#d1d1d6]">
                <button
                  onClick={() => setPreviewLang("zh")}
                  className={`px-4 py-1.5 text-xs font-medium ${previewLang === "zh" ? "bg-[#1d1d1f] text-white" : "text-[#1d1d1f]"}`}
                >
                  中文版
                </button>
                <button
                  onClick={() => setPreviewLang("ko")}
                  className={`px-4 py-1.5 text-xs font-medium ${previewLang === "ko" ? "bg-[#1d1d1f] text-white" : "text-[#1d1d1f]"}`}
                >
                  한국어판
                </button>
              </div>
            )}
            <p className="text-xs text-[#86868b]">{zh(isZh, "제출한 뒤 \"미리보기 / PDF\"에서 인쇄할 수 있습니다.")}</p>
          </div>
        }
      >
        <SupplierInvoiceDocument
          lang={previewLang}
          brandName={appUser?.brandName}
          data={{
            invoiceNumber: zh(isZh, "미리보기 (제출 전)"),
            partnerName: appUser?.name ?? "",
            currency,
            items: previewData.items,
            totalAmount: total,
            title: title.trim() || undefined,
            titleKo: previewData.titleKo,
            memo: memo.trim() || undefined,
            memoKo: previewData.memoKo,
            submittedAt: Date.now(),
          }}
        />
      </PrintablePreview>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-[#1d1d1f]">
            <span className="h-2 w-2 rounded-full bg-[#1d1d1f]" />
            {zh(isZh, "청구서")}
          </h1>
          <p className="mt-1 pl-4 text-sm text-[#86868b]">{zh(isZh, "발주서를 골라 묶거나 직접 입력해서 청구서를 제출합니다.")}</p>
        </div>
        <button
          onClick={openForm}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-[#1d1d1f] px-4 text-sm font-medium text-white transition hover:bg-black"
        >
          <Plus size={16} /> {zh(isZh, "청구서 작성")}
        </button>
      </div>

      {outstandingByProject.length > 0 && (
        <div className="rounded-3xl bg-white p-5">
          <p className="mb-3 text-sm font-semibold text-[#1d1d1f]">{zh(isZh, "미수금 현황")}</p>
          <div className="space-y-2">
            {outstandingByProject.map((p, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-2xl bg-[#f5f5f7] px-4 py-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[#1d1d1f]">{p.name}</span>
                  {Array.from(p.kinds).map((kind) => (
                    <span key={kind} className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${SUPPLIER_ORDER_KIND_BADGE_CLASS[kind]}`}>
                      {zh(isZh, SUPPLIER_ORDER_KIND_LABEL[kind])}
                    </span>
                  ))}
                </span>
                <span className="shrink-0 font-medium text-[#1d1d1f]">
                  {(Object.entries(p.totals) as [SupplierCurrency, number][]).map(([cur, amt]) => formatSupplierMoney(amt, cur)).join(" + ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="space-y-4 rounded-3xl bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[#1d1d1f]">{zh(isZh, "청구서 작성")}</p>
            {isZh ? (
              <span className="rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3 py-1.5 text-xs font-medium text-[#1d1d1f]">CNY ¥</span>
            ) : (
              <select
                value={currencyChoice}
                onChange={(e) => { setCurrencyChoice(e.target.value as SupplierCurrency); setSelectedOrderIds([]); }}
                className="rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs text-[#1d1d1f] outline-none focus:border-[#86868b]"
              >
                <option value="USD">USD $</option>
                <option value="CNY">CNY ¥</option>
                <option value="KRW">KRW ₩</option>
              </select>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-[#86868b]">{zh(isZh, "청구서 제목")}</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={zh(isZh, "예: 10월 청구서")}
              className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
            />
          </div>

          {/* 미납금이 있을 때만 배너가 뜨다 보니, "확인은 했는데 없는 건지" "아직 확인이
              안 된 건지" 구분이 안 가서 헷갈린다는 요청이 있었다 — 미납금이 없는 경우에도
              "미납금 없음"을 체크된 상태로 명시해, 조회 자체는 항상 됐다는 걸 보여준다. */}
          {unreconciled.invoiceIds.length > 0 && unreconciled.amount !== 0 ? (
            <div className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-xs ${unreconciled.amount > 0 ? "bg-amber-50" : "bg-blue-50"}`}>
              <div>
                <p className={`font-semibold ${unreconciled.amount > 0 ? "text-amber-700" : "text-blue-700"}`}>
                  {zh(isZh, "미납금 현황")}: {formatSupplierMoney(unreconciled.amount, currency)}
                </p>
                <p className="mt-0.5 text-[#86868b]">{zh(isZh, "지난 청구서 중 실제 입금액이 청구액보다 적었던 차액입니다.")}</p>
              </div>
              <button
                onClick={() => setIncludeAdjustment((v) => !v)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  includeAdjustment
                    ? "bg-[#1d1d1f] text-white"
                    : "border border-[#d1d1d6] text-[#1d1d1f] hover:border-[#86868b]"
                }`}
              >
                {includeAdjustment ? zh(isZh, "포함 취소") : zh(isZh, "이번 청구서에 포함")}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl bg-[#f5f5f7] px-4 py-3 text-xs text-[#86868b]">
              <CheckSquare size={14} className="shrink-0 text-[#1d1d1f]" />
              {zh(isZh, "미납금 없음")}
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs font-medium text-[#86868b]">{zh(isZh, "미청구 발주서 중 이번에 청구할 건 선택")}</p>
            <div className="space-y-1.5">
              {(outstandingByCurrency.get(currency) ?? []).map((o) => {
                const billing = getBilling(o);
                const remaining = remainingOf(o);
                const checked = selectedOrderIds.includes(o.id);
                const showSelector = needsPhaseSelector(o);
                const orderKinds = Array.from(new Set(o.items.map((it) => it.orderKind ?? "production")));
                const singleKind = orderKinds.length === 1 ? orderKinds[0] : null;
                return (
                  <div key={o.id} className="rounded-xl border border-[#d1d1d6] px-3 py-2 text-xs">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={checked} onChange={() => toggleOrder(o.id)} />
                      <span className="min-w-0 flex-1 truncate text-[#1d1d1f]">
                        {o.soNumber}{o.linkedProjectName ? ` · ${trProjectName(o.linkedProjectName)}` : ""}
                        {singleKind && (
                          <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${SUPPLIER_ORDER_KIND_BADGE_CLASS[singleKind]}`}>
                            {zh(isZh, SUPPLIER_ORDER_KIND_LABEL[singleKind])}
                          </span>
                        )}
                        {o.installmentType && (
                          <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${o.installmentType === "full" ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-600"}`}>
                            {zh(isZh, SUPPLIER_ORDER_INSTALLMENT_LABEL[o.installmentType])}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-right font-medium text-[#1d1d1f]">
                        {formatSupplierMoney(billedAmountForOrder(o), o.currency)}
                      </span>
                    </label>
                    {remaining < o.totalAmount && (
                      <p className="mt-1 pl-6 text-[10px] text-[#86868b]">
                        {zh(isZh, "전체")} {formatSupplierMoney(o.totalAmount, o.currency)} · {zh(isZh, "남은 금액")} {formatSupplierMoney(remaining, o.currency)}
                      </p>
                    )}
                    {/* 발주 자체에 선금/잔금 구분이 걸려 있거나 이미 일부 청구된 적 있을 때만
                        "이번 청구 차수" 선택지를 보여준다 — 평범한 단일 발주는 그냥 체크만 하면 된다. */}
                    {checked && showSelector && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
                        <select
                          value={billing.type}
                          onChange={(e) => {
                            const type = e.target.value as "deposit" | "balance" | "full";
                            setOrderBillingOverrides((prev) => ({
                              ...prev,
                              [o.id]: { type, percent: type === "full" ? 100 : (prev[o.id]?.percent ?? billing.percent) },
                            }));
                          }}
                          className="rounded-lg border border-[#d1d1d6] bg-white px-2 py-1 text-[11px] outline-none focus:border-[#86868b]"
                        >
                          <option value="deposit">{zh(isZh, "선금")}</option>
                          <option value="balance">{zh(isZh, "잔금")}</option>
                          <option value="full">{zh(isZh, "완납")}</option>
                        </select>
                        {billing.type !== "full" && (
                          <span className="flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={billing.percent}
                              onChange={(e) => {
                                const percent = Math.min(100, Math.max(1, Number(e.target.value) || 1));
                                setOrderBillingOverrides((prev) => ({ ...prev, [o.id]: { type: billing.type, percent } }));
                              }}
                              className="w-12 rounded-lg border border-[#d1d1d6] bg-white px-1.5 py-1 text-[11px] outline-none focus:border-[#86868b]"
                            />
                            <span className="text-[11px] text-[#86868b]">% {zh(isZh, "청구")}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {(outstandingByCurrency.get(currency) ?? []).length === 0 && (
                <p className="text-xs text-[#86868b]">{zh(isZh, "이 통화로 청구할 발주서가 없습니다.")}</p>
              )}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-[#86868b]">{zh(isZh, "발주서와 무관한 항목 직접 추가")}</p>
            <div className="space-y-1.5">
              {customItems.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-1.5">
                  <input
                    value={c.description}
                    onChange={(e) => setCustomItems((prev) => prev.map((it) => (it.id === c.id ? { ...it, description: e.target.value } : it)))}
                    placeholder={zh(isZh, "내용")}
                    className="min-w-[8rem] flex-1 rounded-lg border border-[#d1d1d6] px-2 py-1.5 text-xs outline-none focus:border-[#86868b]"
                  />
                  <select
                    value={c.projectId}
                    onChange={(e) => setCustomItems((prev) => prev.map((it) => (it.id === c.id ? { ...it, projectId: e.target.value } : it)))}
                    className="rounded-lg border border-[#d1d1d6] bg-white px-2 py-1.5 text-xs outline-none focus:border-[#86868b]"
                  >
                    <option value="">{zh(isZh, "프로젝트 없음")}</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{trProjectName(p.name, p.nameZh)}</option>)}
                  </select>
                  <NumberInput
                    value={c.amount}
                    onChange={(n) => setCustomItems((prev) => prev.map((it) => (it.id === c.id ? { ...it, amount: n } : it)))}
                    placeholder={zh(isZh, "금액")}
                    className="w-24 rounded-lg border border-[#d1d1d6] bg-white px-2 py-1.5 text-xs outline-none focus:border-[#86868b]"
                  />
                  <button onClick={() => setCustomItems((prev) => prev.filter((it) => it.id !== c.id))} className="rounded-full p-1 text-[#d1d1d6] hover:bg-red-50 hover:text-red-500">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <button onClick={addCustomItem} className="flex items-center gap-1 text-xs font-medium text-[#86868b] hover:text-[#1d1d1f]">
                <Plus size={12} /> {zh(isZh, "항목 추가")}
              </button>
            </div>
          </div>

          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
            placeholder={zh(isZh, "비고 (선택)")}
            className="w-full resize-none rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
          />

          <div className="flex items-center justify-between border-t border-[#f0f0f0] pt-3">
            <span className="text-sm text-[#86868b]">{zh(isZh, "합계")}</span>
            <span className="text-lg font-bold text-[#1d1d1f]">{formatSupplierMoney(total, currency)}</span>
          </div>
          {submitError && <p className="text-xs text-red-500">{submitError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={submitting || !hasItems}
              className="rounded-full bg-[#1d1d1f] px-5 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
            >
              {submitting ? zh(isZh, "제출 중...") : zh(isZh, "청구서 제출")}
            </button>
            <button
              onClick={async () => {
                setPreviewLoading(true);
                setPreviewLang(isZh ? "zh" : "ko");
                try {
                  setPreviewData(await buildItemsWithTranslation());
                  setShowPreview(true);
                } finally {
                  setPreviewLoading(false);
                }
              }}
              disabled={!hasItems || previewLoading}
              className="flex items-center gap-1.5 rounded-full border border-[#d1d1d6] px-5 py-2 text-sm font-medium text-[#1d1d1f] transition hover:border-[#86868b] disabled:opacity-50"
            >
              <Eye size={14} /> {previewLoading ? zh(isZh, "불러오는 중...") : zh(isZh, "미리보기")}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-full border border-[#d1d1d6] px-5 py-2 text-sm text-[#1d1d1f] hover:bg-[#f5f5f7]">
              {zh(isZh, "취소")}
            </button>
          </div>
        </div>
      )}

      {!loaded && <p className="text-sm text-[#86868b]">{zh(isZh, "불러오는 중...")}</p>}
      {loaded && invoices.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#d1d1d6] bg-white py-16 text-center">
          <Receipt size={32} className="mb-3 text-[#d1d1d6]" />
          <p className="text-sm text-[#86868b]">{zh(isZh, "제출한 청구서가 없습니다.")}</p>
        </div>
      )}

      <div className="space-y-3">
        {invoices.map((inv) => (
          <div key={inv.id} className="rounded-3xl bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 font-semibold text-[#1d1d1f]">
                  {inv.title || inv.invoiceNumber}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[inv.status]}`}>
                    {zh(isZh, SUPPLIER_INVOICE_STATUS_LABEL[inv.status])}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-[#86868b]">
                  {inv.title ? `${inv.invoiceNumber} · ` : ""}
                  {new Date(inv.submittedAt).toLocaleDateString(isZh ? "zh-CN" : "ko-KR")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-[#1d1d1f]">{formatSupplierMoney(inv.totalAmount, inv.currency)}</p>
                {/* 새 탭이 아니라 같은 탭에서 연다 — 전용 인쇄 페이지의 "닫기" 버튼이
                    router.back()이라, 같은 탭 히스토리로 들어가야 닫을 때 이 목록으로
                    그대로 돌아온다. */}
                <Link
                  href={`/supplier-invoices/${inv.id}/print`}
                  className="flex items-center gap-1 rounded-full border border-[#d1d1d6] px-3 py-1.5 text-xs font-medium text-[#1d1d1f] transition hover:border-[#86868b]"
                >
                  <FileText size={12} /> {zh(isZh, "미리보기 / PDF")}
                </Link>
                {inv.status === "submitted" && (
                  <button onClick={() => handleDeleteInvoice(inv)} className="rounded-full p-2 text-[#d1d1d6] hover:bg-red-50 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
            {inv.status === "paid" && typeof inv.paidAmount === "number" && inv.paidAmount !== inv.totalAmount && (
              <p className={`mt-3 rounded-xl px-3 py-2 text-xs font-medium ${inv.paidAmount < inv.totalAmount ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                {zh(isZh, "실제 입금액")} {formatSupplierMoney(inv.paidAmount, inv.currency)}
                {inv.carriedForward && ` · ${zh(isZh, "다음 청구서에 반영됨")}`}
              </p>
            )}
            {inv.status === "paid" && inv.receiptUrl && (
              <a href={toProxiedUrl(inv.receiptUrl)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-green-600 underline underline-offset-2">
                <Receipt size={12} /> {zh(isZh, "영수증 보기")}
              </a>
            )}
          </div>
        ))}
      </div>

    </div>
  );
}
