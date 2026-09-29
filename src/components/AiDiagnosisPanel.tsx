"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Project, Task } from "@/lib/types";
import { isOverdue, isDueSoon, computeProjectProgress } from "@/lib/bottleneck";
import { getComments } from "@/lib/firestore/comments";
import { zh, usePartnerZh } from "@/lib/i18n";

interface AiInsight {
  summary: string;
  riskLevel: "low" | "medium" | "high";
}

const RISK_LABEL: Record<AiInsight["riskLevel"], string> = { low: "양호", medium: "주의", high: "위험" };
const RISK_STYLE: Record<AiInsight["riskLevel"], string> = {
  low: "bg-green-50 text-green-600",
  medium: "bg-amber-50 text-amber-600",
  high: "bg-red-50 text-red-600",
};

export default function AiDiagnosisPanel({ project, tasks }: { project: Project; tasks: Task[] }) {
  const isZh = usePartnerZh();
  const [aiInsight, setAiInsight] = useState<AiInsight | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  async function handleAiDiagnose() {
    setAiLoading(true);
    setAiError("");
    try {
      const overdueTasks = tasks.filter(isOverdue);
      const dueSoonTasks = tasks.filter((t) => isDueSoon(t) && !isOverdue(t));
      const progress = computeProjectProgress(tasks);

      const today = new Date();

      // 프로젝트 전체 기간의 경과율이 아니라, 업무 하나하나를 "자기 일정 기준으로" 지금쯤
      // 얼마나 진행돼 있어야 하는지 평균낸다. 예: 3주짜리 업무가 마지막 날에만 결과물을
      // 등록해 체크리스트가 완료되는 경우, 앞선 준비 기간(아직 마감 전)은 정상 상태이지
      // 위험 신호가 아니다 — 프로젝트 전체 경과율과 단순 비교하면 이런 준비 기간까지
      // "뒤처짐"으로 오판하게 된다.
      const expectedProgressPercent = (() => {
        if (tasks.length === 0) return 0;
        const now = today.getTime();
        const sum = tasks.reduce((acc, t) => {
          const s = new Date(`${t.startDate}T00:00:00`).getTime();
          const d = new Date(`${t.dueDate}T00:00:00`).getTime();
          if (now <= s) return acc;
          if (now >= d || d <= s) return acc + 100;
          return acc + ((now - s) / (d - s)) * 100;
        }, 0);
        return Math.round(sum / tasks.length);
      })();

      const checklistTotal = tasks.reduce((s, t) => s + (t.checklist?.length ?? 0), 0);
      const checklistDone = tasks.reduce((s, t) => s + (t.checklist?.filter((c) => c.done).length ?? 0), 0);

      // 지연/임박 업무에 남겨진 코멘트를 지연 사유 근거로 함께 전달한다(관리자/담당자가 직접 쓴 텍스트만 사용).
      const atRiskTasks = [...overdueTasks, ...dueSoonTasks];
      const delayContext = (
        await Promise.all(
          atRiskTasks.map(async (t) => {
            const comments = await getComments(t.id);
            if (comments.length === 0) return null;
            return {
              taskName: t.name,
              taskStatus: t.status,
              comments: comments.slice(-5).map((c) => ({
                author: c.authorRole === "admin" ? "운영팀" : "클라이언트",
                text: c.text,
              })),
            };
          })
        )
      ).filter((v): v is NonNullable<typeof v> => v !== null);

      const stats = {
        totalTasks: tasks.length,
        doneTasks: tasks.filter((t) => t.status === "done").length,
        inProgressTasks: tasks.filter((t) => t.status === "in_progress").length,
        todoTasks: tasks.filter((t) => t.status === "todo").length,
        pendingTasks: tasks.filter((t) => t.status === "pending").length,
        overdueTaskCount: overdueTasks.length,
        dueSoonTaskCount: dueSoonTasks.length,
        averageProgressPercent: progress,
        projectStartDate: project.startDate,
        projectEndDate: project.endDate,
        todayDate: today.toLocaleDateString("en-CA"),
        expectedProgressPercent,
        checklistCompletion: checklistTotal > 0 ? `${checklistDone}/${checklistTotal} 완료` : "등록된 체크리스트 없음",
        delayContext: delayContext.length > 0 ? delayContext : "지연/임박 업무에 등록된 코멘트가 없음",
      };

      const res = await fetch("/api/project-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...stats, lang: isZh ? "zh" : "ko" }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "진단에 실패했습니다.");
      setAiInsight(data);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "진단 중 오류가 발생했습니다.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#1d1d1f]">{zh(isZh, "AI 진단")}</h3>
          <p className="mt-0.5 text-xs text-[#86868b]">{zh(isZh, "실제 데이터 수치만 근거로 생성되는 참고 의견입니다")}</p>
        </div>
        <button
          onClick={handleAiDiagnose}
          disabled={aiLoading}
          className="flex w-[110px] shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#1d1d1f] px-4 py-2 text-xs font-medium text-white hover:bg-black disabled:opacity-60"
        >
          {aiLoading ? (
            <span key="loading" className="flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin" />
              {zh(isZh, "진단 중...")}
            </span>
          ) : (
            <span key="idle" className="flex items-center gap-1.5">
              <Sparkles size={13} />
              {aiInsight ? zh(isZh, "다시 진단") : zh(isZh, "AI 진단하기")}
            </span>
          )}
        </button>
      </div>

      {aiError && <p className="mt-3 text-xs text-red-500">{aiError}</p>}

      {aiInsight && (
        <div className="mt-4 space-y-3 border-t border-[#f0f0f0] pt-4">
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${RISK_STYLE[aiInsight.riskLevel]}`}>
            {zh(isZh, RISK_LABEL[aiInsight.riskLevel])}
          </span>
          <p className="text-sm leading-relaxed text-[#1d1d1f]">{aiInsight.summary}</p>
          <p className="text-[10px] text-[#d1d1d6]">{zh(isZh, "* AI가 자동 생성한 참고 의견입니다.")}</p>
        </div>
      )}
    </div>
  );
}
