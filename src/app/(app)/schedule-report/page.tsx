"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, TrendingUp, Trash2 } from "lucide-react";
import { differenceInCalendarDays } from "date-fns";
import { useAuth } from "@/lib/auth-context";
import { listenAllProjects } from "@/lib/firestore/projects";
import { listenAllTasks, deleteDateHistoryEntry } from "@/lib/firestore/tasks";
import { listenClients } from "@/lib/firestore/clients";
import { Project, Client, Task, DateChangeEntry } from "@/lib/types";
import { groupDateHistory } from "@/lib/groupDateHistory";

function formatDays(days: number): string {
  const abs = Math.abs(days);
  let label: string;
  if (abs >= 30) {
    const months = Math.floor(abs / 30);
    const rest = abs % 30;
    label = rest > 0 ? `${months}개월 ${rest}일` : `${months}개월`;
  } else if (abs >= 7) {
    const weeks = Math.floor(abs / 7);
    const rest = abs % 7;
    label = rest > 0 ? `${weeks}주 ${rest}일` : `${weeks}주`;
  } else {
    label = `${abs}일`;
  }
  return days < 0 ? `${label} 단축` : `${label} 지연`;
}

type HistoryItem = { task: Task; entry: Task["dateHistory"] extends (infer E)[] | undefined ? E : never; originalIndex: number };

