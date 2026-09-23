"use client";

import { useEffect, useRef, useState, Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Trash2, X, Plus, Paperclip, Download, Upload, ChevronDown, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  listenQuoteRequests,
  updateQuote,
  deleteQuote,
  createQuoteRequest,
  listenQuoteFiles,
  uploadQuoteFile,
  deleteQuoteFile,
  QuoteRequest,
  QuoteStatus,
  QuoteLineItem,
  FormalQuoteStatus,
  QuoteFile,
} from "@/lib/firestore/quotes";
import { issueQuote } from "@/lib/functions";
import { openAuthenticatedStorageFile } from "@/lib/firebase";
import { formatMoney } from "@/lib/orderCalc";
import { formatPhoneInput, formatAmountInput } from "@/lib/formatInput";
import { Currency } from "@/lib/types";
import QuoteDocument from "@/components/QuoteDocument";
import { usePrintFileName } from "@/lib/usePrintFileName";
import PdfPageScaler from "@/components/PdfPageScaler";

const StepViewer = dynamic(() => import("@/components/StepViewer"), { ssr: false });

function isStepFile(name: string) {
  const l = name.toLowerCase();
  return l.endsWith(".stp") || l.endsWith(".step");
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const STAGES = ["올인원", "디자인", "기구설계", "시제품", "금형", "양산", "상세페이지 제작", "크라우드펀딩 컨설팅"] as const;

const UNIT_PRESETS = ["개", "세트", "모델"];

const STATUS_LABEL: Record<QuoteStatus, string> = {
  pending: "검토중",
  reviewed: "검토완료",
  contacted: "연락완료",
};

const STATUS_STYLE: Record<QuoteStatus, string> = {
  pending: "bg-amber-50 text-amber-600",
  reviewed: "bg-blue-50 text-blue-600",
  contacted: "bg-green-50 text-green-600",
};

const FORMAL_QUOTE_LABEL: Record<FormalQuoteStatus, string> = {
  sent: "견적서 발송됨",
  accepted: "견적서 수락됨",
  declined: "견적서 거절됨",
  expired: "기간만료",
};

const FORMAL_QUOTE_STYLE: Record<FormalQuoteStatus, string> = {
  sent: "bg-blue-50 text-blue-600",
  accepted: "bg-green-50 text-green-600",
  declined: "bg-red-50 text-red-500",
  expired: "bg-[#f5f5f7] text-[#86868b]",
};

const emptyLineItem = (): QuoteLineItem => ({ name: "", unitPrice: 0, currency: "KRW", quantity: 1, unit: "개", vatApplicable: true });

// 견적 상세 패널의 "견적서 작성"과, 문의 없이 바로 만드는 모달 둘 다에서 쓰는 품목 편집기 —
// 단가 입력 중(특히 USD 소수점) 커서 처리·통화별 VAT 체크박스 숨김 등 로직이 꽤 있어서
// 공유 컴포넌트로 뺐다.
function QuoteItemsEditor({
  items,
  onChange,
  priceDrafts,
  setPriceDrafts,
}: {
  items: QuoteLineItem[];
  onChange: (items: QuoteLineItem[]) => void;
  priceDrafts: Record<number, string>;
  setPriceDrafts: Dispatch<SetStateAction<Record<number, string>>>;
}) {
  function updateItem(index: number, patch: Partial<QuoteLineItem>) {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }
  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
    setPriceDrafts({});
  }

  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="space-y-1 rounded-lg border border-[#f0f0f0] p-1.5">
          <div className="flex items-center gap-1.5">
            <input
              value={it.name}
              onChange={(e) => updateItem(i, { name: e.target.value })}
              placeholder="품명"
              className="min-w-0 flex-1 rounded-lg border border-[#d1d1d6] px-2 py-1.5 text-xs outline-none focus:border-[#86868b]"
            />
            <input
              type="text"
              inputMode="decimal"
              value={priceDrafts[i] ?? (it.unitPrice ? it.unitPrice.toLocaleString("en-US") : "")}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9.]/g, "");
                setPriceDrafts((prev) => ({ ...prev, [i]: formatAmountInput(raw) }));
                updateItem(i, { unitPrice: raw === "" || raw === "." ? 0 : Number(raw) });
              }}
              onBlur={() => setPriceDrafts((prev) => { const next = { ...prev }; delete next[i]; return next; })}
              placeholder="단가"
              className="w-20 rounded-lg border border-[#d1d1d6] px-2 py-1.5 text-xs outline-none focus:border-[#86868b]"
            />
            <select
              value={it.currency}
              onChange={(e) => {
                const currency = e.target.value as Currency;
                // 달러는 해외결제라 부가세 대상이 아니다 — USD로 바꾸면 VAT 별도 체크도 같이 풀어준다.
                updateItem(i, currency === "USD" ? { currency, vatApplicable: false } : { currency });
              }}
              className="rounded-lg border border-[#d1d1d6] px-1 py-1.5 text-xs outline-none focus:border-[#86868b]"
            >
              <option value="KRW">KRW</option>
              <option value="USD">USD</option>
            </select>
            <input
              type="number"
              value={it.quantity || ""}
              onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
              placeholder="수량"
              className="w-14 rounded-lg border border-[#d1d1d6] px-2 py-1.5 text-xs outline-none focus:border-[#86868b]"
            />
            <button onClick={() => removeItem(i)} className="shrink-0 text-[#d1d1d6] hover:text-red-500">
              <X size={14} />
            </button>
          </div>
          <div className="flex items-center gap-1.5 px-1">
            <select
              value={UNIT_PRESETS.includes(it.unit ?? "") ? it.unit : "__custom"}
              onChange={(e) => updateItem(i, { unit: e.target.value === "__custom" ? "" : e.target.value })}
              className="rounded-lg border border-[#d1d1d6] px-1.5 py-1 text-[11px] outline-none focus:border-[#86868b]"
            >
              {UNIT_PRESETS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
              <option value="__custom">직접입력</option>
            </select>
            {!UNIT_PRESETS.includes(it.unit ?? "") && (
              <input
                value={it.unit ?? ""}
                onChange={(e) => updateItem(i, { unit: e.target.value })}
                placeholder="단위 직접입력"
                className="min-w-0 flex-1 rounded-lg border border-[#d1d1d6] px-2 py-1 text-[11px] outline-none focus:border-[#86868b]"
              />
            )}
          </div>
          {it.currency !== "USD" && (
            <label className="flex items-center gap-1.5 px-1 text-[11px] text-[#86868b]">
              <input
                type="checkbox"
                checked={it.vatApplicable ?? false}
                onChange={(e) => updateItem(i, { vatApplicable: e.target.checked })}
                className="h-3 w-3 accent-[#1d1d1f]"
              />
              VAT 별도
            </label>
          )}
        </div>
      ))}
      <button
        onClick={() => onChange([...items, emptyLineItem()])}
        className="flex items-center gap-1 text-xs font-medium text-[#86868b] hover:text-[#1d1d1f]"
      >
        <Plus size={12} /> 품목 추가
      </button>
    </div>
  );
}

