"use client";

import { FormEvent, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Check, Trash2, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  addAnnotationComment,
  deleteAnnotation,
  listenAnnotationComments,
  toggleAnnotationResolved,
} from "@/lib/firestore/annotations";
import { ModelAnnotation, TaskComment } from "@/lib/types";

export default function AnnotationThread({
  taskId,
  fileId,
  annotation,
  onClose,
}: {
  taskId: string;
  fileId: string;
  annotation: ModelAnnotation;
  onClose: () => void;
}) {
  const { appUser } = useAuth();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(
    () => listenAnnotationComments(taskId, fileId, annotation.id, setComments),
    [taskId, fileId, annotation.id]
  );

  const canManage = appUser?.role === "admin" || appUser?.uid === annotation.createdBy;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!appUser || !text.trim()) return;
    setSubmitting(true);
    try {
      await addAnnotationComment(taskId, fileId, annotation.id, appUser.uid, appUser.name, appUser.role, text.trim());
      setText("");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteAnnotation() {
    await deleteAnnotation(taskId, fileId, annotation.id);
    onClose();
  }

  return (
    <div className="w-72 space-y-3 rounded-2xl border border-[#e5e5e5] bg-white p-3 shadow-[0_4px_20px_rgba(0,0,0,0.12)]">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-[#1d1d1f]">
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${annotation.resolved ? "bg-[#86868b]" : "bg-[#ff3b30]"}`}>
            {annotation.number}
          </span>
          핀 {annotation.number}
        </span>
        <button onClick={onClose} className="text-[#86868b] hover:text-[#1d1d1f]"><X size={14} /></button>
      </div>

      <div className="scrollbar-thin max-h-56 space-y-2 overflow-y-auto">
        {comments.map((c) => (
          <div key={c.id} className="rounded-xl bg-[#f5f5f7] p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#1d1d1f]">
                {c.authorName}
                <span className="ml-1 text-[10px] text-[#86868b]">
                  {c.authorRole === "admin" ? "(운영팀)" : c.authorRole === "claude-auto" ? "(Claude 자동)" : "(클라이언트)"}
                </span>
              </span>
              <span className="text-[10px] text-[#d1d1d6]">{formatDistanceToNow(c.createdAt, { addSuffix: true, locale: ko })}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-xs text-[#1d1d1f]">{c.text}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="답글 입력"
          className="min-w-0 flex-1 rounded-xl border border-[#d1d1d6] px-2.5 py-1.5 text-xs text-[#1d1d1f] outline-none focus:border-[#86868b]"
        />
        <button
          type="submit"
          disabled={submitting || !text.trim()}
          className="rounded-full bg-[#1d1d1f] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-black disabled:opacity-50"
        >
          등록
        </button>
      </form>

      {canManage && (
        <div className="flex items-center justify-between border-t border-[#f0f0f0] pt-2.5">
          <button
            onClick={() => toggleAnnotationResolved(taskId, fileId, annotation.id, !annotation.resolved)}
            className="flex items-center gap-1 text-xs font-medium text-[#86868b] transition hover:text-[#1d1d1f]"
          >
            <Check size={12} /> {annotation.resolved ? "미해결로 표시" : "해결됨으로 표시"}
          </button>
          <button onClick={handleDeleteAnnotation} className="flex items-center gap-1 text-xs text-[#86868b] transition hover:text-red-500">
            <Trash2 size={12} /> 핀 삭제
          </button>
        </div>
      )}
    </div>
  );
}
