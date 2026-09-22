"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Briefcase, ChevronDown, ExternalLink, Power } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  listenFreelanceJobs,
  updateFreelanceJobStatus,
  deleteFreelanceJob,
  listenFeedConfigs,
  addFeedConfig,
  updateFeedConfig,
  deleteFeedConfig,
} from "@/lib/firestore/freelanceJobs";
import { FreelanceJob, FreelanceJobStatus, FreelanceFeedConfig, FREELANCE_JOB_PLATFORM_LABEL } from "@/lib/types";

const STATUS_TABS: { key: FreelanceJobStatus | "all"; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "new", label: "새 공고" },
  { key: "reviewed", label: "검토함" },
  { key: "applied", label: "지원함" },
  { key: "dismissed", label: "보류" },
];

const STATUS_BADGE: Record<FreelanceJobStatus, string> = {
  new: "bg-blue-50 text-blue-600",
  reviewed: "bg-[#f5f5f7] text-[#86868b]",
  applied: "bg-green-50 text-green-600",
  dismissed: "bg-[#f5f5f7] text-[#86868b]",
};

const STATUS_LABEL: Record<FreelanceJobStatus, string> = {
  new: "새 공고",
  reviewed: "검토함",
  applied: "지원함",
  dismissed: "보류",
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

export default function FreelanceJobsPage() {
  const { appUser } = useAuth();
  const [jobs, setJobs] = useState<FreelanceJob[]>([]);
  const [configs, setConfigs] = useState<FreelanceFeedConfig[]>([]);
  const [statusFilter, setStatusFilter] = useState<FreelanceJobStatus | "all">("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => listenFreelanceJobs(setJobs), []);
  useEffect(() => listenFeedConfigs(setConfigs), []);

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAddConfig() {
    if (!newLabel.trim() || !newUrl.trim()) return;
    setSubmitting(true);
    try {
      await addFeedConfig("upwork", newLabel.trim(), newUrl.trim());
      setNewLabel("");
      setNewUrl("");
      setShowConfigForm(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (appUser?.role !== "admin") {
    return <p className="text-sm text-[#86868b]">접근 권한이 없습니다.</p>;
  }

  const filteredJobs = statusFilter === "all" ? jobs : jobs.filter((j) => j.status === statusFilter);
  const newCount = jobs.filter((j) => j.status === "new").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-[#1d1d1f]">
            <span className="h-2 w-2 rounded-full bg-[#1d1d1f]" />
            입찰 공고
          </h1>
          <p className="mt-1 pl-4 text-sm text-[#86868b]">
            저장 검색 RSS 피드에서 자동으로 가져와 한글로 번역한 공고입니다. 새 공고 {newCount}건.
          </p>
        </div>
        <button
          onClick={() => setShowConfigForm((v) => !v)}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 self-start whitespace-nowrap rounded-full bg-[#1d1d1f] px-4 text-sm font-medium text-white transition hover:bg-black"
        >
          <Plus size={15} /> 피드 관리
        </button>
      </div>

      {showConfigForm && (
        <div className="space-y-4 rounded-3xl bg-white p-5">
          <div>
            <p className="mb-3 text-sm font-semibold text-[#1d1d1f]">수집할 RSS 피드</p>
            <p className="mb-3 text-xs text-[#86868b] leading-relaxed">
              Upwork에서 원하는 키워드로 검색 후 저장 검색(Saved Search)으로 등록하고, 그 검색의 RSS 피드 주소를
              복사해 아래에 추가하세요. 30분마다 새 공고를 자동으로 가져옵니다.
            </p>
            {configs.length > 0 && (
              <div className="mb-3 space-y-2">
                {configs.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 rounded-xl bg-[#f5f5f7] px-3 py-2">
                    <button
                      onClick={() => updateFeedConfig(c.id, { enabled: !c.enabled })}
                      title={c.enabled ? "비활성화" : "활성화"}
                      className={`shrink-0 rounded-full p-1 ${c.enabled ? "text-green-600" : "text-[#d1d1d6]"}`}
                    >
                      <Power size={14} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#1d1d1f]">
                        {FREELANCE_JOB_PLATFORM_LABEL[c.platform]} · {c.label}
                      </p>
                      <p className="truncate text-xs text-[#86868b]">{c.url}</p>
                    </div>
                    <button onClick={() => deleteFeedConfig(c.id)} className="shrink-0 text-[#86868b] hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#86868b]">이름 (예: 판금·기구설계)</label>
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
                placeholder="검색 이름"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#86868b]">RSS 피드 URL</label>
              <input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
                placeholder="https://www.upwork.com/ab/feed/jobs/rss?..."
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddConfig}
              disabled={submitting || !newLabel.trim() || !newUrl.trim()}
              className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
            >
              {submitting ? "추가 중..." : "추가"}
            </button>
            <button
              onClick={() => setShowConfigForm(false)}
              className="rounded-full border border-[#d1d1d6] px-4 py-2 text-sm text-[#1d1d1f] hover:bg-[#f5f5f7]"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              statusFilter === t.key ? "bg-[#1d1d1f] text-white" : "bg-white text-[#86868b] hover:bg-[#f5f5f7]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filteredJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#d1d1d6] bg-white py-16 text-center">
          <Briefcase size={32} className="mb-3 text-[#d1d1d6]" />
          <p className="text-sm text-[#86868b]">
            {configs.length === 0 ? "아직 등록된 RSS 피드가 없습니다. 피드 관리에서 추가해보세요." : "표시할 공고가 없습니다."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((j) => {
            const expanded = expandedIds.has(j.id);
            return (
              <div key={j.id} className="group rounded-3xl bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <button onClick={() => toggleExpanded(j.id)} className="min-w-0 flex-1 text-left">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[j.status]}`}>
                        {STATUS_LABEL[j.status]}
                      </span>
                      <span className="rounded-full bg-[#f5f5f7] px-2 py-0.5 text-[10px] font-medium text-[#86868b]">
                        {FREELANCE_JOB_PLATFORM_LABEL[j.platform]}
                      </span>
                      <span className="text-xs text-[#86868b]">{formatDate(j.postedAt)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <p className="font-semibold text-[#1d1d1f]">{j.titleKo}</p>
                      <ChevronDown size={14} className={`shrink-0 text-[#86868b] transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </div>
                    <p className="truncate text-xs text-[#86868b]">{j.title}</p>
                    {expanded && (
                      <div className="mt-3 space-y-2">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#1d1d1f]">{j.descriptionKo}</p>
                        <details className="text-xs text-[#86868b]">
                          <summary className="cursor-pointer select-none">원문 보기</summary>
                          <p className="mt-1.5 whitespace-pre-wrap leading-relaxed">{j.description}</p>
                        </details>
                      </div>
                    )}
                  </button>
                  <button onClick={() => deleteFreelanceJob(j.id)} className="shrink-0 text-[#d1d1d6] opacity-0 transition group-hover:opacity-100 hover:text-red-500">
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 pl-0">
                  <a
                    href={j.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full bg-[#1d1d1f] px-3 py-1.5 text-xs font-medium text-white hover:bg-black"
                  >
                    <ExternalLink size={12} /> 원본 공고 열기
                  </a>
                  {(["reviewed", "applied", "dismissed"] as const)
                    .filter((s) => s !== j.status)
                    .map((s) => (
                      <button
                        key={s}
                        onClick={() => updateFreelanceJobStatus(j.id, s)}
                        className="rounded-full border border-[#d1d1d6] px-3 py-1.5 text-xs text-[#1d1d1f] hover:bg-[#f5f5f7]"
                      >
                        {STATUS_LABEL[s]}로 표시
                      </button>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
