"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, Trash2, Search, Megaphone, X, AlertCircle, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { zh, usePartnerZh, useZhAutoTranslate } from "@/lib/i18n";
import { listenAllProjects, listenProjectsByClient, listenProjectsByIds, updateProject, deleteProject, createProject } from "@/lib/firestore/projects";
import { listenClients } from "@/lib/firestore/clients";
import { listenAllTasks, listenTasksByProject, listenTasksByProjectIds } from "@/lib/firestore/tasks";
import { listenNotices, markNoticeRead } from "@/lib/firestore/notices";
import { listenAllContracts } from "@/lib/firestore/contracts";
import { listenAllPurchaseOrders } from "@/lib/firestore/purchaseOrders";
import { isOverdue, isDueSoon } from "@/lib/bottleneck";
import { Project, Client, ProjectStatus, Task, Notice, DateChangeEntry, PROJECT_TYPE_LABEL, Contract, PurchaseOrder } from "@/lib/types";
import { groupDateHistory } from "@/lib/groupDateHistory";
import { calcOrderTotals } from "@/lib/orderCalc";
import MonthlyOrderChart, { buildMonthlyOrderData } from "@/components/dashboard/MonthlyOrderChart";
import { toProxiedUrl } from "@/lib/storageProxy";

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
  const [hiddenProjectCount, setHiddenProjectCount] = useState(0);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  // 협력사와 먼저 자료 공유를 시작해야 하는 경우가 있어, 고객사를 정하지 않고도 여기서 바로
  // 프로젝트를 만들 수 있게 한다 — 지금까지는 클라이언트 상세 화면에서만 만들 수 있어서
  // 반드시 고객사를 먼저 골라야 했다. 고객사는 나중에 프로젝트 수정에서 지정하면 된다.
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [npName, setNpName] = useState("");
  const [npClientId, setNpClientId] = useState("");
  const [npStart, setNpStart] = useState("");
  const [npEnd, setNpEnd] = useState("");
  const [savingNewProject, setSavingNewProject] = useState(false);

  const isAdmin = appUser?.role === "admin";
  // 협력사(파트너) 계정 — clients 컬렉션 접근 권한이 없어 clientId로 묶어 조회할 수 없다.
  // 관리자가 배정한 projectIds를 listenProjectsByIds로 배치 구독한다(10개씩 묶음) —
  // 개별 문서를 하나씩 구독하면 프로젝트 수만큼 리스너 채널이 열려 프록시 경유 시 느리다.
  const isPartner = appUser?.role === "partner";
  const isZh = usePartnerZh();

  useEffect(() => {
    return listenNotices((notices) => setLatestNotice(notices[0] ?? null));
  }, []);

  // 프로젝트명은 관리자가 직접 입력한 자유 텍스트라 기계 번역으로 처리한다.
  const zhProjectNames = useZhAutoTranslate(isZh, projects.map((p) => p.name));
  // 공지 배너 제목도 마찬가지 — 관리자가 쓴 자유 텍스트다.
  const zhNoticeTitle = useZhAutoTranslate(isZh, latestNotice ? [latestNotice.title] : []);

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
      const unsub4 = listenAllContracts(setContracts);
      const unsub5 = listenAllPurchaseOrders(setOrders);
      return () => {
        unsub1();
        unsub2();
        unsub3();
        unsub4();
        unsub5();
      };
    } else if (appUser.clientId) {
      const unsub = listenProjectsByClient(appUser.clientId, (raw) => {
        // 관리자가 아직 "고객에게 공개"를 켜지 않은 프로젝트는 목록에서 숨긴다 — Firestore
        // list 규칙은 "쿼리 결과 중 하나라도 막히면 쿼리 전체가 실패"하는 방식이라 비공개
        // 프로젝트를 규칙에서 걸러낼 수 없어서, 쿼리는 전체를 받아온 뒤 여기서 걸러낸다.
        const p = raw.filter((proj) => proj.clientVisible !== false);
        setProjects(p);
        setHiddenProjectCount(raw.length - p.length);
        setLoaded(true);
        if (p.length === 1) router.replace(`/projects/${p[0].id}`);
      }, () => setLoaded(true));
      return () => unsub();
    } else if (isPartner) {
      const ids = appUser.projectIds ?? [];
      if (ids.length === 0) {
        setProjects([]);
        setLoaded(true);
        return;
      }
      const unsub = listenProjectsByIds(ids, (list) => {
        setProjects(list);
        setLoaded(true);
        if (ids.length === 1 && list.length === 1) router.replace(`/projects/${list[0].id}`);
      });
      return () => unsub();
    } else {
      setLoaded(true);
    }
  }, [appUser, isAdmin, isPartner, router]);

  useEffect(() => {
    if (isAdmin || projects.length === 0 || !appUser?.clientId) return;
    // clientId를 함께 넘겨야 한다 — 이유는 listenTasksByProject 주석 참고(list 규칙은 쿼리
    // 제약만으로 권한을 증명해야 해서, projectId만으로 좁히면 클라이언트 계정에선 거부된다).
    const unsubs = projects.map((p) => listenTasksByProject(p.id, (ts) => {
      setAllTasks((prev) => [...prev.filter((t) => t.projectId !== p.id), ...ts]);
    }, undefined, appUser.clientId));
    return () => unsubs.forEach((u) => u());
  }, [isAdmin, projects, appUser?.clientId]);

  useEffect(() => {
    if (!isPartner || projects.length === 0) return;
    // listenTasksByProjectIds로 배치 구독한다(10개씩 묶음) — belongsToPartnerProject
    // 규칙이 projectId만으로 허용하므로 clientId는 필요 없다. hiddenFromPartner는 list
    // 규칙에서 걸러줄 수 없어(문서 하나라도 조건을 못 넘으면 쿼리 전체가 거부되는 함정)
    // 쿼리는 전체를 받아온 뒤 여기서 걸러낸다.
    const unsub = listenTasksByProjectIds(
      projects.map((p) => p.id),
      (ts) => setAllTasks(ts.filter((t) => !t.hiddenFromPartner))
    );
    return () => unsub();
  }, [isPartner, projects]);

  const clientName = (clientId?: string) => (clientId ? clients.find((c) => c.id === clientId)?.name ?? clientId : "");
  const clientLogo = (clientId?: string) => (clientId ? clients.find((c) => c.id === clientId)?.logoUrl : undefined);

  const sortedProjects = [...projects].sort((a, b) => {
    const ao = a.sortOrder ?? a.createdAt;
    const bo = b.sortOrder ?? b.createdAt;
    return ao - bo;
  });

  const activeProjectCount = sortedProjects.filter((p) => p.status === "active").length;
  const overdueTaskCount = allTasks.filter(isOverdue).length;
  const dueSoonTaskCount = allTasks.filter((t) => isDueSoon(t) && !isOverdue(t)).length;
  // "서명 대기" = 발송했지만 아직 서명 안 됨(수정요청 포함, 클라이언트 액션을 기다리는 상태) —
  // draft(관리자가 작성만 하고 아직 안 보낸 것)는 대기가 아니라 그냥 미발송이라 제외한다.
  const pendingSignatureCount = contracts.filter((c) => c.status === "sent" || c.status === "revision_requested").length;
  const now = new Date();
  // 발주별 통화 합계(calcOrderTotals)는 발주 하나당 딱 한 번만 계산해서, 이번 달 요약 카드와
  // 6개월 차트(KRW/USD 두 개) 양쪽에서 같은 결과를 재사용한다 — orders가 바뀔 때만 다시 계산.
  const ordersWithTotals = useMemo(() => orders.map((o) => ({ ...o, totals: calcOrderTotals(o.items) })), [orders]);
  const hasUsdOrders = ordersWithTotals.some((o) => o.totals.hasUsd);
  const monthlyData = useMemo(() => buildMonthlyOrderData(ordersWithTotals), [ordersWithTotals]);
  const monthlyOrderTotalKrw = monthlyData.krw[monthlyData.krw.length - 1]?.total ?? 0;
  const monthlyOrderTotalUsd = monthlyData.usd[monthlyData.usd.length - 1]?.total ?? 0;

  const upcomingTasks = allTasks
    .filter((t) => isOverdue(t) || isDueSoon(t))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // 협력사 본인이 담당자로 지정된 업무 — 마감 임박·지연과 무관하게 전부 보여준다.
  const myAssignedTasks = isPartner && appUser
    ? allTasks.filter((t) => t.assigneeId === appUser.uid && t.status !== "done").sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    : [];

  const decisionTasks = allTasks.filter((t) => t.needsDecision);

  // 업무명은 관리자가 직접 입력한 자유 텍스트라, nameZh(저장 시 미리 번역해둔 값)가 없는
  // 오래된/번역 실패 업무는 화면에서 즉석 번역(useZhAutoTranslate)으로 대체한다.
  const zhTaskNames = useZhAutoTranslate(isZh, [...upcomingTasks, ...myAssignedTasks].map((t) => t.name));
  const trTaskName = (t: Task) => (isZh && t.nameZh) || zhTaskNames[t.name] || t.name;

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

  async function handleCreateNewProject(e: FormEvent) {
    e.preventDefault();
    if (!appUser || !npName.trim() || !npStart || !npEnd) return;
    setSavingNewProject(true);
    try {
      const ref = await createProject({
        clientId: npClientId || undefined,
        name: npName.trim(),
        startDate: npStart,
        endDate: npEnd,
        createdBy: appUser.uid,
      });
      setNpName("");
      setNpClientId("");
      setNpStart("");
      setNpEnd("");
      setShowNewProjectForm(false);
      router.push(`/projects/${ref.id}`);
    } finally {
      setSavingNewProject(false);
    }
  }

  if (!loaded) {
    return <p className="text-sm text-[#86868b]">{zh(isZh, "불러오는 중...")}</p>;
  }

  return (
    <div className="space-y-6">
      {showNoticeBanner && latestNotice && (
        <div className="flex items-center gap-3 rounded-2xl bg-[#1d1d1f] px-4 py-3">
          <Megaphone size={16} className="shrink-0 text-white" />
          <Link href="/notices" onClick={dismissNoticeBanner} className="min-w-0 flex-1 truncate text-sm text-white">
            <span className="font-semibold">{zh(isZh, "공지")}</span> · {zhNoticeTitle[latestNotice.title] ?? latestNotice.title}
          </Link>
          <button onClick={dismissNoticeBanner} className="shrink-0 text-white/50 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-[#1d1d1f]">
            <span className="h-2 w-2 rounded-full bg-[#1d1d1f]" />
            {isAdmin ? "전체 프로젝트 현황" : zh(isZh, "내 프로젝트")}
          </h1>
          <p className="mt-1 pl-4 text-sm text-[#86868b]">
            {isAdmin ? "진행 중인 프로젝트와 마감 임박 업무를 한눈에 확인하세요." : zh(isZh, "내가 참여 중인 프로젝트의 진행 상황을 확인하세요.")}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowNewProjectForm((v) => !v)}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full bg-[#1d1d1f] px-4 text-sm font-medium text-white transition hover:bg-black"
          >
            <Plus size={16} /> 새 프로젝트
          </button>
        )}
      </div>

      {isAdmin && showNewProjectForm && (
        <form onSubmit={handleCreateNewProject} className="space-y-3 rounded-3xl bg-white p-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#86868b]">프로젝트명</label>
            <input
              required
              value={npName}
              onChange={(e) => setNpName(e.target.value)}
              className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#86868b]">
              고객사 (지금 안 정해도 됩니다 — 나중에 프로젝트 수정에서 지정할 수 있어요)
            </label>
            <select
              value={npClientId}
              onChange={(e) => setNpClientId(e.target.value)}
              className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
            >
              <option value="">나중에 지정</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-[#86868b]">시작일</label>
              <input
                required
                type="date"
                value={npStart}
                onChange={(e) => setNpStart(e.target.value)}
                className="w-full appearance-none rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-[#86868b]">종료일</label>
              <input
                required
                type="date"
                value={npEnd}
                onChange={(e) => setNpEnd(e.target.value)}
                className="w-full appearance-none rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={savingNewProject}
              className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
            >
              {savingNewProject ? "생성 중..." : "프로젝트 생성"}
            </button>
            <button
              type="button"
              onClick={() => setShowNewProjectForm(false)}
              className="rounded-full border border-[#d1d1d6] px-4 py-2 text-sm text-[#1d1d1f] hover:bg-[#f5f5f7]"
            >
              취소
            </button>
          </div>
        </form>
      )}

      {isAdmin && projects.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
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
          <div className="rounded-3xl bg-white p-4">
            <p className="text-xs text-[#86868b]">서명 대기 계약</p>
            <p className={`mt-1 text-2xl font-semibold ${pendingSignatureCount > 0 ? "text-amber-500" : "text-[#1d1d1f]"}`}>{pendingSignatureCount}건</p>
          </div>
          <div className="rounded-3xl bg-white p-4">
            <p className="text-xs text-[#86868b]">이번 달 발주 금액</p>
            <p className="mt-1 text-2xl font-semibold text-[#1d1d1f]">{monthlyOrderTotalKrw.toLocaleString()}원</p>
            {monthlyOrderTotalUsd > 0 && (
              <p className="mt-0.5 text-sm font-medium text-[#86868b]">
                +${monthlyOrderTotalUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
          </div>
        </div>
      )}

      {isAdmin && orders.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <MonthlyOrderChart data={monthlyData.krw} currency="KRW" />
          {hasUsdOrders && <MonthlyOrderChart data={monthlyData.usd} currency="USD" />}
        </div>
      )}

      {/* 협력사는 여러 프로젝트를 동시에 진행하는 경우가 많아, 계약·발주 금액 같은 민감한
          항목은 빼고 프로젝트·업무 현황만 요약해서 보여준다. */}
      {isPartner && projects.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-3xl bg-white p-4">
            <p className="text-xs text-[#86868b]">{zh(isZh, "진행 중")}</p>
            <p className="mt-1 text-2xl font-semibold text-[#1d1d1f]">{activeProjectCount}{zh(isZh, "건")}</p>
          </div>
          <div className="rounded-3xl bg-white p-4">
            <p className="text-xs text-[#86868b]">{zh(isZh, "지연 업무")}</p>
            <p className={`mt-1 text-2xl font-semibold ${overdueTaskCount > 0 ? "text-red-500" : "text-[#1d1d1f]"}`}>{overdueTaskCount}{zh(isZh, "건")}</p>
          </div>
          <div className="rounded-3xl bg-white p-4">
            <p className="text-xs text-[#86868b]">{zh(isZh, "마감 임박")}</p>
            <p className={`mt-1 text-2xl font-semibold ${dueSoonTaskCount > 0 ? "text-amber-500" : "text-[#1d1d1f]"}`}>{dueSoonTaskCount}{zh(isZh, "건")}</p>
          </div>
        </div>
      )}

      {isPartner && myAssignedTasks.length > 0 && (
        <div className="rounded-3xl bg-white p-5">
          <p className="mb-3 text-sm font-semibold text-[#1d1d1f]">{zh(isZh, "내 업무")} {myAssignedTasks.length}{zh(isZh, "건")}</p>
          <div className="space-y-1">
            {myAssignedTasks.slice(0, 8).map((t) => {
              const overdue = isOverdue(t);
              const dueSoon = isDueSoon(t) && !overdue;
              const project = projects.find((p) => p.id === t.projectId);
              return (
                <Link
                  key={t.id}
                  href={`/projects/${t.projectId}?task=${t.id}`}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition hover:bg-[#f5f5f7]"
                >
                  {(overdue || dueSoon) && (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${overdue ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-600"}`}>
                      {zh(isZh, overdue ? "지연" : "임박")}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate font-medium text-[#1d1d1f]">{trTaskName(t)}</span>
                  <span className="hidden shrink-0 truncate text-xs text-[#86868b] sm:block">{(isZh && project?.nameZh) || project?.name || "-"}</span>
                  <span className={`shrink-0 text-xs ${overdue ? "font-semibold text-red-500" : "text-[#86868b]"}`}>{t.dueDate}</span>
                </Link>
              );
            })}
          </div>
          {myAssignedTasks.length > 8 && (
            <p className="mt-2 px-3 text-xs text-[#86868b]">{zh(isZh, "외")} {myAssignedTasks.length - 8}{zh(isZh, "건 더 있음")}</p>
          )}
        </div>
      )}

      {decisionTasks.length > 0 && (
        <div className="rounded-3xl border border-violet-200 bg-violet-100/70 p-5">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-violet-700">
            <AlertCircle size={15} />
            {zh(isZh, "확인/승인이 필요한 업무")} {decisionTasks.length}{zh(isZh, "건")}
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
            <p className="mt-2 px-1 text-xs text-violet-600">{zh(isZh, "외")} {decisionTasks.length - 8}{zh(isZh, "건 더 있음")}</p>
          )}
        </div>
      )}

      {(isAdmin || isPartner) && upcomingTasks.length > 0 && (
        <div className="rounded-3xl bg-white p-5">
          <p className="mb-3 text-sm font-semibold text-[#1d1d1f]">{zh(isZh, "마감 임박·지연 업무")}</p>
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
                    {zh(isZh, overdue ? "지연" : "임박")}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-[#1d1d1f]">{trTaskName(t)}</span>
                  <span className="hidden shrink-0 truncate text-xs text-[#86868b] sm:block">{(isZh && project?.nameZh) || project?.name || "-"}</span>
                  <span className={`shrink-0 text-xs ${overdue ? "font-semibold text-red-500" : "text-[#86868b]"}`}>{t.dueDate}</span>
                </Link>
              );
            })}
          </div>
          {upcomingTasks.length > 8 && (
            <p className="mt-2 px-3 text-xs text-[#86868b]">{zh(isZh, "외")} {upcomingTasks.length - 8}{zh(isZh, "건 더 있음")}</p>
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
            : zh(isZh, "아직 배정된 프로젝트가 없습니다.")}
        </div>
      )}

      {projects.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868b]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAdmin ? "클라이언트명, 프로젝트명 검색" : zh(isZh, "프로젝트명 검색")}
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
                {s === "all" ? zh(isZh, "전체") : zh(isZh, STATUS_LABEL[s])}
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
          {showCompleted
            ? zh(isZh, "완료된 프로젝트 숨기기")
            : isZh
              ? `已隐藏 ${archivedCount} 个已完成项目 · 查看`
              : `완료된 프로젝트 ${archivedCount}건 숨겨짐 · 보기`}
        </button>
      )}

      {projects.length > 0 && filteredProjects.length === 0 && (
        <div className="rounded-3xl border border-dashed border-[#d1d1d6] bg-white p-10 text-center text-sm text-[#86868b]">
          {zh(isZh, "검색 결과가 없습니다.")}
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
            {isAdmin && p.clientId && (
              <Link
                href={`/clients/${p.clientId}`}
                onClick={(e) => e.stopPropagation()}
                className="ml-[18px] mr-6 mt-3 flex w-fit items-center rounded-lg px-1.5 py-0.5 transition hover:bg-[#f5f5f7]"
              >
                {/* 로고가 등록된 고객사는 이름 앞에 함께 보여준다 — 카드가 글자만 있어 프로젝트를
                    한눈에 알아보기 어려웠다. 좁은 화면에서는 작게(h-7), 넓은 화면에서는 크게(h-11). */}
                {clientLogo(p.clientId) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={clientLogo(p.clientId)}
                    alt=""
                    className="mr-2.5 h-7 w-auto max-w-[120px] shrink-0 object-contain md:h-11 md:max-w-[180px]"
                  />
                )}
                <span className="truncate text-xs font-medium text-[#86868b] hover:text-[#1d1d1f]">{clientName(p.clientId)}</span>
              </Link>
            )}
            {isAdmin && !p.clientId && (
              <span className="ml-[18px] mr-6 mt-3 inline-flex w-fit items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                고객 미지정
              </span>
            )}
            {/* 협력사 계정은 clients 컬렉션을 읽을 권한이 없어, 프로젝트 문서에 복사해둔
                clientDisplayName/clientLogoUrl(Project 타입 참고)로 같은 배지를 보여준다. */}
            {!isAdmin && isPartner && p.clientDisplayName && (
              <div className="ml-[18px] mr-6 mt-3 flex w-fit items-center rounded-lg px-1.5 py-0.5">
                {p.clientLogoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={toProxiedUrl(p.clientLogoUrl)}
                    alt=""
                    className="mr-2.5 h-7 w-auto max-w-[120px] shrink-0 object-contain md:h-11 md:max-w-[180px]"
                  />
                )}
                {/* 고객사명은 일부러 번역하지 않고 한국어 원문 그대로 둔다(회사 고유명사). */}
                <span className="truncate text-xs font-medium text-[#86868b]">{p.clientDisplayName}</span>
              </div>
            )}
            <Link href={`/projects/${p.id}`} className={`block px-6 pb-6 ${isAdmin || (isPartner && p.clientDisplayName) ? "pt-0.5" : "pt-6"}`}>
              <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#1d1d1f]">{(isZh && p.nameZh) || zhProjectNames[p.name] || p.name}</p>
                  {p.projectType && p.projectType.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {p.projectType.map((t) => (
                        <span key={t} className="rounded-full bg-[#f5f5f7] px-2.5 py-0.5 text-xs text-[#1d1d1f]">
                          {zh(isZh, PROJECT_TYPE_LABEL[t])}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-1.5 text-xs text-[#86868b]">{p.startDate} ~ {p.endDate}</p>
              </div>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#f5f5f7] px-2.5 py-0.5 text-xs text-[#86868b]">
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[p.status]}`} />
                {zh(isZh, STATUS_LABEL[p.status])}
              </span>
            </Link>
          </div>
          );
        })}
        {!isAdmin && hiddenProjectCount > 0 && !search.trim() && statusFilter === "all" && (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#d1d1d6] p-6 text-center">
            <p className="text-sm font-medium text-[#86868b]">{zh(isZh, "새 프로젝트를 준비하고 있습니다")}</p>
          </div>
        )}
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
