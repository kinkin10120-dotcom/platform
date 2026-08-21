"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Megaphone, ChevronDown } from "lucide-react";
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
  // 공지가 여러 개 쌓이면 다 펼쳐진 채로는 훑어보기 어려워서, 제목만 보이게 접어두고
  // 눌러서 펼치는 방식으로 바꾼다 — 항목마다 따로 펼침 상태를 기억한다.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-[#1d1d1f]">
            <span className="h-2 w-2 rounded-full bg-[#1d1d1f]" />
            공지사항
          </h1>
          <p className="mt-1 pl-4 text-sm text-[#86868b]">클라이언트와 팀 전체에 알릴 내용을 등록하고 확인 여부를 관리합니다.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 self-start whitespace-nowrap rounded-full bg-[#1d1d1f] px-4 text-sm font-medium text-white transition hover:bg-black"
          >
            <Plus size={15} /> 공지 작성
          </button>
        )}
      </div>

      {isAdmin && showForm && (
        <div className="space-y-3 rounded-3xl bg-white p-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#86868b]">제목</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
              placeholder="공지 제목을 입력하세요"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#86868b]">내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="w-full resize-none rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
              placeholder="공지 내용을 입력하세요"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={submitting || !title.trim() || !content.trim()}
              className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
            >
              {submitting ? "등록 중..." : "등록"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-full border border-[#d1d1d6] px-4 py-2 text-sm text-[#1d1d1f] hover:bg-[#f5f5f7]"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {notices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#d1d1d6] bg-white py-16 text-center">
          <Megaphone size={32} className="mb-3 text-[#d1d1d6]" />
          <p className="text-sm text-[#86868b]">등록된 공지사항이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map((n) => {
            const expanded = expandedIds.has(n.id);
            return (
            <div key={n.id} className="group rounded-3xl bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <button onClick={() => toggleExpanded(n.id)} className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-[#1d1d1f]">{n.title}</p>
                    <ChevronDown size={14} className={`shrink-0 text-[#86868b] transition-transform ${expanded ? "rotate-180" : ""}`} />
                  </div>
                  <p className="mt-0.5 text-xs text-[#86868b]">{formatDate(n.createdAt)} · {n.createdByName}</p>
                  {expanded && (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-[#1d1d1f] leading-relaxed">{n.content}</p>
                  )}
                </button>
                {isAdmin && (
                  <button
                    onClick={() => deleteNotice(n.id)}
                    className="shrink-0 text-[#d1d1d6] opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
