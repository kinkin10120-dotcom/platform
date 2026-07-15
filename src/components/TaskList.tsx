"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Task, TaskStatus, TASK_STATUS_LABEL, TASK_STATUS_ORDER } from "@/lib/types";
import { isOverdue, isDueSoon } from "@/lib/bottleneck";
import { useAuth } from "@/lib/auth-context";
import { updateTaskStatus } from "@/lib/firestore/tasks";

interface Props {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
}

export default function TaskList({ tasks, onSelectTask }: Props) {
  const { appUser } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");

  const sorted = [...tasks]
    .sort((a, b) => a.order - b.order)
    .filter((t) => {
      const matchSearch =
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.assigneeName ?? "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      return matchSearch && matchStatus;
    });

  async function handleStatusChange(task: Task, status: TaskStatus) {
    if (!appUser) return;
    await updateTaskStatus(task, status, appUser.name);
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
            placeholder="업무명 또는 담당자 검색"
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
              {s === "all" ? "전체" : TASK_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#d1d1d6] bg-white p-10 text-center text-sm text-[#86868b]">
          {search || statusFilter !== "all" ? "검색 결과가 없습니다." : "등록된 업무가 없습니다."}
        </div>
      ) : (
        <>
          {/* 모바일: 카드 리스트 */}
          <div className="space-y-2 sm:hidden">
            {sorted.map((task) => {
              const overdue = isOverdue(task);
              const dueSoon = isDueSoon(task);
              return (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className="rounded-2xl border border-[#e5e5e5] bg-white p-4 active:bg-[#f5f5f7]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#1d1d1f] truncate">{task.name}</p>
                      {task.dependsOn.length > 0 && (
                        <p className="text-xs text-[#86868b] mt-0.5">선행 {task.dependsOn.length}건</p>
                      )}
                    </div>
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus)}
                      disabled={task.status === "pending"}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-lg border border-[#e5e5e5] bg-white px-2 py-1 text-xs text-[#1d1d1f] shrink-0"
                    >
                      {TASK_STATUS_ORDER.map((s) => (
                        <option key={s} value={s} disabled={s === "pending"}>
                          {TASK_STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
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
                      ~{task.dueDate}{overdue ? " (지연)" : dueSoon ? " (임박)" : ""}
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
            })}
          </div>

          {/* 데스크탑: 테이블 */}
          <div className="hidden sm:block overflow-hidden rounded-3xl border border-[#e5e5e5] bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[#f5f5f7] text-left text-xs text-[#86868b]">
                <tr>
                  <th className="px-4 py-3">업무명</th>
                  <th className="px-4 py-3">담당자</th>
                  <th className="px-4 py-3">시작일</th>
                  <th className="px-4 py-3">마감일</th>
                  <th className="px-4 py-3">진행률</th>
                  <th className="px-4 py-3">상태</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((task) => {
                  const overdue = isOverdue(task);
                  const dueSoon = isDueSoon(task);
                  return (
                    <tr
                      key={task.id}
                      className="cursor-pointer border-t border-[#f5f5f7] hover:bg-[#f5f5f7] transition"
                    >
                      <td className="px-4 py-3 font-medium text-[#1d1d1f]" onClick={() => onSelectTask(task)}>
                        {task.name}
                        {task.dependsOn.length > 0 && (
                          <span className="ml-2 text-xs text-[#86868b]">선행 {task.dependsOn.length}건</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#86868b]" onClick={() => onSelectTask(task)}>
                        {task.assigneeName || <span className="text-[#d1d1d6]">미지정</span>}
                      </td>
                      <td className="px-4 py-3 text-[#86868b]" onClick={() => onSelectTask(task)}>
                        {task.startDate}
                      </td>
                      <td
                        className={`px-4 py-3 ${overdue ? "font-semibold text-red-500" : dueSoon ? "font-medium text-amber-500" : "text-[#86868b]"}`}
                        onClick={() => onSelectTask(task)}
                      >
                        {task.dueDate}
                        {overdue && " (지연)"}
                        {!overdue && dueSoon && " (임박)"}
                      </td>
                      <td className="px-4 py-3 text-[#86868b]" onClick={() => onSelectTask(task)}>
                        {task.progress}%
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={task.status}
                          onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus)}
                          disabled={task.status === "pending"}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-lg border border-[#e5e5e5] bg-white px-2 py-1 text-xs text-[#1d1d1f]"
                        >
                          {TASK_STATUS_ORDER.map((s) => (
                            <option key={s} value={s} disabled={s === "pending"}>
                              {TASK_STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
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
