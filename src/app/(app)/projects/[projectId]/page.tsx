"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { GanttChartSquare, ListChecks, LayoutDashboard, Pencil, Paperclip, Download } from "lucide-react";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuth } from "@/lib/auth-context";
import { listenProject, updateProject } from "@/lib/firestore/projects";
import { listenClient } from "@/lib/firestore/clients";
import { listenTasksByProject } from "@/lib/firestore/tasks";
import { listenUsersByClient, listenAdmins } from "@/lib/firestore/users";
import { listenTemplates, applyTemplateToProject } from "@/lib/firestore/templates";
import { Project, Task, AppUser, WorkflowTemplate, ProjectType, PROJECT_TYPE_LABEL, ALL_PROJECT_TYPES, Client, TASK_STATUS_LABEL } from "@/lib/types";
import GanttChart from "@/components/GanttChart";
import TaskList from "@/components/TaskList";
import TaskCreateForm from "@/components/TaskCreateForm";
import TaskDetailDrawer from "@/components/TaskDetailDrawer";
import ProjectDashboard from "@/components/dashboard/ProjectDashboard";
import ProjectFilesTab from "@/components/ProjectFilesTab";

type Tab = "gantt" | "list" | "dashboard" | "files";

const DEFAULT_TAB_ORDER: Tab[] = ["gantt", "list", "dashboard", "files"];

const TAB_LABEL: Record<Tab, string> = {
  gantt: "프로젝트 일정",
  list: "업무 리스트",
  dashboard: "대시보드",
  files: "첨부 자료",
};

function getTabIcon(id: Tab) {
  if (id === "gantt") return <GanttChartSquare size={15} />;
  if (id === "list") return <ListChecks size={15} />;
  if (id === "dashboard") return <LayoutDashboard size={15} />;
  return <Paperclip size={15} />;
}

