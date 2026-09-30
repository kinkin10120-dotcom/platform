"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { collectionGroup, getDocs } from "firebase/firestore";
import { Search, X, FolderKanban, ListTodo, MessageSquare, Paperclip, Building2, FileText, ShoppingCart, FileSignature, Megaphone } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { zh, usePartnerZh } from "@/lib/i18n";
import { listenAllProjects, listenProjectsByClient } from "@/lib/firestore/projects";
import { listenAllTasks, listenTasksByProject } from "@/lib/firestore/tasks";
import { listenClients } from "@/lib/firestore/clients";
import { listenComments } from "@/lib/firestore/comments";
import { listenFiles } from "@/lib/firestore/files";
import { listenQuoteRequests, QuoteRequest } from "@/lib/firestore/quotes";
import { listenAllPurchaseOrders } from "@/lib/firestore/purchaseOrders";
import { listenAllContracts } from "@/lib/firestore/contracts";
import { listenNotices } from "@/lib/firestore/notices";
import { Project, Task, Client, TaskComment, TaskFile, PurchaseOrder, Contract, Notice } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";

type Category = "all" | "project" | "task" | "comment" | "file" | "notice" | "client" | "quote" | "order" | "contract";

const CATEGORY_DEFS: { key: Category; label: string; adminOnly?: boolean }[] = [
  { key: "all", label: "전체" },
  { key: "project", label: "프로젝트" },
  { key: "task", label: "업무" },
  { key: "comment", label: "코멘트" },
  { key: "file", label: "파일" },
  { key: "notice", label: "공지" },
  { key: "client", label: "클라이언트", adminOnly: true },
  { key: "quote", label: "견적", adminOnly: true },
  { key: "order", label: "발주", adminOnly: true },
  { key: "contract", label: "계약", adminOnly: true },
];

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, "");
}

