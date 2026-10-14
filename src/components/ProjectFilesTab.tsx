"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Paperclip, Download, Eye, EyeOff, Trash2, ChevronDown, ChevronRight, ChevronUp, History, Sparkles, Loader2 } from "lucide-react";
import { listenFiles, deleteTaskFile, setFileVisibleToClient } from "@/lib/firestore/files";
import { Task, TaskFile } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import StatusBadge from "@/components/StatusBadge";
import { zh, usePartnerZh, useZhAutoTranslate } from "@/lib/i18n";

const StepViewer = dynamic(() => import("@/components/StepViewer"), { ssr: false });

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function isStep(name: string) {
  const l = name.toLowerCase();
  return l.endsWith(".stp") || l.endsWith(".step");
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

const COST_LABEL: Record<number, string> = { 1: "낮음", 2: "보통", 3: "높음" };

function CostBadges({ initial, unit }: { initial: number; unit: number }) {
  const isZh = usePartnerZh();
  return (
    <span className="flex shrink-0 flex-wrap gap-1">
      <span className="rounded-full bg-[#f5f5f7] px-1.5 py-0.5 text-[10px] text-[#86868b]">
        {zh(isZh, "초기투자")} {COST_LABEL[initial] ? zh(isZh, COST_LABEL[initial]) : "-"}
      </span>
      <span className="rounded-full bg-[#f5f5f7] px-1.5 py-0.5 text-[10px] text-[#86868b]">
        {zh(isZh, "개당단가")} {COST_LABEL[unit] ? zh(isZh, COST_LABEL[unit]) : "-"}
      </span>
    </span>
  );
}

function AiAnalysisPanel({ f }: { f: TaskFile }) {
  const isZh = usePartnerZh();
  // AI가 생성한 요약·공법명·재질은 매번 내용이 달라지는 자유 텍스트라 고정 사전으로는
  // 못 돌린다 — 프로젝트명 등과 같은 기계 번역으로 처리한다.
  const ai = f.aiAnalysis;
  const zhTexts = useZhAutoTranslate(
    isZh,
    ai ? [ai.summary ?? "", ai.partName ?? "", ai.material ?? "", ...(ai.recommendedMethods ?? []).map((m) => m.method)] : []
  );
  const tr = (s: string) => zhTexts[s] ?? s;
  if (!ai) return null;

  if (ai.status === "pending") {
    return (
      <div className="mt-1.5 flex items-center gap-1.5 rounded-2xl bg-[#f5f5f7] px-3 py-2 text-xs text-[#86868b]">
        <Loader2 size={12} className="animate-spin" /> {zh(isZh, "AI 형상 분석 중...")}
      </div>
    );
  }
  if (ai.status === "error") {
    return <div className="mt-1.5 rounded-2xl bg-[#f5f5f7] px-3 py-2 text-xs text-[#86868b]">{zh(isZh, "AI 분석에 실패했습니다.")}</div>;
  }
  return (
    <div className="mt-1.5 space-y-2 rounded-2xl bg-[#f5f5f7] p-3 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-[#1d1d1f]">{ai.partName ? tr(ai.partName) : zh(isZh, "추정 부품")}</span>
        {ai.complexity && <span className="rounded-full bg-white px-2 py-0.5 text-[#86868b]">{zh(isZh, "복잡도")} {ai.complexity}</span>}
        {ai.material && <span className="rounded-full bg-white px-2 py-0.5 text-[#86868b]">{tr(ai.material)}</span>}
      </div>
      {ai.recommendedMethods && ai.recommendedMethods.length > 0 && (
        <div className="space-y-1.5">
          {ai.recommendedMethods.map((m, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1.5 rounded-xl bg-white px-2.5 py-1.5">
              <span className="text-[#86868b]">{i === 0 ? zh(isZh, "1순위") : zh(isZh, "2순위")}</span>
              <span className="font-medium text-[#1d1d1f]">{tr(m.method)}</span>
              <CostBadges initial={m.initialCostLevel} unit={m.unitCostLevel} />
            </div>
          ))}
        </div>
      )}
      {ai.summary && <p className="text-[#86868b]">{tr(ai.summary)}</p>}
      <p className="text-[10px] text-[#d1d1d6]">{zh(isZh, "* AI 추정 결과로 참고용입니다.")}</p>
    </div>
  );
}

function FileRow({
  f,
  canDelete,
  badge,
  hideAi,
  isAdmin,
}: {
  f: TaskFile;
  canDelete: boolean;
  badge?: React.ReactNode;
  hideAi: boolean;
  isAdmin: boolean;
}) {
  const isZh = usePartnerZh();
  const [open, setOpen] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const isImage = f.contentType.startsWith("image/");
  const isPdf = f.contentType === "application/pdf";
  const isStp = isStep(f.name);
  const hasPreview = isImage || isPdf || isStp;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#f0f0f0] bg-white">
      {open && isImage && (
        <a href={f.url} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={f.url} alt={f.name} className="max-h-64 w-full bg-[#f5f5f7] object-contain" />
        </a>
      )}
      {open && isPdf && (
        <iframe src={f.url} className="h-96 w-full bg-[#f5f5f7]" title={f.name} />
      )}
      {open && isStp && <StepViewer url={f.url} taskId={f.taskId} fileId={f.id} />}

      <div className="flex items-center justify-between px-3 py-2 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <Paperclip size={13} className="shrink-0 text-[#86868b]" />
          <span className="truncate text-[#1d1d1f]">{f.name}</span>
          <span className="shrink-0 text-xs text-[#86868b]">{formatSize(f.size)}</span>
          {badge}
          {!hideAi && f.aiAnalysis && (
            <button
              onClick={() => setShowAi((v) => !v)}
              className="ml-1 flex shrink-0 items-center gap-1 rounded-full bg-[#f5f5f7] px-2 py-0.5 text-xs text-[#1d1d1f] hover:bg-[#e5e5e5]"
            >
              {f.aiAnalysis.status === "pending" ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              {zh(isZh, "AI 분석")}
            </button>
          )}
          {isAdmin && f.visibleToClient === false && (
            <button
              onClick={() => setFileVisibleToClient(f.taskId, f.id, true)}
              title="협력사가 올린 자료입니다 — 눌러서 고객에게 공개"
              className="ml-1 flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
            >
              <EyeOff size={11} /> 고객 비공개
            </button>
          )}
        </div>
        <div className="ml-2 flex shrink-0 items-center gap-2">
          {hasPreview && (
            <button onClick={() => setOpen((v) => !v)} className="text-[#86868b] hover:text-[#1d1d1f]">
              {open ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}
          <a href={f.url} target="_blank" rel="noreferrer" className="text-[#86868b] hover:text-[#1d1d1f]">
            <Download size={14} />
          </a>
          {canDelete && (
            <button
              onClick={() => deleteTaskFile(f.taskId, f.id, f.storagePath)}
              className="text-[#86868b] hover:text-red-500"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      {!hideAi && showAi && (
        <div className="px-3 pb-3">
          <AiAnalysisPanel f={f} />
        </div>
      )}
    </div>
  );
}

function FileGroupRow({
  latest,
  older,
  canDelete,
  hideAi,
  isAdmin,
}: {
  latest: TaskFile;
  older: TaskFile[];
  canDelete: (f: TaskFile) => boolean;
  hideAi: boolean;
  isAdmin: boolean;
}) {
  const [showOlder, setShowOlder] = useState(false);

  return (
    <div className="space-y-1.5">
      <FileRow
        f={latest}
        canDelete={canDelete(latest)}
        hideAi={hideAi}
        isAdmin={isAdmin}
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
              hideAi={hideAi}
              isAdmin={isAdmin}
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

function TaskFileSection({ task, appUser, hideAi }: { task: Task; appUser: { uid: string; role: string } | null; hideAi: boolean }) {
  const isZh = usePartnerZh();
  const zhNames = useZhAutoTranslate(isZh, [task.name]);
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => listenFiles(task.id, (fs) => {
    // visibleToClient는 firestore.rules의 list에서 걸러줄 수 없어(hiddenFromPartner와 같은
    // 함정) 쿼리는 전체를 받아온 뒤 여기서 클라이언트 계정에 한해 필터링한다 — 협력사가 올린
    // 자료는 관리자가 승인(공개 전환)하기 전까지 고객에게 안 보여야 한다.
    setFiles(appUser?.role === "client" ? fs.filter((f) => f.visibleToClient !== false) : fs);
  }), [task.id, appUser?.role]);

  if (files.length === 0) return null;

  return (
    <div className="rounded-3xl bg-[#ececef] overflow-hidden">
      {/* 업무 헤더 */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-[#e2e2e5] transition"
      >
        {collapsed ? (
          <ChevronRight size={15} className="shrink-0 text-[#86868b]" />
        ) : (
          <ChevronDown size={15} className="shrink-0 text-[#86868b]" />
        )}
        <span className="font-medium text-[#1d1d1f] text-sm">{(isZh && task.nameZh) || zhNames[task.name] || task.name}</span>
        <StatusBadge status={task.status} />
        <span className="ml-auto text-xs text-[#86868b]">{files.length}{isZh ? "个" : "개"}</span>
      </button>

      {/* 파일 목록 */}
      {!collapsed && (
        <div className="space-y-1.5 border-t border-[#e5e5e5] bg-white p-3">
          {groupByName(files).map(({ latest, older }) => (
            <FileGroupRow
              key={latest.id}
              latest={latest}
              older={older}
              hideAi={hideAi}
              isAdmin={appUser?.role === "admin"}
              canDelete={(f) => appUser?.role === "admin" || appUser?.uid === f.uploadedBy}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProjectFilesTab({ tasks }: { tasks: Task[] }) {
  const { appUser } = useAuth();
  // AI 형상 분석은 원가 수준(초기투자/개당단가) 추정까지 함께 보여주는데, 협력사(외부
  // 제조사)에게 이걸 노출할 이유가 없어 아예 감춘다 — 요청받은 범위(일정·자료·코멘트)에도
  // 포함되지 않는다.
  const hideAi = appUser?.role === "partner";
  const isZh = usePartnerZh();

  // 파일이 있는 업무만 렌더(각 섹션 내부에서 판단)
  const orderedTasks = [...tasks].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-3">
      {orderedTasks.map((task) => (
        <TaskFileSection key={task.id} task={task} appUser={appUser} hideAi={hideAi} />
      ))}
      {orderedTasks.length === 0 && (
        <div className="rounded-3xl border border-dashed border-[#d1d1d6] bg-white p-10 text-center text-sm text-[#86868b]">
          {zh(isZh, "등록된 업무가 없습니다.")}
        </div>
      )}
    </div>
  );
}
