"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Megaphone } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenNotices, createNotice, deleteNotice } from "@/lib/firestore/notices";
import { Notice } from "@/lib/types";

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

export default function NoticesPage() {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin";
  const [notices, setNotices] = useState<Notice[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => listenNotices(setNotices), []);

  async function handleCreate() {
    if (!title.trim() || !content.trim() || !appUser) return;
    setSubmitting(true);
    try {
      await createNotice(title.trim(), content.trim(), appUser.uid, appUser.name);
      setTitle("");
      setContent("");
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">공지사항</h1>
        {isAdmin && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus size={15} /> 공지 작성
          </button>
        )}
      </div>

      {isAdmin && showForm && (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">제목</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="공지 제목을 입력하세요"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="공지 내용을 입력하세요"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={submitting || !title.trim() || !content.trim()}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting ? "등록 중..." : "등록"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {notices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <Megaphone size={32} className="mb-3 text-gray-300" />
          <p className="text-sm text-gray-400">등록된 공지사항이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map((n) => (
            <div key={n.id} className="group rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{n.title}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{formatDate(n.createdAt)} · {n.createdByName}</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{n.content}</p>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => deleteNotice(n.id)}
                    className="shrink-0 text-gray-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
