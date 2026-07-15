"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Paperclip, Download, Eye, EyeOff, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { listenFiles, deleteTaskFile } from "@/lib/firestore/files";
import { Task, TaskFile } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import StatusBadge from "@/components/StatusBadge";

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

function FileRow({
  f,
  canDelete,
}: {
  f: TaskFile;
  canDelete: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isImage = f.contentType.startsWith("image/");
  const isPdf = f.contentType === "application/pdf";
  const isStp = isStep(f.name);
  const hasPreview = isImage || isPdf || isStp;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-100 bg-white">
      {open && isImage && (
        <a href={f.url} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={f.url} alt={f.name} className="max-h-64 w-full bg-gray-50 object-contain" />
        </a>
      )}
      {open && isPdf && (
        <iframe src={f.url} className="h-96 w-full bg-gray-50" title={f.name} />
      )}
      {open && isStp && <StepViewer url={f.url} />}

      <div className="flex items-center justify-between px-3 py-2 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <Paperclip size={13} className="shrink-0 text-gray-400" />
          <span className="truncate text-gray-700">{f.name}</span>
          <span className="shrink-0 text-xs text-gray-400">{formatSize(f.size)}</span>
        </div>
        <div className="ml-2 flex shrink-0 items-center gap-2">
          {hasPreview && (
            <button onClick={() => setOpen((v) => !v)} className="text-gray-400 hover:text-brand-600">
              {open ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}
          <a href={f.url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-brand-600">
            <Download size={14} />
          </a>
          {canDelete && (
            <button
              onClick={() => deleteTaskFile(f.taskId, f.id, f.storagePath)}
              className="text-gray-400 hover:text-red-500"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskFileSection({ task, appUser }: { task: Task; appUser: { uid: string; role: string } | null }) {
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => listenFiles(task.id, setFiles), [task.id]);

  if (files.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
      {/* 업무 헤더 */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-gray-100 transition"
      >
        {collapsed ? (
          <ChevronRight size={15} className="shrink-0 text-gray-400" />
        ) : (
          <ChevronDown size={15} className="shrink-0 text-gray-400" />
        )}
        <span className="font-medium text-gray-800 text-sm">{task.name}</span>
        <StatusBadge status={task.status} />
        <span className="ml-auto text-xs text-gray-400">{files.length}개</span>
      </button>

      {/* 파일 목록 */}
      {!collapsed && (
        <div className="space-y-1.5 border-t border-gray-200 bg-white p-3">
          {files.map((f) => (
            <FileRow
              key={f.id}
              f={f}
              canDelete={appUser?.role === "admin" || appUser?.uid === f.uploadedBy}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProjectFilesTab({ tasks }: { tasks: Task[] }) {
  const { appUser } = useAuth();

  // 파일이 있는 업무만 렌더(각 섹션 내부에서 판단)
  const orderedTasks = [...tasks].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-3">
      {orderedTasks.map((task) => (
        <TaskFileSection key={task.id} task={task} appUser={appUser} />
      ))}
      {orderedTasks.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
          등록된 업무가 없습니다.
        </div>
      )}
    </div>
  );
}
