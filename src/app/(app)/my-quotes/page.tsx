"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, documentId, getDocs, query, where } from "firebase/firestore";
import { Calculator, ChevronDown, ChevronUp, Eye, FileText, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { listenSupplierQuotesByPartner, createSupplierQuote, updateSupplierQuote, deleteSupplierQuote } from "@/lib/firestore/supplierQuotes";
import { formatSupplierMoney } from "@/lib/firestore/supplierOrders";
import { parseLineItems } from "@/lib/aiLineItems";
import { takeAiAssistantDraft } from "@/lib/aiAssistantHandoff";
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
import PrintablePreview from "@/components/PrintablePreview";
import SupplierQuoteDocument from "@/components/SupplierQuoteDocument";
import { getCached, setCached } from "@/lib/queryCache";

const KIND_ORDER: SupplierOrderKind[] = ["production", "development", "mold", "sample"];

const STATUS_STYLE: Record<string, string> = {
  submitted: "bg-amber-50 text-amber-600",
  approved: "bg-green-50 text-green-600",
  rejected: "bg-red-50 text-red-500",
  revision_requested: "bg-blue-50 text-blue-600",
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
  // 메뉴 전환 때마다 리스너를 새로 맺고 첫 응답을 기다리느라 "불러오는 중..."이 매번
  // 길게 보였다 — 직전 값을 캐시에서 먼저 보여주고 리스너는 백그라운드에서 갱신한다.
  const quotesCacheKey = `my-quotes:${appUser?.uid}`;
  const [quotes, setQuotes] = useState<SupplierQuote[]>(() => getCached(quotesCacheKey) ?? []);
  const [loaded, setLoaded] = useState(() => getCached(quotesCacheKey) !== undefined);
  const [loadError, setLoadError] = useState("");
  const [projects, setProjects] = useState<{ id: string; name: string; nameZh?: string }[]>([]);
  // 발주 목록과 같은 방식으로 기본은 접어두고 필요할 때만 펼친다.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [showForm, setShowForm] = useState(false);
  // null이면 새로 작성, 아니면 그 견적서를 수정 중 — "검토 대기" 상태일 때만 가격 조정 등
  // 수정이 허용된다(승인/반려 이후엔 Firestore 규칙에서도 막는다).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currencyChoice, setCurrencyChoice] = useState<SupplierCurrency>("USD");
  const currency: SupplierCurrency = isZh ? "CNY" : currencyChoice;
  const [orderKind, setOrderKind] = useState<SupplierOrderKind>("production");
  const [linkedProjectId, setLinkedProjectId] = useState("");
  const [items, setItems] = useState<SupplierQuoteItem[]>([emptyItem()]);
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{ items: SupplierQuoteItem[]; memoKo?: string } | null>(null);
  const [previewLang, setPreviewLang] = useState<"zh" | "ko">("zh");

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    if (!appUser || !isPartner) return;
    return listenSupplierQuotesByPartner(
      appUser.uid,
      (q) => {
        setLoadError("");
        setQuotes(q);
        setCached(quotesCacheKey, q);
        setLoaded(true);
      },
      (e) => {
        setLoadError(e.message);
        setLoaded(true);
      }
    );
  }, [appUser, isPartner, quotesCacheKey]);

  // /organize의 AI 비서가 "견적서 작성"으로 판단한 결과를 여기로 넘겨받는다 — 받는 즉시
  // 작성 폼을 그 내용으로 채워서 열어준다(실제 제출은 사람이 확인하고 직접 눌러야 한다).
  useEffect(() => {
    if (!isPartner) return;
    const draft = takeAiAssistantDraft("quote");
    if (!draft) return;
    setEditingId(null);
    if (draft.currency) setCurrencyChoice(draft.currency);
    setOrderKind("production");
    setLinkedProjectId("");
    setItems(
      draft.items.length > 0
        ? draft.items.map((it) => ({ id: newId(), name: it.name, spec: it.spec, quantity: it.quantity, unit: it.unit || "EA", unitPrice: it.unitPrice }))
        : [emptyItem()]
    );
    setMemo(draft.memo ?? "");
    setSubmitError("");
    setAiText("");
    setAiError("");
    setShowForm(true);
  }, [isPartner]);

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

  const zhProjectNames = useZhAutoTranslate(isZh, [
    ...projects.map((p) => p.name),
    ...quotes.map((q) => q.linkedProjectName || "").filter(Boolean),
  ]);
  function trProjectName(name: string, nameZh?: string): string {
    return (isZh && nameZh) || zhProjectNames[name] || name;
  }

  // 관리자 쪽 구매 카탈로그·발주 목록과 같은 방식 — 생산/개발/금형으로 나눠 보여줘야 내역이
  // 많을 때도 찾기 쉽다. 구분을 안 고른 견적서는 "미지정" 묶음으로 따로 둔다.
  const groupedQuotes = useMemo(() => {
    const groups: Record<SupplierOrderKind | "unset", SupplierQuote[]> = { production: [], development: [], mold: [], sample: [], unset: [] };
    quotes.forEach((q) => groups[q.orderKind ?? "unset"].push(q));
    return groups;
  }, [quotes]);

  function openForm() {
    setEditingId(null);
    setCurrencyChoice("USD");
    setOrderKind("production");
    setLinkedProjectId("");
    setItems([emptyItem()]);
    setMemo("");
    setSubmitError("");
    setAiText("");
    setAiError("");
    setShowForm(true);
  }

  function openEditForm(q: SupplierQuote) {
    setEditingId(q.id);
    setCurrencyChoice(q.currency);
    setOrderKind(q.orderKind ?? "production");
    setLinkedProjectId(q.linkedProjectId ?? "");
    setItems(q.items.length > 0 ? q.items.map((it) => ({ ...it })) : [emptyItem()]);
    setMemo(q.memo ?? "");
    setSubmitError("");
    setAiText("");
    setAiError("");
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

  // "A제품 100개 5000원씩" 같은 문장을 던지면 AI가 품목 배열로 구조화해서 돌려준다 — 그
  // 결과는 바로 제출되지 않고 아래 품목 입력란에 채워넣기만 한다. 금액이 걸린 문서라
  // AI가 잘못 읽었을 가능성까지 그대로 제출되면 안 되므로, 사람이 눈으로 확인·수정한
  // 뒤 기존과 똑같이 "미리보기"→"제출" 버튼을 직접 눌러야 한다.
  async function handleAiFill() {
    if (!aiText.trim()) return;
    setAiLoading(true);
    setAiError("");
    try {
      const result = await parseLineItems(aiText.trim(), isZh ? "zh" : "ko");
      if (result.items.length === 0) {
        setAiError(zh(isZh, "품목을 인식하지 못했습니다. 조금 더 구체적으로 적어주세요."));
        return;
      }
      const newItems: SupplierQuoteItem[] = result.items.map((it) => ({
        id: newId(),
        name: it.name,
        spec: it.spec || undefined,
        quantity: it.quantity || 0,
        unit: it.unit || "EA",
        unitPrice: it.unitPrice || 0,
      }));
      setItems((prev) => {
        const isBlank = prev.length === 1 && !prev[0].name.trim() && prev[0].unitPrice === 0;
        return isBlank ? newItems : [...prev, ...newItems];
      });
      if (!isZh && result.currency && (["USD", "CNY", "KRW"] as SupplierCurrency[]).includes(result.currency)) {
        setCurrencyChoice(result.currency);
      }
      if (result.memo && !memo.trim()) setMemo(result.memo);
      setAiText("");
    } catch (e) {
      setAiError(e instanceof Error ? e.message : zh(isZh, "AI 인식에 실패했습니다."));
    } finally {
      setAiLoading(false);
    }
  }

  const validItems = items.filter((it) => it.name.trim() && it.quantity > 0 && it.unitPrice > 0);
  const total = validItems.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);

  // 중국 협력사가 중국어로 입력한 내용(품명, 비고)만 한국어로 미리 번역해둔다 — 제출/수정과
  // 미리보기 둘 다 같은 번역 결과를 써야 하므로 공통 함수로 뺐다.
  async function buildItemsWithTranslation(): Promise<{ items: SupplierQuoteItem[]; memoKo?: string }> {
    const finalItems = validItems.map((it) => ({ ...it, name: it.name.trim() }));
    if (!isZh) return { items: finalItems };
    const texts = [...finalItems.map((it) => it.name), memo.trim()];
    const translations = await translateToKoreanForCache(texts);
    const translatedItems = finalItems.map((it, i) => (translations[i] ? { ...it, nameKo: translations[i]! } : it));
    const memoKo = translations[translations.length - 1] ?? undefined;
    return { items: translatedItems, memoKo: memoKo ?? undefined };
  }

  async function handleSubmit() {
    if (!appUser) return;
    if (validItems.length === 0) {
      setSubmitError(zh(isZh, "품목을 하나 이상 입력해 주세요."));
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const { items: finalItems, memoKo } = await buildItemsWithTranslation();
      const project = projects.find((p) => p.id === linkedProjectId);
      if (editingId) {
        await updateSupplierQuote(editingId, {
          currency,
          items: finalItems,
          orderKind,
          linkedProjectId: linkedProjectId || undefined,
          linkedProjectName: project?.name,
          memo: memo.trim() || undefined,
          memoKo,
        });
      } else {
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
      }
      setShowForm(false);
      setEditingId(null);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : zh(isZh, "견적서 제출에 실패했습니다."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(q: SupplierQuote) {
    // 본인이 만든 견적서는 상태(승인/반려 포함)와 무관하게 삭제할 수 있다 — 수정은
    // "검토 대기"일 때만 허용하지만, 삭제는 본인 이력 정리라 막을 이유가 없다. 승인된
    // 건을 지워도 이미 생성된 매입 발주서는 그대로 남는다.
    if (!confirm(zh(isZh, "이 견적서를 삭제할까요?"))) return;
    await deleteSupplierQuote(q.id);
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
        label={zh(isZh, "제출 전 미리보기 — 실제 견적서와 동일합니다.")}
        right={
          <div className="flex items-center gap-3">
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
        <SupplierQuoteDocument
          lang={previewLang}
          data={{
            quoteNumber: zh(isZh, "미리보기 (제출 전)"),
            partnerName: appUser?.name ?? "",
            currency,
            items: previewData.items,
            totalAmount: total,
            orderKind,
            linkedProjectName: projects.find((p) => p.id === linkedProjectId)?.name,
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
            <p className="text-sm font-semibold text-[#1d1d1f]">
              {editingId ? zh(isZh, "견적서 수정") : zh(isZh, "견적서 작성")}
            </p>
            <div className="flex items-center gap-2">
              <select
                value={orderKind}
                onChange={(e) => setOrderKind(e.target.value as SupplierOrderKind)}
                className="rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs text-[#1d1d1f] outline-none focus:border-[#86868b]"
              >
                <option value="production">{zh(isZh, "생산")}</option>
                <option value="development">{zh(isZh, "개발")}</option>
                <option value="mold">{zh(isZh, "금형")}</option>
                <option value="sample">{zh(isZh, "샘플")}</option>
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
                  <option value="KRW">KRW ₩</option>
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
                {projects.map((p) => <option key={p.id} value={p.id}>{trProjectName(p.name, p.nameZh)}</option>)}
              </select>
            </div>
          )}

          <div className="space-y-1.5 rounded-xl border border-dashed border-[#d1d1d6] bg-[#fafafa] p-2.5">
            <p className="flex items-center gap-1 text-xs font-medium text-[#86868b]">
              <Sparkles size={12} /> {zh(isZh, "AI로 작성 — 문장으로 품목을 적으면 아래 입력란을 채워줍니다")}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !aiLoading) { e.preventDefault(); handleAiFill(); } }}
                placeholder={zh(isZh, "예) A제품 100개 5000원씩, B부품 50개 개당 2000원")}
                className="min-w-[12rem] flex-1 rounded-lg border border-[#d1d1d6] bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#86868b]"
              />
              <button
                onClick={handleAiFill}
                disabled={aiLoading || !aiText.trim()}
                className="flex items-center gap-1 rounded-lg bg-[#1d1d1f] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-black disabled:opacity-50"
              >
                <Sparkles size={12} /> {aiLoading ? zh(isZh, "인식 중...") : zh(isZh, "채우기")}
              </button>
            </div>
            {aiError && <p className="text-xs text-red-500">{aiError}</p>}
          </div>

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
              {submitting
                ? zh(isZh, "제출 중...")
                : editingId
                  ? zh(isZh, "수정 저장")
                  : zh(isZh, "견적서 제출")}
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
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="rounded-full border border-[#d1d1d6] px-5 py-2 text-sm text-[#1d1d1f] hover:bg-[#f5f5f7]">
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

      <div className="space-y-6">
        {[...KIND_ORDER, "unset" as const].map((kind) => {
          const list = groupedQuotes[kind];
          if (list.length === 0) return null;
          return (
            <div key={kind}>
              <p className="mb-2 px-1 text-sm font-semibold text-[#1d1d1f]">
                {kind === "unset" ? zh(isZh, "미지정") : zh(isZh, SUPPLIER_ORDER_KIND_LABEL[kind])}
              </p>
              <div className="space-y-3">
                {list.map((q) => {
                  const expanded = expandedIds.has(q.id);
                  return (
                    <div key={q.id} className="overflow-hidden rounded-3xl bg-white">
                      <button
                        onClick={() => toggleExpanded(q.id)}
                        className="flex w-full flex-wrap items-center justify-between gap-2 p-5 text-left"
                      >
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 font-semibold text-[#1d1d1f]">
                            {q.quoteNumber}
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[q.status]}`}>
                              {zh(isZh, SUPPLIER_QUOTE_STATUS_LABEL[q.status])}
                            </span>
                          </p>
                          {q.linkedProjectName && (
                            <p className="mt-0.5 truncate text-xs text-[#86868b]">{trProjectName(q.linkedProjectName)}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <p className="text-xs text-[#86868b]">
                            {new Date(q.submittedAt).toLocaleDateString(isZh ? "zh-CN" : "ko-KR")}
                          </p>
                          <p className="font-semibold text-[#1d1d1f]">{formatSupplierMoney(q.totalAmount, q.currency)}</p>
                          {expanded ? <ChevronUp size={16} className="text-[#86868b]" /> : <ChevronDown size={16} className="text-[#86868b]" />}
                        </div>
                      </button>

                      {expanded && (
                        <div className="border-t border-[#f0f0f0] px-5 pb-5 pt-4">
                          <div className="flex flex-wrap justify-end gap-2">
                            {/* 새 탭이 아니라 같은 탭에서 연다 — 전용 인쇄 페이지의 "닫기" 버튼이
                                router.back()이라, 같은 탭 히스토리로 들어가야 닫을 때 이 목록으로
                                그대로 돌아온다. */}
                            <Link
                              href={`/supplier-quotes/${q.id}/print`}
                              className="flex items-center gap-1 rounded-full border border-[#d1d1d6] px-3 py-1.5 text-xs font-medium text-[#1d1d1f] transition hover:border-[#86868b]"
                            >
                              <FileText size={12} /> {zh(isZh, "미리보기 / PDF")}
                            </Link>
                            {/* 가격이 나중에 조정되는 경우가 많아서 생긴 기능 — 수정은 관리자가
                                아직 검토 전(submitted)이거나 수정을 요청한(revision_requested)
                                상태일 때만 가능하다. 저장하면 자동으로 "검토 대기"로 돌아간다. */}
                            {(q.status === "submitted" || q.status === "revision_requested") && (
                              <button
                                onClick={() => openEditForm(q)}
                                className="flex items-center gap-1 rounded-full border border-[#d1d1d6] px-3 py-1.5 text-xs font-medium text-[#1d1d1f] transition hover:border-[#86868b]"
                              >
                                <Pencil size={12} /> {zh(isZh, "수정")}
                              </button>
                            )}
                            {/* 삭제는 본인이 만든 견적서라 상태(승인/반려 포함)와 무관하게 할 수 있다. */}
                            <button
                              onClick={() => handleDelete(q)}
                              className="rounded-full border border-[#d1d1d6] p-1.5 text-[#86868b] transition hover:border-red-400 hover:text-red-500"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          <div className="mt-4 space-y-2">
                            {q.items.map((it) => (
                              <div key={it.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#f5f5f7] px-4 py-3 text-sm">
                                <div className="min-w-0">
                                  <p className="font-medium text-[#1d1d1f]">{it.name}</p>
                                  {it.spec && <p className="text-xs text-[#86868b]">{it.spec}</p>}
                                </div>
                                <p className="shrink-0 text-xs text-[#86868b]">
                                  {it.quantity.toLocaleString()}{it.unit ?? "EA"} × {formatSupplierMoney(it.unitPrice, q.currency)}
                                </p>
                              </div>
                            ))}
                          </div>

                          {(q.memoKo || q.memo) && (
                            <p className="mt-3 whitespace-pre-wrap text-xs text-[#86868b]">{q.memoKo || q.memo}</p>
                          )}
                          {q.status === "rejected" && q.rejectReason && (
                            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{zh(isZh, "반려 사유")}: {q.rejectReason}</p>
                          )}
                          {q.status === "revision_requested" && (q.revisionNoteZh || q.revisionNote) && (
                            <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-600">
                              {zh(isZh, "수정 요청")}: {(isZh && q.revisionNoteZh) || q.revisionNote}
                            </p>
                          )}
                          {q.status === "approved" && (
                            <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-xs text-green-600">{zh(isZh, "승인되어 발주서로 전환되었습니다.")}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
