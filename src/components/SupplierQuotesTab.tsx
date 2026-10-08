"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronUp, Pencil, Printer, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenAllSupplierQuotes, approveSupplierQuote, requestSupplierQuoteRevision, deleteSupplierQuote } from "@/lib/firestore/supplierQuotes";
import { formatSupplierMoney } from "@/lib/firestore/supplierOrders";
import { SupplierQuote, SUPPLIER_QUOTE_STATUS_LABEL, SUPPLIER_ORDER_KIND_LABEL, SUPPLIER_ORDER_KIND_BADGE_CLASS } from "@/lib/types";

const STATUS_STYLE: Record<string, string> = {
  submitted: "bg-amber-50 text-amber-600",
  approved: "bg-green-50 text-green-600",
  rejected: "bg-red-50 text-red-500",
  revision_requested: "bg-blue-50 text-blue-600",
};

export default function SupplierQuotesTab() {
  const { appUser } = useAuth();
  const [quotes, setQuotes] = useState<SupplierQuote[]>([]);
  const [selected, setSelected] = useState<SupplierQuote | null>(null);
  const [showDecided, setShowDecided] = useState(false);
  const [approving, setApproving] = useState(false);
  const [requestingRevision, setRequestingRevision] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [actionError, setActionError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function resetSelection(q: SupplierQuote) {
    setSelected(q);
    setRequestingRevision(false);
    setRevisionNote("");
    setActionError("");
    setDeleteConfirm(false);
  }

  useEffect(() => listenAllSupplierQuotes(setQuotes), []);

  useEffect(() => {
    if (!selected) return;
    const fresh = quotes.find((q) => q.id === selected.id);
    if (fresh) setSelected(fresh);
  }, [quotes]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleApprove() {
    if (!selected || !appUser) return;
    setApproving(true);
    setActionError("");
    try {
      await approveSupplierQuote(selected, appUser.uid);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "승인 처리에 실패했습니다.");
    } finally {
      setApproving(false);
    }
  }

  // 그냥 반려하는 대신, 뭘 고쳐야 하는지 적어서 협력사에게 돌려준다 — 협력사는 이 내용을
  // 보고 수정해서 다시 제출할 수 있다.
  async function handleRequestRevision() {
    if (!selected || !appUser || !revisionNote.trim()) return;
    setApproving(true);
    setActionError("");
    try {
      await requestSupplierQuoteRevision(selected, appUser.uid, revisionNote.trim());
      setRequestingRevision(false);
      setRevisionNote("");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "수정 요청에 실패했습니다.");
    } finally {
      setApproving(false);
    }
  }

  // 관리자는 테스트/실수로 생긴 견적서를 상태와 무관하게 지울 수 있다(firestore.rules의
  // isAdmin() 전체 write 권한으로 이미 허용됨) — 승인된 건을 지워도 이미 생성된 매입
  // 발주서는 그대로 남는다(연쇄 삭제하지 않는다).
  async function handleDelete() {
    if (!selected) return;
    setDeleting(true);
    try {
      await deleteSupplierQuote(selected.id);
      setSelected(null);
      setDeleteConfirm(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  }

  const pending = quotes.filter((q) => q.status === "submitted");
  const awaitingRevision = quotes.filter((q) => q.status === "revision_requested");
  const decided = quotes.filter((q) => q.status === "approved" || q.status === "rejected");

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="space-y-2">
        {pending.length > 0 && <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">검토 대기 ({pending.length})</p>}
        {pending.map((q) => (
          <QuoteCard key={q.id} quote={q} selected={selected?.id === q.id} onClick={() => resetSelection(q)} />
        ))}
        {awaitingRevision.length > 0 && (
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-blue-500">협력사 응답 대기 ({awaitingRevision.length})</p>
        )}
        {awaitingRevision.map((q) => (
          <QuoteCard key={q.id} quote={q} selected={selected?.id === q.id} onClick={() => resetSelection(q)} />
        ))}
        {decided.length > 0 && (
          <button
            onClick={() => setShowDecided((v) => !v)}
            className="mt-4 flex items-center gap-1 text-xs font-medium text-[#86868b] underline underline-offset-2 hover:text-[#1d1d1f]"
          >
            {showDecided ? "처리된 견적서 숨기기" : `처리된 견적서 ${decided.length}건 숨겨짐 · 보기`}
            {showDecided ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
        {showDecided && decided.map((q) => (
          <QuoteCard key={q.id} quote={q} selected={selected?.id === q.id} onClick={() => resetSelection(q)} />
        ))}
        {quotes.length === 0 && (
          <div className="rounded-3xl border border-dashed border-[#d1d1d6] bg-white p-10 text-center text-sm text-[#86868b]">
            제출된 견적서가 없습니다.
          </div>
        )}
      </div>

      {selected && (
        <div className="space-y-4 self-start rounded-3xl bg-white p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-[#1d1d1f]">{selected.partnerName}</p>
              <p className="mt-0.5 text-xs text-[#86868b]">
                {selected.quoteNumber} · {new Date(selected.submittedAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
              </p>
              {selected.linkedProjectName && <p className="mt-0.5 text-xs text-[#86868b]">프로젝트: {selected.linkedProjectName}</p>}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {selected.orderKind && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SUPPLIER_ORDER_KIND_BADGE_CLASS[selected.orderKind]}`}>
                  {SUPPLIER_ORDER_KIND_LABEL[selected.orderKind]}
                </span>
              )}
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[selected.status]}`}>
                {SUPPLIER_QUOTE_STATUS_LABEL[selected.status]}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 rounded-2xl bg-[#f5f5f7] p-3">
            {selected.items.map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-[#1d1d1f]">{it.nameKo || it.name}</p>
                  <p className="text-xs text-[#86868b]">
                    {it.spec ? `${it.spec} · ` : ""}
                    {it.quantity.toLocaleString()}{it.unit ?? "EA"} × {formatSupplierMoney(it.unitPrice, selected.currency)}
                  </p>
                </div>
                <span className="shrink-0 font-medium text-[#1d1d1f]">{formatSupplierMoney(it.unitPrice * it.quantity, selected.currency)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-[#f0f0f0] pt-3">
            <span className="text-sm text-[#86868b]">합계</span>
            <span className="text-lg font-bold text-[#1d1d1f]">{formatSupplierMoney(selected.totalAmount, selected.currency)}</span>
          </div>

          {(selected.memoKo || selected.memo) && (
            <p className="rounded-xl bg-[#f5f5f7] px-3 py-2 text-xs text-[#86868b]">{selected.memoKo || selected.memo}</p>
          )}

          {selected.status === "rejected" && selected.rejectReason && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">반려 사유: {selected.rejectReason}</p>
          )}
          {selected.status === "revision_requested" && selected.revisionNote && (
            <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-600">
              수정 요청: {selected.revisionNote} <span className="text-blue-400">(협력사 응답 대기 중)</span>
            </p>
          )}
          {selected.status === "approved" && (
            <p className="rounded-xl bg-green-50 px-3 py-2 text-xs text-green-600">
              승인되어 매입 발주서(작성중)로 전환되었습니다 — &quot;구매 발주&quot; 탭에서 확인·발행할 수 있습니다.
            </p>
          )}

          {selected.status === "submitted" && requestingRevision ? (
            <div className="space-y-2 border-t border-[#f0f0f0] pt-4">
              <textarea
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                rows={3}
                placeholder="어떤 부분을 고쳐야 하는지 적어주세요 — 협력사에게 그대로 전달됩니다."
                className="w-full resize-none rounded-xl border border-[#d1d1d6] px-3 py-2 text-xs outline-none focus:border-[#86868b]"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleRequestRevision}
                  disabled={approving || !revisionNote.trim()}
                  className="rounded-full bg-blue-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {approving ? "처리 중..." : "수정 요청 보내기"}
                </button>
                <button
                  onClick={() => { setRequestingRevision(false); setRevisionNote(""); }}
                  className="rounded-full border border-[#d1d1d6] px-4 py-2 text-xs text-[#1d1d1f] hover:bg-[#f5f5f7]"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 border-t border-[#f0f0f0] pt-4">
              <Link
                href={`/supplier-quotes/${selected.id}/print`}
                className="flex items-center gap-1.5 rounded-full bg-[#1d1d1f] px-5 py-2 text-xs font-medium text-white transition hover:bg-black"
              >
                <Printer size={14} /> 견적서 보기 / PDF
              </Link>
              {selected.status === "submitted" && (
                <>
                  <button
                    onClick={handleApprove}
                    disabled={approving}
                    className="flex items-center gap-1.5 rounded-full border border-[#d1d1d6] px-4 py-2 text-xs font-medium text-[#1d1d1f] transition hover:border-[#86868b] disabled:opacity-50"
                  >
                    <Check size={14} /> {approving ? "처리 중..." : "승인하고 발주서 생성"}
                  </button>
                  <button
                    onClick={() => setRequestingRevision(true)}
                    disabled={approving}
                    className="flex items-center gap-1.5 rounded-full border border-[#d1d1d6] px-4 py-2 text-xs font-medium text-[#86868b] transition hover:border-blue-400 hover:text-blue-600"
                  >
                    <Pencil size={13} /> 수정 요청
                  </button>
                </>
              )}
              {/* 관리자는 상태와 무관하게 견적서를 지울 수 있다(테스트/실수로 생긴 건 정리용). */}
              <div className="ml-auto flex items-center gap-2">
                {deleteConfirm ? (
                  <>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="rounded-full bg-red-500 px-4 py-2 text-xs font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
                    >
                      {deleting ? "삭제 중..." : "정말 삭제"}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="rounded-full border border-[#d1d1d6] px-4 py-2 text-xs text-[#1d1d1f] hover:bg-[#f5f5f7]"
                    >
                      취소
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    className="rounded-full p-2 text-[#d1d1d6] transition hover:bg-red-50 hover:text-red-500"
                    title="삭제"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          )}
          {actionError && <p className="text-xs text-red-500">{actionError}</p>}
        </div>
      )}
    </div>
  );
}

function QuoteCard({ quote, selected, onClick }: { quote: SupplierQuote; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`block w-full rounded-2xl p-4 text-left transition ${selected ? "bg-[#1d1d1f] text-white" : "bg-white text-[#1d1d1f] hover:bg-[#f5f5f7]"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-medium">{quote.partnerName}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${selected ? "bg-white/20 text-white" : STATUS_STYLE[quote.status]}`}>
          {SUPPLIER_QUOTE_STATUS_LABEL[quote.status]}
        </span>
      </div>
      <p className={`mt-1 text-xs ${selected ? "text-white/70" : "text-[#86868b]"}`}>
        {quote.quoteNumber}{quote.linkedProjectName ? ` · ${quote.linkedProjectName}` : ""}
      </p>
      <p className={`mt-1.5 text-sm font-semibold ${selected ? "text-white" : "text-[#1d1d1f]"}`}>
        {formatSupplierMoney(quote.totalAmount, quote.currency)}
      </p>
    </button>
  );
}
