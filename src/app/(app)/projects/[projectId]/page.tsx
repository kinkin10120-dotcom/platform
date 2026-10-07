"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { GanttChartSquare, ListChecks, LayoutDashboard, Pencil, Paperclip, Download, CalendarDays, MessageSquare, ImageIcon, AlertCircle, Eye, EyeOff, Lock } from "lucide-react";
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
import { zh, usePartnerZh, useZhAutoTranslate } from "@/lib/i18n";
import { listenProject, updateProject } from "@/lib/firestore/projects";
import { listenClient, listenClients, uploadClientLogo } from "@/lib/firestore/clients";
import { listenTasksByProject } from "@/lib/firestore/tasks";
import { listenUsersByClient, listenAdmins, listenPartners } from "@/lib/firestore/users";
import { Project, Task, AppUser, ProjectType, PROJECT_TYPE_LABEL, ALL_PROJECT_TYPES, Client, TASK_STATUS_LABEL } from "@/lib/types";
import { isOverdue } from "@/lib/bottleneck";
import GanttChart from "@/components/GanttChart";
import TaskList from "@/components/TaskList";
import TaskCreateForm from "@/components/TaskCreateForm";
import TaskDetailDrawer from "@/components/TaskDetailDrawer";
import ProjectDashboard from "@/components/dashboard/ProjectDashboard";
import ProjectFilesTab from "@/components/ProjectFilesTab";
import ProjectCommentsTab from "@/components/ProjectCommentsTab";
import PartnerArchiveTab from "@/components/PartnerArchiveTab";
import AiDiagnosisPanel from "@/components/AiDiagnosisPanel";

type Tab = "gantt" | "list" | "dashboard" | "files" | "comments" | "partner";

const DEFAULT_TAB_ORDER: Tab[] = ["gantt", "list", "dashboard", "files", "comments", "partner"];

const TAB_LABEL: Record<Tab, string> = {
  gantt: "프로젝트 일정",
  list: "업무 리스트",
  dashboard: "대시보드",
  files: "첨부 자료",
  comments: "코멘트",
  partner: "협력사 자료함",
};

function getTabIcon(id: Tab) {
  if (id === "gantt") return <GanttChartSquare size={15} />;
  if (id === "list") return <ListChecks size={15} />;
  if (id === "dashboard") return <LayoutDashboard size={15} />;
  if (id === "files") return <Paperclip size={15} />;
  if (id === "partner") return <Lock size={15} />;
  return <MessageSquare size={15} />;
}

