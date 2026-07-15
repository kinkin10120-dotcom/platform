"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { Task, TASK_STATUS_LABEL, TaskStatus } from "@/lib/types";
import {
  computeStatusDwellStats,
  findBottleneckStatus,
  computeProjectProgress,
  computeStatusDistribution,
  isOverdue,
  isDueSoon,
} from "@/lib/bottleneck";
import StatusBadge from "@/components/StatusBadge";

const STATUS_COLOR: Record<TaskStatus, string> = {
  pending: "#d1d5db",
  todo: "#94a3b8",
  in_progress: "#3b82f6",
  done: "#22c55e",
};

interface Props {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
}

export default function ProjectDashboard({ tasks, onSelectTask }: Props) {
  const progress = useMemo(() => computeProjectProgress(tasks), [tasks]);
  const distribution = useMemo(() => computeStatusDistribution(tasks), [tasks]);
  const dwellStats = useMemo(() => computeStatusDwellStats(tasks), [tasks]);
  const bottleneck = useMemo(() => findBottleneckStatus(dwellStats), [dwellStats]);
  const overdueTasks = useMemo(() => tasks.filter(isOverdue), [tasks]);
  const dueSoonTasks = useMemo(() => tasks.filter((t) => isDueSoon(t) && !isOverdue(t)), [tasks]);

  const dwellChartData = dwellStats
    .filter((s) => s.status !== "done")
    .map((s) => ({ name: TASK_STATUS_LABEL[s.status], avgDays: Math.round(s.avgDays * 10) / 10 }));

  const pieData = distribution.map((d) => ({ name: TASK_STATUS_LABEL[d.status], value: d.count, status: d.status }));

  return (
    <div className="space-y-6">
      {/* KPI 카드 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="전체 업무" value={`${tasks.length}건`} />
        <KpiCard label="평균 진행률" value={`${progress}%`} />
        <KpiCard label="지연 업무" value={`${overdueTasks.length}건`} tone={overdueTasks.length > 0 ? "danger" : "default"} />
        <KpiCard label="마감 임박" value={`${dueSoonTasks.length}건`} tone={dueSoonTasks.length > 0 ? "warning" : "default"} />
      </div>

      {/* 병목 구간 알림 */}
      {bottleneck && bottleneck.avgDays > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <span className="font-semibold">병목 구간 감지:</span> &quot;{TASK_STATUS_LABEL[bottleneck.status]}&quot; 상태에
          평균 <span className="font-semibold">{bottleneck.avgDays.toFixed(1)}일</span> 머무릅니다. 해당 단계 리소스를
          점검해보세요.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 상태별 평균 체류일 (병목 구간 분석) */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">상태별 평균 체류 기간 (병목 분석)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dwellChartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} unit="일" />
              <Tooltip formatter={(v: number) => [`${v}일`, "평균 체류"]} />
              <Bar dataKey="avgDays" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 상태 분포 */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">업무 상태 분포</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {pieData.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLOR[entry.status as TaskStatus]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
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
    tone === "danger" ? "text-red-500" : tone === "warning" ? "text-amber-500" : "text-gray-900";
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-400">{label}</p>
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
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">{title}</h3>
      {tasks.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li
              key={t.id}
              onClick={() => onSelectTask(t)}
              className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm hover:bg-gray-50"
            >
              <span className="truncate text-gray-700">{t.name}</span>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-gray-400">{t.dueDate}</span>
                <StatusBadge status={t.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
