"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { listenQuoteRequests, updateQuote, QuoteRequest, QuoteStatus } from "@/lib/firestore/quotes";

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

export default function QuotesPage() {
  const { appUser } = useAuth();
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [selected, setSelected] = useState<QuoteRequest | null>(null);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return listenQuoteRequests(setQuotes);
  }, []);

  async function handleSave(status: QuoteStatus) {
    if (!selected) return;
    setSaving(true);
    try {
      await updateQuote(selected.id, { status, memo });
      setSelected((prev) => prev ? { ...prev, status, memo } : null);
    } finally {
      setSaving(false);
    }
  }

  if (appUser?.role !== "admin") {
    return <p className="text-sm text-[#86868b]">접근 권한이 없습니다.</p>;
  }

  const pending = quotes.filter((q) => q.status === "pending");
  const others = quotes.filter((q) => q.status !== "pending");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#1d1d1f]">견적 요청 관리</h1>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">
          미처리 {pending.length}건
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* 목록 */}
        <div className="space-y-2">
          {pending.length > 0 && (
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">검토중 ({pending.length})</p>
          )}
          {pending.map((q) => (
            <QuoteCard key={q.id} quote={q} selected={selected?.id === q.id}
              onClick={() => { setSelected(q); setMemo(q.memo); }} />
          ))}

          {others.length > 0 && (
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[#86868b]">처리완료 ({others.length})</p>
          )}
          {others.map((q) => (
            <QuoteCard key={q.id} quote={q} selected={selected?.id === q.id}
              onClick={() => { setSelected(q); setMemo(q.memo); }} />
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
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[selected.status]}`}>
                {STATUS_LABEL[selected.status]}
              </span>
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
            </div>

            <div>
              <p className="mb-1.5 text-xs text-[#86868b]">제품 개요</p>
              <div className="rounded-2xl bg-[#f5f5f7] px-4 py-3 text-sm text-[#1d1d1f] whitespace-pre-wrap">
                {selected.description}
              </div>
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
        selected ? "border-[#1d1d1f] bg-[#f5f5f7]" : "border-[#e5e5e5] bg-white hover:border-[#86868b]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-[#1d1d1f] truncate">
          {quote.name}
          {quote.company && <span className="ml-1.5 text-xs font-normal text-[#86868b]">{quote.company}</span>}
        </p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[quote.status]}`}>
          {STATUS_LABEL[quote.status]}
        </span>
      </div>
      <p className="mt-1 text-xs text-[#86868b] line-clamp-1">{quote.description}</p>
      <p className="mt-1.5 text-xs text-[#d1d1d6]">
        {quote.stage && <span className="mr-2">{quote.stage}</span>}
        {new Date(quote.createdAt).toLocaleDateString("ko-KR")}
      </p>
    </button>
  );
}
