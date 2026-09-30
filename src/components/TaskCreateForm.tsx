"use client";

import { FormEvent, useState } from "react";
import { Plus, X } from "lucide-react";
import { AppUser, Task } from "@/lib/types";
import { createTask } from "@/lib/firestore/tasks";

interface Props {
  projectId: string;
  clientId?: string;
  existingTasks: Task[];
  assigneeOptions: AppUser[];
  compact?: boolean;
}

export default function TaskCreateForm({ projectId, clientId, existingTasks, assigneeOptions, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dependsOn, setDependsOn] = useState<string[]>([]);
  const [group, setGroup] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const existingGroups = Array.from(
    new Set(existingTasks.map((t) => t.group?.trim()).filter((g): g is string => !!g))
  );

  function toggleDependsOn(taskId: string) {
    setDependsOn((prev) => (prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]));
  }

  function reset() {
    setName("");
    setAssigneeId("");
    setStartDate("");
    setDueDate("");
    setDependsOn([]);
    setGroup("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name || !startDate || !dueDate) return;
    setSubmitting(true);
    setError("");
    const assignee = assigneeOptions.find((u) => u.uid === assigneeId);
    try {
      await createTask({
        projectId,
        clientId,
        name,
        assigneeId: assignee?.uid ?? "",
        assigneeName: assignee?.name ?? "",
        startDate,
        dueDate,
        dependsOn,
        order: Date.now(),
        group: group.trim() || undefined,
      });
      reset();
      setOpen(false);
    } catch (err: any) {
      console.error("업무 생성 실패:", err);
      setError(err?.message ?? "업무 추가에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="업무 추가"
        className={
          compact
            ? "inline-flex items-center gap-1 rounded-full border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs font-medium text-[#86868b] transition hover:border-[#86868b]"
            : "inline-flex items-center gap-1 rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white transition hover:bg-black"
        }
      >
        <Plus size={compact ? 13 : 16} />
        {compact ? null : "업무 추가"}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setOpen(false)}>
    <form
      onSubmit={handleSubmit}
      onClick={(e) => e.stopPropagation()}
      className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl border border-[#e5e5e5] bg-white p-5 shadow-xl sm:p-6"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#1d1d1f]">새 업무 추가</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-[#86868b] hover:text-[#1d1d1f]">
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs text-[#86868b]">업무명</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-xl border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#86868b]">담당자</label>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="w-full appearance-none rounded-xl border border-[#e5e5e5] bg-white bg-[length:14px] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-8 text-sm text-[#1d1d1f] outline-none"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")" }}
          >
            <option value="">미지정</option>
            {assigneeOptions.map((u) => (
              <option key={u.uid} value={u.uid}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs text-[#86868b]">시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="w-full appearance-none rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#1d1d1f] outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#86868b]">마감일</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
              className="w-full appearance-none rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#1d1d1f] outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-[#86868b]">그룹 (선택)</label>
          <input
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            list="task-group-options"
            placeholder="예: 생산, 물류"
            className="w-full rounded-xl border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
          />
          {existingGroups.length > 0 && (
            <datalist id="task-group-options">
              {existingGroups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          )}
        </div>

        {existingTasks.length > 0 && (
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-[#86868b]">선행 업무</label>
            <div className="scrollbar-thin flex max-h-28 flex-wrap gap-2 overflow-y-auto rounded-xl border border-[#e5e5e5] p-2">
              {existingTasks.map((t) => (
                <label key={t.id} className="flex items-center gap-1 rounded-full border border-[#e5e5e5] px-2 py-1 text-xs text-[#1d1d1f]">
                  <input type="checkbox" checked={dependsOn.includes(t.id)} onChange={() => toggleDependsOn(t.id)} />
                  {t.name}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
        >
          {submitting ? "추가 중..." : "업무 추가"}
        </button>
      </div>
    </form>
    </div>
  );
}