function renderHistoryRow(
  { task: t, entry: h, originalIndex }: HistoryItem,
  key: string,
  onDelete: (task: Task, originalIndex: number) => void
) {
  const dueChanged = h.fromDueDate !== h.toDueDate;
  const startChanged = h.fromStartDate !== h.toStartDate;
  return (
    <div key={key} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition hover:bg-[#f5f5f7]">
      <Link href={`/projects/${t.projectId}?task=${t.id}`} className="min-w-0 flex-1">
        <p className="truncate font-medium text-[#1d1d1f]">{t.name}</p>
        <p className="truncate text-xs text-[#86868b]">
          {dueChanged && <>마감일 {h.fromDueDate} → <span className="font-medium text-[#1d1d1f]">{h.toDueDate}</span></>}
          {dueChanged && startChanged && " · "}
          {startChanged && <>시작일 {h.fromStartDate} → <span className="font-medium text-[#1d1d1f]">{h.toStartDate}</span></>}
        </p>
      </Link>
      {h.cascaded && (
        <span className="shrink-0 rounded-full bg-[#f5f5f7] px-2 py-0.5 text-[10px] font-medium text-[#86868b]">자동조정</span>
      )}
      <span className="shrink-0 text-xs text-[#86868b]">{new Date(h.changedAt).toLocaleDateString("ko-KR")}</span>
      <button
        onClick={() => onDelete(t, originalIndex)}
        className="shrink-0 rounded-lg p-1.5 text-[#c7c7cc] transition hover:bg-red-50 hover:text-red-500"
        title="이 이력 삭제"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export default function ScheduleReportPage() {
  const { appUser } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const isAdmin = appUser?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    const unsub1 = listenAllProjects((p) => { setProjects(p); setLoaded(true); });
    const unsub2 = listenAllTasks(setAllTasks);
    const unsub3 = listenClients(setClients);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [isAdmin]);

  if (appUser && !isAdmin) {
    return <p className="text-sm text-[#86868b]">접근 권한이 없습니다.</p>;
  }

  const clientName = (clientId?: string) => (clientId ? clients.find((c) => c.id === clientId)?.name ?? clientId : "미지정");

  async function handleDeleteEntry(task: Task, originalIndex: number) {
    if (!confirm("이 일정 변경 이력을 삭제하시겠습니까?\n삭제해도 업무의 현재 일정은 바뀌지 않고, 이력에서만 사라집니다.")) return;
    try {
      await deleteDateHistoryEntry(task, originalIndex);
    } catch (e) {
      alert(e instanceof Error ? e.message : "이력 삭제 중 오류가 발생했습니다.");
    }
  }

  const report = projects
    .map((project) => {
      const tasks = allTasks.filter((t) => t.projectId === project.id);
      const historyEntries = tasks
        .flatMap((t) => (t.dateHistory ?? []).map((h, idx) => ({ task: t, entry: h, originalIndex: idx })))
        .sort((a, b) => b.entry.changedAt - a.entry.changedAt);

      if (tasks.length === 0) {
        return { project, tasks, historyEntries, delayDays: 0, originalEnd: project.endDate, currentEnd: project.endDate };
      }

      const currentEnd = tasks.reduce((max, t) => (t.dueDate > max ? t.dueDate : max), tasks[0].dueDate);
      // 프로젝트 전체의 "원래" 마감일은, 각 업무별 최초 마감일(변경 이력이 있으면 dateHistory[0].fromDueDate,
      // 없으면 현재 마감일) 중 가장 늦은 것으로 재구성한다. 지금 제일 늦는 업무가 처음부터 그 업무였다는
      // 보장이 없으므로, 그 업무 하나의 이력만 보면 지연일수가 실제보다 부풀려질 수 있다.
      const originalEnd = tasks.reduce((max, t) => {
        const taskOriginal = t.dateHistory && t.dateHistory.length > 0 ? t.dateHistory[0].fromDueDate : t.dueDate;
        return taskOriginal > max ? taskOriginal : max;
      }, tasks[0].dateHistory && tasks[0].dateHistory.length > 0 ? tasks[0].dateHistory[0].fromDueDate : tasks[0].dueDate);
      const delayDays = differenceInCalendarDays(new Date(`${currentEnd}T00:00:00`), new Date(`${originalEnd}T00:00:00`));

      return { project, tasks, historyEntries, delayDays, originalEnd, currentEnd };
    })
    .sort((a, b) => b.delayDays - a.delayDays);

  if (!loaded) {
    return <p className="text-sm text-[#86868b]">불러오는 중...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-[#1d1d1f]">
          <span className="h-2 w-2 rounded-full bg-[#1d1d1f]" />
          일정 변경 리포트
        </h1>
        <p className="mt-1 pl-4 text-sm text-[#86868b]">
          업무 일정이 원래 계획 대비 얼마나 밀렸는지 프로젝트별로 종합해서 보여줍니다.
        </p>
      </div>

      <div className="space-y-3">
        {report.map(({ project, historyEntries, delayDays, originalEnd, currentEnd }) => {
          const isOpen = expanded === project.id;
          return (
            <div key={project.id} className="overflow-hidden rounded-3xl border border-black/5 bg-white">
              <button
                onClick={() => setExpanded(isOpen ? null : project.id)}
                className="flex w-full items-center gap-4 p-5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#1d1d1f]">{project.name}</p>
                  <p className="mt-0.5 truncate text-xs text-[#86868b]">{clientName(project.clientId)}</p>
                </div>
                <div className="hidden shrink-0 items-center gap-1.5 text-xs text-[#86868b] sm:flex">
                  {originalEnd !== currentEnd ? (
                    <>
                      원래 완료 예정 {originalEnd} → <span className="font-medium text-[#1d1d1f]">{currentEnd}</span>
                    </>
                  ) : (
                    <>완료 예정 {currentEnd}</>
                  )}
                </div>
                <span
                  className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                    delayDays > 0 ? "bg-red-50 text-red-500" : delayDays < 0 ? "bg-green-50 text-green-600" : "bg-[#f5f5f7] text-[#86868b]"
                  }`}
                >
                  {delayDays > 0 && <TrendingUp size={12} />}
                  {delayDays !== 0 ? formatDays(delayDays) : "변동 없음"}
                </span>
                {historyEntries.length > 0 && (isOpen ? <ChevronUp size={16} className="shrink-0 text-[#86868b]" /> : <ChevronDown size={16} className="shrink-0 text-[#86868b]" />)}
              </button>

              {isOpen && historyEntries.length > 0 && (
                <div className="space-y-1 border-t border-[#f0f0f0] p-3">
                  {groupDateHistory(historyEntries).map((group, gi) => {
                    if (group.length === 1) {
                      return renderHistoryRow(group[0], `${project.id}-${gi}`, handleDeleteEntry);
                    }
                    const groupKey = `${project.id}-${gi}`;
                    const groupOpen = expandedGroup === groupKey;
                    const cascadedCount = group.filter(({ entry }) => entry.cascaded).length;
                    const latest = group[0].entry;
                    return (
                      <div key={groupKey} className="rounded-xl">
                        <button
                          onClick={() => setExpandedGroup(groupOpen ? null : groupKey)}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-[#f5f5f7]"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-[#1d1d1f]">일정 변경 {group.length}건</p>
                            {cascadedCount > 0 && (
                              <p className="truncate text-xs text-[#86868b]">자동조정 {cascadedCount}건 포함</p>
                            )}
                          </div>
                          <span className="shrink-0 text-xs text-[#86868b]">{new Date(latest.changedAt).toLocaleDateString("ko-KR")}</span>
                          {groupOpen ? <ChevronUp size={16} className="shrink-0 text-[#86868b]" /> : <ChevronDown size={16} className="shrink-0 text-[#86868b]" />}
                        </button>
                        {groupOpen && (
                          <div className="ml-3 space-y-1 border-l border-[#f0f0f0] pl-2">
                            {group.map((item, i) => renderHistoryRow(item, `${groupKey}-${i}`, handleDeleteEntry))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {projects.length === 0 && (
        <div className="rounded-3xl border border-dashed border-[#d1d1d6] bg-white p-10 text-center text-sm text-[#86868b]">
          아직 등록된 프로젝트가 없습니다.
        </div>
      )}
    </div>
  );
}
