"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, Trash2, Search, Megaphone, X, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenAllProjects, listenProjectsByClient, updateProject, deleteProject } from "@/lib/firestore/projects";
import { listenClients } from "@/lib/firestore/clients";
import { listenAllTasks, listenTasksByProject } from "@/lib/firestore/tasks";
import { listenNotices, markNoticeRead } from "@/lib/firestore/notices";
import { isOverdue, isDueSoon } from "@/lib/bottleneck";
import { Project, Client, ProjectStatus, Task, Notice, DateChangeEntry, PROJECT_TYPE_LABEL } from "@/lib/types";
import { groupDateHistory } from "@/lib/groupDateHistory";

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "진행 중",
  on_hold: "보류",
  completed: "완료",
};

const STATUS_DOT: Record<ProjectStatus, string> = {
  active: "bg-green-500",
  on_hold: "bg-amber-400",
  completed: "bg-[#86868b]",
};

function renderDateChangeRow(
  { task: t, entry: h }: { task: Task; entry: DateChangeEntry },
  key: string,
  projects: Project[]
) {
  const project = projects.find((p) => p.id === t.projectId);
  const dueChanged = h.fromDueDate !== h.toDueDate;
  const startChanged = h.fromStartDate !== h.toStartDate;
  return (
    <Link
      key={key}
      href={`/projects/${t.projectId}?task=${t.id}`}
      className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition hover:bg-[#f5f5f7]"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-[#1d1d1f]">
          {t.name}
          <span className="ml-1.5 font-normal text-[#86868b]">· {project?.name ?? "-"}</span>
        </p>
        <p className="truncate text-xs text-[#86868b]">
          {dueChanged && <>마감일 {h.fromDueDate} → <span className="font-medium text-[#1d1d1f]">{h.toDueDate}</span></>}
          {dueChanged && startChanged && " · "}
          {startChanged && <>시작일 {h.fromStartDate} → <span className="font-medium text-[#1d1d1f]">{h.toStartDate}</span></>}
        </p>
      </div>
      {h.cascaded && (
        <span className="shrink-0 rounded-full bg-[#f5f5f7] px-2 py-0.5 text-[10px] font-medium text-[#86868b]">자동조정</span>
      )}
      <span className="shrink-0 text-xs text-[#86868b]">{new Date(h.changedAt).toLocaleDateString("ko-KR")}</span>
    </Link>
  );
}

export default function HomePage() {
  const { appUser } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [latestNotice, setLatestNotice] = useState<Notice | null>(null);
  const [expandedChangeGroup, setExpandedChangeGroup] = useState<number | null>(null);

  const isAdmin = appUser?.role === "admin";

  useEffect(() => {
    return listenNotices((notices) => setLatestNotice(notices[0] ?? null));
  }, []);

  const showNoticeBanner = !!latestNotice && !!appUser && !latestNotice.readBy?.includes(appUser.uid);

  function dismissNoticeBanner() {
    if (!latestNotice || !appUser) return;
    markNoticeRead(latestNotice.id, appUser.uid);
  }

  useEffect(() => {
    if (!appUser) return;
    if (isAdmin) {
      const unsub1 = listenAllProjects((p) => {
        setProjects(p);
        setLoaded(true);
      });
      const unsub2 = listenClients(setClients);
      const unsub3 = listenAllTasks(setAllTasks);
      return () => {
        unsub1();
        unsub2();
        unsub3();
      };
    } else if (appUser.clientId) {
      const unsub = listenProjectsByClient(appUser.clientId, (p) => {
        setProjects(p);
        setLoaded(true);
        if (p.length === 1) router.replace(`/projects/${p[0].id}`);
      }, () => setLoaded(true));
      return () => unsub();
    } else {
      setLoaded(true);
    }
  }, [appUser, isAdmin, router]);

  useEffect(() => {
    if (isAdmin || projects.length === 0) return;
    const unsubs = projects.map((p) => listenTasksByProject(p.id, (ts) => {
      setAllTasks((prev) => [...prev.filter((t) => t.projectId !== p.id), ...ts]);
    }));
    return () => unsubs.forEach((u) => u());
  }, [isAdmin, projects]);

  const clientName = (clientId: string) => clients.find((c) => c.id === clientId)?.name ?? clientId;

  const sortedProjects = [...projects].sort((a, b) => {
    const ao = a.sortOrder ?? a.createdAt;
    const bo = b.sortOrder ?? b.createdAt;
    return ao - bo;
  });

  const activeProjectCount = sortedProjects.filter((p) => p.status === "active").length;
  const overdueTaskCount = allTasks.filter(isOverdue).length;
  const dueSoonTaskCount = allTasks.filter((t) => isDueSoon(t) && !isOverdue(t)).length;

  const upcomingTasks = allTasks
    .filter((t) => isOverdue(t) || isDueSoon(t))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const decisionTasks = allTasks.filter((t) => t.needsDecision);

  // 그룹화 전이 아니라 그룹화 후 8건을 자르므로, 자동조정 연쇄로 한 번에 여러 건이 묶여도
  // 다른 날짜에 있었던 별개 변경들이 밀려나지 않는다.
  const recentDateChangeGroups = isAdmin
    ? groupDateHistory(
        allTasks
          .flatMap((t) => (t.dateHistory ?? []).map((h) => ({ task: t, entry: h })))
          .sort((a, b) => b.entry.changedAt - a.entry.changedAt)
      ).slice(0, 8)
    : [];

  const archivedCount = statusFilter === "all" && !search.trim()
    ? sortedProjects.filter((p) => p.status === "completed").length
    : 0;

  const filteredProjects = sortedProjects.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (statusFilter === "all" && !showCompleted && !q && p.status === "completed") return false;
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || clientName(p.clientId).toLowerCase().includes(q);
  });

  async function moveProject(index: number, dir: -1 | 1) {
    const ordered = sortedProjects;
    const swapIndex = index + dir;
    if (swapIndex < 0 || swapIndex >= ordered.length) return;
    const a = ordered[index];
    const b = ordered[swapIndex];
    await Promise.all([
      updateProject(a.id, { sortOrder: swapIndex }),
      updateProject(b.id, { sortOrder: index }),
    ]);
  }

  async function handleDelete(id: string) {
    await deleteProject(id);
    setDeleteConfirm(null);
    setDeleteInput("");
  }

  if (!loaded) {
    return <p className="text-sm text-[#86868b]">불러오는 중...</p>;
  }

  return (
    <div className="space-y-6">
      {showNoticeBanner && latestNotice && (
        <div className="flex items-center gap-3 rounded-2xl bg-[#1d1d1f] px-4 py-3">
          <Megaphone size={16} className="shrink-0 text-white" />
          <Link href="/notices" onClick={dismissNoticeBanner} className="min-w-0 flex-1 truncate text-sm text-white">
            <span className="font-semibold">공지</span> · {latestNotice.title}
          </Link>
          <button onClick={dismissNoticeBanner} className="shrink-0 text-white/50 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-[#1d1d1f]">
            <span className="h-2 w-2 rounded-full bg-[#1d1d1f]" />
            {isAdmin ? "전체 프로젝트 현황" : "내 프로젝트"}
          </h1>
          <p className="mt-1 pl-4 text-sm text-[#86868b]">
            {isAdmin ? "진행 중인 프로젝트와 마감 임박 업무를 한눈에 확인하세요." : "내가 참여 중인 프로젝트의 진행 상황을 확인하세요."}
          </p>
        </div>
      </div>

      {isAdmin && projects.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-3xl bg-white p-4">
            <p className="text-xs text-[#86868b]">진행 중</p>
            <p className="mt-1 text-2xl font-semibold text-[#1d1d1f]">{activeProjectCount}건</p>
          </div>
          <div className="rounded-3xl bg-white p-4">
            <p className="text-xs text-[#86868b]">지연 업무</p>
            <p className={`mt-1 text-2xl font-semibold ${overdueTaskCount > 0 ? "text-red-500" : "text-[#1d1d1f]"}`}>{overdueTaskCount}건</p>
          </div>
          <div className="rounded-3xl bg-white p-4">
            <p className="text-xs text-[#86868b]">마감 임박</p>
            <p className={`mt-1 text-2xl font-semibold ${dueSoonTaskCount > 0 ? "text-amber-500" : "text-[#1d1d1f]"}`}>{dueSoonTaskCount}건</p>
          </div>
        </div>
      )}

      {decisionTasks.length > 0 && (
        <div className="rounded-3xl border border-violet-200 bg-violet-100/70 p-5">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-violet-700">
            <AlertCircle size={15} />
            확인/승인이 필요한 업무 {decisionTasks.length}건
          </p>
          <div className="space-y-2">
            {decisionTasks.slice(0, 8).map((t) => {
              const project = projects.find((p) => p.id === t.projectId);
              const openNote = [...(t.decisionHistory ?? [])].reverse().find((h) => !h.decidedAt)?.note;
              return (
                <Link
                  key={t.id}
                  href={`/projects/${t.projectId}?task=${t.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-white px-4 py-3 text-sm shadow-[0_1px_4px_rgba(124,58,237,0.06)] transition hover:border-violet-300 hover:shadow-[0_4px_12px_rgba(124,58,237,0.12)]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                    <AlertCircle size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    {isAdmin && <p className="truncate text-xs text-[#86868b]">{project?.name ?? "-"}</p>}
                    <p className="truncate font-medium text-[#1d1d1f]">{t.name}</p>
                    {openNote && <p className="truncate text-xs text-violet-600">{openNote}</p>}
                  </div>
                  <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600">{t.dueDate}</span>
                </Link>
              );
            })}
          </div>
          {decisionTasks.length > 8 && (
            <p className="mt-2 px-1 text-xs text-violet-600">외 {decisionTasks.length - 8}건 더 있음</p>
          )}
        </div>
      )}

      {isAdmin && upcomingTasks.length > 0 && (
        <div className="rounded-3xl bg-white p-5">
          <p className="mb-3 text-sm font-semibold text-[#1d1d1f]">마감 임박·지연 업무</p>
          <div className="space-y-1">
            {upcomingTasks.slice(0, 8).map((t) => {
              const overdue = isOverdue(t);
              const project = projects.find((p) => p.id === t.projectId);
              return (
                <Link
                  key={t.id}
                  href={`/projects/${t.projectId}`}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition hover:bg-[#f5f5f7]"
                >
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${overdue ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-600"}`}>
                    {overdue ? "지연" : "임박"}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-[#1d1d1f]">{t.name}</span>
                  <span className="hidden shrink-0 truncate text-xs text-[#86868b] sm:block">{project?.name ?? "-"}</span>
                  <span className={`shrink-0 text-xs ${overdue ? "font-semibold text-red-500" : "text-[#86868b]"}`}>{t.dueDate}</span>
                </Link>
              );
            })}
          </div>
          {upcomingTasks.length > 8 && (
            <p className="mt-2 px-3 text-xs text-[#86868b]">외 {upcomingTasks.length - 8}건 더 있음</p>
          )}
        </div>
      )}

      {isAdmin && recentDateChangeGroups.length > 0 && (
        <div className="rounded-3xl bg-white p-5">
          <p className="mb-3 text-sm font-semibold text-[#1d1d1f]">최근 일정 변경</p>
          <div className="space-y-1">
            {recentDateChangeGroups.map((group, gi) => {
              if (group.length === 1) {
                return renderDateChangeRow(group[0], `${gi}`, projects);
              }
              const groupOpen = expandedChangeGroup === gi;
              const cascadedCount = group.filter(({ entry }) => entry.cascaded).length;
              return (
                <div key={gi}>
                  <button
                    onClick={() => setExpandedChangeGroup(groupOpen ? null : gi)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-[#f5f5f7]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-[#1d1d1f]">일정 변경 {group.length}건</p>
                      {cascadedCount > 0 && (
                        <p className="truncate text-xs text-[#86868b]">자동조정 {cascadedCount}건 포함</p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-[#86868b]">{new Date(group[0].entry.changedAt).toLocaleDateString("ko-KR")}</span>
                    {groupOpen ? <ChevronUp size={16} className="shrink-0 text-[#86868b]" /> : <ChevronDown size={16} className="shrink-0 text-[#86868b]" />}
                  </button>
                  {groupOpen && (
                    <div className="ml-3 space-y-1 border-l border-[#f0f0f0] pl-2">
                      {group.map((item, i) => renderDateChangeRow(item, `${gi}-${i}`, projects))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {projects.length === 0 && (
        <div className="rounded-3xl border border-dashed border-[#d1d1d6] bg-white p-10 text-center text-sm text-[#86868b]">
          {isAdmin
            ? "아직 등록된 프로젝트가 없습니다. 클라이언트 관리에서 프로젝트를 생성해보세요."
            : "아직 배정된 프로젝트가 없습니다."}
        </div>
      )}

      {projects.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868b]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAdmin ? "클라이언트명, 프로젝트명 검색" : "프로젝트명 검색"}
              className="w-full rounded-full border border-[#d1d1d6] bg-white py-2 pl-9 pr-3 text-sm text-[#1d1d1f] outline-none placeholder:text-[#86868b] focus:border-[#86868b]"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["all", "active", "on_hold", "completed"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  statusFilter === s ? "bg-[#1d1d1f] text-white" : "bg-white text-[#86868b] hover:bg-[#f5f5f7]"
                }`}
              >
                {s === "all" ? "전체" : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      )}

      {archivedCount > 0 && (
        <button
          onClick={() => setShowCompleted((v) => !v)}
          className="text-xs font-medium text-[#86868b] underline underline-offset-2 hover:text-[#1d1d1f]"
        >
          {showCompleted ? "완료된 프로젝트 숨기기" : `완료된 프로젝트 ${archivedCount}건 숨겨짐 · 보기`}
        </button>
      )}

      {projects.length > 0 && filteredProjects.length === 0 && (
        <div className="rounded-3xl border border-dashed border-[#d1d1d6] bg-white p-10 text-center text-sm text-[#86868b]">
          검색 결과가 없습니다.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredProjects.map((p) => {
          const i = sortedProjects.findIndex((sp) => sp.id === p.id);
          return (
          <div key={p.id} className="relative rounded-3xl border border-black/5 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition hover:shadow-[0_8px_24px_rgba(0,0,0,0.07)]">
            {isAdmin && (
              <div className="flex items-center justify-end gap-1 px-3 pt-3">
                {!search.trim() && statusFilter === "all" && (
                  <>
                    <button onClick={() => moveProject(i, -1)} disabled={i === 0} className="rounded-lg p-1 text-[#86868b] hover:bg-[#f5f5f7] disabled:opacity-30"><ChevronUp size={14} /></button>
                    <button onClick={() => moveProject(i, 1)} disabled={i === sortedProjects.length - 1} className="rounded-lg p-1 text-[#86868b] hover:bg-[#f5f5f7] disabled:opacity-30"><ChevronDown size={14} /></button>
                  </>
                )}
                <button onClick={() => setDeleteConfirm(p.id)} className="rounded-lg p-1 text-[#86868b] hover:bg-red-50 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            )}
            {isAdmin && (
              <Link
                href={`/clients/${p.clientId}`}
                onClick={(e) => e.stopPropagation()}
                className="ml-[18px] mr-6 mt-3 flex w-fit items-center rounded-lg px-1.5 py-0.5 transition hover:bg-[#f5f5f7]"
              >
                <span className="truncate text-xs font-medium text-[#86868b] hover:text-[#1d1d1f]">{clientName(p.clientId)}</span>
              </Link>
            )}
            <Link href={`/projects/${p.id}`} className={`block px-6 pb-6 ${isAdmin ? "pt-0.5" : "pt-6"}`}>
              <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#1d1d1f]">{p.name}</p>
                  {p.projectType && p.projectType.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {p.projectType.map((t) => (
                        <span key={t} className="rounded-full bg-[#f5f5f7] px-2.5 py-0.5 text-xs text-[#1d1d1f]">
                          {PROJECT_TYPE_LABEL[t]}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-1.5 text-xs text-[#86868b]">{p.startDate} ~ {p.endDate}</p>
              </div>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#f5f5f7] px-2.5 py-0.5 text-xs text-[#86868b]">
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[p.status]}`} />
                {STATUS_LABEL[p.status]}
              </span>
            </Link>
          </div>
          );
        })}
      </div>

      {deleteConfirm && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-3xl bg-white p-6 shadow-xl space-y-4 w-96">
            <p className="font-semibold text-[#1d1d1f]">프로젝트 삭제</p>
            <p className="text-sm text-[#86868b]">삭제하면 복구할 수 없습니다. 계속하려면 아래에 <span className="font-semibold text-red-500">바로삭제</span>를 입력하세요.</p>
            <input
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="바로삭제"
              className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm focus:border-[#86868b] focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setDeleteConfirm(null); setDeleteInput(""); }} className="rounded-full border border-[#d1d1d6] px-4 py-2 text-sm text-[#1d1d1f]">취소</button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleteInput !== "바로삭제"}
                className="rounded-full bg-red-500 px-4 py-2 text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                삭제
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
