import { differenceInCalendarDays, parseISO } from "date-fns";
import { Task, TaskStatus, TASK_STATUS_ORDER } from "@/lib/types";

export interface StatusDwellStat {
  status: TaskStatus;
  avgDays: number;
  sampleCount: number;
}

/**
 * 각 상태(status)에 머문 평균 일수를 계산한다.
 * statusHistory의 연속된 두 항목 사이 시간차를 해당 상태의 체류 시간으로 본다.
 * 가장 평균 체류일이 긴 상태가 '병목 구간' 후보다.
 */
export function computeStatusDwellStats(tasks: Task[]): StatusDwellStat[] {
  const totals: Record<TaskStatus, { sum: number; count: number }> = {
    pending: { sum: 0, count: 0 },
    todo: { sum: 0, count: 0 },
    in_progress: { sum: 0, count: 0 },
    done: { sum: 0, count: 0 },
  };

  for (const task of tasks) {
    const history = task.statusHistory;
    for (let i = 0; i < history.length; i++) {
      const cur = history[i];
      const next = history[i + 1];
      const endTime = next ? next.enteredAt : Date.now();
      const days = (endTime - cur.enteredAt) / (1000 * 60 * 60 * 24);
      if (days >= 0) {
        totals[cur.status].sum += days;
        totals[cur.status].count += 1;
      }
    }
  }

  return TASK_STATUS_ORDER.map((status) => ({
    status,
    avgDays: totals[status].count ? totals[status].sum / totals[status].count : 0,
    sampleCount: totals[status].count,
  }));
}

export function findBottleneckStatus(stats: StatusDwellStat[]): StatusDwellStat | null {
  const candidates = stats.filter((s) => s.status !== "done" && s.sampleCount > 0);
  if (candidates.length === 0) return null;
  return candidates.reduce((max, s) => (s.avgDays > max.avgDays ? s : max), candidates[0]);
}

export function isOverdue(task: Task): boolean {
  if (task.status === "done") return false;
  return differenceInCalendarDays(new Date(), parseISO(task.dueDate)) > 0;
}

export function isDueSoon(task: Task, withinDays = 3): boolean {
  if (task.status === "done") return false;
  const diff = differenceInCalendarDays(parseISO(task.dueDate), new Date());
  return diff >= 0 && diff <= withinDays;
}

export function computeProjectProgress(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const sum = tasks.reduce((acc, t) => acc + (t.progress ?? 0), 0);
  return Math.round(sum / tasks.length);
}

export interface StatusCount {
  status: TaskStatus;
  count: number;
}

export function computeStatusDistribution(tasks: Task[]): StatusCount[] {
  return TASK_STATUS_ORDER.map((status) => ({
    status,
    count: tasks.filter((t) => t.status === status).length,
  }));
}