export default function GlobalSearch() {
  const { appUser } = useAuth();
  const router = useRouter();
  const isAdmin = appUser?.role === "admin";
  const isZh = usePartnerZh();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [category, setCategory] = useState<Category>("all");
  const [loadError, setLoadError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // 필터 칩 줄은 스크롤바를 숨기고(no-scrollbar) 대신 마우스로 눌러서 좌우로 끌 수 있게
  // 한다 — 데스크탑에서 스크롤바가 안 보이면 옆으로 더 있다는 걸 알기 어려우므로, 드래그가
  // 그 대체 단서 역할을 한다. 드래그 중 상태는 리렌더가 필요 없어 ref로만 들고 있는다.
  const chipsRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ dragging: boolean; startX: number; startScrollLeft: number; moved: boolean }>({
    dragging: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });

  function handleChipsMouseDown(e: React.MouseEvent) {
    const el = chipsRef.current;
    if (!el) return;
    dragState.current = { dragging: true, startX: e.clientX, startScrollLeft: el.scrollLeft, moved: false };
  }
  function handleChipsMouseMove(e: React.MouseEvent) {
    const el = chipsRef.current;
    const state = dragState.current;
    if (!el || !state.dragging) return;
    const delta = e.clientX - state.startX;
    if (Math.abs(delta) > 3) state.moved = true;
    el.scrollLeft = state.startScrollLeft - delta;
  }
  function handleChipsMouseUp() {
    dragState.current.dragging = false;
  }

  useEffect(() => {
    if (!open || !appUser) return;
    const unsubs: (() => void)[] = [];
    if (isAdmin) {
      unsubs.push(listenAllProjects(setProjects));
      unsubs.push(listenAllTasks(setTasks));
      unsubs.push(listenClients(setClients));
      unsubs.push(listenQuoteRequests(setQuotes));
      unsubs.push(listenAllPurchaseOrders(setOrders));
      unsubs.push(listenAllContracts(setContracts));
      // 코멘트·첨부파일은 실시간 구독 대신, 검색창 열릴 때 한 번만 collectionGroup으로 조회
      // 문서 자체에는 taskId 필드가 저장되어 있지 않으므로(tasks/{taskId}/comments 서브컬렉션 구조상
      // 상위 경로로만 알 수 있음), 문서 참조 경로(parent.parent)에서 taskId를 직접 추출한다.
      getDocs(collectionGroup(db, "comments"))
        .then((snap) => setComments(snap.docs.map((d) => ({ ...d.data(), id: d.id, taskId: d.ref.parent.parent?.id }) as TaskComment)))
        .catch((e) => { console.error("코멘트 검색 데이터 로드 실패:", e); setLoadError(`코멘트 검색 불러오기 실패: ${e?.code ?? e?.message ?? e}`); });
      getDocs(collectionGroup(db, "files"))
        .then((snap) => setFiles(snap.docs.map((d) => ({ ...d.data(), id: d.id, taskId: d.ref.parent.parent?.id }) as TaskFile)))
        .catch((e) => { console.error("첨부파일 검색 데이터 로드 실패:", e); setLoadError(`첨부파일 검색 불러오기 실패: ${e?.code ?? e?.message ?? e}`); });
    } else if (appUser.clientId) {
      // 홈 화면과 동일하게, 관리자가 아직 공개하지 않은 프로젝트는 검색 결과에서도 숨긴다.
      unsubs.push(listenProjectsByClient(appUser.clientId, (raw) => setProjects(raw.filter((p) => p.clientVisible !== false))));
    }
    return () => unsubs.forEach((u) => u());
  }, [open, appUser, isAdmin]);

  // 공지사항은 관리자·클라이언트 모두 볼 수 있는 콘텐츠라 역할 구분 없이 항상 구독한다.
  useEffect(() => {
    if (!open || !appUser) return;
    return listenNotices(setNotices);
  }, [open, appUser]);

  // 클라이언트 역할은 프로젝트별 업무를 각각 구독(전체 업무 컬렉션 접근 권한이 없으므로).
  // clientId를 함께 넘겨야 한다 — list 규칙은 쿼리 제약만으로 권한을 증명해야 해서
  // projectId로만 좁히면 통째로 거부된다(자세한 내용은 listenTasksByProject 주석 참고).
  useEffect(() => {
    if (!open || isAdmin || projects.length === 0 || !appUser?.clientId) return;
    const unsubs = projects.map((p) => listenTasksByProject(p.id, (ts) => {
      setTasks((prev) => [...prev.filter((t) => t.projectId !== p.id), ...ts]);
    }, undefined, appUser.clientId));
    return () => unsubs.forEach((u) => u());
  }, [open, isAdmin, projects, appUser?.clientId]);

  // 클라이언트 역할은 collectionGroup 조회 권한이 없으므로, 자신의 업무 각각에 대해
  // 코멘트·첨부파일 서브컬렉션을 직접 구독한다.
  useEffect(() => {
    if (!open || isAdmin || tasks.length === 0) return;
    const unsubComments = tasks.map((t) => listenComments(t.id, (cs) => {
      setComments((prev) => [...prev.filter((c) => c.taskId !== t.id), ...cs]);
    }));
    const unsubFiles = tasks.map((t) => listenFiles(t.id, (fs) => {
      setFiles((prev) => [...prev.filter((f) => f.taskId !== t.id), ...fs]);
    }));
    return () => {
      unsubComments.forEach((u) => u());
      unsubFiles.forEach((u) => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isAdmin, tasks.map((t) => t.id).join(",")]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else setQuery("");
  }, [open]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const clientName = (clientId?: string) => (clientId ? clients.find((c) => c.id === clientId)?.name ?? "" : "");
  const projectName = (projectId: string) => projects.find((p) => p.id === projectId)?.name ?? "";
  const taskName = (taskId: string) => tasks.find((t) => t.id === taskId)?.name ?? "";
  const taskProjectId = (taskId: string) => tasks.find((t) => t.id === taskId)?.projectId ?? "";

  const q = norm(query.trim());
  const matchedProjects = useMemo(() => {
    if (!q) return [];
    return projects.filter((p) => norm(p.name).includes(q) || norm(clientName(p.clientId)).includes(q)).slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, projects, clients]);
  const matchedTasks = useMemo(() => {
    if (!q) return [];
    return tasks.filter((t) => norm(t.name).includes(q)).slice(0, 6);
  }, [q, tasks]);
  const matchedComments = useMemo(() => {
    if (!q) return [];
    return comments.filter((c) => norm(c.text).includes(q)).slice(0, 6);
  }, [q, comments]);
  const matchedFiles = useMemo(() => {
    if (!q) return [];
    return files.filter((f) => norm(f.name).includes(q)).slice(0, 6);
  }, [q, files]);
  const matchedClients = useMemo(() => {
    if (!q || !isAdmin) return [];
    return clients.filter((c) => norm(c.name).includes(q)).slice(0, 6);
  }, [q, clients, isAdmin]);
  const matchedQuotes = useMemo(() => {
    if (!q || !isAdmin) return [];
    return quotes.filter((qt) => norm(qt.company).includes(q) || norm(qt.name).includes(q)).slice(0, 6);
  }, [q, quotes, isAdmin]);
  const matchedOrders = useMemo(() => {
    if (!q || !isAdmin) return [];
    return orders.filter((o) => norm(o.clientName).includes(q) || norm(o.poNumber).includes(q)).slice(0, 6);
  }, [q, orders, isAdmin]);
  const matchedContracts = useMemo(() => {
    if (!q || !isAdmin) return [];
    return contracts.filter((c) => norm(c.companyName).includes(q) || norm(c.title).includes(q) || norm(c.productName ?? "").includes(q)).slice(0, 6);
  }, [q, contracts, isAdmin]);
  const matchedNotices = useMemo(() => {
    if (!q) return [];
    return notices.filter((n) => norm(n.title).includes(q) || norm(n.content).includes(q)).slice(0, 6);
  }, [q, notices]);

  const resultsByCategory: Record<Exclude<Category, "all">, unknown[]> = {
    project: matchedProjects,
    task: matchedTasks,
    comment: matchedComments,
    file: matchedFiles,
    notice: matchedNotices,
    client: matchedClients,
    quote: matchedQuotes,
    order: matchedOrders,
    contract: matchedContracts,
  };
  const visibleCategories = category === "all" ? (Object.keys(resultsByCategory) as (keyof typeof resultsByCategory)[]) : [category];
  const noResults = !!q && visibleCategories.every((c) => resultsByCategory[c].length === 0);
  const showSection = (key: Exclude<Category, "all">) => category === "all" || category === key;

  function goToProject(projectId: string, taskId?: string) {
    setOpen(false);
    router.push(taskId ? `/projects/${projectId}?task=${taskId}` : `/projects/${projectId}`);
  }

  function goTo(path: string) {
    setOpen(false);
    router.push(path);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg p-1.5 text-[#86868b] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
        title={zh(isZh, "검색 (⌘K)")}
      >
        <Search size={18} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-20 sm:pt-32" onClick={() => setOpen(false)}>
          <div
            className="max-h-[70vh] w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-[#f0f0f0] px-4 py-3">
              <Search size={16} className="shrink-0 text-[#86868b]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="프로젝트, 업무, 클라이언트, 계약 등 검색"
                className="min-w-0 flex-1 text-sm text-[#1d1d1f] outline-none placeholder:text-[#c7c7cc]"
              />
              <button onClick={() => setOpen(false)} className="shrink-0 text-[#86868b] hover:text-[#1d1d1f]">
                <X size={16} />
              </button>
            </div>

            <div
              ref={chipsRef}
              onMouseDown={handleChipsMouseDown}
              onMouseMove={handleChipsMouseMove}
              onMouseUp={handleChipsMouseUp}
              onMouseLeave={handleChipsMouseUp}
              className="no-scrollbar flex cursor-grab select-none gap-1.5 overflow-x-auto border-b border-[#f0f0f0] px-3 py-2 active:cursor-grabbing"
            >
              {CATEGORY_DEFS.filter((c) => !c.adminOnly || isAdmin).map((c) => (
                <button
                  key={c.key}
                  onClick={() => { if (!dragState.current.moved) setCategory(c.key); }}
                  className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition ${
                    category === c.key ? "bg-[#1d1d1f] text-white" : "bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="max-h-[calc(70vh-52px)] overflow-y-auto p-2">
              {loadError && (
                <p className="mx-1 mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-500">{loadError}</p>
              )}
              {!q && (
                <p className="px-3 py-6 text-center text-sm text-[#86868b]">검색어를 입력하세요.</p>
              )}

              {noResults && (
                <p className="px-3 py-6 text-center text-sm text-[#86868b]">검색 결과가 없습니다.</p>
              )}

              {showSection("project") && matchedProjects.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-1.5 text-xs font-semibold text-[#86868b]">프로젝트</p>
                  {matchedProjects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => goToProject(p.id)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-[#f5f5f7]"
                    >
                      <FolderKanban size={15} className="shrink-0 text-[#86868b]" />
                      <span className="min-w-0 flex-1 truncate text-sm text-[#1d1d1f]">{p.name}</span>
                      {isAdmin && <span className="shrink-0 text-xs text-[#86868b]">{clientName(p.clientId)}</span>}
                    </button>
                  ))}
                </div>
              )}

              {showSection("task") && matchedTasks.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-1.5 text-xs font-semibold text-[#86868b]">업무</p>
                  {matchedTasks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => goToProject(t.projectId, t.id)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-[#f5f5f7]"
                    >
                      <ListTodo size={15} className="shrink-0 text-[#86868b]" />
                      <span className="min-w-0 flex-1 truncate text-sm text-[#1d1d1f]">{t.name}</span>
                      <span className="shrink-0 truncate text-xs text-[#86868b]">{projectName(t.projectId)}</span>
                      <span className="shrink-0"><StatusBadge status={t.status} /></span>
                    </button>
                  ))}
                </div>
              )}

              {showSection("comment") && matchedComments.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-1.5 text-xs font-semibold text-[#86868b]">코멘트</p>
                  {matchedComments.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => goToProject(taskProjectId(c.taskId), c.taskId)}
                      className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-[#f5f5f7]"
                    >
                      <MessageSquare size={15} className="mt-0.5 shrink-0 text-[#86868b]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-[#1d1d1f]">{c.text}</span>
                        <span className="block truncate text-xs text-[#86868b]">{taskName(c.taskId) || "업무"}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {showSection("file") && matchedFiles.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-1.5 text-xs font-semibold text-[#86868b]">첨부 자료</p>
                  {matchedFiles.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => goToProject(taskProjectId(f.taskId), f.taskId)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-[#f5f5f7]"
                    >
                      <Paperclip size={15} className="shrink-0 text-[#86868b]" />
                      <span className="min-w-0 flex-1 truncate text-sm text-[#1d1d1f]">{f.name}</span>
                      <span className="shrink-0 truncate text-xs text-[#86868b]">{taskName(f.taskId) || "업무"}</span>
                    </button>
                  ))}
                </div>
              )}

              {showSection("client") && matchedClients.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-1.5 text-xs font-semibold text-[#86868b]">클라이언트</p>
                  {matchedClients.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => goTo(`/clients/${c.id}`)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-[#f5f5f7]"
                    >
                      <Building2 size={15} className="shrink-0 text-[#86868b]" />
                      <span className="min-w-0 flex-1 truncate text-sm text-[#1d1d1f]">{c.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {showSection("quote") && matchedQuotes.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-1.5 text-xs font-semibold text-[#86868b]">견적 요청</p>
                  {matchedQuotes.map((qt) => (
                    <button
                      key={qt.id}
                      onClick={() => goTo("/quotes")}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-[#f5f5f7]"
                    >
                      <FileText size={15} className="shrink-0 text-[#86868b]" />
                      <span className="min-w-0 flex-1 truncate text-sm text-[#1d1d1f]">{qt.company || qt.name}</span>
                      <span className="shrink-0 truncate text-xs text-[#86868b]">{qt.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {showSection("order") && matchedOrders.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-1.5 text-xs font-semibold text-[#86868b]">발주</p>
                  {matchedOrders.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => goTo("/orders")}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-[#f5f5f7]"
                    >
                      <ShoppingCart size={15} className="shrink-0 text-[#86868b]" />
                      <span className="min-w-0 flex-1 truncate text-sm text-[#1d1d1f]">{o.clientName}</span>
                      <span className="shrink-0 truncate text-xs text-[#86868b]">{o.poNumber}</span>
                    </button>
                  ))}
                </div>
              )}

              {showSection("contract") && matchedContracts.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-1.5 text-xs font-semibold text-[#86868b]">계약</p>
                  {matchedContracts.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => goTo("/contracts")}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-[#f5f5f7]"
                    >
                      <FileSignature size={15} className="shrink-0 text-[#86868b]" />
                      <span className="min-w-0 flex-1 truncate text-sm text-[#1d1d1f]">{c.companyName}</span>
                      <span className="shrink-0 truncate text-xs text-[#86868b]">{c.title}</span>
                    </button>
                  ))}
                </div>
              )}

              {showSection("notice") && matchedNotices.length > 0 && (
                <div>
                  <p className="px-3 py-1.5 text-xs font-semibold text-[#86868b]">공지사항</p>
                  {matchedNotices.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => goTo("/notices")}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-[#f5f5f7]"
                    >
                      <Megaphone size={15} className="shrink-0 text-[#86868b]" />
                      <span className="min-w-0 flex-1 truncate text-sm text-[#1d1d1f]">{n.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
