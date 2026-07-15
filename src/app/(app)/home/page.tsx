"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenAllProjects, listenProjectsByClient, updateProject, deleteProject } from "@/lib/firestore/projects";
import { listenClients } from "@/lib/firestore/clients";
import { Project, Client, ProjectStatus, PROJECT_TYPE_LABEL } from "@/lib/types";

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "진행 중",
  on_hold: "보류",
  completed: "완료",
};

export default function HomePage() {
  const { appUser } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteInput, setDeleteInput] = useState("");

  const isAdmin = appUser?.role === "admin";

  useEffect(() => {
    if (!appUser) return;
    if (isAdmin) {
      const unsub1 = listenAllProjects((p) => {
        setProjects(p);
        setLoaded(true);
      });
      const unsub2 = listenClients(setClients);
      return () => {
        unsub1();
        unsub2();
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

  const clientName = (clientId: string) => clients.find((c) => c.id === clientId)?.name ?? clientId;
  const clientLogo = (clientId: string) => clients.find((c) => c.id === clientId)?.logoUrl;

  const sortedProjects = [...projects].sort((a, b) => {
    const ao = a.sortOrder ?? a.createdAt;
    const bo = b.sortOrder ?? b.createdAt;
    return ao - bo;
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
    return <p className="text-sm text-gray-400">불러오는 중...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#1d1d1f]">
          {isAdmin ? "전체 프로젝트 현황" : "내 프로젝트"}
        </h1>
        {isAdmin && (
          <Link
            href="/clients"
            className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1d1d1f]"
          >
            클라이언트 관리로 이동
          </Link>
        )}
      </div>

      {projects.length === 0 && (
        <div className="rounded-3xl border border-dashed border-[#d1d1d6] bg-white p-10 text-center text-sm text-[#86868b]">
          {isAdmin
            ? "아직 등록된 프로젝트가 없습니다. 클라이언트 관리에서 프로젝트를 생성해보세요."
            : "아직 배정된 프로젝트가 없습니다."}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sortedProjects.map((p, i) => (
          <div key={p.id} className="relative group rounded-3xl bg-white transition hover:shadow-md">
            <Link href={`/projects/${p.id}`} className="block p-6">
              {isAdmin && (
                <div className="mb-3 flex items-center gap-2">
                  {clientLogo(p.clientId) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={clientLogo(p.clientId)!}
                      alt=""
                      className="h-8 w-8 rounded-lg object-contain"
                    />
                  )}
                  <p className="text-xs font-medium text-[#86868b]">{clientName(p.clientId)}</p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-[#1d1d1f]">{p.name}</p>
                {p.projectType && p.projectType.map((t) => (
                  <span key={t} className="rounded-full bg-[#f5f5f7] px-2.5 py-0.5 text-xs text-[#1d1d1f]">
                    {PROJECT_TYPE_LABEL[t]}
                  </span>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-[#86868b]">{p.startDate} ~ {p.endDate}</p>
              <span className="mt-3 inline-block rounded-full bg-[#f5f5f7] px-2.5 py-0.5 text-xs text-[#86868b]">
                {STATUS_LABEL[p.status]}
              </span>
            </Link>
            {isAdmin && (
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button onClick={() => moveProject(i, -1)} disabled={i === 0} className="rounded-lg p-1 text-[#86868b] hover:bg-[#f5f5f7] disabled:opacity-30"><ChevronUp size={14} /></button>
                <button onClick={() => moveProject(i, 1)} disabled={i === sortedProjects.length - 1} className="rounded-lg p-1 text-[#86868b] hover:bg-[#f5f5f7] disabled:opacity-30"><ChevronDown size={14} /></button>
                <button onClick={() => setDeleteConfirm(p.id)} className="rounded-lg p-1 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
              </div>
            )}
          </div>
        ))}
      </div>

      {deleteConfirm && (
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
        </div>
      )}
    </div>
  );
}
