"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ko, zhCN } from "date-fns/locale";
import { Paperclip, Download, Trash2, Pencil, Check, X, Lock, Eye, EyeOff, Maximize2, History, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  listenPartnerArchiveFiles,
  listenPartnerArchiveComments,
  uploadPartnerArchiveFile,
  deletePartnerArchiveFile,
  addPartnerArchiveComment,
  updatePartnerArchiveComment,
  deletePartnerArchiveComment,
  PARTNER_ARCHIVE_MAX_FILE_SIZE,
} from "@/lib/firestore/partnerArchive";
import { getAdmins, getPartnersByProject } from "@/lib/firestore/users";
import { createNotification } from "@/lib/firestore/notifications";
import { PartnerArchiveFile, PartnerArchiveComment, Task } from "@/lib/types";
import { zh, usePartnerZh, useZhAutoTranslate } from "@/lib/i18n";
import { toProxiedUrl, isCnProxyOn, openFileViaProxy } from "@/lib/storageProxy";
import { getCached, setCached } from "@/lib/queryCache";

// 관리자가 올리면 이 프로젝트에 배정된 협력사 계정에게, 협력사가 올리면 관리자 전원에게
// 알린다 — 지금까지는 자료함에 새 파일·코멘트가 생겨도 상대쪽에 아무 알림이 안 가서,
// 들어가 보기 전까진 올라온 줄 몰랐다.
async function notifyPartnerArchiveTargets(
  projectId: string,
  actorUid: string,
  actorName: string,
  actorRole: string | undefined,
  message: string
) {
  const targets = actorRole === "admin" ? await getPartnersByProject(projectId) : await getAdmins();
  await Promise.all(
    targets
      .filter((u) => u.uid !== actorUid)
      .map((u) =>
        createNotification({
          userId: u.uid,
          projectId,
          type: "partner_archive",
          message,
        })
      )
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// FileUploader.tsx(업무별 자료)와 같은 버전 묶음 방식 — 같은 이름으로 다시 올리면 새 버전으로
// 쌓이는데, 그냥 나열하면 서로 다른 파일처럼 보여 뭐가 최신인지 헷갈린다.
function groupByName(files: PartnerArchiveFile[]) {
  const groups = new Map<string, PartnerArchiveFile[]>();
  for (const f of files) {
    const list = groups.get(f.name) ?? [];
    list.push(f);
    groups.set(f.name, list);
  }
  return Array.from(groups.values()).map((versions) => {
    const sorted = [...versions].sort((a, b) => b.version - a.version);
    return { latest: sorted[0], older: sorted.slice(1) };
  });
}

function ExpandModal({ f, onClose }: { f: PartnerArchiveFile; onClose: () => void }) {
  const isImage = f.contentType.startsWith("image/");
  const isPdf = f.contentType === "application/pdf";
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm" onClick={onClose}>
      <div className="flex items-center justify-between px-5 py-3" onClick={(e) => e.stopPropagation()}>
        <span className="truncate text-sm font-medium text-white/80">{f.name}</span>
        <button onClick={onClose} className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-hidden p-4" onClick={(e) => e.stopPropagation()}>
        {isImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={toProxiedUrl(f.url)} alt={f.name} className="h-full w-full object-contain" />
        )}
        {isPdf && <iframe src={toProxiedUrl(f.url)} className="h-full w-full rounded-xl bg-white" title={f.name} />}
      </div>
    </div>
  );
}