export default function ProjectWorkspacePage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const searchParams = useSearchParams();
  const router = useRouter();
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin";
  // 협력사(파트너) 계정 — 지정된 프로젝트의 일정·업무·첨부 자료·코멘트만 보고, 클라이언트
  // 정보·프로젝트 수정·업무 편집 등 관리자 전용 기능은 전부 isAdmin 분기로 이미 가려진다.
  const isPartner = appUser?.role === "partner";
  const isZh = usePartnerZh();

  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [client, setClient] = useState<Client | null>(null);
  // 고객사를 나중에 지정/변경할 수 있게 하는 수정 화면 드롭다운용 — 관리자만 필요하다.
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assigneeOptions, setAssigneeOptions] = useState<AppUser[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [tab, setTab] = useState<Tab>("gantt");
  const [tabOrder, setTabOrder] = useState<Tab[]>(DEFAULT_TAB_ORDER);
  // 프로젝트명·설명은 관리자가 직접 입력한 자유 텍스트라, nameZh/descriptionZh(저장 시
  // 미리 번역된 캐시)가 없는 기존 데이터에 한해 여기서 즉석 번역으로 대체한다. project가
  // 아직 로딩 전(undefined)이거나 없음(null)이어도 훅은 항상 같은 순서로 호출되어야 하므로
  // 조건 없이 여기서 호출한다.
  const zhProjectName = useZhAutoTranslate(isZh, project ? [project.name, project.description ?? ""] : []);

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
  const [editForm, setEditForm] = useState({ name: "", description: "", startDate: "", endDate: "", status: "", projectType: [] as ProjectType[], clientId: "" });
  const [saving, setSaving] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  useEffect(() => listenProject(projectId, setProject), [projectId]);
  useEffect(() => {
    if (!appUser) return;
    return listenTasksByProject(
      projectId,
      (t) => {
        setTasksError(null);
        // hiddenFromPartner는 firestore.rules의 list 규칙에서 걸러줄 수 없다(문서 하나라도
        // 조건을 통과 못 하면 쿼리 전체가 거부되는 함정 — clientVisible과 동일) — 그래서
        // 쿼리는 전체를 받아온 뒤 여기서 협력사 계정에 한해 숨김 업무를 걸러낸다.
        setTasks(isPartner ? t.filter((task) => !task.hiddenFromPartner) : t);
      },
      (e) => setTasksError(e.message),
      (isAdmin || isPartner) ? undefined : appUser.clientId
    );
  }, [projectId, appUser, isAdmin, isPartner]);

  // 검색 결과(코멘트·자료)에서 ?task=taskId 로 들어오면 해당 업무 상세를 바로 연다.
  useEffect(() => {
    const taskId = searchParams.get("task");
    if (!taskId || tasks.length === 0) return;
    const target = tasks.find((t) => t.id === taskId);
    if (target) {
      setSelectedTask(target);
      router.replace(`/projects/${projectId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, searchParams]);
  const projectClientId = project?.clientId;

  useEffect(() => {
    // 협력사 계정은 clients 컬렉션 접근 권한이 없다(firestore.rules) — 애초에 호출하지 않는다.
    if (!projectClientId || isPartner) return;
    return listenClient(projectClientId, setClient);
  }, [projectClientId, isPartner]);

  useEffect(() => {
    // 고객사 지정/변경 드롭다운용 — 관리자만 전체 고객 목록이 필요하다.
    if (!isAdmin) return;
    return listenClients(setAllClients);
  }, [isAdmin]);

  useEffect(() => {
    // 담당자 배정 UI는 관리자 전용 기능이라 협력사에게는 필요 없고, listenUsersByClient/
    // listenPartners는 협력사 계정으로 호출하면 권한 오류가 난다(협력사는 users 컬렉션에서
    // 본인 role이 admin인 문서만 조회 가능 — firestore.rules 참고).
    if (isPartner) return;
    const admins: AppUser[] = [];
    const clientUsers: AppUser[] = [];
    const projectPartners: AppUser[] = [];
    const unsub1 = listenAdmins((u) => {
      admins.splice(0, admins.length, ...u);
      setAssigneeOptions([...admins, ...clientUsers, ...projectPartners]);
    });
    // 고객사를 아직 못 정한 프로젝트도 있어(고객계정 추후 지정) clientId가 없으면 이 부분만 건너뛴다.
    const unsub2 = projectClientId
      ? listenUsersByClient(projectClientId, (u) => {
          clientUsers.splice(0, clientUsers.length, ...u);
          setAssigneeOptions([...admins, ...clientUsers, ...projectPartners]);
        })
      : undefined;
    // 이 프로젝트에 배정된 협력사 계정도 담당자로 고를 수 있게 한다 — users의 role=='partner'
    // 조회는 규칙상 관리자만 가능해서, 담당자 배정 UI 자체가 안 보이는 고객 세션에서는 아예
    // 호출하지 않는다(안 그러면 조용히 permission-denied만 나고 아무도 못 쓰는 리스너가 돈다).
    const unsub3 = isAdmin
      ? listenPartners((u) => {
          projectPartners.splice(0, projectPartners.length, ...u.filter((p) => p.projectIds?.includes(projectId)));
          setAssigneeOptions([...admins, ...clientUsers, ...projectPartners]);
        })
      : undefined;
    return () => {
      unsub1();
      unsub2?.();
      unsub3?.();
    };
  }, [projectClientId, projectId, isPartner, isAdmin]);

  // 선택된 업무가 실시간 업데이트를 반영하도록 최신 tasks에서 다시 찾아준다.
  const liveSelectedTask = useMemo(
    () => (selectedTask ? tasks.find((t) => t.id === selectedTask.id) ?? null : null),
    [selectedTask, tasks]
  );

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "done").length;
    const progress = total === 0 ? 0 : Math.round(tasks.reduce((sum, t) => sum + t.progress, 0) / total);
    const todayStr = new Date().toLocaleDateString("en-CA");
    const overdue = tasks.filter((t) => t.status !== "done" && t.dueDate < todayStr).length;
    return { total, done, progress, overdue };
  }, [tasks]);

  const decisionTasks = useMemo(() => tasks.filter((t) => t.needsDecision), [tasks]);
  // 협력사 자료함(partner) 탭은 관리자·협력사에게만 보인다 — 고객(클라이언트) 계정에겐
  // 탭 자체가 아예 렌더링되지 않는다("이런 게 있다"는 존재조차 몰라야 한다).
  const visibleTabOrder = useMemo(() => {
    let order = tabOrder;
    if (isPartner) order = order.filter((id) => id !== "dashboard");
    if (!isAdmin && !isPartner) order = order.filter((id) => id !== "partner");
    return order;
  }, [tabOrder, isPartner, isAdmin]);

  async function handleToggleClientVisible() {
    if (!project) return;
    await updateProject(project.id, { clientVisible: !(project.clientVisible ?? true) });
  }

  function openEdit() {
    if (!project) return;
    setEditForm({ name: project.name, description: project.description ?? "", startDate: project.startDate, endDate: project.endDate, status: project.status, projectType: project.projectType ?? [], clientId: project.clientId ?? "" });
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!project) return;
    setSaving(true);
    try {
      await updateProject(project.id, {
        name: editForm.name,
        description: editForm.description,
        startDate: editForm.startDate,
        endDate: editForm.endDate,
        status: editForm.status as any,
        projectType: editForm.projectType.length > 0 ? editForm.projectType : undefined,
        // Firestore는 undefined 필드값을 거부한다 — 선택 안 함(빈 값)일 땐 아예 키를 빼서
        // 기존 clientId를 그대로 둔다(비우는 기능은 없음, 지정만 가능).
        ...(editForm.clientId ? { clientId: editForm.clientId } : {}),
      });
      setEditOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleExportExcel() {
    const { utils, writeFile } = await import("xlsx");
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    const rows = tasks
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((t) => {
        const checklistTotal = t.checklist?.length ?? 0;
        const checklistDone = t.checklist?.filter((c) => c.done).length ?? 0;
        const checklistDetail = (t.checklist ?? [])
          .map((c) => `${c.done ? "☑" : "☐"} ${c.text}`)
          .join("\n");
        return {
          업무명: t.name,
          그룹: t.group ?? "",
          담당자: t.assigneeName ?? "미지정",
          시작일: t.startDate,
          마감일: t.dueDate,
          상태: TASK_STATUS_LABEL[t.status],
          "진행률(%)": t.progress,
          지연여부: isOverdue(t) ? "지연" : "",
          선행업무: t.dependsOn.map((id) => taskById.get(id)?.name).filter(Boolean).join(", "),
          체크리스트: checklistTotal > 0 ? `${checklistDone}/${checklistTotal}` : "",
          "체크리스트 항목": checklistDetail,
          설명: t.description ?? "",
        };
      });
    const ws = utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 24 }, { wch: 10 }, { wch: 36 }, { wch: 40 }];
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "업무일정");
    writeFile(wb, `${project?.name ?? "프로젝트"}_업무일정.xlsx`);
  }

  const [calendarUrl, setCalendarUrl] = useState<string | null>(null);
  const [calendarError, setCalendarError] = useState("");
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarCopied, setCalendarCopied] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  async function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !client) return;
    setUploadingLogo(true);
    try {
      await uploadClientLogo(client.id, file);
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  }

  async function handleOpenCalendarLink() {
    if (!project) return;
    setCalendarError("");
    setCalendarCopied(false);
    setCalendarLoading(true);
    try {
      let token = project.calendarToken;
      if (!token) {
        token = crypto.randomUUID();
        await updateProject(project.id, { calendarToken: token });
      }
      setCalendarUrl(`https://asia-northeast3-handyhand-a175a.cloudfunctions.net/projectCalendarFeed?projectId=${project.id}&token=${token}`);
    } catch (e) {
      setCalendarError(e instanceof Error ? e.message : "링크를 준비하지 못했습니다.");
    } finally {
      setCalendarLoading(false);
    }
  }

  async function handleCopyCalendarUrl() {
    if (!calendarUrl) return;
    try {
      await navigator.clipboard.writeText(calendarUrl);
      setCalendarCopied(true);
    } catch {
      setCalendarCopied(false);
    }
  }

  if (project === undefined) {
    return <p className="text-sm text-[#86868b]">불러오는 중...</p>;
  }
  if (project === null) {
    return <p className="text-sm text-[#86868b]">프로젝트를 찾을 수 없습니다.</p>;
  }

  // 협력사 계정은 clients 컬렉션을 못 읽어 client가 항상 null이다 — 대신 프로젝트 문서에
  // 미리 복사해둔 clientDisplayName/clientLogoUrl로 로고·표시명을 보여준다(고객 요청).
  // 실제 clients 문서(사업자등록번호 등 민감 정보 포함)에는 여전히 접근 경로가 없다.
  const displayClientName = client?.name ?? project.clientDisplayName;
  const displayClientLogoUrl = client?.logoUrl ?? project.clientLogoUrl;
  // 파트너는 로고가 실제로 있을 때만 박스를 보여준다 — 관리자처럼 빈 업로드 자리(placeholder)를
  // 보여줄 이유가 없다(파트너는 업로드 권한이 없어 눌러도 아무 일도 안 일어난다).
  const showClientBlock = !!client || (isPartner && !!displayClientLogoUrl);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-6">
          <div className="flex min-w-0 flex-1 items-stretch gap-4">
            {/* 클라이언트 로고 */}
            {showClientBlock && (
              <div className="group relative shrink-0 self-start">
                {displayClientLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={displayClientLogoUrl}
                    alt={`${displayClientName} 로고`}
                    className="aspect-square h-24 sm:h-32 rounded-2xl border border-[#e5e5e5] bg-white object-cover"
                  />
                ) : (
                  <div className="flex aspect-square h-24 sm:h-32 items-center justify-center rounded-2xl border border-dashed border-[#d1d1d6] bg-[#f5f5f7]">
                    <ImageIcon size={24} className="text-[#c7c7cc]" />
                  </div>
                )}
                {isAdmin && (
                  <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-2xl bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                    <span className="text-xs font-medium text-white">{uploadingLogo ? "..." : "변경"}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                  </label>
                )}
                {isAdmin && (
                  <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-[#e5e5e5] bg-white text-[#86868b] shadow-[0_1px_4px_rgba(0,0,0,0.1)] sm:hidden">
                    <Pencil size={11} />
                  </span>
                )}
              </div>
            )}
            <div>
              {displayClientName && (
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#86868b]">{displayClientName}</p>
              )}
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-[#1d1d1f]">{(isZh && project.nameZh) || zhProjectName[project.name] || project.name}</h1>
                {isAdmin && (
                  <button onClick={openEdit} className="text-[#d1d1d6] hover:text-[#86868b]">
                    <Pencil size={15} />
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={handleToggleClientVisible}
                    title={project.clientVisible === false ? "고객에게 비공개 — 눌러서 공개" : "고객에게 공개됨 — 눌러서 비공개"}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                      project.clientVisible === false
                        ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                        : "bg-[#f5f5f7] text-[#86868b] hover:bg-[#ececee]"
                    }`}
                  >
                    {project.clientVisible === false ? <EyeOff size={12} /> : <Eye size={12} />}
                    {project.clientVisible === false ? "비공개" : "공개"}
                  </button>
                )}
              </div>
              {project.description && (
                <p className="mt-1 text-sm text-[#86868b]">
                  {(isZh && project.descriptionZh) || zhProjectName[project.description] || project.description}
                </p>
              )}
              <div className="mt-2.5 flex flex-wrap items-center gap-1">
                {project.projectType?.map((t) => (
                  <span key={t} className="whitespace-nowrap rounded-full bg-[#f5f5f7] px-2 py-0.5 text-xs font-medium text-[#1d1d1f]">
                    {zh(isZh, PROJECT_TYPE_LABEL[t])}
                  </span>
                ))}
              </div>
              <p className="mt-1.5 whitespace-nowrap text-xs text-[#86868b]">{project.startDate} ~ {project.endDate}</p>
            </div>
          </div>

          {isAdmin && (
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <TaskCreateForm
                projectId={project.id}
                clientId={project.clientId}
                existingTasks={tasks}
                assigneeOptions={assigneeOptions}
              />
            </div>
          )}
        </div>

        {stats.total > 0 && (
          <div className="mt-6 border-t border-[#f0f0f0] pt-5">
            <p className="text-xs text-[#86868b]">{zh(isZh, "전체 진행률")}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#f5f5f7]">
                <div className="h-full rounded-full bg-[#1d1d1f]" style={{ width: `${stats.progress}%` }} />
              </div>
              <span className="text-sm font-semibold text-[#1d1d1f]">{stats.progress}%</span>
            </div>
          </div>
        )}
      </div>

      {decisionTasks.length > 0 && (
        <div className="rounded-3xl border border-violet-200 bg-violet-100/70 p-5">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-violet-700">
            <AlertCircle size={15} />
            {zh(isZh, "확인/승인이 필요한 업무")} {decisionTasks.length}{zh(isZh, "건")}
          </p>
          <div className="space-y-2">
            {decisionTasks.map((t) => {
              const openNote = [...(t.decisionHistory ?? [])].reverse().find((h) => !h.decidedAt)?.note;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTask(t)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-violet-100 bg-white px-4 py-3 text-left text-sm shadow-[0_1px_4px_rgba(124,58,237,0.06)] transition hover:border-violet-300 hover:shadow-[0_4px_12px_rgba(124,58,237,0.12)]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                    <AlertCircle size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[#1d1d1f]">{t.name}</p>
                    {openNote && <p className="truncate text-xs text-[#86868b]">{openNote}</p>}
                  </div>
                  <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600">{t.dueDate}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {stats.total > 0 && (
        <div className="rounded-3xl bg-white p-6 sm:p-8">
          <AiDiagnosisPanel project={project} tasks={tasks} />
        </div>
      )}

      {tasksError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">{zh(isZh, "업무 목록을 불러오지 못했습니다.")}</p>
          <p className="mt-1 break-all text-xs text-red-600">{tasksError}</p>
        </div>
      )}

      {/* 탭 — 협력사는 요청 범위(일정·업무·자료·코멘트)만 보여주고 대시보드는 뺀다 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DndContext sensors={tabSensors} collisionDetection={closestCenter} onDragEnd={handleTabReorder}>
          <SortableContext items={visibleTabOrder} strategy={horizontalListSortingStrategy}>
            <div className="flex gap-1 overflow-x-auto rounded-full bg-[#eeeef0] p-1">
              {visibleTabOrder.map((id) => (
                <SortableTabButton
                  key={id}
                  id={id}
                  active={tab === id}
                  onClick={() => setTab(id)}
                  icon={getTabIcon(id)}
                  label={zh(isZh, TAB_LABEL[id])}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <div className="flex shrink-0 items-center gap-2">
          {isAdmin && (
            <div className="sm:hidden">
              <TaskCreateForm
                projectId={project.id}
                clientId={project.clientId}
                existingTasks={tasks}
                assigneeOptions={assigneeOptions}
                compact
              />
            </div>
          )}
          <button
            onClick={handleOpenCalendarLink}
            disabled={tasks.length === 0 || calendarLoading}
            title={zh(isZh, "캘린더 구독 링크 — 구글/애플 캘린더에 URL로 추가하면 일정이 자동으로 갱신됩니다")}
            className="flex items-center gap-1.5 rounded-full border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] disabled:opacity-40"
          >
            <CalendarDays size={13} />
            <span className="hidden sm:inline">{calendarLoading ? zh(isZh, "준비 중...") : zh(isZh, "캘린더 구독")}</span>
          </button>
          <button
            onClick={handleExportExcel}
            disabled={tasks.length === 0}
            className="flex items-center gap-1.5 rounded-full border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] disabled:opacity-40"
          >
            <Download size={13} />
            <span className="hidden sm:inline">{zh(isZh, "엑셀 다운로드")}</span>
          </button>
        </div>
      </div>
      {calendarError && <p className="text-xs text-red-500">{calendarError}</p>}

      {calendarUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setCalendarUrl(null)}>
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h2 className="text-lg font-semibold text-[#1d1d1f]">{zh(isZh, "캘린더 구독")}</h2>
              <p className="mt-1 text-sm text-[#86868b]">{zh(isZh, "아래 버튼을 누르면 캘린더 앱이 바로 열리면서 구독이 시작됩니다. 안 열리면 링크를 복사해서 캘린더 앱에 직접 추가해주세요.")}</p>
            </div>
            <a
              href={calendarUrl.replace(/^https:/, "webcal:")}
              className="block w-full rounded-full bg-[#1d1d1f] py-3 text-center text-sm font-semibold text-white transition hover:bg-black"
            >
              {zh(isZh, "캘린더 앱에 바로 추가")}
            </a>
            <input
              readOnly
              value={calendarUrl}
              onFocus={(e) => e.target.select()}
              className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-xs text-[#1d1d1f] outline-none focus:border-[#86868b]"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setCalendarUrl(null)} className="rounded-full border border-[#d1d1d6] px-4 py-2 text-sm text-[#1d1d1f] hover:bg-[#f5f5f7]">{zh(isZh, "닫기")}</button>
              <button
                onClick={handleCopyCalendarUrl}
                className="rounded-full border border-[#d1d1d6] px-4 py-2 text-sm font-medium text-[#1d1d1f] transition hover:bg-[#f5f5f7]"
              >
                {calendarCopied ? zh(isZh, "복사됨!") : zh(isZh, "링크 복사")}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "gantt" && <GanttChart tasks={tasks} onSelectTask={setSelectedTask} />}
      {tab === "list" && <TaskList tasks={tasks} onSelectTask={setSelectedTask} />}
      {tab === "dashboard" && <ProjectDashboard project={project} tasks={tasks} onSelectTask={setSelectedTask} />}
      {tab === "files" && <ProjectFilesTab tasks={tasks} />}
      {tab === "comments" && <ProjectCommentsTab tasks={tasks} onSelectTask={setSelectedTask} />}
      {tab === "partner" && (isAdmin || isPartner) && <PartnerArchiveTab projectId={project.id} tasks={tasks} />}

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
              <div>
                <label className="block text-xs font-medium text-[#86868b] mb-1.5">
                  고객사{!editForm.clientId && " (아직 미지정)"}
                </label>
                <select
                  className="w-full appearance-none rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#1d1d1f] outline-none"
                  value={editForm.clientId}
                  onChange={e => setEditForm(f => ({ ...f, clientId: e.target.value }))}
                >
                  <option value="">나중에 지정</option>
                  {allClients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[#86868b] mb-1.5">시작일</label>
                  <input type="date" className="w-full appearance-none rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#1d1d1f] outline-none" value={editForm.startDate} onChange={e => setEditForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[#86868b] mb-1.5">종료일</label>
                  <input type="date" className="w-full appearance-none rounded-xl border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#1d1d1f] outline-none" value={editForm.endDate} onChange={e => setEditForm(f => ({ ...f, endDate: e.target.value }))} />
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
                <select
                  className="w-full appearance-none rounded-xl border border-[#e5e5e5] bg-white bg-[length:14px] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-8 text-sm text-[#1d1d1f] outline-none"
                  style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")" }}
                  value={editForm.status}
                  onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                >
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
      className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition whitespace-nowrap ${
        active ? "bg-white text-[#1d1d1f] shadow-[0_1px_4px_rgba(0,0,0,0.08)]" : "text-[#86868b] hover:text-[#1d1d1f]"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
