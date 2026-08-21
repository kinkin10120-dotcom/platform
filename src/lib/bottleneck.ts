import { differenceInCalendarDays, parseISO } from "date-fns";
import { Task, TaskStatus, TASK_STATUS_ORDER } from "@/lib/types";

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
