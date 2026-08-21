"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenAllInquiries, answerInquiry, deleteInquiry } from "@/lib/firestore/inquiries";
import { Inquiry } from "@/lib/types";

export default function InquiriesPage() {
  const { appUser } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAnswered, setShowAnswered] = useState(false);

  useEffect(() => {
    return listenAllInquiries(setInquiries);
  }, []);

  async function handleAnswer() {
    if (!selected || !answer.trim() || !appUser) return;
    setSaving(true);
    try {
      await answerInquiry(selected.id, answer.trim(), appUser.name);
      setSelected(null);
      setAnswer("");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(q: Inquiry) {
    if (!confirm(`"${q.title}" 문의를 삭제하시겠습니까?\n삭제하면 복구할 수 없습니다.`)) return;
    if (selected?.id === q.id) {
      setSelected(null);
      setAnswer("");
    }
    await deleteInquiry(q.id);
  }

  if (appUser?.role !== "admin") {
    return <p className="text-sm text-[#86868b]">접근 권한이 없습니다.</p>;
  }

  const pending = inquiries.filter((q) => q.status === "pending");
  const answered = inquiries.filter((q) => q.status === "answered");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-[#1d1d1f]">
            <span className="h-2 w-2 rounded-full bg-[#1d1d1f]" />
            문의 관리
          </h1>
          <p className="mt-1 pl-4 text-sm text-[#86868b]">홈페이지로 접수된 문의를 확인하고 처리 상태를 관리합니다.</p>
        </div>
        <span className="inline-flex h-9 items-center rounded-full bg-amber-50 px-3 text-xs font-medium text-amber-600">
          미처리 {pending.length}건
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 목록 */}
        <div className="space-y-3">
          {pending.map((q) => (
            <InquiryCard
              key={q.id}
              inquiry={q}
              selected={selected?.id === q.id}
              onClick={() => { setSelected(q); setAnswer(q.answer ?? ""); }}
              onDelete={() => handleDelete(q)}
            />
          ))}
          {inquiries.length === 0 && (
            <p className="rounded-3xl border border-dashed border-[#d1d1d6] bg-white p-10 text-center text-sm text-[#86868b]">
              접수된 문의가 없습니다.
            </p>
          )}
          {pending.length === 0 && inquiries.length > 0 && (
            <p className="rounded-3xl border border-dashed border-[#d1d1d6] bg-white p-10 text-center text-sm text-[#86868b]">
              검토중인 문의가 없습니다.
            </p>
          )}

          {answered.length > 0 && (
            <button
              onClick={() => setShowAnswered((v) => !v)}
              className="text-xs font-medium text-[#86868b] underline underline-offset-2 hover:text-[#1d1d1f]"
            >
              {showAnswered ? "답변완료 숨기기" : `답변완료 ${answered.length}건 숨겨짐 · 보기`}
            </button>
          )}
          {showAnswered && answered.map((q) => (
            <InquiryCard
              key={q.id}
              inquiry={q}
              selected={selected?.id === q.id}
              onClick={() => { setSelected(q); setAnswer(q.answer ?? ""); }}
              onDelete={() => handleDelete(q)}
            />
          ))}
        </div>

        {/* 상세 / 답변 작성 */}
        {selected && (
          <div className="rounded-3xl bg-white p-6 space-y-4 self-start">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-[#1d1d1f]">{selected.title}</p>
                <p className="text-xs text-[#86868b] mt-0.5">
                  {selected.userName} · {new Date(selected.createdAt).toLocaleDateString("ko-KR")}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                selected.status === "answered" ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
              }`}>
                {selected.status === "answered" ? "답변완료" : "검토중"}
              </span>
            </div>
            {selected.userId === "website" && (
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#86868b]">
                {selected.email && <span>이메일 · <a href={`mailto:${selected.email}`} className="text-[#1d1d1f] underline underline-offset-2">{selected.email}</a></span>}
                {selected.phone && <span>연락처 · <span className="text-[#1d1d1f]">{selected.phone}</span></span>}
              </div>
            )}
            <div className="rounded-2xl bg-[#f5f5f7] px-4 py-3 text-sm text-[#1d1d1f] whitespace-pre-wrap">
              {selected.content}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#86868b]">답변 작성</label>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={5}
                placeholder="답변을 입력하세요"
                className="w-full resize-none rounded-2xl border border-[#d1d1d6] px-3 py-2.5 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setSelected(null)} className="rounded-full border border-[#d1d1d6] px-4 py-2 text-sm text-[#1d1d1f] hover:bg-[#f5f5f7]">
                닫기
              </button>
              <button
                onClick={handleAnswer}
                disabled={saving || !answer.trim()}
                className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-40"
              >
                {saving ? "저장 중..." : "답변 저장"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InquiryCard({
  inquiry, selected, onClick, onDelete,
}: { inquiry: Inquiry; selected: boolean; onClick: () => void; onDelete: () => void }) {
  return (
    <div
      className={`relative w-full rounded-2xl border p-4 text-left transition ${
        selected ? "border-[#1d1d1f] bg-[#e5e5e5]" : "border-[#e5e5e5] bg-white hover:border-[#86868b]"
      }`}
    >
      <button onClick={onClick} className="block w-full pr-7 text-left">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-medium text-[#1d1d1f] truncate">{inquiry.title}</p>
          {inquiry.userId === "website" && (
            <span className="shrink-0 rounded-full bg-[#f5f5f7] px-2 py-0.5 text-xs text-[#86868b]">사이트</span>
          )}
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            inquiry.status === "answered" ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
          }`}>
            {inquiry.status === "answered" ? "답변완료" : "검토중"}
          </span>
        </div>
        <p className="text-xs text-[#86868b] line-clamp-1">{inquiry.content}</p>
        <p className="mt-1.5 text-xs text-[#d1d1d6]">
          {inquiry.userName} · {new Date(inquiry.createdAt).toLocaleDateString("ko-KR")}
        </p>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute right-3 top-3.5 text-[#d1d1d6] hover:text-red-500"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
