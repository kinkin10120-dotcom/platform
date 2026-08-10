"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Task, TaskStatus } from "@/lib/types";
import { isOverdue } from "@/lib/bottleneck";

const LABEL_WIDTH_DESKTOP = 220;
const LABEL_WIDTH_MOBILE = 132;
const DAY_WIDTH_DEFAULT = 28;
const DAY_WIDTH_MIN = 6;
const DAY_WIDTH_MAX = 40;
const HEADER_HEIGHT = 36;
const ROW_HEIGHT = 44;
const BAR_HEIGHT = 24;
const PADDING_DAYS = 2;

const BAR_COLOR: Record<TaskStatus, string> = {
  pending: "bg-[#d1d1d6]",
  todo: "bg-slate-400",
  in_progress: "bg-blue-500",
  done: "bg-green-500",
  on_hold: "bg-amber-400",
};

interface Props {
  tasks: Task[];
  onSelectTask?: (task: Task) => void;
}

export default function GanttChart({ tasks, onSelectTask }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [labelWidth, setLabelWidth] = useState(LABEL_WIDTH_DESKTOP);
  const [isMobile, setIsMobile] = useState(false);
  const [zoomOverride, setZoomOverride] = useState<number | null>(null);

  useEffect(() => {
    const updateForWidth = () => {
      const mobile = window.innerWidth < 640;
      setIsMobile(mobile);
      setLabelWidth(mobile ? LABEL_WIDTH_MOBILE : LABEL_WIDTH_DESKTOP);
    };
    updateForWidth();
    window.addEventListener("resize", updateForWidth);
    return () => window.removeEventListener("resize", updateForWidth);
  }, []);

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

  // 모바일에서는 기본적으로 전체 일정이 가로 스크롤 없이 한 화면에 들어오도록 자동 축소한다.
  const [autoFitWidth, setAutoFitWidth] = useState(DAY_WIDTH_DEFAULT);
  useLayoutEffect(() => {
    if (!isMobile || !scrollRef.current) {
      setAutoFitWidth(DAY_WIDTH_DEFAULT);
      return;
    }
    const available = scrollRef.current.clientWidth;
    const fit = Math.max(DAY_WIDTH_MIN, Math.min(DAY_WIDTH_DEFAULT, Math.floor(available / totalDays)));
    setAutoFitWidth(fit);
  }, [isMobile, totalDays, labelWidth]);

  const dayWidth = zoomOverride ?? autoFitWidth;

  function zoomIn() {
    setZoomOverride(Math.min(DAY_WIDTH_MAX, dayWidth + 6));
  }
  function zoomOut() {
    setZoomOverride(Math.max(DAY_WIDTH_MIN, dayWidth - 6));
  }
  function resetZoom() {
    setZoomOverride(null);
  }

  const offsetOf = (dateStr: string) => differenceInCalendarDays(parseISO(dateStr), minDate);

  const totalWidth = totalDays * dayWidth;
  const bodyHeight = sorted.length * ROW_HEIGHT;

  const weekTicks = useMemo(() => {
    const ticks: { x: number; label: string }[] = [];
    for (let d = 0; d <= totalDays; d += 7) {
      ticks.push({ x: d * dayWidth, label: format(addDays(minDate, d), "M/d") });
    }
    return ticks;
  }, [minDate, totalDays, dayWidth]);

  const todayOffset = differenceInCalendarDays(new Date(), minDate);

  // 오늘 날짜가 보이도록 타임라인을 자동으로 스크롤
  useEffect(() => {
    if (!scrollRef.current) return;
    if (todayOffset < 0 || todayOffset > totalDays) return;
    const targetLeft = Math.max(todayOffset * dayWidth - 80, 0);
    scrollRef.current.scrollLeft = targetLeft;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted.length, dayWidth]);

  const rowIndexById = useMemo(() => {
    const map = new Map<string, number>();
    sorted.forEach((t, i) => map.set(t.id, i));
    return map;
  }, [sorted]);

  function barRect(task: Task, rowIndex: number) {
    const x = offsetOf(task.startDate) * dayWidth;
    const widthDays = Math.max(differenceInCalendarDays(parseISO(task.dueDate), parseISO(task.startDate)), 1);
    const width = widthDays * dayWidth;
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
  }, [sorted, rowIndexById, dayWidth]);

  if (sorted.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-[#d1d1d6] bg-white p-10 text-center text-sm text-[#86868b]">
        등록된 업무가 없습니다. 업무 리스트 탭에서 업무를 추가해보세요.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* 확대/축소 컨트롤 */}
      <div className="flex items-center justify-end gap-1">
        <button
          onClick={resetZoom}
          className="rounded-full p-1.5 text-[#86868b] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
          title="전체 보기"
        >
          <Maximize2 size={14} />
        </button>
        <button
          onClick={zoomOut}
          disabled={dayWidth <= DAY_WIDTH_MIN}
          className="rounded-full p-1.5 text-[#86868b] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f] disabled:opacity-30"
          title="축소"
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={zoomIn}
          disabled={dayWidth >= DAY_WIDTH_MAX}
          className="rounded-full p-1.5 text-[#86868b] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f] disabled:opacity-30"
          title="확대"
        >
          <ZoomIn size={14} />
        </button>
      </div>

      <div className="flex overflow-hidden rounded-3xl bg-white">
        {/* 고정 업무명 컬럼 — 가로 스크롤과 무관하게 항상 보임 */}
        <div className="shrink-0 border-r border-[#e5e5e5]" style={{ width: labelWidth }}>
          <div
            className="flex items-center border-b border-[#e5e5e5] bg-[#ececef] pl-6 pr-3 text-sm font-medium text-[#86868b] sm:pl-8"
            style={{ height: HEADER_HEIGHT }}
          >
            업무명
          </div>
          {sorted.map((task) => (
            <div
              key={task.id}
              className="flex items-center border-b border-[#f0f0f0] pl-6 pr-3 text-sm text-[#1d1d1f] sm:pl-8"
              style={{ height: ROW_HEIGHT }}
              title={task.name}
            >
              <button onClick={() => onSelectTask?.(task)} className="min-w-0 flex-1 truncate text-left font-medium text-[#1d1d1f] hover:underline">
                {task.name}
              </button>
            </div>
          ))}
        </div>

        {/* 타임라인 — 이 영역만 가로 스크롤 */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto">
          <div className="relative" style={{ width: totalWidth, minWidth: "100%", height: HEADER_HEIGHT + bodyHeight }}>
            {/* 헤더: 날짜 눈금 */}
            <div
              className="sticky top-0 z-10 border-b border-[#e5e5e5] bg-[#ececef]"
              style={{ height: HEADER_HEIGHT, width: totalWidth, minWidth: "100%" }}
            >
              {weekTicks.map((tick) => (
                <div
                  key={tick.x}
                  className="absolute top-0 flex h-full items-center border-l border-[#f0f0f0] pl-1 text-xs text-[#86868b]"
                  style={{ left: tick.x }}
                >
                  {tick.label}
                </div>
              ))}
            </div>

            {/* 오늘 표시선 */}
            {todayOffset >= 0 && todayOffset <= totalDays && (
              <div
                className="absolute z-10 w-px bg-red-400"
                style={{ left: todayOffset * dayWidth, top: HEADER_HEIGHT, height: bodyHeight }}
              />
            )}

            {/* 의존관계 선 */}
            <svg className="pointer-events-none absolute left-0 top-0" width={totalWidth} height={HEADER_HEIGHT + bodyHeight}>
              {dependencyPaths.map((p) => (
                <path key={p.key} d={p.d} stroke="#b7bdd6" strokeWidth={1.5} fill="none" markerEnd="url(#arrow)" />
              ))}
              <defs>
                <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#b7bdd6" />
                </marker>
              </defs>
            </svg>

            {/* 행 (막대) */}
            {sorted.map((task, i) => {
              const rect = barRect(task, i);
              const overdue = isOverdue(task);
              return (
                <div key={task.id}>
                  <div
                    className="absolute border-b border-[#f5f5f7]"
                    style={{ left: 0, top: HEADER_HEIGHT + i * ROW_HEIGHT, width: totalWidth, height: ROW_HEIGHT }}
                  />
                  <button
                    onClick={() => onSelectTask?.(task)}
                    className={`absolute flex items-center rounded-full px-2 text-xs font-medium text-white shadow-sm transition hover:opacity-90 ${BAR_COLOR[task.status]} ${
                      overdue ? "ring-2 ring-red-400" : ""
                    }`}
                    style={{ left: rect.x, top: rect.y, width: Math.max(rect.width, 8), height: BAR_HEIGHT }}
                    title={`${task.name} (${task.startDate} ~ ${task.dueDate})`}
                  >
                    {dayWidth >= 16 && <span className="truncate">{task.progress}%</span>}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
