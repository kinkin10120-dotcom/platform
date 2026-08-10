"use client";

import { FormEvent, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { useAuth } from "@/lib/auth-context";
import { listenComments, addComment, updateComment, deleteComment } from "@/lib/firestore/comments";
import { createNotification } from "@/lib/firestore/notifications";
import { TaskComment, AppUser, Task } from "@/lib/types";
import { Pencil, Trash2, Check, X } from "lucide-react";

function CommentItem({ comment: c, isMine, onUpdate, onDelete }: {
  comment: TaskComment;
  isMine: boolean;
  onUpdate: (text: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(c.text);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!editText.trim()) return;
    setSaving(true);
    await onUpdate(editText.trim());
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="group rounded-2xl bg-[#f5f5f7] p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#1d1d1f]">
          {c.authorName}
          <span className="ml-1 text-xs text-[#86868b]">
            {c.authorRole === "admin" ? "(운영팀)" : c.authorRole === "claude-auto" ? "(Claude 자동)" : "(클라이언트)"}
          </span>
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#d1d1d6]">{formatDistanceToNow(c.createdAt, { addSuffix: true, locale: ko })}</span>
          {isMine && !editing && (
            <div className="flex gap-1">
              <button onClick={() => { setEditText(c.text); setEditing(true); }} className="text-[#86868b] hover:text-[#1d1d1f]"><Pencil size={12} /></button>
              <button onClick={onDelete} className="text-[#86868b] hover:text-red-500"><Trash2 size={12} /></button>
            </div>
          )}
        </div>
      </div>
      {editing ? (
        <div className="mt-2 flex gap-2">
          <textarea
            className="flex-1 rounded-xl border border-[#d1d1d6] px-2 py-1 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
            rows={2}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            autoFocus
          />
          <div className="flex flex-col gap-1">
            <button onClick={handleSave} disabled={saving} className="text-[#1d1d1f] hover:text-[#86868b]"><Check size={14} /></button>
            <button onClick={() => setEditing(false)} className="text-[#86868b] hover:text-[#1d1d1f]"><X size={14} /></button>
          </div>
        </div>
      ) : (
        <p className="mt-1 whitespace-pre-wrap text-sm text-[#1d1d1f]">{c.text}</p>
      )}
    </div>
  );
}

export default function CommentThread({ taskId, task, projectUsers }: { taskId: string; task: Task; projectUsers: AppUser[] }) {
  const { appUser } = useAuth();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => listenComments(taskId, setComments), [taskId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!appUser || !text.trim()) return;
    setSubmitting(true);
    try {
      await addComment(taskId, appUser.uid, appUser.name, appUser.role, text.trim());
      setText("");

      // 본인 제외 프로젝트 유저에게 알림 발송
      const targets = projectUsers.filter((u) => u.uid !== appUser.uid);
      await Promise.all(
        targets.map((u) =>
          createNotification({
            userId: u.uid,
            projectId: task.projectId,
            taskId: task.id,
            type: "comment",
            message: `${appUser.name}님이 [${task.name}]에 코멘트를 남겼습니다.`,
          })
        )
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="scrollbar-thin max-h-64 space-y-3 overflow-y-auto">
        {comments.length === 0 && <p className="text-sm text-[#86868b]">아직 코멘트가 없습니다.</p>}
        {comments.map((c) => (
          <CommentItem
            key={c.id}
            comment={c}
            isMine={c.authorId === appUser?.uid}
            onUpdate={(text) => updateComment(taskId, c.id, text)}
            onDelete={() => deleteComment(taskId, c.id)}
          />
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="코멘트를 입력하세요"
          className="flex-1 rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
        />
        <button
          type="submit"
          disabled={submitting || !text.trim()}
          className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
        >
          등록
        </button>
      </form>
    </div>
  );
}
