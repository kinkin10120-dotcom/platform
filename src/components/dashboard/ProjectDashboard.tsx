"use client";

import { useMemo } from "react";
import { Project, Task } from "@/lib/types";
import { computeProjectProgress, isOverdue, isDueSoon } from "@/lib/bottleneck";
import StatusBadge from "@/components/StatusBadge";

interface Props {
  project: Project;
  tasks: Task[];
  onSelectTask: (task: Task) => void;
}

export default function ProjectDashboard({ project, tasks, onSelectTask }: Props) {
  const progress = useMemo(() => computeProjectProgress(tasks), [tasks]);
  const overdueTasks = useMemo(() => tasks.filter(isOverdue), [tasks]);
  const dueSoonTasks = useMemo(() => tasks.filter((t) => isDueSoon(t) && !isOverdue(t)), [tasks]);

  // 프로젝트 전체 기간의 경과율이 아니라, 업무 하나하나가 "자기 일정 기준으로" 지금쯤
  // 얼마나 진행돼 있어야 하는지를 평균낸다. 아직 시작일도 안 된 후속 업무(정상적으로 0%인
  // 업무)까지 프로젝트 전체 경과율과 단순 비교하면, 순차 진행되는 프로젝트는 뒷 단계
  // 업무들 때문에 실제로는 일정대로인데도 "일정보다 느림"으로 잘못 나온다.
  const expectedProgress = useMemo(() => {
    if (tasks.length === 0) return 0;
    const now = Date.now();
    const sum = tasks.reduce((acc, t) => {
      const start = new Date(`${t.startDate}T00:00:00`).getTime();
      const due = new Date(`${t.dueDate}T00:00:00`).getTime();
      if (now <= start) return acc;
      if (now >= due || due <= start) return acc + 100;
      return acc + ((now - start) / (due - start)) * 100;
    }, 0);
    return Math.round(sum / tasks.length);
  }, [tasks]);

  return (
    <div className="space-y-6">
      {/* KPI 카드 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="전체 업무" value={`${tasks.length}건`} />
        <KpiCard label="평균 진행률" value={`${progress}%`} />
        <KpiCard label="지연 업무" value={`${overdueTasks.length}건`} tone={overdueTasks.length > 0 ? "danger" : "default"} />
        <KpiCard label="마감 임박" value={`${dueSoonTasks.length}건`} tone={dueSoonTasks.length > 0 ? "warning" : "default"} />
      </div>

      {/* 일정 대비 진행률 — 상태 배지는 퍼센트 격차가 아니라 실제 지연/임박 업무 유무로 판단한다.
          퍼센트는 참고용 보조 지표일 뿐, "문제없이 진행 중인지"의 기준은 마감을 실제로
          놓쳤는지 여부이기 때문이다. */}
      <div className="rounded-3xl bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[#1d1d1f]">일정 대비 진행률</h3>
          {overdueTasks.length > 0 && (
            <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">지연 업무 {overdueTasks.length}건</span>
          )}
          {overdueTasks.length === 0 && dueSoonTasks.length > 0 && (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-600">마감 임박</span>
          )}
          {overdueTasks.length === 0 && dueSoonTasks.length === 0 && (
            <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-600">일정 내</span>
          )}
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-[#86868b]">
              <span>예상 진행률 (업무별 일정 기준, 참고용)</span>
              <span className="font-semibold text-[#1d1d1f]">{expectedProgress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#f5f5f7]">
              <div className="h-full rounded-full bg-[#86868b]" style={{ width: `${expectedProgress}%` }} />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-[#86868b]">
              <span>실제 진행률</span>
              <span className="font-semibold text-[#1d1d1f]">{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#f5f5f7]">
              <div className="h-full rounded-full bg-[#1d1d1f]" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* 지연/임박 업무 리스트 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TaskAlertList title="지연된 업무" tasks={overdueTasks} onSelectTask={onSelectTask} emptyText="지연된 업무가 없습니다." />
        <TaskAlertList title="마감 임박 업무 (3일 이내)" tasks={dueSoonTasks} onSelectTask={onSelectTask} emptyText="마감 임박 업무가 없습니다." />
      </div>
    </div>
  );
}

function KpiCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "danger" | "warning" }) {
  const toneClass =
    tone === "danger" ? "text-red-500" : tone === "warning" ? "text-amber-500" : "text-[#1d1d1f]";
  return (
    <div className="rounded-3xl bg-white p-4">
      <p className="text-xs text-[#86868b]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function TaskAlertList({
  title,
  tasks,
  onSelectTask,
  emptyText,
}: {
  title: string;
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  emptyText: string;
}) {
  return (
    <div className="rounded-3xl bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-[#1d1d1f]">{title}</h3>
      {tasks.length === 0 ? (
        <p className="text-sm text-[#86868b]">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li
              key={t.id}
              onClick={() => onSelectTask(t)}
              className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm hover:bg-[#f5f5f7]"
            >
              <span className="truncate text-[#1d1d1f]">{t.name}</span>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-[#86868b]">{t.dueDate}</span>
                <StatusBadge status={t.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
