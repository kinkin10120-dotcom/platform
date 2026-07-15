import { TaskStatus, TASK_STATUS_LABEL } from "@/lib/types";

const COLOR: Record<TaskStatus, string> = {
  pending: "bg-gray-100 text-gray-500",
  todo: "bg-slate-100 text-slate-600",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
};

export default function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${COLOR[status]}`}>
      {TASK_STATUS_LABEL[status]}
    </span>
  );
}
