"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ko, zhCN } from "date-fns/locale";
import { ArrowUpRight, MessageSquare } from "lucide-react";
import { listenComments } from "@/lib/firestore/comments";
import { Task, TaskComment } from "@/lib/types";
import { zh, usePartnerZh, useZhAutoTranslate } from "@/lib/i18n";

interface FeedComment extends TaskComment {
  taskName: string;
}

export default function ProjectCommentsTab({ tasks, onSelectTask }: { tasks: Task[]; onSelectTask: (task: Task) => void }) {
  const isZh = usePartnerZh();
  const [byTask, setByTask] = useState<Record<string, FeedComment[]>>({});
  const zhNames = useZhAutoTranslate(isZh, tasks.map((t) => t.name));

  useEffect(() => {
    const unsubs = tasks.map((t) =>
      listenComments(t.id, (comments) => {
        setByTask((prev) => ({
          ...prev,
          [t.id]: comments.map((c) => ({ ...c, taskName: t.name })),
        }));
      })
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.map((t) => t.id).join(",")]);

  const feed = Object.values(byTask)
    .flat()
    .sort((a, b) => b.createdAt - a.createdAt);

  if (feed.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-[#d1d1d6] bg-white p-10 text-center text-sm text-[#86868b]">
        {zh(isZh, "아직 등록된 코멘트가 없습니다.")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {feed.map((c) => {
        const task = tasks.find((t) => t.id === c.taskId);
        return (
          <div key={`${c.taskId}-${c.id}`} className="rounded-2xl bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-[#1d1d1f]">
                {c.authorName}
                <span className="ml-1 text-xs text-[#86868b]">
                  {zh(isZh, c.authorRole === "admin" ? "(운영팀)" : c.authorRole === "claude-auto" ? "(Claude 자동)" : c.authorRole === "partner" ? "(협력사)" : "(클라이언트)")}
                </span>
              </span>
              <span className="shrink-0 text-xs text-[#d1d1d6]">
                {formatDistanceToNow(c.createdAt, { addSuffix: true, locale: isZh ? zhCN : ko })}
              </span>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-[#1d1d1f]">{c.text}</p>
            <button
              onClick={() => task && onSelectTask(task)}
              disabled={!task}
              className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-[#f5f5f7] px-2.5 py-1 text-xs font-medium text-[#86868b] transition hover:bg-[#eeeef0] hover:text-[#1d1d1f] disabled:opacity-40"
            >
              <MessageSquare size={11} />
              {zhNames[c.taskName] ?? c.taskName}
              <ArrowUpRight size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
