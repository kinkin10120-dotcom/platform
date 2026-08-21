"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenMyInquiries, createInquiry, updateMyInquiry, deleteInquiry } from "@/lib/firestore/inquiries";
import { Inquiry } from "@/lib/types";

export default function MyInquiriesPage() {
  const { appUser } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!appUser) return;
    return listenMyInquiries(appUser.uid, setInquiries);
  }, [appUser]);

  function startCreate() {
    setEditingId(null);
    setTitle("");
    setContent("");
    setShowForm(true);
  }

  function startEdit(q: Inquiry) {
    setEditingId(q.id);
    setTitle(q.title);
    setContent(q.content);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setTitle("");
    setContent("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!appUser || !title.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      if (editingId) {
        await updateMyInquiry(editingId, title.trim(), content.trim());
      } else {
        await createInquiry({
          userId: appUser.uid,
          userName: appUser.name,
          clientId: appUser.clientId,
          title: title.trim(),
          content: content.trim(),
        });
      }
      closeForm();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("이 문의를 삭제하시겠습니까?")) return;
    await deleteInquiry(id);
    if (editingId === id) closeForm();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-[#1d1d1f]">
            <span className="h-2 w-2 rounded-full bg-[#1d1d1f]" />
            문의하기
          </h1>
          <p className="mt-1 pl-4 text-sm text-[#86868b]">시스템 이용 중 궁금한 점이나 기타 문의사항을 남겨주세요.</p>
        </div>
        {!showForm && (
          <button
            onClick={startCreate}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1 self-start whitespace-nowrap rounded-full bg-[#1d1d1f] px-4 text-sm font-medium text-white transition hover:bg-black"
          >
            <Plus size={16} />
            새 문의
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-3xl bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#1d1d1f]">{editingId ? "문의 수정" : "새 문의"}</h3>
            <button type="button" onClick={closeForm} className="text-[#86868b] hover:text-[#1d1d1f]">
              <X size={16} />
            </button>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#86868b]">제목</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="문의 제목을 입력하세요"
              className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#86868b]">내용</label>
            <textarea
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder="문의 내용을 자세히 작성해주세요"
              className="w-full resize-none rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !title.trim() || !content.trim()}
            className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
          >
            {submitting ? "저장 중..." : editingId ? "수정 저장" : "문의 보내기"}
          </button>
        </form>
      )}

      {inquiries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#d1d1d6] bg-white py-16 text-center">
          <p className="text-sm text-[#86868b]">보낸 문의가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {inquiries.map((q) => (
            <div key={q.id} className="rounded-3xl bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[#1d1d1f]">{q.title}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      q.status === "answered" ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
                    }`}>
                      {q.status === "answered" ? "답변완료" : "검토중"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#86868b]">{new Date(q.createdAt).toLocaleDateString("ko-KR")}</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-[#1d1d1f] leading-relaxed">{q.content}</p>
                  {q.answer && (
                    <div className="mt-3 rounded-2xl bg-[#f5f5f7] px-4 py-3">
                      <p className="mb-1 text-xs font-medium text-[#86868b]">답변</p>
                      <p className="whitespace-pre-wrap text-sm text-[#1d1d1f]">{q.answer}</p>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {q.status !== "answered" && (
                    <button onClick={() => startEdit(q)} className="rounded-lg p-1.5 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]">
                      <Pencil size={14} />
                    </button>
                  )}
                  <button onClick={() => handleDelete(q.id)} className="rounded-lg p-1.5 text-[#86868b] hover:bg-red-50 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
