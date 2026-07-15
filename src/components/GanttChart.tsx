"use client";

import { useMemo } from "react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { Task, TaskStatus } from "@/lib/types";
import { isOverdue } from "@/lib/bottleneck";

const LABEL_WIDTH = 220;
const DAY_WIDTH = 28;
const HEADER_HEIGHT = 36;
const ROW_HEIGHT = 44;
const BAR_HEIGHT = 24;
const PADDING_DAYS = 2;

const BAR_COLOR: Record<TaskStatus, string> = {
  pending: "bg-gray-300",
  todo: "bg-slate-400",
  in_progress: "bg-blue-500",
  done: "bg-green-500",
};

interface Props {
  tasks: Task[];
  onSelectTask?: (task: Task) => void;
}

export default function GanttChart({ tasks, onSelectTask }: Props) {
  const sorted = useMemo(() => [...tasks].sort((a, b) => a.order - b.order), [tasks]);

  const { minDate, totalDays } = useMemo(() => {
    if (sorted.length === 0) {
      const today = new Date();
      return { minDate: today, totalDays: 30 };
    }
    const starts = sorted.map((t) => parseISO(t.startDate));
    const ends = sorted.map((t) => parseISO(t.dueDate));
    const min = new Date(Math.min(...starts.map((d) => d.getTime())));
    const max = new Date(Math.max(...ends.map((d) => d.getTime())));
    const days = Math.max(differenceInCalendarDays(max, min) + PADDING_DAYS * 2, 14);
    return { minDate: addDays(min, -PADDING_DAYS), totalDays: days };
  }, [sorted]);

  const offsetOf = (dateStr: string) => differenceInCalendarDays(parseISO(dateStr), minDate);

  const totalWidth = totalDays * DAY_WIDTH;
  const bodyHeight = sorted.length * ROW_HEIGHT;

  const weekTicks = useMemo(() => {
    const ticks: { x: number; label: string }[] = [];
    for (let d = 0; d <= totalDays; d += 7) {
      ticks.push({ x: d * DAY_WIDTH, label: format(addDays(minDate, d), "M/d") });
    }
    return ticks;
  }, [minDate, totalDays]);

  const todayOffset = differenceInCalendarDays(new Date(), minDate);

  const rowIndexById = useMemo(() => {
    const map = new Map<string, number>();
    sorted.forEach((t, i) => map.set(t.id, i));
    return map;
  }, [sorted]);

  function barRect(task: Task, rowIndex: number) {
    const x = LABEL_WIDTH + offsetOf(task.startDate) * DAY_WIDTH;
    const widthDays = Math.max(differenceInCalendarDays(parseISO(task.dueDate), parseISO(task.startDate)), 1);
    const width = widthDays * DAY_WIDTH;
    const y = HEADER_HEIGHT + rowIndex * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2;
    return { x, width, y };
  }

  const dependencyPaths = useMemo(() => {
    const paths: { d: string; key: string }[] = [];
    sorted.forEach((task, rowIndex) => {
      task.dependsOn.forEach((depId) => {
        const depRowIndex = rowIndexById.get(depId);
        const depTask = sorted.find((t) => t.id === depId);
        if (depRowIndex === undefined || !depTask) return;
        const from = barRect(depTask, depRowIndex);
        const to = barRect(task, rowIndex);
        const startX = from.x + from.width;
        const startY = from.y + BAR_HEIGHT / 2;
        const endX = to.x;
        const endY = to.y + BAR_HEIGHT / 2;
        const midX = (startX + endX) / 2;
        paths.push({
          key: `${depId}-${task.id}`,
          d: `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`,
        });
      });
    });
    return paths;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted, rowIndexById]);

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
        등록된 업무가 없습니다. 업무 리스트 탭에서 업무를 추가해보세요.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <div
        className="relative"
        style={{ width: LABEL_WIDTH + totalWidth, height: HEADER_HEIGHT + bodyHeight }}
      >
        {/* 헤더: 날짜 눈금 */}
        <div
          className="sticky top-0 z-10 border-b border-gray-200 bg-white"
          style={{ height: HEADER_HEIGHT }}
        >
          <div
            className="absolute left-0 top-0 flex items-center border-r border-gray-200 bg-white px-3 text-xs font-medium text-gray-500"
            style={{ width: LABEL_WIDTH, height: HEADER_HEIGHT }}
          >
            업무명
          </div>
          {weekTicks.map((tick) => (
            <div
              key={tick.x}
              className="absolute top-0 flex h-full items-center border-l border-gray-100 pl-1 text-xs text-gray-400"
              style={{ left: LABEL_WIDTH + tick.x }}
            >
              {tick.label}
            </div>
          ))}
        </div>

        {/* 오늘 표시선 */}
        {todayOffset >= 0 && todayOffset <= totalDays && (
          <div
            className="absolute z-10 w-px bg-red-400"
            style={{ left: LABEL_WIDTH + todayOffset * DAY_WIDTH, top: HEADER_HEIGHT, height: bodyHeight }}
          />
        )}

        {/* 의존관계 선 */}
        <svg
          className="pointer-events-none absolute left-0 top-0"
          width={LABEL_WIDTH + totalWidth}
          height={HEADER_HEIGHT + bodyHeight}
        >
          {dependencyPaths.map((p) => (
            <path key={p.key} d={p.d} stroke="#b7bdd6" strokeWidth={1.5} fill="none" markerEnd="url(#arrow)" />
          ))}
          <defs>
            <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#b7bdd6" />
            </marker>
          </defs>
        </svg>

        {/* 행 (업무명 + 막대) */}
        {sorted.map((task, i) => {
          const rect = barRect(task, i);
          const overdue = isOverdue(task);
          return (
            <div key={task.id}>
              <div
                className="absolute flex items-center truncate border-b border-r border-gray-100 px-3 text-sm text-gray-700"
                style={{ left: 0, top: HEADER_HEIGHT + i * ROW_HEIGHT, width: LABEL_WIDTH, height: ROW_HEIGHT }}
                title={task.name}
              >
                {task.name}
              </div>
              <div
                className="absolute border-b border-gray-50"
                style={{ left: LABEL_WIDTH, top: HEADER_HEIGHT + i * ROW_HEIGHT, width: totalWidth, height: ROW_HEIGHT }}
              />
              <button
                onClick={() => onSelectTask?.(task)}
                className={`absolute flex items-center rounded-md px-2 text-xs font-medium text-white shadow-sm transition hover:opacity-90 ${BAR_COLOR[task.status]} ${
                  overdue ? "ring-2 ring-red-400" : ""
                }`}
                style={{ left: rect.x, top: rect.y, width: Math.max(rect.width, 8), height: BAR_HEIGHT }}
                title={`${task.name} (${task.startDate} ~ ${task.dueDate})`}
              >
                <span className="truncate">{task.progress}%</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
