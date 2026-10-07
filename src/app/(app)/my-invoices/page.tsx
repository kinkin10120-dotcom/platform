"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, documentId, getDocs, query, where } from "firebase/firestore";
import { Eye, FileText, Plus, Receipt, Trash2, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { listenSupplierOrdersByPartner, formatSupplierMoney } from "@/lib/firestore/supplierOrders";
import {
  listenSupplierInvoicesByPartner,
  createSupplierInvoice,
  deleteSupplierInvoice,
} from "@/lib/firestore/supplierInvoices";
import { SupplierOrder, SupplierInvoice, SupplierInvoiceLineItem, SupplierCurrency, SUPPLIER_INVOICE_STATUS_LABEL, SUPPLIER_ORDER_INSTALLMENT_LABEL } from "@/lib/types";
import { zh, usePartnerZh, useZhAutoTranslate, translateToKoreanForCache } from "@/lib/i18n";
import NumberInput from "@/components/NumberInput";
import PdfPageScaler from "@/components/PdfPageScaler";
import SupplierInvoiceDocument from "@/components/SupplierInvoiceDocument";

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
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string; nameZh?: string }[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [currencyChoice, setCurrencyChoice] = useState<SupplierCurrency>("USD");
  // 중국 협력사 계정은 결국 위안화로 받으므로 고를 필요 없이 고정한다 — 선택지를 보여주면
  // 실수로 USD/KRW를 고를 위험만 생긴다.
  const currency: SupplierCurrency = isZh ? "CNY" : currencyChoice;
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [customItems, setCustomItems] = useState<{ id: string; description: string; amount: number; projectId: string }[]>([]);
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{ items: SupplierInvoiceLineItem[]; memoKo?: string } | null>(null);
  const [previewLang, setPreviewLang] = useState<"zh" | "ko">("zh");

  useEffect(() => {
    if (!appUser || !isPartner) return;
    return listenSupplierOrdersByPartner(appUser.uid, setOrders);
  }, [appUser, isPartner]);

  useEffect(() => {
    if (!appUser || !isPartner) return;
    return listenSupplierInvoicesByPartner(appUser.uid, (inv) => {
      setInvoices(inv);
      setLoaded(true);
    });
  }, [appUser, isPartner]);

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

  // 이미 어떤 청구서에든(제출됨/지급완료 상관없이) 한 번 담긴 발주서는 더 이상 미수금이 아니다.
  const invoicedOrderIds = useMemo(
    () => new Set(invoices.flatMap((inv) => inv.items.filter((it) => it.source === "order" && it.supplierOrderId).map((it) => it.supplierOrderId!))),
    [invoices]
  );
  const outstandingOrders = orders.filter((o) => o.status === "issued" && !invoicedOrderIds.has(o.id));
  const outstandingByCurrency = useMemo(() => {
    const map = new Map<SupplierCurrency, SupplierOrder[]>();
    outstandingOrders.forEach((o) => map.set(o.currency, [...(map.get(o.currency) ?? []), o]));
    return map;
  }, [outstandingOrders]);

  // 프로젝트별 미수금 — 청구서 작성 폼 없이도 전체 현황을 한눈에 보여준다.
  const outstandingByProject = useMemo(() => {
    const map = new Map<string, { name: string; totals: Partial<Record<SupplierCurrency, number>> }>();
    outstandingOrders.forEach((o) => {
      const key = o.linkedProjectId || "__none__";
      const entry = map.get(key) ?? { name: o.linkedProjectName ? trProjectName(o.linkedProjectName) : zh(isZh, "프로젝트 미지정"), totals: {} };
      entry.totals[o.currency] = (entry.totals[o.currency] ?? 0) + o.totalAmount;
      map.set(key, entry);
    });
    return Array.from(map.values());
  }, [outstandingOrders, isZh, zhProjectNames]);

  function openForm() {
    setSelectedOrderIds([]);
    setCustomItems([]);
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
  const total = selectedOrders.reduce((sum, o) => sum + o.totalAmount, 0) + customItems.reduce((sum, c) => sum + (c.amount || 0), 0);

  function buildItems(): SupplierInvoiceLineItem[] {
    return [
      ...selectedOrders.map((o) => ({
        id: newId(),
        source: "order" as const,
        supplierOrderId: o.id,
        soNumber: o.soNumber,
        linkedProjectId: o.linkedProjectId,
        linkedProjectName: o.linkedProjectName,
        description: `${o.installmentType ? `[${SUPPLIER_ORDER_INSTALLMENT_LABEL[o.installmentType]}] ` : ""}${o.items.map((it) => it.name).join(", ") || o.soNumber}`,
        amount: o.totalAmount,
      })),
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

  // 중국 협력사가 직접 입력한 내용(직접 추가한 항목의 내용, 비고)만 한국어로 미리 번역해둔다 —
  // 발주서에서 가져온 항목의 설명은 이미 한국어(관리자가 입력한 품명)라 번역이 필요 없다.
  async function buildItemsWithTranslation(): Promise<{ items: SupplierInvoiceLineItem[]; memoKo?: string }> {
    const items = buildItems();
    if (!isZh) return { items };
    const customIndexes = items
      .map((it, i) => (it.source === "custom" ? i : -1))
      .filter((i) => i >= 0);
    const texts = [...customIndexes.map((i) => items[i].description), memo.trim()];
    const translations = await translateToKoreanForCache(texts);
    const translatedItems = items.map((it, i) => {
      const idx = customIndexes.indexOf(i);
      if (idx === -1) return it;
      const ko = translations[idx];
      return ko ? { ...it, descriptionKo: ko } : it;
    });
    const memoKo = translations[translations.length - 1] ?? undefined;
    return { items: translatedItems, memoKo: memoKo ?? undefined };
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
      const { items, memoKo } = await buildItemsWithTranslation();
      await createSupplierInvoice({
        partnerId: appUser.uid,
        partnerName: appUser.name,
        currency,
        items,
        memo: memo.trim() || undefined,
        memoKo,
        createdBy: appUser.uid,
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
              <div key={i} className="flex items-center justify-between rounded-2xl bg-[#f5f5f7] px-4 py-2.5 text-sm">
                <span className="text-[#1d1d1f]">{p.name}</span>
                <span className="font-medium text-[#1d1d1f]">
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
                <option value="KRW">KRW 원</option>
              </select>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-[#86868b]">{zh(isZh, "미청구 발주서 중 이번에 청구할 건 선택")}</p>
            <div className="space-y-1.5">
              {(outstandingByCurrency.get(currency) ?? []).map((o) => (
                <label key={o.id} className="flex items-center gap-2 rounded-xl border border-[#d1d1d6] px-3 py-2 text-xs">
                  <input type="checkbox" checked={selectedOrderIds.includes(o.id)} onChange={() => toggleOrder(o.id)} />
                  <span className="min-w-0 flex-1 truncate text-[#1d1d1f]">
                    {o.soNumber}{o.linkedProjectName ? ` · ${trProjectName(o.linkedProjectName)}` : ""}
                    {o.installmentType && (
                      <span className="ml-1.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                        {zh(isZh, SUPPLIER_ORDER_INSTALLMENT_LABEL[o.installmentType])}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-medium text-[#1d1d1f]">{formatSupplierMoney(o.totalAmount, o.currency)}</span>
                </label>
              ))}
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
              disabled={submitting || total <= 0}
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
              disabled={total <= 0 || previewLoading}
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
                  {inv.invoiceNumber}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[inv.status]}`}>
                    {zh(isZh, SUPPLIER_INVOICE_STATUS_LABEL[inv.status])}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-[#86868b]">{new Date(inv.submittedAt).toLocaleDateString(isZh ? "zh-CN" : "ko-KR")}</p>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-[#1d1d1f]">{formatSupplierMoney(inv.totalAmount, inv.currency)}</p>
                <Link
                  href={`/supplier-invoices/${inv.id}/print`}
                  target="_blank"
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
            {inv.status === "paid" && inv.receiptUrl && (
              <a href={inv.receiptUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-green-600 underline underline-offset-2">
                <Receipt size={12} /> {zh(isZh, "영수증 보기")}
              </a>
            )}
          </div>
        ))}
      </div>

      {showPreview && previewData && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 py-10" onClick={() => setShowPreview(false)}>
          <div className="mx-auto mb-4 flex w-full max-w-[210mm] items-center justify-between px-4">
            <button
              onClick={() => setShowPreview(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 text-white transition hover:border-white"
            >
              <X size={16} />
            </button>
            {/* 중국 협력사만 의미가 있는 토글 — 본인이 쓴 중국어 원문과, 관리자가 실제로 볼
                한국어 번역본을 둘 다 확인할 수 있게 한다. */}
            {isZh && (
              <div className="flex overflow-hidden rounded-full border border-white/30" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setPreviewLang("zh")}
                  className={`px-4 py-1.5 text-xs font-medium ${previewLang === "zh" ? "bg-white text-[#1d1d1f]" : "text-white"}`}
                >
                  中文版
                </button>
                <button
                  onClick={() => setPreviewLang("ko")}
                  className={`px-4 py-1.5 text-xs font-medium ${previewLang === "ko" ? "bg-white text-[#1d1d1f]" : "text-white"}`}
                >
                  한국어판
                </button>
              </div>
            )}
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <PdfPageScaler>
              <SupplierInvoiceDocument
                lang={previewLang}
                data={{
                  invoiceNumber: zh(isZh, "미리보기 (제출 전)"),
                  partnerName: appUser?.name ?? "",
                  currency,
                  items: previewData.items,
                  totalAmount: total,
                  memo: memo.trim() || undefined,
                  memoKo: previewData.memoKo,
                  submittedAt: Date.now(),
                }}
              />
            </PdfPageScaler>
          </div>
        </div>
      )}
    </div>
  );
}
