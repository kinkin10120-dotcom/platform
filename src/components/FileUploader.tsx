"use client";

import { ChangeEvent, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Paperclip, Download, Trash2, Eye, EyeOff, Maximize2, X, History, ChevronDown, ChevronUp, Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenFiles, uploadTaskFile, deleteTaskFile } from "@/lib/firestore/files";
import { TaskFile } from "@/lib/types";

const COST_LABEL: Record<number, string> = { 1: "낮음", 2: "보통", 3: "높음" };

function CostBadges({ initial, unit }: { initial: number; unit: number }) {
  return (
    <span className="flex shrink-0 flex-wrap gap-1">
      <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-[#86868b]">초기투자 {COST_LABEL[initial] ?? "-"}</span>
      <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-[#86868b]">개당단가 {COST_LABEL[unit] ?? "-"}</span>
    </span>
  );
}

function AiAnalysisPanel({ f }: { f: TaskFile }) {
  const ai = f.aiAnalysis;
  if (!ai) return null;

  if (ai.status === "pending") {
    return (
      <div className="mt-1.5 flex items-center gap-1.5 rounded-2xl bg-[#f5f5f7] px-3 py-2 text-xs text-[#86868b]">
        <Loader2 size={12} className="animate-spin" /> AI 형상 분석 중...
      </div>
    );
  }
  if (ai.status === "error") {
    return (
      <div className="mt-1.5 rounded-2xl bg-[#f5f5f7] px-3 py-2 text-xs text-[#86868b]">AI 분석에 실패했습니다.</div>
    );
  }
  return (
    <div className="mt-1.5 space-y-2 rounded-2xl bg-[#f5f5f7] p-3 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-[#1d1d1f]">{ai.partName || "추정 부품"}</span>
        {ai.complexity && <span className="rounded-full bg-white px-2 py-0.5 text-[#86868b]">복잡도 {ai.complexity}</span>}
        {ai.material && <span className="rounded-full bg-white px-2 py-0.5 text-[#86868b]">{ai.material}</span>}
      </div>
      {ai.recommendedMethods && ai.recommendedMethods.length > 0 && (
        <div className="space-y-1.5">
          {ai.recommendedMethods.map((m, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1.5 rounded-xl bg-white px-2.5 py-1.5">
              <span className="text-[#86868b]">{i === 0 ? "1순위" : "2순위"}</span>
              <span className="font-medium text-[#1d1d1f]">{m.method}</span>
              <CostBadges initial={m.initialCostLevel} unit={m.unitCostLevel} />
            </div>
          ))}
        </div>
      )}
      {ai.summary && <p className="text-[#86868b]">{ai.summary}</p>}
      <p className="text-[10px] text-[#d1d1d6]">* AI 추정 결과로 참고용입니다.</p>
    </div>
  );
}

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

function groupByName(files: TaskFile[]) {
  const groups = new Map<string, TaskFile[]>();
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

function FileRow({ f, canDelete, onDelete, badge }: { f: TaskFile; canDelete: boolean; onDelete: () => void; badge?: React.ReactNode }) {
  const [preview, setPreview] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const isImage = f.contentType.startsWith("image/");
  const isPdf = f.contentType === "application/pdf";
  const isStp = isStep(f);
  const hasPreview = isImage || isPdf || isStp;

  return (
    <>
      {expanded && <ExpandModal f={f} onClose={() => setExpanded(false)} />}
      <div className="rounded-2xl border border-[#f0f0f0] overflow-hidden">
        {preview && isImage && (
          <a href={f.url} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt={f.name} className="max-h-64 w-full object-contain bg-[#f5f5f7]" />
          </a>
        )}
        {preview && isPdf && (
          <iframe src={f.url} className="h-96 w-full bg-[#f5f5f7]" title={f.name} />
        )}
        {preview && isStp && (
          <StepViewer url={f.url} />
        )}
        <div className="flex items-center justify-between px-3 py-2 text-sm">
          <div className="flex items-center gap-2 truncate">
            <Paperclip size={14} className="shrink-0 text-[#86868b]" />
            <span className="truncate text-[#1d1d1f]">{f.name}</span>
            <span className="shrink-0 text-xs text-[#86868b]">{formatSize(f.size)}</span>
            {badge}
            {f.aiAnalysis && (
              <button
                onClick={() => setShowAi((v) => !v)}
                className="ml-1 flex shrink-0 items-center gap-1 rounded-full bg-[#f5f5f7] px-2 py-0.5 text-xs text-[#1d1d1f] hover:bg-[#e5e5e5]"
              >
                {f.aiAnalysis.status === "pending" ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                AI 분석
              </button>
            )}
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
            <a href={f.url} target="_blank" rel="noreferrer" className="text-[#86868b] hover:text-[#1d1d1f]">
              <Download size={14} />
            </a>
            {canDelete && (
              <button onClick={onDelete} className="text-[#86868b] hover:text-red-500">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
        {showAi && (
          <div className="px-3 pb-3">
            <AiAnalysisPanel f={f} />
          </div>
        )}
      </div>
    </>
  );
}

function FileGroupRow({
  latest,
  older,
  canDelete,
  onDelete,
}: {
  latest: TaskFile;
  older: TaskFile[];
  canDelete: (f: TaskFile) => boolean;
  onDelete: (f: TaskFile) => void;
}) {
  const [showOlder, setShowOlder] = useState(false);

  return (
    <div className="space-y-1.5">
      <FileRow
        f={latest}
        canDelete={canDelete(latest)}
        onDelete={() => onDelete(latest)}
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
              canDelete={canDelete(f)}
              onDelete={() => onDelete(f)}
              badge={
                <span className="ml-1 shrink-0 rounded-full bg-[#f5f5f7] px-2 py-0.5 text-xs text-[#86868b]">
                  v{f.version}
                </span>
              }
            />
          ))}
        </div>
      )}
    </div>
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

  const canDelete = (f: TaskFile) => appUser?.role === "admin" || appUser?.uid === f.uploadedBy;

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {groupByName(files).map(({ latest, older }) => (
          <FileGroupRow
            key={latest.id}
            latest={latest}
            older={older}
            canDelete={canDelete}
            onDelete={(f) => deleteTaskFile(taskId, f.id, f.storagePath)}
          />
        ))}
        {files.length === 0 && <p className="text-sm text-[#86868b]">첨부된 자료가 없습니다.</p>}
      </div>

      <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[#d1d1d6] px-3 py-1.5 text-xs font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]">
        <Paperclip size={12} />
        {uploading ? "업로드 중..." : "자료 업로드"}
        <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
      </label>
    </div>
  );
}
