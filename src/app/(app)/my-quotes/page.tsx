"use client";

import { useEffect, useState } from "react";
import { collection, documentId, getDocs, query, where } from "firebase/firestore";
import { Calculator, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { listenSupplierQuotesByPartner, createSupplierQuote, deleteSupplierQuote } from "@/lib/firestore/supplierQuotes";
import { formatSupplierMoney } from "@/lib/firestore/supplierOrders";
import {
  SupplierQuote,
  SupplierQuoteItem,
  SupplierCurrency,
  SupplierOrderKind,
  SUPPLIER_QUOTE_STATUS_LABEL,
  SUPPLIER_ORDER_KIND_LABEL,
  SUPPLIER_ORDER_KIND_BADGE_CLASS,
} from "@/lib/types";
import { zh, usePartnerZh, useZhAutoTranslate, translateToKoreanForCache } from "@/lib/i18n";
import NumberInput from "@/components/NumberInput";

const STATUS_STYLE: Record<string, string> = {
  submitted: "bg-amber-50 text-amber-600",
  approved: "bg-green-50 text-green-600",
  rejected: "bg-red-50 text-red-500",
};

function newId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function emptyItem(): SupplierQuoteItem {
  return { id: newId(), name: "", unit: "EA", quantity: 1, unitPrice: 0 };
}

// 협력사(파트너) 계정 전용 — 아직 발주 전인 건에 대해 "이 가격에 만들 수 있다"고 먼저
// 제안하는 견적서. 관리자가 승인하면 같은 내용으로 매입 발주서가 자동 생성된다.
export default function MyQuotesPage() {
  const { appUser } = useAuth();
  const isPartner = appUser?.role === "partner";
  const isZh = usePartnerZh();
  const [quotes, setQuotes] = useState<SupplierQuote[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [projects, setProjects] = useState<{ id: string; name: string; nameZh?: string }[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [currencyChoice, setCurrencyChoice] = useState<SupplierCurrency>("USD");
  const currency: SupplierCurrency = isZh ? "CNY" : currencyChoice;
  const [orderKind, setOrderKind] = useState<SupplierOrderKind>("production");
  const [linkedProjectId, setLinkedProjectId] = useState("");
  const [items, setItems] = useState<SupplierQuoteItem[]>([emptyItem()]);
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!appUser || !isPartner) return;
    return listenSupplierQuotesByPartner(
      appUser.uid,
      (q) => {
        setLoadError("");
        setQuotes(q);
        setLoaded(true);
      },
      (e) => {
        setLoadError(e.message);
        setLoaded(true);
      }
    );
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

  const zhProjectNames = useZhAutoTranslate(isZh, projects.map((p) => p.name));
  function trProjectName(p: { name: string; nameZh?: string }): string {
    return (isZh && p.nameZh) || zhProjectNames[p.name] || p.name;
  }

  function openForm() {
    setCurrencyChoice("USD");
    setOrderKind("production");
    setLinkedProjectId("");
    setItems([emptyItem()]);
    setMemo("");
    setSubmitError("");
    setShowForm(true);
  }

  function updateItem(id: string, patch: Partial<SupplierQuoteItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(id: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));
  }

  const validItems = items.filter((it) => it.name.trim() && it.quantity > 0 && it.unitPrice > 0);
  const total = validItems.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);

  async function handleSubmit() {
    if (!appUser) return;
    if (validItems.length === 0) {
      setSubmitError(zh(isZh, "품목을 하나 이상 입력해 주세요."));
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      let finalItems = validItems.map((it) => ({ ...it, name: it.name.trim() }));
      let memoKo: string | undefined;
      // 중국 협력사가 중국어로 입력한 내용(품명, 비고)만 한국어로 미리 번역해둔다.
      if (isZh) {
        const texts = [...finalItems.map((it) => it.name), memo.trim()];
        const translations = await translateToKoreanForCache(texts);
        finalItems = finalItems.map((it, i) => (translations[i] ? { ...it, nameKo: translations[i]! } : it));
        memoKo = translations[translations.length - 1] ?? undefined;
      }
      const project = projects.find((p) => p.id === linkedProjectId);
      await createSupplierQuote({
        partnerId: appUser.uid,
        partnerName: appUser.name,
        currency,
        items: finalItems,
        orderKind,
        linkedProjectId: linkedProjectId || undefined,
        linkedProjectName: project?.name,
        memo: memo.trim() || undefined,
        memoKo,
        createdBy: appUser.uid,
      });
      setShowForm(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : zh(isZh, "견적서 제출에 실패했습니다."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(q: SupplierQuote) {
    if (q.status !== "submitted") return;
    if (!confirm(zh(isZh, "이 견적서를 삭제할까요?"))) return;
    await deleteSupplierQuote(q.id);
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
            {zh(isZh, "견적서")}
          </h1>
          <p className="mt-1 pl-4 text-sm text-[#86868b]">{zh(isZh, "아직 발주되지 않은 건에 대해 가격을 먼저 제안합니다. 승인되면 발주서로 전환됩니다.")}</p>
        </div>
        <button
          onClick={openForm}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-[#1d1d1f] px-4 text-sm font-medium text-white transition hover:bg-black"
        >
          <Plus size={16} /> {zh(isZh, "견적서 작성")}
        </button>
      </div>

      {showForm && (
        <div className="space-y-4 rounded-3xl bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[#1d1d1f]">{zh(isZh, "견적서 작성")}</p>
            <div className="flex items-center gap-2">
              <select
                value={orderKind}
                onChange={(e) => setOrderKind(e.target.value as SupplierOrderKind)}
                className="rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs text-[#1d1d1f] outline-none focus:border-[#86868b]"
              >
                <option value="production">{zh(isZh, "생산")}</option>
                <option value="development">{zh(isZh, "개발")}</option>
                <option value="mold">{zh(isZh, "금형")}</option>
              </select>
              {isZh ? (
                <span className="rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] px-3 py-1.5 text-xs font-medium text-[#1d1d1f]">CNY ¥</span>
              ) : (
                <select
                  value={currencyChoice}
                  onChange={(e) => setCurrencyChoice(e.target.value as SupplierCurrency)}
                  className="rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs text-[#1d1d1f] outline-none focus:border-[#86868b]"
                >
                  <option value="USD">USD $</option>
                  <option value="CNY">CNY ¥</option>
                  <option value="KRW">KRW 원</option>
                </select>
              )}
            </div>
          </div>

          {projects.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-[#86868b]">{zh(isZh, "관련 프로젝트 (선택)")}</p>
              <select
                value={linkedProjectId}
                onChange={(e) => setLinkedProjectId(e.target.value)}
                className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
              >
                <option value="">{zh(isZh, "프로젝트 없음")}</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{trProjectName(p)}</option>)}
              </select>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs font-medium text-[#86868b]">{zh(isZh, "품목")}</p>
            <div className="space-y-1.5">
              {items.map((it) => (
                <div key={it.id} className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#d1d1d6] p-2">
                  <input
                    value={it.name}
                    onChange={(e) => updateItem(it.id, { name: e.target.value })}
                    placeholder={zh(isZh, "품명")}
                    className="min-w-[8rem] flex-1 rounded-lg border border-[#d1d1d6] px-2 py-1.5 text-xs outline-none focus:border-[#86868b]"
                  />
                  <input
                    value={it.spec ?? ""}
                    onChange={(e) => updateItem(it.id, { spec: e.target.value })}
                    placeholder={zh(isZh, "사양 (선택)")}
                    className="w-28 rounded-lg border border-[#d1d1d6] px-2 py-1.5 text-xs outline-none focus:border-[#86868b]"
                  />
                  <NumberInput
                    value={it.quantity}
                    onChange={(n) => updateItem(it.id, { quantity: n })}
                    decimal={false}
                    placeholder={zh(isZh, "수량")}
                    className="w-20 rounded-lg border border-[#d1d1d6] bg-white px-2 py-1.5 text-xs outline-none focus:border-[#86868b]"
                  />
                  <input
                    value={it.unit ?? ""}
                    onChange={(e) => updateItem(it.id, { unit: e.target.value })}
                    placeholder="EA"
                    className="w-14 rounded-lg border border-[#d1d1d6] px-2 py-1.5 text-xs outline-none focus:border-[#86868b]"
                  />
                  <NumberInput
                    value={it.unitPrice}
                    onChange={(n) => updateItem(it.id, { unitPrice: n })}
                    placeholder={zh(isZh, "단가")}
                    className="w-24 rounded-lg border border-[#d1d1d6] bg-white px-2 py-1.5 text-xs outline-none focus:border-[#86868b]"
                  />
                  <span className="w-24 shrink-0 text-right text-xs font-medium text-[#1d1d1f]">
                    {formatSupplierMoney(it.quantity * it.unitPrice, currency)}
                  </span>
                  <button onClick={() => removeItem(it.id)} className="rounded-full p-1 text-[#d1d1d6] hover:bg-red-50 hover:text-red-500">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <button onClick={addItem} className="flex items-center gap-1 text-xs font-medium text-[#86868b] hover:text-[#1d1d1f]">
                <Plus size={12} /> {zh(isZh, "품목 추가")}
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
              {submitting ? zh(isZh, "제출 중...") : zh(isZh, "견적서 제출")}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-full border border-[#d1d1d6] px-5 py-2 text-sm text-[#1d1d1f] hover:bg-[#f5f5f7]">
              {zh(isZh, "취소")}
            </button>
          </div>
        </div>
      )}

      {!loaded && <p className="text-sm text-[#86868b]">{zh(isZh, "불러오는 중...")}</p>}

      {loadError && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-xs text-red-600">
          {zh(isZh, "불러오지 못했습니다")}: {loadError}
        </p>
      )}

      {loaded && !loadError && quotes.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#d1d1d6] bg-white py-16 text-center">
          <Calculator size={32} className="mb-3 text-[#d1d1d6]" />
          <p className="text-sm text-[#86868b]">{zh(isZh, "제출한 견적서가 없습니다.")}</p>
        </div>
      )}

      <div className="space-y-3">
        {quotes.map((q) => (
          <div key={q.id} className="rounded-3xl bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 font-semibold text-[#1d1d1f]">
                  {q.quoteNumber}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[q.status]}`}>
                    {zh(isZh, SUPPLIER_QUOTE_STATUS_LABEL[q.status])}
                  </span>
                  {q.orderKind && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SUPPLIER_ORDER_KIND_BADGE_CLASS[q.orderKind]}`}>
                      {zh(isZh, SUPPLIER_ORDER_KIND_LABEL[q.orderKind])}
                    </span>
                  )}
                </p>
                {q.linkedProjectName && <p className="mt-0.5 text-xs text-[#86868b]">{trProjectName({ name: q.linkedProjectName })}</p>}
                <p className="mt-0.5 text-xs text-[#86868b]">{new Date(q.submittedAt).toLocaleDateString(isZh ? "zh-CN" : "ko-KR")}</p>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-[#1d1d1f]">{formatSupplierMoney(q.totalAmount, q.currency)}</p>
                {q.status === "submitted" && (
                  <button onClick={() => handleDelete(q)} className="rounded-full p-2 text-[#d1d1d6] hover:bg-red-50 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              {q.items.map((it) => (
                <div key={it.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#f5f5f7] px-4 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[#1d1d1f]">{it.name}</p>
                    {it.spec && <p className="text-xs text-[#86868b]">{it.spec}</p>}
                  </div>
                  <p className="shrink-0 text-xs text-[#86868b]">
                    {it.quantity.toLocaleString()}{it.unit ?? "EA"} × {formatSupplierMoney(it.unitPrice, q.currency)}
                  </p>
                </div>
              ))}
            </div>
            {q.status === "rejected" && q.rejectReason && (
              <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{zh(isZh, "반려 사유")}: {q.rejectReason}</p>
            )}
            {q.status === "approved" && (
              <p className="mt-2 rounded-xl bg-green-50 px-3 py-2 text-xs text-green-600">{zh(isZh, "승인되어 발주서로 전환되었습니다.")}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
