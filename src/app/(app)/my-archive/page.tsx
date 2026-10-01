"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenProject } from "@/lib/firestore/projects";
import { listenTasksByProject } from "@/lib/firestore/tasks";
import { Project, Task } from "@/lib/types";
import { zh, usePartnerZh, useZhAutoTranslate } from "@/lib/i18n";
import PartnerArchiveTab from "@/components/PartnerArchiveTab";

// 협력사(파트너) 계정 전용 — 사이드바에서 바로 들어올 수 있는 자료함. 한 협력사가 프로젝트를
// 여러 개 동시에 진행하는 경우가 많아, 매번 홈에서 프로젝트를 먼저 찾아 들어가 탭을 눌러야
// 했던 걸 단축한다. 내용 자체는 프로젝트 상세의 "협력사" 탭(PartnerArchiveTab)과 완전히
// 같은 컴포넌트를 그대로 쓴다 — 관리자/고객 노출 범위도 그쪽과 동일하게 유지된다.
export default function MyArchivePage() {
  const { appUser } = useAuth();
  const isZh = usePartnerZh();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (!appUser) return;
    const ids = appUser.projectIds ?? [];
    if (ids.length === 0) {
      setProjects([]);
      setLoaded(true);
      return;
    }
    const results: Record<string, Project> = {};
    const unsubs = ids.map((id) =>
      listenProject(id, (p) => {
        if (p) results[id] = p;
        else delete results[id];
        setProjects(Object.values(results));
        setLoaded(true);
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [appUser]);

  const zhNames = useZhAutoTranslate(isZh, projects.map((p) => p.name));
  const trName = (p: Project) => (isZh && p.nameZh) || zhNames[p.name] || p.name;

  useEffect(() => {
    if (projects.length > 0 && !selectedId) setSelectedId(projects[0].id);
  }, [projects, selectedId]);

  // 자료함의 "관련 업무" 선택지용 — hiddenFromPartner는 list 규칙에서 걸러줄 수 없어 앱에서 거른다.
  useEffect(() => {
    if (!selectedId) return;
    return listenTasksByProject(selectedId, (ts) => setTasks(ts.filter((t) => !t.hiddenFromPartner)));
  }, [selectedId]);

  if (!loaded) {
    return <p className="text-sm text-[#86868b]">{zh(isZh, "불러오는 중...")}</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-[#1d1d1f]">
          <Lock size={16} />
          {zh(isZh, "자료함")}
        </h1>
        <p className="mt-1 pl-6 text-sm text-[#86868b]">
          {zh(isZh, "관리자와 나만 보는 프로젝트별 자료·코멘트입니다. 고객에게는 노출되지 않습니다.")}
        </p>
      </div>

      {projects.length === 0 && (
        <div className="rounded-3xl border border-dashed border-[#d1d1d6] bg-white p-10 text-center text-sm text-[#86868b]">
          {zh(isZh, "아직 배정된 프로젝트가 없습니다.")}
        </div>
      )}

      {projects.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                selectedId === p.id ? "bg-[#1d1d1f] text-white" : "bg-white text-[#86868b] hover:text-[#1d1d1f]"
              }`}
            >
              {trName(p)}
            </button>
          ))}
        </div>
      )}

      {selectedId && (
        <div className="rounded-3xl bg-white p-5">
          {projects.length > 1 && (
            <p className="mb-4 text-sm font-semibold text-[#1d1d1f]">
              {trName(projects.find((p) => p.id === selectedId)!)}
            </p>
          )}
          <PartnerArchiveTab projectId={selectedId} tasks={tasks} />
        </div>
      )}
    </div>
  );
}
