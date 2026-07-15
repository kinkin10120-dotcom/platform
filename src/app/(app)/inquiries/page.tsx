"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { listenAllInquiries, answerInquiry } from "@/lib/firestore/inquiries";
import { Inquiry } from "@/lib/types";

export default function InquiriesPage() {
  const { appUser } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);

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

  if (appUser?.role !== "admin") {
    return <p className="text-sm text-gray-400">접근 권한이 없습니다.</p>;
  }

  const pending = inquiries.filter((q) => q.status === "pending");
  const answered = inquiries.filter((q) => q.status === "answered");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">문의 관리</h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 목록 */}
        <div className="space-y-3">
          {pending.length > 0 && (
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">
              검토중 ({pending.length})
            </p>
          )}
          {pending.map((q) => (
            <InquiryCard key={q.id} inquiry={q} selected={selected?.id === q.id} onClick={() => { setSelected(q); setAnswer(q.answer ?? ""); }} />
          ))}
          {answered.length > 0 && (
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
              답변완료 ({answered.length})
            </p>
          )}
          {answered.map((q) => (
            <InquiryCard key={q.id} inquiry={q} selected={selected?.id === q.id} onClick={() => { setSelected(q); setAnswer(q.answer ?? ""); }} />
          ))}
          {inquiries.length === 0 && (
            <p className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
              접수된 문의가 없습니다.
            </p>
          )}
        </div>

        {/* 상세 / 답변 작성 */}
        {selected && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4 self-start">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">{selected.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selected.userName} · {new Date(selected.createdAt).toLocaleDateString("ko-KR")}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                selected.status === "answered" ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
              }`}>
                {selected.status === "answered" ? "답변완료" : "검토중"}
              </span>
            </div>
            <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">
              {selected.content}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">답변 작성</label>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={5}
                placeholder="답변을 입력하세요"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setSelected(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600">
                닫기
              </button>
              <button
                onClick={handleAnswer}
                disabled={saving || !answer.trim()}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
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

function InquiryCard({ inquiry, selected, onClick }: { inquiry: Inquiry; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border p-4 text-left transition hover:border-brand-300 ${
        selected ? "border-brand-400 bg-brand-50" : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="font-medium text-gray-800 truncate">{inquiry.title}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
          inquiry.status === "answered" ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
        }`}>
          {inquiry.status === "answered" ? "답변완료" : "검토중"}
        </span>
      </div>
      <p className="text-xs text-gray-500 line-clamp-1">{inquiry.content}</p>
      <p className="mt-1.5 text-xs text-gray-300">
        {inquiry.userName} · {new Date(inquiry.createdAt).toLocaleDateString("ko-KR")}
      </p>
    </button>
  );
}