function formatUploadedAt(ts: number, isZh: boolean) {
  return new Date(ts).toLocaleString(isZh ? "zh-CN" : "ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FileRow({
  f,
  displayName,
  canDelete,
  onDelete,
  badge,
  isZh,
}: {
  f: PartnerArchiveFile;
  displayName: string;
  canDelete: boolean;
  onDelete: () => void;
  badge?: React.ReactNode;
  isZh: boolean;
}) {
  const [preview, setPreview] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isImage = f.contentType.startsWith("image/");
  const isPdf = f.contentType === "application/pdf";
  const hasPreview = isImage || isPdf;

  return (
    <>
      {expanded && <ExpandModal f={f} onClose={() => setExpanded(false)} />}
      <div className="overflow-hidden rounded-2xl border border-[#f0f0f0] bg-white">
        {preview && isImage && (
          <a href={toProxiedUrl(f.url)} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={toProxiedUrl(f.url)} alt={f.name} className="max-h-64 w-full bg-[#f5f5f7] object-contain" />
          </a>
        )}
        {preview && isPdf && <iframe src={toProxiedUrl(f.url)} className="h-96 w-full bg-[#f5f5f7]" title={f.name} />}
        <div className="flex items-center justify-between px-3 py-2 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={toProxiedUrl(f.url)} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
            ) : (
              <Paperclip size={13} className="shrink-0 text-[#86868b]" />
            )}
            <span className="truncate text-[#1d1d1f]">{displayName}</span>
            <span className="shrink-0 text-xs text-[#86868b]">{formatSize(f.size)}</span>
            <span className="shrink-0 text-xs text-[#86868b]">{formatUploadedAt(f.uploadedAt, isZh)}</span>
            {f.taskName && (
              <span className="shrink-0 truncate rounded-full bg-[#f5f5f7] px-2 py-0.5 text-xs text-[#86868b]">{f.taskName}</span>
            )}
            {badge}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {hasPreview && (
              <>
                <button onClick={() => setPreview((v) => !v)} className="text-[#86868b] hover:text-[#1d1d1f]">
                  {preview ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button onClick={() => setExpanded(true)} className="text-[#86868b] hover:text-[#1d1d1f]">
                  <Maximize2 size={14} />
                </button>
              </>
            )}
            {isCnProxyOn() ? (
              <button
                onClick={() => openFileViaProxy(toProxiedUrl(f.url), f.name).catch((e) => alert(e instanceof Error ? e.message : "파일을 여는 데 실패했습니다."))}
                className="text-[#86868b] hover:text-[#1d1d1f]"
              >
                <Download size={14} />
              </button>
            ) : (
              <a href={f.url} target="_blank" rel="noreferrer" className="text-[#86868b] hover:text-[#1d1d1f]">
                <Download size={14} />
              </a>
            )}
            {canDelete && (
              <button onClick={onDelete} className="text-[#86868b] hover:text-red-500">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function FileGroupRow({
  latest,
  older,
  displayName,
  canDelete,
  onDelete,
  isZh,
}: {
  latest: PartnerArchiveFile;
  older: PartnerArchiveFile[];
  displayName: (f: PartnerArchiveFile) => string;
  canDelete: (f: PartnerArchiveFile) => boolean;
  onDelete: (f: PartnerArchiveFile) => void;
  isZh: boolean;
}) {
  const [showOlder, setShowOlder] = useState(false);

  return (
    <div className="space-y-1.5">
      <FileRow
        f={latest}
        displayName={displayName(latest)}
        canDelete={canDelete(latest)}
        onDelete={() => onDelete(latest)}
        isZh={isZh}
        badge={
          older.length > 0 ? (
            <button
              onClick={() => setShowOlder((v) => !v)}
              className="ml-1 flex shrink-0 items-center gap-1 rounded-full bg-[#f5f5f7] px-2 py-0.5 text-xs text-[#86868b] hover:bg-[#e5e5e5]"
            >
              <History size={11} />
              v{latest.version}
              {showOlder ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          ) : undefined
        }
      />
      {showOlder && older.length > 0 && (
        <div className="ml-4 space-y-1.5 border-l border-[#e5e5e5] pl-3">
          {older.map((f) => (
            <FileRow
              key={f.id}
              f={f}
              displayName={displayName(f)}
              canDelete={canDelete(f)}
              onDelete={() => onDelete(f)}
              isZh={isZh}
              badge={<span className="ml-1 shrink-0 rounded-full bg-[#f5f5f7] px-2 py-0.5 text-xs text-[#86868b]">v{f.version}</span>}
            />
          ))}
        </div>
      )}
    </div>
  );
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
        <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-[#1d1d1f]">
          <span className="truncate">
            {zh(isZh, c.authorName)}
            <span className="ml-1 text-xs text-[#86868b]">
              {zh(isZh, c.authorRole === "admin" ? "(운영팀)" : c.authorRole === "partner" ? "(협력사)" : "(운영팀)")}
            </span>
          </span>
          {c.taskName && (
            <span className="shrink-0 truncate rounded-full bg-white px-2 py-0.5 text-xs text-[#86868b]">{c.taskName}</span>
          )}
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
        <p className="mt-1 whitespace-pre-wrap text-sm text-[#1d1d1f]">{isZh ? c.textZh || c.text : c.textKo || c.text}</p>
      )}
    </div>
  );
}

// 관리자 ↔ 협력사 전용 프로젝트 단위 자료함 — 업무(task)와 무관하다. 클라이언트(고객)는
// 이 탭 자체를 볼 수 없고(project page에서 렌더 조건으로 막음), firestore.rules에도 client
// 관련 함수를 아예 쓰지 않아 접근 경로 자체가 없다.
export default function PartnerArchiveTab({ projectId, tasks = [] }: { projectId: string; tasks?: Task[] }) {
  const { appUser } = useAuth();
  const isZh = usePartnerZh();
  // 탭을 오갈 때마다 리스너를 새로 맺고 첫 응답을 기다리느라 "자료가 없다"는 빈 화면이
  // 잠깐 보였다 사라지곤 했다 — 직전 값을 캐시에서 먼저 보여주고 리스너는 백그라운드에서
  // 갱신한다.
  const filesCacheKey = `partnerArchive:files:${projectId}`;
  const commentsCacheKey = `partnerArchive:comments:${projectId}`;
  const [files, setFiles] = useState<PartnerArchiveFile[]>(() => getCached(filesCacheKey) ?? []);
  const [comments, setComments] = useState<PartnerArchiveComment[]>(() => getCached(commentsCacheKey) ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadProgress, setUploadProgress] = useState<{ name: string; index: number; total: number; pct: number } | null>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // 이 자료함은 업무와 무관한 공간이지만, 어떤 업무 건인지 알아두면 찾기 편하다는 요청으로
  // 선택적 라벨만 붙인다 — tasks 컬렉션에는 아무 것도 쓰지 않고(고객과는 절대 연동 안 함),
  // 이 문서에 taskId/taskName을 그대로 복사해두기만 한다.
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  useEffect(() => listenPartnerArchiveFiles(projectId, (f) => {
    setFiles(f);
    setCached(filesCacheKey, f);
  }), [projectId, filesCacheKey]);
  useEffect(() => listenPartnerArchiveComments(projectId, (c) => {
    setComments(c);
    setCached(commentsCacheKey, c);
  }), [projectId, commentsCacheKey]);

  const zhFileNames = useZhAutoTranslate(isZh, files.map((f) => f.name));

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const fileList = Array.from(e.target.files ?? []);
    if (fileList.length === 0 || !appUser) return;

    // 용량 제한을 넘는 파일은 미리 걸러내고, 나머지는 그대로 올린다.
    const oversized = fileList.filter((f) => f.size > PARTNER_ARCHIVE_MAX_FILE_SIZE);
    const uploadable = fileList.filter((f) => f.size <= PARTNER_ARCHIVE_MAX_FILE_SIZE);

    setUploading(true);
    setUploadError(
      oversized.length > 0
        ? `${zh(isZh, "100MB가 넘는 파일은 제외했습니다:")} ${oversized.map((f) => f.name).join(", ")}`
        : ""
    );
    try {
      // 한 장씩 업로드해 하나가 실패해도 나머지는 그대로 반영되게 한다.
      for (let i = 0; i < uploadable.length; i++) {
        const file = uploadable[i];
        setUploadProgress({ name: file.name, index: i + 1, total: uploadable.length, pct: 0 });
        await uploadPartnerArchiveFile(
          projectId,
          file,
          appUser.uid,
          appUser.name,
          (ratio) => setUploadProgress({ name: file.name, index: i + 1, total: uploadable.length, pct: Math.round(ratio * 100) }),
          selectedTask ? { taskId: selectedTask.id, taskName: selectedTask.name } : undefined
        );
      }
      if (uploadable.length > 0) {
        // 알림 발송 실패는 업로드 자체의 실패가 아니다 — 여기서 던지면 업로드는 됐는데
        // "업로드에 실패했습니다"로 잘못 뜬다.
        const message = uploadable.length === 1
          ? `${appUser.name}님이 협력사 자료함에 "${uploadable[0].name}" 파일을 올렸습니다.`
          : `${appUser.name}님이 협력사 자료함에 파일 ${uploadable.length}개를 올렸습니다.`;
        notifyPartnerArchiveTargets(projectId, appUser.uid, appUser.name, appUser.role, message)
          .catch((e) => console.warn("협력사 자료함 업로드 알림 발송 실패", e));
      }
    } catch (err) {
      console.error("협력사 자료함 업로드 실패:", err);
      const detail = err instanceof Error ? err.message : String(err);
      setUploadError(`${zh(isZh, "업로드에 실패했습니다.")} (${detail})`);
    } finally {
      setUploading(false);
      setUploadProgress(null);
      e.target.value = "";
    }
  }

  async function handleSubmitComment(e: FormEvent) {
    e.preventDefault();
    if (!appUser || !text.trim()) return;
    setSubmitting(true);
    try {
      await addPartnerArchiveComment(
        projectId,
        appUser.uid,
        appUser.name,
        appUser.role,
        text.trim(),
        selectedTask ? { taskId: selectedTask.id, taskName: selectedTask.name } : undefined,
        appUser.role === "partner" ? appUser.partnerLang : undefined
      );
      setText("");
      notifyPartnerArchiveTargets(
        projectId,
        appUser.uid,
        appUser.name,
        appUser.role,
        `${appUser.name}님이 협력사 자료함에 코멘트를 남겼습니다.`
      ).catch((e) => console.warn("협력사 자료함 코멘트 알림 발송 실패", e));
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

      {tasks.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="shrink-0 text-xs font-medium text-[#86868b]">{zh(isZh, "관련 업무 (선택)")}</label>
          <select
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs text-[#1d1d1f] outline-none focus:border-[#86868b]"
          >
            <option value="">{zh(isZh, "미지정")}</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>{(isZh && t.nameZh) || t.name}</option>
            ))}
          </select>
        </div>
      )}

      <section>
        <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-[#86868b]">
          <Paperclip size={13} />
          {zh(isZh, "첨부 자료")}
        </p>
        <div className="space-y-2">
          {groupByName(files).map(({ latest, older }) => (
            <FileGroupRow
              key={latest.id}
              latest={latest}
              older={older}
              displayName={(f) => zhFileNames[f.name] ?? f.name}
              canDelete={canDelete}
              onDelete={(f) => deletePartnerArchiveFile(f.id, f.storagePath)}
              isZh={isZh}
            />
          ))}
          {files.length === 0 && <p className="text-sm text-[#86868b]">{zh(isZh, "첨부된 자료가 없습니다.")}</p>}
        </div>

        <label className="mt-2 inline-flex cursor-pointer items-center gap-1 rounded-full border border-[#d1d1d6] px-3 py-1.5 text-xs font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]">
          <Paperclip size={12} />
          {uploading ? zh(isZh, "업로드 중...") : zh(isZh, "자료 업로드")}
          <input type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
        {uploadProgress && (
          <div className="mt-2 max-w-xs">
            <p className="mb-1 truncate text-xs text-[#86868b]">
              {uploadProgress.total > 1 ? `(${uploadProgress.index}/${uploadProgress.total}) ` : ""}
              {uploadProgress.name} · {uploadProgress.pct}%
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#f0f0f0]">
              <div className="h-full rounded-full bg-[#1d1d1f] transition-all" style={{ width: `${uploadProgress.pct}%` }} />
            </div>
          </div>
        )}
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
              onUpdate={(t) => updatePartnerArchiveComment(c.id, t, appUser?.role === "partner" ? appUser.partnerLang : undefined)}
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