export default function ProjectWorkspacePage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin";

  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [client, setClient] = useState<Client | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assigneeOptions, setAssigneeOptions] = useState<AppUser[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [tab, setTab] = useState<Tab>("gantt");
  const [tabOrder, setTabOrder] = useState<Tab[]>(DEFAULT_TAB_ORDER);
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("project-tab-order");
      if (saved) {
        const parsed = JSON.parse(saved) as Tab[];
        if (parsed.length === DEFAULT_TAB_ORDER.length && DEFAULT_TAB_ORDER.every((t) => parsed.includes(t))) {
          setTabOrder(parsed);
        }
      }
    } catch {}
  }, []);

  const tabSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  function handleTabReorder(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setTabOrder((prev) => {
      const oldIdx = prev.indexOf(active.id as Tab);
      const newIdx = prev.indexOf(over.id as Tab);
      const next = arrayMove(prev, oldIdx, newIdx);
      localStorage.setItem("project-tab-order", JSON.stringify(next));
      return next;
    });
  }
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "", startDate: "", endDate: "", status: "", projectType: [] as ProjectType[] });
  const [saving, setSaving] = useState(false);

  useEffect(() => listenProject(projectId, setProject), [projectId]);
  useEffect(() => listenTasksByProject(projectId, setTasks), [projectId]);
  useEffect(() => {
    if (isAdmin) {
      const unsub = listenTemplates(setTemplates);
      return () => unsub();
    }
  }, [isAdmin]);

  const projectClientId = project?.clientId;

  useEffect(() => {
    if (!projectClientId) return;
    return listenClient(projectClientId, setClient);
  }, [projectClientId]);

  useEffect(() => {
    if (!projectClientId) return;
    const admins: AppUser[] = [];
    const clientUsers: AppUser[] = [];
    const unsub1 = listenAdmins((u) => {
      admins.splice(0, admins.length, ...u);
      setAssigneeOptions([...admins, ...clientUsers]);
    });
    const unsub2 = listenUsersByClient(projectClientId, (u) => {
      clientUsers.splice(0, clientUsers.length, ...u);
      setAssigneeOptions([...admins, ...clientUsers]);
    });
    return () => {
      unsub1();
      unsub2();
    };
  }, [projectClientId]);

  // 선택된 업무가 실시간 업데이트를 반영하도록 최신 tasks에서 다시 찾아준다.
  const liveSelectedTask = useMemo(
    () => (selectedTask ? tasks.find((t) => t.id === selectedTask.id) ?? null : null),
    [selectedTask, tasks]
  );

  function openEdit() {
    if (!project) return;
    setEditForm({ name: project.name, description: project.description ?? "", startDate: project.startDate, endDate: project.endDate, status: project.status, projectType: project.projectType ?? [] });
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!project) return;
    setSaving(true);
    try {
      await updateProject(project.id, { name: editForm.name, description: editForm.description, startDate: editForm.startDate, endDate: editForm.endDate, status: editForm.status as any, projectType: editForm.projectType.length > 0 ? editForm.projectType : undefined });
      setEditOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleExportExcel() {
    const { utils, writeFile } = await import("xlsx");
    const rows = tasks
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((t) => ({
        업무명: t.name,
        담당자: t.assigneeName ?? "미지정",
        시작일: t.startDate,
        마감일: t.dueDate,
        상태: TASK_STATUS_LABEL[t.status],
        "진행률(%)": t.progress,
        설명: t.description ?? "",
      }));
    const ws = utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 40 }];
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "업무일정");
    writeFile(wb, `${project?.name ?? "프로젝트"}_업무일정.xlsx`);
  }

  async function handleApplyTemplate(templateId: string) {
    if (!project || !templateId) return;
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    setApplyingTemplate(true);
    try {
      await applyTemplateToProject(template, project.id, project.clientId, project.startDate);
    } finally {
      setApplyingTemplate(false);
    }
  }

  if (project === undefined) {
    return <p className="text-sm text-gray-400">불러오는 중...</p>;
  }
  if (project === null) {
    return <p className="text-sm text-gray-400">프로젝트를 찾을 수 없습니다.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-start gap-4">
          {/* 클라이언트 로고 */}
          {client?.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={client.logoUrl}
              alt={`${client.name} 로고`}
              className="h-16 w-16 shrink-0 rounded-2xl border border-[#e5e5e5] bg-white object-contain p-1.5"
            />
          )}
          <div>
            {client && (
              <p className="mb-0.5 text-xs font-medium text-[#86868b]">{client.name}</p>
            )}
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-[#1d1d1f]">{project.name}</h1>
              {isAdmin && (
                <button onClick={openEdit} className="text-[#d1d1d6] hover:text-[#86868b]">
                  <Pencil size={15} />
                </button>
              )}
            </div>
            {project.description && <p className="mt-0.5 text-sm text-[#86868b]">{project.description}</p>}
            {project.projectType && project.projectType.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {project.projectType.map((t) => (
                  <span key={t} className="rounded-full bg-[#f5f5f7] px-2.5 py-0.5 text-xs font-medium text-[#1d1d1f]">
                    {PROJECT_TYPE_LABEL[t]}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-[#86868b]">
              {project.startDate} ~ {project.endDate}
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            {templates.length > 0 && (
              <select
                defaultValue=""
                disabled={applyingTemplate}
                onChange={(e) => {
                  if (e.target.value) handleApplyTemplate(e.target.value);
                  e.target.value = "";
                }}
                className="rounded-xl border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1f] outline-none"
              >
                <option value="" disabled>
                  {applyingTemplate ? "적용 중..." : "템플릿으로 업무 일괄 생성"}
                </option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            <TaskCreateForm
              projectId={project.id}
              clientId={project.clientId}
              existingTasks={tasks}
              assigneeOptions={assigneeOptions}
            />
          </div>
        )}
      </div>

      {/* 탭 */}
      <div className="flex items-center justify-between border-b border-[#e5e5e5]">
        <DndContext sensors={tabSensors} collisionDetection={closestCenter} onDragEnd={handleTabReorder}>
          <SortableContext items={tabOrder} strategy={horizontalListSortingStrategy}>
            <div className="flex gap-0.5 overflow-x-auto">
              {tabOrder.map((id) => (
                <SortableTabButton
                  key={id}
                  id={id}
                  active={tab === id}
                  onClick={() => setTab(id)}
                  icon={getTabIcon(id)}
                  label={TAB_LABEL[id]}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <button
          onClick={handleExportExcel}
          disabled={tasks.length === 0}
          className="mb-1 ml-2 flex shrink-0 items-center gap-1.5 rounded-full border border-[#e5e5e5] px-3 py-1.5 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] disabled:opacity-40"
        >
          <Download size={13} />
          <span className="hidden sm:inline">엑셀 다운로드</span>
        </button>
      </div>

      {tab === "gantt" && <GanttChart tasks={tasks} onSelectTask={setSelectedTask} />}
      {tab === "list" && <TaskList tasks={tasks} onSelectTask={setSelectedTask} />}
      {tab === "dashboard" && <ProjectDashboard tasks={tasks} onSelectTask={setSelectedTask} />}
      {tab === "files" && <ProjectFilesTab tasks={tasks} />}

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-lg space-y-4">
            <h2 className="text-lg font-semibold text-[#1d1d1f]">프로젝트 수정</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#86868b] mb-1.5">프로젝트명</label>
                <input className="w-full rounded-xl border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#86868b] mb-1.5">설명</label>
                <textarea className="w-full rounded-xl border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b] resize-none" rows={3} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[#86868b] mb-1.5">시작일</label>
                  <input type="date" className="w-full rounded-xl border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1f] outline-none" value={editForm.startDate} onChange={e => setEditForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[#86868b] mb-1.5">종료일</label>
                  <input type="date" className="w-full rounded-xl border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1f] outline-none" value={editForm.endDate} onChange={e => setEditForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#86868b] mb-1.5">프로젝트 유형</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_PROJECT_TYPES.map((t) => {
                    const selected = editForm.projectType.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setEditForm(f => ({
                          ...f,
                          projectType: selected
                            ? f.projectType.filter(x => x !== t)
                            : [...f.projectType, t]
                        }))}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          selected ? "border-[#1d1d1f] bg-[#1d1d1f] text-white" : "border-[#e5e5e5] text-[#86868b] hover:border-[#86868b]"
                        }`}
                      >
                        {PROJECT_TYPE_LABEL[t]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#86868b] mb-1.5">상태</label>
                <select className="w-full rounded-xl border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1f] outline-none" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="active">진행 중</option>
                  <option value="completed">완료</option>
                  <option value="on_hold">보류</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditOpen(false)} className="rounded-full border border-[#e5e5e5] px-4 py-2 text-sm text-[#86868b] transition hover:border-[#86868b]">취소</button>
              <button onClick={handleSaveEdit} disabled={saving} className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm text-white transition hover:bg-black disabled:opacity-50">
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {liveSelectedTask && (
        <TaskDetailDrawer
          task={liveSelectedTask}
          allTasks={tasks}
          assigneeOptions={assigneeOptions}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}

function SortableTabButton({
  id,
  active,
  onClick,
  icon,
  label,
}: {
  id: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? "grabbing" : "pointer",
  };
  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition whitespace-nowrap ${
        active ? "border-[#1d1d1f] text-[#1d1d1f]" : "border-transparent text-[#86868b] hover:text-[#1d1d1f]"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