export default function QuotesPage() {
  const { appUser } = useAuth();
  const router = useRouter();
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [selected, setSelected] = useState<QuoteRequest | null>(null);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const [editingQuote, setEditingQuote] = useState(false);
  const [quoteItems, setQuoteItems] = useState<QuoteLineItem[]>([emptyLineItem()]);
  // 단가 입력 중(특히 USD 소수점)에는 quoteItems.unitPrice(number)를 그대로 표시용으로 쓰면
  // 매 입력마다 숫자로 왕복 변환되면서 마침표("12." 같은)가 사라져 소수점을 입력할 수 없다 —
  // 포커스가 있는 동안만 원본 문자열을 따로 들고 있다가, blur되면 정리한다.
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});
  const [quoteMemo, setQuoteMemo] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [directQuoteOpen, setDirectQuoteOpen] = useState(false);

  // 인쇄 대화상자가 제안하는 파일명(업체명_견적서_품목). 미리보기가 열려있을 때만 적용된다.
  // 발행 전 초안은 아직 저장 전이라 지금 편집 중인 품목(quoteItems)을, 발행된 건은 저장된
  // 품목을 그대로 쓴다 — 화면에 그려지는 QuoteDocument의 data와 같은 출처여야 어긋나지 않는다.
  usePrintFileName(
    [selected?.company || selected?.name, "견적서", (selected?.quoteStatus ? selected?.quoteItems ?? [] : quoteItems).map((it) => it.name).filter(Boolean).join(",")],
    previewOpen && !!selected
  );

  useEffect(() => {
    return listenQuoteRequests(setQuotes);
  }, []);

  // 다른 화면(고객 응답 등)에서 selected 문서가 바뀌어도 상세 패널이 최신 상태를 반영하게 한다.
  useEffect(() => {
    if (!selected) return;
    const fresh = quotes.find((q) => q.id === selected.id);
    if (fresh) setSelected(fresh);
  }, [quotes]); // eslint-disable-line react-hooks/exhaustive-deps

  function openIssueEditor(q: QuoteRequest) {
    setQuoteItems(q.quoteItems && q.quoteItems.length > 0 ? q.quoteItems : [emptyLineItem()]);
    setQuoteMemo(q.quoteMemo ?? "");
    setPriceDrafts({});
    setEditingQuote(true);
  }

  async function handleIssueQuote() {
    if (!selected) return;
    const validItems = quoteItems.filter((it) => it.name.trim() && it.unitPrice > 0 && it.quantity > 0);
    if (validItems.length === 0) return;
    setIssuing(true);
    try {
      await issueQuote(selected.id, validItems, quoteMemo.trim());
      setEditingQuote(false);
    } finally {
      setIssuing(false);
    }
  }

  function goToCreateContract(q: QuoteRequest) {
    const params = new URLSearchParams();
    if (q.company) params.set("prefillCompany", q.company);
    if (q.name) params.set("prefillContact", q.name);
    if (q.email) params.set("prefillEmail", q.email);
    // 견적 수락 시 이미 사업자등록증을 받았다면 계약서에 그대로 이어받아, 서명 페이지에서
    // 다시 첨부하라고 중복으로 뜨지 않게 한다.
    if (q.bizRegCertUrl) params.set("prefillBizRegCertUrl", q.bizRegCertUrl);
    router.push(`/contracts?${params.toString()}`);
  }

  // "기간만료" 건을 품목 수정 없이 같은 내용 그대로 다시 발송한다 — "다시 작성 후 재발행"보다
  // 가벼운 액션.
  async function handleResendReminder(q: QuoteRequest) {
    setIssuing(true);
    try {
      await issueQuote(q.id, q.quoteItems ?? [], q.quoteMemo ?? "");
    } finally {
      setIssuing(false);
    }
  }

  async function handleSave(status: QuoteStatus) {
    if (!selected) return;
    setSaving(true);
    try {
      await updateQuote(selected.id, { status, memo });
      if (status === "contacted") {
        setSelected(null);
        setMemo("");
      } else {
        setSelected((prev) => prev ? { ...prev, status, memo } : null);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    if (!confirm("이 견적 요청을 삭제하시겠습니까?")) return;
    await deleteQuote(selected.id);
    setSelected(null);
  }

  if (appUser?.role !== "admin") {
    return <p className="text-sm text-[#86868b]">접근 권한이 없습니다.</p>;
  }

  if (previewOpen && selected) {
    // 편집 중이면(발행 전/재발행 작성 중) 지금 입력한 초안을, 아니면 실제 발행된 견적서
    // 그대로를 보여준다 — "크게 보기"와 "미리보기"가 같은 화면을 공유한다.
    const isDraft = editingQuote;
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
                onClick={() => setPreviewOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d1d1d6] text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
                title="닫기"
              >
                <X size={16} />
              </button>
              <p className="text-sm text-[#86868b]">{isDraft ? "발행 전 미리보기 — 실제 발송 화면과 동일합니다." : "발행된 견적서"}</p>
            </div>
            <button
              onClick={() => window.print()}
              className="rounded-full bg-[#1d1d1f] px-5 py-2 text-sm font-medium text-white transition hover:bg-black"
            >
              인쇄 / PDF 저장
            </button>
          </div>
        </div>
        <PdfPageScaler>
          <QuoteDocument
            data={
              isDraft
                ? {
                    quoteId: selected.id,
                    name: selected.name,
                    company: selected.company,
                    items: quoteItems.filter((it) => it.name.trim() && it.unitPrice > 0 && it.quantity > 0),
                    quoteMemo: quoteMemo,
                    quoteIssuedAt: Date.now(),
                    quoteIssuedBy: "주식회사 핸디핸드 최형준 대표",
                  }
                : {
                    quoteId: selected.id,
                    name: selected.name,
                    company: selected.company,
                    items: selected.quoteItems ?? [],
                    quoteMemo: selected.quoteMemo,
                    quoteIssuedAt: selected.quoteIssuedAt ?? Date.now(),
                    quoteIssuedBy: selected.quoteIssuedBy,
                  }
            }
          />
        </PdfPageScaler>
      </div>
    );
  }

  const pending = quotes.filter((q) => q.status === "pending");
  const others = quotes.filter((q) => q.status !== "pending");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-[#1d1d1f]">
            <span className="h-2 w-2 rounded-full bg-[#1d1d1f]" />
            견적 요청 관리
          </h1>
          <p className="mt-1 pl-4 text-sm text-[#86868b]">홈페이지에서 접수된 견적 요청을 확인하고 처리 상태를 관리합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex h-9 items-center gap-1 rounded-full border border-dashed border-[#d1d1d6] px-3 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
          >
            <Plus size={13} /> 견적 요청 직접 등록
          </button>
          <button
            onClick={() => setDirectQuoteOpen(true)}
            className="flex h-9 items-center gap-1 rounded-full border border-dashed border-[#d1d1d6] px-3 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
          >
            <Plus size={13} /> 견적서 바로 만들기 (문의 없이)
          </button>
          <span className="inline-flex h-9 items-center rounded-full bg-amber-50 px-3 text-xs font-medium text-amber-600">
            미처리 {pending.length}건
          </span>
        </div>
      </div>

      {addModalOpen && (
        <AddQuoteRequestModal
          onClose={() => setAddModalOpen(false)}
          onCreated={(q) => { setSelected(q); setAddModalOpen(false); }}
        />
      )}

      {directQuoteOpen && (
        <DirectQuoteModal
          onClose={() => setDirectQuoteOpen(false)}
          onCreated={(q) => { setSelected(q); setDirectQuoteOpen(false); }}
        />
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* 목록 */}
        <div className="space-y-2">
          {pending.length > 0 && (
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">검토중 ({pending.length})</p>
          )}
          {pending.map((q) => (
            <QuoteCard key={q.id} quote={q} selected={selected?.id === q.id}
              onClick={() => { setSelected(q); setMemo(q.memo); setEditingQuote(false); }} />
          ))}

          {others.length > 0 && (
            <button
              onClick={() => setShowDone((v) => !v)}
              className="mt-4 block text-xs font-medium text-[#86868b] underline underline-offset-2 hover:text-[#1d1d1f]"
            >
              {showDone ? "처리완료 숨기기" : `처리완료 ${others.length}건 숨겨짐 · 보기`}
            </button>
          )}
          {showDone && others.map((q) => (
            <QuoteCard key={q.id} quote={q} selected={selected?.id === q.id}
              onClick={() => { setSelected(q); setMemo(q.memo); setEditingQuote(false); }} />
          ))}

          {quotes.length === 0 && (
            <div className="rounded-3xl border border-dashed border-[#d1d1d6] bg-white p-10 text-center text-sm text-[#86868b]">
              접수된 견적 요청이 없습니다.
            </div>
          )}
        </div>

        {/* 상세 */}
        {selected && (
          <div className="rounded-3xl bg-white p-6 space-y-4 self-start">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[#1d1d1f]">{selected.name}
                  {selected.company && <span className="ml-2 text-sm font-normal text-[#86868b]">({selected.company})</span>}
                </p>
                <p className="mt-0.5 text-xs text-[#86868b]">
                  {new Date(selected.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {selected.quoteStatus ? (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${FORMAL_QUOTE_STYLE[selected.quoteStatus]}`}>
                    {FORMAL_QUOTE_LABEL[selected.quoteStatus]}
                  </span>
                ) : (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[selected.status]}`}>
                    {STATUS_LABEL[selected.status]}
                  </span>
                )}
                <button
                  onClick={handleDelete}
                  className="rounded-full p-1.5 text-[#d1d1d6] transition hover:bg-red-50 hover:text-red-500"
                  title="삭제"
                >
                  <Trash2 size={15} />
                </button>
                <button
                  onClick={() => { setSelected(null); setMemo(""); setEditingQuote(false); }}
                  className="rounded-full p-1.5 text-[#d1d1d6] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                  title="닫기"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-[#f5f5f7] p-4 text-sm">
              <div>
                <p className="text-xs text-[#86868b]">이메일</p>
                <p className="mt-0.5 font-medium text-[#1d1d1f]">{selected.email || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-[#86868b]">연락처</p>
                <p className="mt-0.5 font-medium text-[#1d1d1f]">{selected.phone || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-[#86868b]">개발 단계</p>
                <p className="mt-0.5 font-medium text-[#1d1d1f]">{selected.stage || "—"}</p>
              </div>
              {selected.hasAttachment && (
                <div>
                  <p className="text-xs text-[#86868b]">첨부파일</p>
                  <p className="mt-0.5 font-medium text-[#1d1d1f]">이메일로 전달됨 📎</p>
                </div>
              )}
            </div>

            <div>
              <p className="mb-1.5 text-xs text-[#86868b]">제품 개요</p>
              <div className="rounded-2xl bg-[#f5f5f7] px-4 py-3 text-sm text-[#1d1d1f] whitespace-pre-wrap">
                {selected.description}
              </div>
            </div>

            <QuoteFilesSection quoteId={selected.id} />

            <div className="rounded-2xl border border-[#e5e5e5] p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold text-[#1d1d1f]">정식 견적서</p>
                {selected.quoteStatus && (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${FORMAL_QUOTE_STYLE[selected.quoteStatus]}`}>
                    {FORMAL_QUOTE_LABEL[selected.quoteStatus]}
                  </span>
                )}
              </div>

              {selected.quoteStatus === "sent" && (
                <p className="mb-3 text-xs text-[#86868b]">
                  {selected.quoteViewedAt
                    ? `열람함 · ${new Date(selected.quoteViewedAt).toLocaleString("ko-KR")}`
                    : "아직 열람하지 않음"}
                </p>
              )}

              {!editingQuote && !selected.quoteStatus && (
                <button
                  onClick={() => openIssueEditor(selected)}
                  className="w-full rounded-full border border-dashed border-[#d1d1d6] py-2 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
                >
                  + 견적서 작성
                </button>
              )}

              {!editingQuote && selected.quoteStatus && (
                <div className="space-y-2">
                  <div className="space-y-1.5 text-sm">
                    {(selected.quoteItems ?? []).map((it, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-[#1d1d1f]">{it.name} × {it.quantity}{it.unit || "개"}</span>
                        <span className="text-[#86868b]">{formatMoney(it.unitPrice * it.quantity, it.currency)}</span>
                      </div>
                    ))}
                  </div>
                  {selected.quoteDeclineReason && (
                    <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-500">거절 사유: {selected.quoteDeclineReason}</p>
                  )}
                  {selected.bizRegCertUrl && (
                    <button
                      type="button"
                      onClick={() => openAuthenticatedStorageFile(selected.bizRegCertUrl!)}
                      className="block w-full rounded-xl bg-green-50 px-3 py-2 text-left text-xs font-medium text-green-600 underline underline-offset-2"
                    >
                      고객이 첨부한 사업자등록증 보기
                    </button>
                  )}
                  <button
                    onClick={() => setPreviewOpen(true)}
                    className="w-full rounded-full border border-[#d1d1d6] py-2 text-xs font-medium text-[#1d1d1f] transition hover:border-[#86868b]"
                  >
                    견적서 크게 보기
                  </button>
                  {selected.quoteStatus === "accepted" && (
                    <button
                      onClick={() => goToCreateContract(selected)}
                      className="w-full rounded-full bg-[#1d1d1f] py-2 text-xs font-medium text-white transition hover:bg-black"
                    >
                      계약서 작성하기
                    </button>
                  )}
                  {selected.quoteStatus === "expired" && (
                    <button
                      onClick={() => handleResendReminder(selected)}
                      disabled={issuing}
                      className="w-full rounded-full bg-[#1d1d1f] py-2 text-xs font-medium text-white transition hover:bg-black disabled:opacity-50"
                    >
                      {issuing ? "재발송 중..." : "같은 내용으로 다시 발송"}
                    </button>
                  )}
                  <button
                    onClick={() => openIssueEditor(selected)}
                    className="w-full rounded-full border border-[#d1d1d6] py-2 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
                  >
                    다시 작성 후 재발행
                  </button>
                </div>
              )}

              {editingQuote && (
                <div className="space-y-3">
                  <QuoteItemsEditor items={quoteItems} onChange={setQuoteItems} priceDrafts={priceDrafts} setPriceDrafts={setPriceDrafts} />
                  <textarea
                    value={quoteMemo}
                    onChange={(e) => setQuoteMemo(e.target.value)}
                    rows={2}
                    placeholder="견적 조건·비고 (고객에게 노출됩니다)"
                    className="w-full resize-none rounded-xl border border-[#d1d1d6] px-3 py-2 text-xs text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
                  />
                  <button
                    onClick={() => setPreviewOpen(true)}
                    className="w-full rounded-full border border-[#d1d1d6] py-2 text-xs font-medium text-[#1d1d1f] transition hover:border-[#86868b]"
                  >
                    미리보기
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingQuote(false)}
                      className="flex-1 rounded-full border border-[#d1d1d6] py-2 text-xs font-medium text-[#1d1d1f] hover:border-[#86868b]"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleIssueQuote}
                      disabled={issuing}
                      className="flex-1 rounded-full bg-[#1d1d1f] py-2 text-xs font-medium text-white transition hover:bg-black disabled:opacity-50"
                    >
                      {issuing ? "발행 중..." : "견적서 발행 및 발송"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-[#86868b]">내부 메모</label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={3}
                placeholder="담당자 메모 (고객에게 노출되지 않음)"
                className="w-full resize-none rounded-2xl border border-[#d1d1d6] px-3 py-2.5 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
              />
            </div>

            {/* 정식 견적서를 발행한 뒤로는 그 상태(발송됨/수락됨/거절됨)가 진행상황을 훨씬
                정확히 보여주므로, 리드 관리용 검토중/검토완료/연락완료는 이 시점부턴 굳이
                챙길 이유가 없어 숨긴다. */}
            {!selected.quoteStatus && (
              <div className="flex gap-2">
                {(["pending", "reviewed", "contacted"] as QuoteStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSave(s)}
                    disabled={saving}
                    className={`flex-1 rounded-full py-2 text-xs font-medium transition disabled:opacity-50 ${
                      selected.status === s
                        ? "bg-black text-white"
                        : "border border-[#d1d1d6] text-[#86868b] hover:border-[#86868b] hover:text-[#1d1d1f]"
                    }`}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function QuoteCard({ quote, selected, onClick }: { quote: QuoteRequest; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        selected ? "border-[#1d1d1f] bg-[#e5e5e5]" : "border-[#e5e5e5] bg-white hover:border-[#86868b]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-[#1d1d1f] truncate">
          {quote.name}
          {quote.company && <span className="ml-1.5 text-xs font-normal text-[#86868b]">{quote.company}</span>}
        </p>
        {quote.quoteStatus ? (
          <span className="flex shrink-0 items-center gap-1.5">
            {quote.quoteStatus === "sent" && !quote.quoteViewedAt && (
              <span title="아직 열람하지 않음" className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            )}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${FORMAL_QUOTE_STYLE[quote.quoteStatus]}`}>
              {FORMAL_QUOTE_LABEL[quote.quoteStatus]}
            </span>
          </span>
        ) : (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[quote.status]}`}>
            {STATUS_LABEL[quote.status]}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-[#86868b] line-clamp-1">{quote.description}</p>
      <p className="mt-1.5 text-xs text-[#d1d1d6]">
        {quote.stage && <span className="mr-2">{quote.stage}</span>}
        {new Date(quote.createdAt).toLocaleDateString("ko-KR")}
      </p>
    </button>
  );
}

// 사이트 공개 폼을 거치지 않고(전화·이메일 등으로 직접 받은) 견적 요청을 관리자가 수기로
// 등록하는 모달 — 이후 흐름(정식 견적서 작성·발행)은 사이트에서 들어온 요청과 완전히 동일하다.
function AddQuoteRequestModal({ onClose, onCreated }: { onClose: () => void; onCreated: (quote: QuoteRequest) => void }) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [stage, setStage] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!name.trim() || !email.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      const ref = await createQuoteRequest({
        name: name.trim(),
        company: company.trim() || undefined,
        email: email.trim(),
        phone: phone.trim() || undefined,
        stage: stage || undefined,
        description: description.trim(),
      });
      onCreated({
        id: ref.id,
        name: name.trim(),
        company: company.trim(),
        email: email.trim(),
        phone: phone.trim(),
        description: description.trim(),
        stage: stage,
        status: "pending",
        createdAt: Date.now(),
        memo: "",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="max-h-[90dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-3xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#1d1d1f]">견적 요청 직접 등록</h2>
            <p className="mt-1 text-xs text-[#86868b]">전화·이메일 등으로 별도로 받은 견적 요청을 등록합니다. 등록 후 정식 견적서 작성 흐름은 동일합니다.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#d1d1d6] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]">
            <X size={15} />
          </button>
        </div>

        <div>
          <label className="mb-1.5 block text-xs text-[#86868b]">이름 *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-[#86868b]">회사 / 브랜드명</label>
          <input value={company} onChange={(e) => setCompany(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-[#86868b]">이메일 *</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-[#86868b]">연락처</label>
          <input
            value={phone}
            onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
            placeholder="010-0000-0000"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-[#86868b]">개발 단계</label>
          <div className="flex flex-wrap gap-1.5">
            {STAGES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStage((prev) => (prev === s ? "" : s))}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  stage === s ? "bg-[#1d1d1f] text-white" : "bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-[#86868b]">제품 개요 *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="어떤 제품을 개발하고 싶으신지 간략히 설명해주세요."
            className="w-full resize-none rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || !name.trim() || !email.trim() || !description.trim()}
          className="w-full rounded-full bg-[#1d1d1f] py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
        >
          {submitting ? "등록 중..." : "등록"}
        </button>
      </div>
    </div>
  );
}

// 청구서의 "발주 없이 직접 등록"과 같은 취지 — 견적 문의(리드) 단계를 거치지 않고, 받는
// 사람 정보와 품목을 한 번에 입력해 곧바로 정식 견적서를 발행·발송한다. 내부적으로는
// quoteRequests 문서를 만들고 바로 issueQuote를 이어서 호출하는 것뿐이라, 목록에는
// 처음부터 "발송됨" 상태로만 나타난다.
// 입력 중간에 실수로 모달을 닫거나 브라우저를 새로고침해도 다시 처음부터 치지 않도록,
// 이 브라우저에만 남는 임시저장(로컬 스토리지)을 둔다 — 여러 사람이 공유하는 서버 데이터가
// 아니라 "쓰다 만 것"이라 굳이 Firestore까지 갈 필요는 없다.
const DIRECT_QUOTE_DRAFT_KEY = "directQuoteDraft";

interface DirectQuoteDraft {
  name: string;
  company: string;
  email: string;
  phone: string;
  items: QuoteLineItem[];
  priceDrafts: Record<number, string>;
  quoteMemo: string;
}

function DirectQuoteModal({ onClose, onCreated }: { onClose: () => void; onCreated: (quote: QuoteRequest) => void }) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [items, setItems] = useState<QuoteLineItem[]>([emptyLineItem()]);
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});
  const [quoteMemo, setQuoteMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftSavedJustNow, setDraftSavedJustNow] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DIRECT_QUOTE_DRAFT_KEY);
      if (!raw) return;
      const draft: DirectQuoteDraft = JSON.parse(raw);
      setName(draft.name ?? "");
      setCompany(draft.company ?? "");
      setEmail(draft.email ?? "");
      setPhone(draft.phone ?? "");
      if (draft.items?.length) setItems(draft.items);
      setPriceDrafts(draft.priceDrafts ?? {});
      setQuoteMemo(draft.quoteMemo ?? "");
      setDraftLoaded(true);
    } catch {
      // 저장된 형식이 깨져 있으면 그냥 무시하고 빈 폼으로 시작한다.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSaveDraft() {
    const draft: DirectQuoteDraft = { name, company, email, phone, items, priceDrafts, quoteMemo };
    localStorage.setItem(DIRECT_QUOTE_DRAFT_KEY, JSON.stringify(draft));
    setDraftLoaded(true);
    setDraftSavedJustNow(true);
    setTimeout(() => setDraftSavedJustNow(false), 2000);
  }

  function handleDiscardDraft() {
    localStorage.removeItem(DIRECT_QUOTE_DRAFT_KEY);
    setName("");
    setCompany("");
    setEmail("");
    setPhone("");
    setItems([emptyLineItem()]);
    setPriceDrafts({});
    setQuoteMemo("");
    setDraftLoaded(false);
  }

  const validItems = items.filter((it) => it.name.trim() && it.unitPrice > 0 && it.quantity > 0);

  // 위 QuotesPage와 같은 이유 — 여기는 문의 없이 바로 만드는 경로라 입력 중인 값을 그대로 쓴다.
  usePrintFileName([company || name, "견적서", validItems.map((it) => it.name).filter(Boolean).join(",")], previewOpen);

  async function handleSubmit() {
    if (!name.trim() || !email.trim() || validItems.length === 0) return;
    setSubmitting(true);
    setError("");
    try {
      const ref = await createQuoteRequest({
        name: name.trim(),
        company: company.trim() || undefined,
        email: email.trim(),
        phone: phone.trim() || undefined,
        description: "견적서 바로 만들기로 등록됨",
      });
      await issueQuote(ref.id, validItems, quoteMemo.trim());
      localStorage.removeItem(DIRECT_QUOTE_DRAFT_KEY);
      onCreated({
        id: ref.id,
        name: name.trim(),
        company: company.trim(),
        email: email.trim(),
        phone: phone.trim(),
        description: "견적서 바로 만들기로 등록됨",
        stage: "",
        status: "contacted",
        createdAt: Date.now(),
        memo: "",
        quoteItems: validItems,
        quoteMemo: quoteMemo.trim(),
        quoteStatus: "sent",
        quoteIssuedAt: Date.now(),
      });
    } catch (e: any) {
      setError(e?.message ?? "발행 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]";

  if (previewOpen) {
    return (
      <div className="fixed inset-0 z-50 min-h-screen overflow-y-auto bg-[#e5e5e5] py-10 print:bg-white print:py-0">
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
                onClick={() => setPreviewOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d1d1d6] text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
                title="닫기"
              >
                <X size={16} />
              </button>
              <p className="text-sm text-[#86868b]">발행 전 미리보기 — 실제 발송 화면과 동일합니다.</p>
            </div>
            <button
              onClick={() => window.print()}
              className="rounded-full bg-[#1d1d1f] px-5 py-2 text-sm font-medium text-white transition hover:bg-black"
            >
              인쇄 / PDF 저장
            </button>
          </div>
        </div>
        <PdfPageScaler>
          <QuoteDocument
            data={{
              quoteId: "preview",
              name: name || "(수신자 미입력)",
              company: company || undefined,
              items: validItems,
              quoteMemo: quoteMemo.trim(),
              quoteIssuedAt: Date.now(),
            }}
          />
        </PdfPageScaler>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="flex max-h-[90dvh] w-full max-w-md flex-col rounded-3xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 space-y-3 p-6 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#1d1d1f]">견적서 바로 만들기</h2>
              <p className="mt-1 text-xs text-[#86868b]">견적 문의 없이, 받는 분 정보와 품목을 바로 입력해 정식 견적서를 발행·발송합니다.</p>
            </div>
            <button onClick={onClose} className="rounded-full p-1.5 text-[#d1d1d6] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]">
              <X size={15} />
            </button>
          </div>
        </div>

        {draftLoaded && (
          <div className="mx-6 mb-1 flex shrink-0 items-center justify-between gap-2 rounded-xl bg-[#f5f5f7] px-3 py-2 text-xs text-[#86868b]">
            <span>{draftSavedJustNow ? "임시저장되었습니다." : "임시저장된 내용을 불러왔습니다."}</span>
            <button onClick={handleDiscardDraft} className="shrink-0 font-medium text-[#86868b] underline underline-offset-2 hover:text-[#1d1d1f]">
              지우고 새로 작성
            </button>
          </div>
        )}

        <div className="no-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-6 pb-6">
          <div>
            <label className="mb-1.5 block text-xs text-[#86868b]">이름 *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[#86868b]">회사 / 브랜드명</label>
            <input value={company} onChange={(e) => setCompany(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[#86868b]">이메일 *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[#86868b]">연락처</label>
            <input
              value={phone}
              onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
              placeholder="010-0000-0000"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-[#86868b]">품목</label>
            <QuoteItemsEditor items={items} onChange={setItems} priceDrafts={priceDrafts} setPriceDrafts={setPriceDrafts} />
          </div>

          <textarea
            value={quoteMemo}
            onChange={(e) => setQuoteMemo(e.target.value)}
            rows={2}
            placeholder="견적 조건·비고 (고객에게 노출됩니다)"
            className="w-full resize-none rounded-xl border border-[#d1d1d6] px-3 py-2 text-xs text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
          />

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={() => setPreviewOpen(true)}
              disabled={validItems.length === 0}
              className="flex-1 rounded-full border border-[#d1d1d6] py-2 text-xs font-medium text-[#1d1d1f] transition hover:border-[#86868b] disabled:opacity-50"
            >
              미리보기
            </button>
            <button
              onClick={handleSaveDraft}
              className="flex-1 rounded-full border border-[#d1d1d6] py-2 text-xs font-medium text-[#1d1d1f] transition hover:border-[#86868b]"
            >
              임시저장
            </button>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || !name.trim() || !email.trim() || validItems.length === 0}
            className="w-full rounded-full bg-[#1d1d1f] py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
          >
            {submitting ? "발행 중..." : "견적서 발행 및 발송"}
          </button>
        </div>
      </div>
    </div>
  );
}

// 상담(대면/화상 미팅) 중 이메일 등으로 추가로 받는 자료를 쌓아두는 섹션 — STP/STEP 도면은
// 업무 파일탭과 동일한 3D 뷰어로 바로 확인할 수 있다(견적 단계라 프로젝트/업무가 없으므로
// 리뷰 핀 기능 없이 보기 전용으로만 쓴다).
function QuoteFilesSection({ quoteId }: { quoteId: string }) {
  const { appUser } = useAuth();
  const [files, setFiles] = useState<QuoteFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => listenQuoteFiles(quoteId, setFiles), [quoteId]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !appUser) return;
    setUploading(true);
    try {
      await uploadQuoteFile(quoteId, file, appUser.name);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(f: QuoteFile) {
    if (!confirm(`"${f.name}" 파일을 삭제하시겠습니까?`)) return;
    await deleteQuoteFile(quoteId, f.id, f.storagePath);
    if (expandedId === f.id) setExpandedId(null);
  }

  return (
    <div className="rounded-2xl border border-[#e5e5e5] p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-[#1d1d1f]">
          <Paperclip size={12} /> 상담 자료
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 text-xs font-medium text-[#86868b] transition hover:text-[#1d1d1f] disabled:opacity-50"
        >
          <Upload size={12} /> {uploading ? "업로드 중..." : "자료 추가"}
        </button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
      </div>

      {files.length === 0 ? (
        <p className="text-xs text-[#d1d1d6]">아직 등록된 자료가 없습니다.</p>
      ) : (
        <div className="space-y-1.5">
          {files.map((f) => {
            const stp = isStepFile(f.name);
            const expanded = expandedId === f.id;
            return (
              <div key={f.id} className="rounded-xl border border-[#f0f0f0]">
                <div className="flex items-center gap-2 px-2.5 py-2">
                  {stp ? (
                    <button
                      onClick={() => setExpandedId(expanded ? null : f.id)}
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs text-[#1d1d1f] hover:text-[#86868b]"
                    >
                      {expanded ? <ChevronDown size={12} className="shrink-0" /> : <ChevronRight size={12} className="shrink-0" />}
                      <span className="truncate">{f.name}</span>
                    </button>
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-xs text-[#1d1d1f]">{f.name}</span>
                  )}
                  <span className="shrink-0 text-[10px] text-[#d1d1d6]">{formatFileSize(f.size)}</span>
                  <a href={f.url} target="_blank" rel="noreferrer" className="shrink-0 text-[#86868b] hover:text-[#1d1d1f]" title="다운로드">
                    <Download size={13} />
                  </a>
                  <button onClick={() => handleDelete(f)} className="shrink-0 text-[#86868b] hover:text-red-500" title="삭제">
                    <Trash2 size={13} />
                  </button>
                </div>
                {stp && expanded && (
                  <div className="border-t border-[#f0f0f0] p-2">
                    <StepViewer url={f.url} height={320} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
