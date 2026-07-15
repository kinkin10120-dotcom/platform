"use client";

import { FormEvent, useState } from "react";
import { Plus, X } from "lucide-react";
import { AppUser, Task } from "@/lib/types";
import { createTask } from "@/lib/firestore/tasks";

interface Props {
  projectId: string;
  clientId: string;
  existingTasks: Task[];
  assigneeOptions: AppUser[];
}

export default function TaskCreateForm({ projectId, clientId, existingTasks, assigneeOptions }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dependsOn, setDependsOn] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function toggleDependsOn(taskId: string) {
    setDependsOn((prev) => (prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]));
  }

  function reset() {
    setName("");
    setAssigneeId("");
    setStartDate("");
    setDueDate("");
    setDependsOn([]);
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
        className="inline-flex items-center gap-1 rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white transition hover:bg-black"
      >
        <Plus size={16} />
        업무 추가
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 rounded-2xl border border-[#e5e5e5] bg-white p-4">
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
            className="w-full rounded-xl border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1f] outline-none"
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
              className="w-full rounded-xl border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1f] outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#86868b]">마감일</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
              className="w-full rounded-xl border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1f] outline-none"
            />
          </div>
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
  );
}
