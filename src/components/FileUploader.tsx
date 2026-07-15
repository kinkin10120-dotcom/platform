"use client";

import { ChangeEvent, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Paperclip, Download, Trash2, Eye, EyeOff, Maximize2, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenFiles, uploadTaskFile, deleteTaskFile } from "@/lib/firestore/files";
import { TaskFile } from "@/lib/types";

const StepViewer = dynamic(() => import("@/components/StepViewer"), { ssr: false });

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function isStep(f: TaskFile) {
  const lower = f.name.toLowerCase();
  return lower.endsWith(".stp") || lower.endsWith(".step");
}

function ExpandModal({ f, onClose }: { f: TaskFile; onClose: () => void }) {
  const isImage = f.contentType.startsWith("image/");
  const isPdf = f.contentType === "application/pdf";
  const isStp = isStep(f);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm" onClick={onClose}>
      <div className="flex items-center justify-between px-5 py-3" onClick={(e) => e.stopPropagation()}>
        <span className="text-sm font-medium text-white/80 truncate">{f.name}</span>
        <button onClick={onClose} className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-hidden p-4" onClick={(e) => e.stopPropagation()}>
        {isImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.url} alt={f.name} className="h-full w-full object-contain" />
        )}
        {isPdf && (
          <iframe src={f.url} className="h-full w-full rounded-xl bg-white" title={f.name} />
        )}
        {isStp && (
          <div className="h-full w-full rounded-xl overflow-hidden">
            <StepViewer url={f.url} height={window.innerHeight - 100} />
          </div>
        )}
      </div>
    </div>
  );
}

function FileRow({ f, canDelete, onDelete }: { f: TaskFile; canDelete: boolean; onDelete: () => void }) {
  const [preview, setPreview] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isImage = f.contentType.startsWith("image/");
  const isPdf = f.contentType === "application/pdf";
  const isStp = isStep(f);
  const hasPreview = isImage || isPdf || isStp;

  return (
    <>
      {expanded && <ExpandModal f={f} onClose={() => setExpanded(false)} />}
      <div className="rounded-lg border border-gray-100 overflow-hidden">
        {preview && isImage && (
          <a href={f.url} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt={f.name} className="max-h-64 w-full object-contain bg-gray-50" />
          </a>
        )}
        {preview && isPdf && (
          <iframe src={f.url} className="h-96 w-full bg-gray-50" title={f.name} />
        )}
        {preview && isStp && (
          <StepViewer url={f.url} />
        )}
        <div className="flex items-center justify-between px-3 py-2 text-sm">
          <div className="flex items-center gap-2 truncate">
            <Paperclip size={14} className="shrink-0 text-gray-400" />
            <span className="truncate text-gray-700">{f.name}</span>
            <span className="shrink-0 text-xs text-gray-400">{formatSize(f.size)}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {hasPreview && (
              <>
                <button onClick={() => setPreview((v) => !v)} className="text-gray-400 hover:text-brand-600">
                  {preview ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button onClick={() => setExpanded(true)} className="text-gray-400 hover:text-brand-600">
                  <Maximize2 size={14} />
                </button>
              </>
            )}
            <a href={f.url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-brand-600">
              <Download size={14} />
            </a>
            {canDelete && (
              <button onClick={onDelete} className="text-gray-400 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function FileUploader({ projectId, taskId }: { projectId: string; taskId: string }) {
  const { appUser } = useAuth();
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => listenFiles(taskId, setFiles), [taskId]);

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !appUser) return;
    setUploading(true);
    try {
      await uploadTaskFile(projectId, taskId, file, appUser.uid, appUser.name);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {files.map((f) => (
          <FileRow
            key={f.id}
            f={f}
            canDelete={appUser?.role === "admin" || appUser?.uid === f.uploadedBy}
            onDelete={() => deleteTaskFile(taskId, f.id, f.storagePath)}
          />
        ))}
        {files.length === 0 && <p className="text-sm text-gray-400">첨부된 자료가 없습니다.</p>}
      </div>

      <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
        <Paperclip size={12} />
        {uploading ? "업로드 중..." : "자료 업로드"}
        <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
      </label>
    </div>
  );
}
