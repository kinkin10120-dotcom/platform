"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Task, TaskStatus, TASK_STATUS_LABEL, TASK_STATUS_ORDER, AppUser } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { updateTaskFields, updateTaskStatus, assignTask } from "@/lib/firestore/tasks";
import { isOverdue, isDueSoon } from "@/lib/bottleneck";
import StatusBadge from "@/components/StatusBadge";
import CommentThread from "@/components/CommentThread";
import FileUploader from "@/components/FileUploader";

interface Props {
  task: Task;
  allTasks: Task[];
  assigneeOptions: AppUser[];
  onClose: () => void;
}

export default function TaskDetailDrawer({ task, allTasks, assigneeOptions, onClose }: Props) {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin";

  const [name, setName] = useState(task.name);
  const [description, setDescription] = useState(task.description ?? "");
  const [startDate, setStartDate] = useState(task.startDate);
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [progress, setProgress] = useState(task.progress);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(task.name);
    setDescription(task.description ?? "");
    setStartDate(task.startDate);
    setDueDate(task.dueDate);
    setProgress(task.progress);
  }, [task.id, task.name, task.description, task.startDate, task.dueDate, task.progress]);

  const dependsOnTasks = allTasks.filter((t) => task.dependsOn.includes(t.id));
  const overdue = isOverdue(task);
  const dueSoon = isDueSoon(task);

  async function handleSaveBasics() {
    setSaving(true);
    try {
      await updateTaskFields(task.id, { name, description, startDate, dueDate });
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(status: TaskStatus) {
    if (!appUser) return;
    await updateTaskStatus(task, status, appUser.name);
  }

  async function handleAssign(uid: string) {
    const person = assigneeOptions.find((u) => u.uid === uid);
    if (!person) return;
    await assignTask(task, person.uid, person.name);
  }

  return createPortal(
    <div className="fixed inset-0 z-30 flex justify-end bg-black/30" onClick={onClose}>
      <div className="scrollbar-thin h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-400">업무 상세</span>
          <button onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {isAdmin ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSaveBasics}
            className="mb-2 w-full rounded-md border border-transparent px-1 py-1 text-lg font-semibold text-gray-900 hover:border-gray-200 focus:border-gray-300 focus:outline-none"
          />
        ) : (
          <h2 className="mb-2 px-1 text-lg font-semibold text-gray-900">{task.name}</h2>
        )}

        <div className="mb-4 flex items-center gap-2">
          <StatusBadge status={task.status} />
          {overdue && <span className="text-xs font-semibold text-red-500">지연</span>}
          {!overdue && dueSoon && <span className="text-xs font-semibold text-amber-500">마감임박</span>}
        </div>

        {isAdmin ? (
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleSaveBasics}
            placeholder="업무 설명을 입력하세요"
            rows={3}
            className="mb-4 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-600 focus:border-brand-400 focus:outline-none"
          />
        ) : (
          task.description && <p className="mb-4 whitespace-pre-wrap text-sm text-gray-600">{task.description}</p>
        )}

        <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <label className="mb-1 block text-xs text-gray-400">시작일</label>
            {isAdmin ? (
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                onBlur={handleSaveBasics}
                className="w-full rounded-md border border-gray-200 px-2 py-1.5"
              />
            ) : (
              <p className="text-gray-700">{task.startDate}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">마감일</label>
            {isAdmin ? (
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                onBlur={handleSaveBasics}
                className="w-full rounded-md border border-gray-200 px-2 py-1.5"
              />
            ) : (
              <p className="text-gray-700">{task.dueDate}</p>
            )}
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs text-gray-400">담당자</label>
          {isAdmin ? (
            <select
              value={task.assigneeId || ""}
              onChange={(e) => e.target.value && handleAssign(e.target.value)}
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm"
            >
              <option value="">미지정</option>
              {assigneeOptions.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-gray-700">{task.assigneeName || "미지정"}</p>
          )}
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs text-gray-400">상태 변경</label>
          <select
            value={task.status}
            onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
            disabled={task.status === "pending"}
            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm"
          >
            {TASK_STATUS_ORDER.map((s) => (
              <option key={s} value={s} disabled={s === "pending"}>
                {TASK_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          {task.status === "pending" && (
            <p className="mt-1 text-xs text-gray-400">선행 업무가 모두 완료되면 자동으로 시작 가능 상태로 전환됩니다.</p>
          )}
        </div>

        <div className="mb-4">
          <label className="mb-2 flex items-center justify-between text-xs text-gray-400">
            <span>진행률</span>
            <span className="font-semibold text-gray-600">{progress}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={progress}
            disabled={task.status === "done"}
            onChange={(e) => setProgress(Number(e.target.value))}
            onMouseUp={() => updateTaskFields(task.id, { progress })}
            onTouchEnd={() => updateTaskFields(task.id, { progress })}
            className="w-full accent-gray-800"
          />
          <div className="mt-1 flex justify-between text-xs text-gray-300">
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
        </div>

        {dependsOnTasks.length > 0 && (
          <div className="mb-4">
            <label className="mb-1 block text-xs text-gray-400">선행 업무</label>
            <ul className="space-y-1">
              {dependsOnTasks.map((d) => (
                <li key={d.id} className="flex items-center gap-2 text-sm text-gray-600">
                  <StatusBadge status={d.status} />
                  {d.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        <hr className="my-4 border-gray-100" />

        <div className="mb-5">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">첨부 자료</h3>
          <FileUploader projectId={task.projectId} taskId={task.id} />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-700">코멘트</h3>
          <CommentThread taskId={task.id} task={task} projectUsers={assigneeOptions} />
        </div>

        {saving && <p className="mt-2 text-xs text-gray-300">저장 중...</p>}
      </div>
    </div>,
    document.body
  );
}
