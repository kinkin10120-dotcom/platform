"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ko, zhCN } from "date-fns/locale";
import { Paperclip, Download, Trash2, Pencil, Check, X, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  listenPartnerArchiveFiles,
  listenPartnerArchiveComments,
  uploadPartnerArchiveFile,
  deletePartnerArchiveFile,
  addPartnerArchiveComment,
  updatePartnerArchiveComment,
  deletePartnerArchiveComment,
} from "@/lib/firestore/partnerArchive";
import { PartnerArchiveFile, PartnerArchiveComment } from "@/lib/types";
import { zh, usePartnerZh, useZhAutoTranslate } from "@/lib/i18n";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function CommentItem({ comment: c, isMine, onUpdate, onDelete, isZh }: {
  comment: PartnerArchiveComment;
  isMine: boolean;
  onUpdate: (text: string) => Promise<void>;
  onDelete: () => Promise<void>;
  isZh: boolean;
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
          {zh(isZh, c.authorName)}
          <span className="ml-1 text-xs text-[#86868b]">
            {zh(isZh, c.authorRole === "admin" ? "(운영팀)" : c.authorRole === "partner" ? "(협력사)" : "(운영팀)")}
          </span>
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#d1d1d6]">{formatDistanceToNow(c.createdAt, { addSuffix: true, locale: isZh ? zhCN : ko })}</span>
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
            className="min-w-0 flex-1 rounded-xl border border-[#d1d1d6] px-2 py-1 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
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
        <p className="mt-1 whitespace-pre-wrap text-sm text-[#1d1d1f]">{(isZh && c.textZh) || c.text}</p>
      )}
    </div>
  );
}

// 관리자 ↔ 협력사 전용 프로젝트 단위 자료함 — 업무(task)와 무관하다. 클라이언트(고객)는
// 이 탭 자체를 볼 수 없고(project page에서 렌더 조건으로 막음), firestore.rules에도 client
// 관련 함수를 아예 쓰지 않아 접근 경로 자체가 없다.
export default function PartnerArchiveTab({ projectId }: { projectId: string }) {
  const { appUser } = useAuth();
  const isZh = usePartnerZh();
  const [files, setFiles] = useState<PartnerArchiveFile[]>([]);
  const [comments, setComments] = useState<PartnerArchiveComment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => listenPartnerArchiveFiles(projectId, setFiles), [projectId]);
  useEffect(() => listenPartnerArchiveComments(projectId, setComments), [projectId]);

  const zhFileNames = useZhAutoTranslate(isZh, files.map((f) => f.name));

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !appUser) return;
    setUploading(true);
    setUploadError("");
    try {
      await uploadPartnerArchiveFile(projectId, file, appUser.uid, appUser.name);
    } catch (err) {
      console.error("협력사 자료함 업로드 실패:", err);
      setUploadError(zh(isZh, "업로드에 실패했습니다. 잠시 후 다시 시도해주세요."));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleSubmitComment(e: FormEvent) {
    e.preventDefault();
    if (!appUser || !text.trim()) return;
    setSubmitting(true);
    try {
      await addPartnerArchiveComment(projectId, appUser.uid, appUser.name, appUser.role, text.trim());
      setText("");
    } finally {
      setSubmitting(false);
    }
  }

  const canDelete = (f: PartnerArchiveFile) => appUser?.role === "admin" || appUser?.uid === f.uploadedBy;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-2xl bg-[#f5f5f7] px-4 py-3 text-xs text-[#86868b]">
        <Lock size={13} className="mt-0.5 shrink-0" />
        <p>{zh(isZh, "이 탭은 관리자와 협력사만 볼 수 있습니다. 고객에게는 노출되지 않습니다.")}</p>
      </div>

      <section>
        <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-[#86868b]">
          <Paperclip size={13} />
          {zh(isZh, "첨부 자료")}
        </p>
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-2xl border border-[#f0f0f0] bg-white px-3 py-2 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <Paperclip size={13} className="shrink-0 text-[#86868b]" />
                <span className="truncate text-[#1d1d1f]">{zhFileNames[f.name] ?? f.name}</span>
                <span className="shrink-0 text-xs text-[#86868b]">{formatSize(f.size)}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a href={f.url} target="_blank" rel="noreferrer" className="text-[#86868b] hover:text-[#1d1d1f]">
                  <Download size={14} />
                </a>
                {canDelete(f) && (
                  <button onClick={() => deletePartnerArchiveFile(f.id, f.storagePath)} className="text-[#86868b] hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {files.length === 0 && <p className="text-sm text-[#86868b]">{zh(isZh, "첨부된 자료가 없습니다.")}</p>}
        </div>

        <label className="mt-2 inline-flex cursor-pointer items-center gap-1 rounded-full border border-[#d1d1d6] px-3 py-1.5 text-xs font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]">
          <Paperclip size={12} />
          {uploading ? zh(isZh, "업로드 중...") : zh(isZh, "자료 업로드")}
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
        {uploadError && <p className="mt-1 text-xs text-red-500">{uploadError}</p>}
      </section>

      <section>
        <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-[#86868b]">
          {zh(isZh, "코멘트")}
        </p>
        <div className="scrollbar-thin max-h-96 space-y-3 overflow-y-auto">
          {comments.length === 0 && <p className="text-sm text-[#86868b]">{zh(isZh, "아직 코멘트가 없습니다.")}</p>}
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              isMine={c.authorId === appUser?.uid}
              onUpdate={(t) => updatePartnerArchiveComment(c.id, t)}
              onDelete={() => deletePartnerArchiveComment(c.id)}
              isZh={isZh}
            />
          ))}
        </div>

        <form onSubmit={handleSubmitComment} className="mt-3 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={zh(isZh, "코멘트를 입력하세요")}
            className="min-w-0 flex-1 rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
          />
          <button
            type="submit"
            disabled={submitting || !text.trim()}
            className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
          >
            {zh(isZh, "등록")}
          </button>
        </form>
      </section>
    </div>
  );
}
