"use client";

import { useState } from "react";
import { Search, ChevronUp, ChevronDown } from "lucide-react";
import { Task, TaskStatus, TASK_STATUS_LABEL, TASK_STATUS_ORDER } from "@/lib/types";
import { isOverdue, isDueSoon } from "@/lib/bottleneck";
import { useAuth } from "@/lib/auth-context";
import { updateTaskStatus, reorderTasks } from "@/lib/firestore/tasks";
import StatusBadge from "@/components/StatusBadge";
import { zh, usePartnerZh } from "@/lib/i18n";

interface Props {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
}

type ListItem = { kind: "task"; task: Task } | { kind: "group"; name: string; tasks: Task[] };

function groupItems(list: Task[]): ListItem[] {
  const items: ListItem[] = [];
  const seen = new Set<string>();
  for (const t of list) {
    const g = t.group?.trim();
    if (!g) {
      items.push({ kind: "task", task: t });
      continue;
    }
    if (seen.has(g)) continue;
    seen.add(g);
    items.push({ kind: "group", name: g, tasks: list.filter((x) => (x.group?.trim() || "") === g) });
  }
  return items;
}

export default function TaskList({ tasks, onSelectTask }: Props) {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin";
  const isZh = usePartnerZh();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const orderedAll = [...tasks].sort((a, b) => a.order - b.order);

  // dependsOn에 이미 삭제된 업무의 id가 남아있을 수 있어(정리되기 전까지), 실제 존재하는
  // 선행 업무만 세어서 "선행 N건" 뱃지에 반영한다.
  function activeDependsOnCount(task: Task): number {
    return task.dependsOn.filter((id) => tasks.some((t) => t.id === id)).length;
  }
  const canReorder = isAdmin && !search.trim() && statusFilter === "all";

  const sorted = orderedAll.filter((t) => {
    const matchSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.assigneeName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const items = groupItems(sorted);

  function toggleGroup(name: string) {
    setOpenGroups((s) => ({ ...s, [name]: !s[name] }));
  }

  async function handleStatusChange(task: Task, status: TaskStatus) {
    if (!appUser) return;
    await updateTaskStatus(task, status, appUser.name);
  }

  async function moveTask(index: number, dir: -1 | 1) {
    const swapIndex = index + dir;
    if (swapIndex < 0 || swapIndex >= orderedAll.length) return;
    const next = [...orderedAll];
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    await reorderTasks(next.map((t) => t.id));
  }

  function renderMobileCard(task: Task, indented?: boolean) {
    const overdue = isOverdue(task);
    const dueSoon = isDueSoon(task);
    const idx = orderedAll.findIndex((t) => t.id === task.id);
    const card = (
      <div
        onClick={() => onSelectTask(task)}
        className="rounded-2xl border border-[#e5e5e5] bg-white p-4 active:bg-[#f5f5f7]"
      >
        <div className="flex items-start justify-between gap-2">
          {canReorder && (
            <div className="flex shrink-0 flex-col" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => moveTask(idx, -1)} disabled={idx === 0} className="rounded p-0.5 text-[#86868b] hover:bg-[#f5f5f7] disabled:opacity-20"><ChevronUp size={14} /></button>
              <button onClick={() => moveTask(idx, 1)} disabled={idx === orderedAll.length - 1} className="rounded p-0.5 text-[#86868b] hover:bg-[#f5f5f7] disabled:opacity-20"><ChevronDown size={14} /></button>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="flex items-center gap-1.5 font-medium text-[#1d1d1f] truncate">
              {task.needsDecision && (
                <span className="shrink-0 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600">{zh(isZh, "확인필요")}</span>
              )}
              <span className="truncate">{task.name}</span>
            </p>
            {activeDependsOnCount(task) > 0 && (
              <p className="text-xs text-[#86868b] mt-0.5">{zh(isZh, "선행")} {activeDependsOnCount(task)}{zh(isZh, "건")}</p>
            )}
          </div>
          {isAdmin ? (
            <select
              value={task.status}
              onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus)}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 appearance-none rounded-lg border border-[#e5e5e5] bg-white bg-[length:12px] bg-[right_0.5rem_center] bg-no-repeat py-1 pl-2 pr-6 text-xs text-[#1d1d1f]"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")" }}
            >
              {TASK_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {zh(isZh, TASK_STATUS_LABEL[s])}
                </option>
              ))}
            </select>
          ) : (
            <span className="shrink-0"><StatusBadge status={task.status} /></span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs text-[#86868b]">
          {task.assigneeName && <span>{task.assigneeName}</span>}
          <span
            className={
              overdue ? "font-semibold text-red-500"
              : dueSoon ? "font-medium text-amber-500"
              : ""
            }
          >
            ~{task.dueDate}{overdue ? ` (${zh(isZh, "지연")})` : dueSoon ? ` (${zh(isZh, "임박")})` : ""}
          </span>
          <span className="ml-auto font-medium text-[#1d1d1f]">{task.progress}%</span>
        </div>

        {/* 진행률 바 */}
        <div className="mt-2 h-1.5 w-full rounded-full bg-[#f5f5f7]">
          <div
            className="h-1.5 rounded-full bg-[#1d1d1f] transition-all"
            style={{ width: `${task.progress}%` }}
          />
        </div>
      </div>
    );

    if (!indented) return <div key={task.id}>{card}</div>;
    return (
      <div key={task.id} className="flex gap-3">
        <div className="w-px shrink-0 self-stretch rounded-full bg-[#d1d1d6]" />
        <div className="min-w-0 flex-1">{card}</div>
      </div>
    );
  }

  function renderDesktopRow(task: Task, indented?: boolean) {
    const overdue = isOverdue(task);
    const dueSoon = isDueSoon(task);
    const idx = orderedAll.findIndex((t) => t.id === task.id);
    return (
      <tr
        key={task.id}
        className="cursor-pointer border-t border-[#f5f5f7] hover:bg-[#f5f5f7] transition"
      >
        {canReorder && (
          <td className="px-2 py-3">
            <div className="flex flex-col">
              <button onClick={() => moveTask(idx, -1)} disabled={idx === 0} className="rounded p-0.5 text-[#86868b] hover:bg-[#f5f5f7] disabled:opacity-20"><ChevronUp size={13} /></button>
              <button onClick={() => moveTask(idx, 1)} disabled={idx === orderedAll.length - 1} className="rounded p-0.5 text-[#86868b] hover:bg-[#f5f5f7] disabled:opacity-20"><ChevronDown size={13} /></button>
            </div>
          </td>
        )}
        <td className={`px-4 py-3 font-medium text-[#1d1d1f] ${indented ? "pl-8" : ""}`} onClick={() => onSelectTask(task)}>
          {task.needsDecision && (
            <span className="mr-1.5 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600">{zh(isZh, "확인필요")}</span>
          )}
          {task.name}
          {activeDependsOnCount(task) > 0 && (
            <span className="ml-2 text-xs text-[#86868b]">{zh(isZh, "선행")} {activeDependsOnCount(task)}{zh(isZh, "건")}</span>
          )}
        </td>
        <td className="px-4 py-3 text-[#86868b]" onClick={() => onSelectTask(task)}>
          {task.assigneeName || <span className="text-[#d1d1d6]">{zh(isZh, "미지정")}</span>}
        </td>
        <td className="px-4 py-3 text-[#86868b]" onClick={() => onSelectTask(task)}>
          {task.startDate}
        </td>
        <td
          className={`px-4 py-3 ${overdue ? "font-semibold text-red-500" : dueSoon ? "font-medium text-amber-500" : "text-[#86868b]"}`}
          onClick={() => onSelectTask(task)}
        >
          {task.dueDate}
          {overdue && ` (${zh(isZh, "지연")})`}
          {!overdue && dueSoon && ` (${zh(isZh, "임박")})`}
        </td>
        <td className="px-4 py-3 text-[#86868b]" onClick={() => onSelectTask(task)}>
          {task.progress}%
        </td>
        <td className="px-4 py-3">
          {isAdmin ? (
            <select
              value={task.status}
              onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus)}
              onClick={(e) => e.stopPropagation()}
              className="appearance-none rounded-lg border border-[#e5e5e5] bg-white bg-[length:12px] bg-[right_0.5rem_center] bg-no-repeat py-1 pl-2 pr-6 text-xs text-[#1d1d1f]"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")" }}
            >
              {TASK_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {zh(isZh, TASK_STATUS_LABEL[s])}
                </option>
              ))}
            </select>
          ) : (
            <StatusBadge status={task.status} />
          )}
        </td>
      </tr>
    );
  }

  return (
    <div className="space-y-3">
      {/* 검색 / 필터 */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-40">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868b]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={zh(isZh, "업무명 또는 담당자 검색")}
            className="w-full rounded-xl border border-[#e5e5e5] bg-white py-2 pl-8 pr-3 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {(["all", ...TASK_STATUS_ORDER] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === s
                  ? "bg-[#1d1d1f] text-white"
                  : "border border-[#e5e5e5] bg-white text-[#86868b] hover:border-[#86868b]"
              }`}
            >
              {s === "all" ? zh(isZh, "전체") : zh(isZh, TASK_STATUS_LABEL[s])}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#d1d1d6] bg-white p-10 text-center text-sm text-[#86868b]">
          {search || statusFilter !== "all" ? zh(isZh, "검색 결과가 없습니다.") : zh(isZh, "등록된 업무가 없습니다.")}
        </div>
      ) : (
        <>
          {/* 모바일: 카드 리스트 */}
          <div className="space-y-2 sm:hidden">
            {items.map((item) => {
              if (item.kind === "task") return renderMobileCard(item.task);
              const isOpen = !!openGroups[item.name];
              return (
                <div key={`group:${item.name}`} className="space-y-2">
                  <button
                    onClick={() => toggleGroup(item.name)}
                    className="flex w-full items-center justify-between rounded-2xl bg-[#1d1d1f] px-4 py-3 text-left"
                  >
                    <span className="font-medium text-white">
                      {item.name} <span className="text-xs font-normal text-white/60">({item.tasks.length}{zh(isZh, "건")})</span>
                    </span>
                    <ChevronDown size={14} className={`shrink-0 text-white/70 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && item.tasks.map((t) => renderMobileCard(t, true))}
                </div>
              );
            })}
          </div>

          {/* 데스크탑: 테이블 */}
          <div className="hidden sm:block overflow-hidden rounded-3xl border border-[#e5e5e5] bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[#ececef] text-left text-sm font-medium text-[#86868b]">
                <tr>
                  {canReorder && <th className="w-8 px-2 py-3" />}
                  <th className="px-4 py-3">{zh(isZh, "업무명")}</th>
                  <th className="px-4 py-3">{zh(isZh, "담당자")}</th>
                  <th className="px-4 py-3">{zh(isZh, "시작일")}</th>
                  <th className="px-4 py-3">{zh(isZh, "마감일")}</th>
                  <th className="px-4 py-3">{zh(isZh, "진행률")}</th>
                  <th className="px-4 py-3">{zh(isZh, "상태")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  if (item.kind === "task") return renderDesktopRow(item.task);
                  const isOpen = !!openGroups[item.name];
                  return (
                    <>
                      <tr key={`group:${item.name}`} className="cursor-pointer bg-[#1d1d1f] transition hover:bg-black" onClick={() => toggleGroup(item.name)}>
                        <td colSpan={canReorder ? 7 : 6} className="px-4 py-3 font-medium text-white">
                          <span className="flex items-center gap-2">
                            <ChevronDown size={14} className={`shrink-0 text-white/70 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                            {item.name} <span className="text-xs font-normal text-white/60">({item.tasks.length}{zh(isZh, "건")})</span>
                          </span>
                        </td>
                      </tr>
                      {isOpen && item.tasks.map((t) => renderDesktopRow(t, true))}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
