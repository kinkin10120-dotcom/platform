"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { ZoomIn, ZoomOut, Maximize2, EyeOff } from "lucide-react";
import { Task, TaskStatus } from "@/lib/types";
import { isOverdue } from "@/lib/bottleneck";
import { zh, usePartnerZh, useZhAutoTranslate } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";

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
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin";
  const isZh = usePartnerZh();
  // 업무명·그룹명은 관리자가 직접 입력한 자유 텍스트라 고정 UI 사전(zh)이 아니라 기계
  // 번역(useZhAutoTranslate)으로 처리한다 — 아직 번역 전이면 원문이 그대로 보인다.
  const zhNames = useZhAutoTranslate(
    isZh,
    Array.from(new Set([...tasks.map((t) => t.name), ...tasks.map((t) => t.group?.trim()).filter((g): g is string => !!g)]))
  );
  // cached는 저장 시점에 미리 번역해둔 값(nameZh/groupZh) — 있으면 그걸 우선 쓰고, 없으면
  // 화면에서 즉석 번역(zhNames)으로 대체한다.
  const trName = (s: string, cached?: string) => cached || zhNames[s] || s;
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

  // 같은 group 태그를 가진 업무는 기본적으로 한 줄(구간별 색 막대)로 묶어 보여주고,
  // 클릭하면 펼쳐서 개별 업무 줄로 볼 수 있다.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  function toggleGroup(name: string) {
    setOpenGroups((s) => ({ ...s, [name]: !s[name] }));
  }

  type GanttRow =
    | { kind: "task"; task: Task; indent?: boolean }
    | { kind: "group"; name: string; tasks: Task[]; startDate: string; dueDate: string; open: boolean };

  const rows = useMemo<GanttRow[]>(() => {
    const result: GanttRow[] = [];
    const seenGroups = new Set<string>();
    for (const t of sorted) {
      const g = t.group?.trim();
      if (!g) {
        result.push({ kind: "task", task: t });
        continue;
      }
      if (seenGroups.has(g)) continue;
      seenGroups.add(g);
      const members = sorted.filter((x) => (x.group?.trim() || "") === g);
      const startDate = members.reduce((min, m) => (m.startDate < min ? m.startDate : min), members[0].startDate);
      const dueDate = members.reduce((max, m) => (m.dueDate > max ? m.dueDate : max), members[0].dueDate);
      const open = !!openGroups[g];
      result.push({ kind: "group", name: g, tasks: members, startDate, dueDate, open });
      if (open) {
        members.forEach((m) => result.push({ kind: "task", task: m, indent: true }));
      }
    }
    return result;
  }, [sorted, openGroups]);

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
  const bodyHeight = rows.length * ROW_HEIGHT;

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
    rows.forEach((row, i) => {
      if (row.kind === "task") map.set(row.task.id, i);
      else if (!row.open) row.tasks.forEach((t) => map.set(t.id, i));
      // 펼쳐진 그룹의 구성원은 뒤이어 나오는 개별 "task" 행에서 각자 매핑된다.
    });
    return map;
  }, [rows]);

  function rectFor(startDate: string, dueDate: string, rowIndex: number, minBarWidth = 48) {
    const x = offsetOf(startDate) * dayWidth;
    const widthDays = Math.max(differenceInCalendarDays(parseISO(dueDate), parseISO(startDate)), 1);
    const width = Math.max(widthDays * dayWidth, minBarWidth);
    const y = HEADER_HEIGHT + rowIndex * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2;
    return { x, width, y };
  }

  function barRect(task: Task, rowIndex: number) {
    return rectFor(task.startDate, task.dueDate, rowIndex);
  }

  const dependencyPaths = useMemo(() => {
    const paths: { d: string; key: string }[] = [];
    sorted.forEach((task) => {
      const rowIndex = rowIndexById.get(task.id);
      if (rowIndex === undefined) return;
      task.dependsOn.forEach((depId) => {
        const depRowIndex = rowIndexById.get(depId);
        const depTask = sorted.find((t) => t.id === depId);
        if (depRowIndex === undefined || !depTask) return;
        if (depRowIndex === rowIndex) return; // 같은 그룹 줄 안의 의존관계는 화살표를 그리지 않는다
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
        {zh(isZh, "등록된 업무가 없습니다. 업무 리스트 탭에서 업무를 추가해보세요.")}
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
          title={zh(isZh, "전체 보기")}
        >
          <Maximize2 size={14} />
        </button>
        <button
          onClick={zoomOut}
          disabled={dayWidth <= DAY_WIDTH_MIN}
          className="rounded-full p-1.5 text-[#86868b] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f] disabled:opacity-30"
          title={zh(isZh, "축소")}
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={zoomIn}
          disabled={dayWidth >= DAY_WIDTH_MAX}
          className="rounded-full p-1.5 text-[#86868b] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f] disabled:opacity-30"
          title={zh(isZh, "확대")}
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
            {zh(isZh, "업무명")}
          </div>
          {rows.map((row) => (
            <div
              key={row.kind === "task" ? `${row.task.id}${row.indent ? "-nested" : ""}` : `group:${row.name}`}
              className={`flex items-center border-b border-[#f0f0f0] pr-3 text-sm text-[#1d1d1f] ${row.kind === "task" && row.indent ? "pl-9 sm:pl-11" : "pl-6 sm:pl-8"}`}
              style={{ height: ROW_HEIGHT }}
              title={row.kind === "task" ? trName(row.task.name, row.task.nameZh) : `${trName(row.name, row.tasks[0]?.groupZh)} (${row.tasks.length}${zh(isZh, "건")})`}
            >
              {row.kind === "task" ? (
                <button onClick={() => onSelectTask?.(row.task)} className="flex min-w-0 flex-1 items-center gap-1 truncate text-left font-medium text-[#1d1d1f] hover:underline">
                  {isAdmin && row.task.hiddenFromPartner && (
                    <EyeOff size={12} className="shrink-0 text-[#d1d1d6]" aria-label="협력사에게 숨김" />
                  )}
                  <span className="truncate">{trName(row.task.name, row.task.nameZh)}</span>
                </button>
              ) : (
                <button
                  onClick={() => toggleGroup(row.name)}
                  className="min-w-0 flex-1 truncate text-left font-medium text-[#1d1d1f] hover:underline"
                >
                  {trName(row.name, row.tasks[0]?.groupZh)} <span className="text-xs font-normal text-[#86868b]">({row.tasks.length}{zh(isZh, "건")})</span>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* 타임라인 — 이 영역만 가로 스크롤 */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto overscroll-x-contain">
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
            {rows.map((row, i) => {
              const rowDivider = (
                <div
                  className="absolute border-b border-[#f5f5f7]"
                  style={{ left: 0, top: HEADER_HEIGHT + i * ROW_HEIGHT, width: totalWidth, height: ROW_HEIGHT }}
                />
              );

              if (row.kind === "task") {
                const task = row.task;
                const rect = barRect(task, i);
                const overdue = isOverdue(task);
                return (
                  <div key={task.id}>
                    {rowDivider}
                    <button
                      onClick={() => onSelectTask?.(task)}
                      className={`absolute flex items-center rounded-full px-2 text-xs font-medium text-white shadow-sm transition hover:opacity-90 ${BAR_COLOR[task.status]} ${
                        overdue ? "ring-2 ring-red-400" : ""
                      }`}
                      style={{ left: rect.x, top: rect.y, width: rect.width, height: BAR_HEIGHT }}
                      title={`${trName(task.name, task.nameZh)} (${task.startDate} ~ ${task.dueDate})`}
                    >
                      {dayWidth >= 16 && <span className="truncate">{task.progress}%</span>}
                    </button>
                  </div>
                );
              }

              // 그룹 행이 펼쳐진 상태면 헤더 줄엔 막대를 그리지 않는다(구성원이 바로 아래
              // 개별 행으로 각자의 막대를 그린다).
              if (row.open) {
                return <div key={`group:${row.name}`}>{rowDivider}</div>;
              }

              // 그룹 행(접힘) — 전체 기간을 아우르는 한 줄 안에, 각 업무를 작은 색 알약으로 나눠 표시
              const groupRect = rectFor(row.startDate, row.dueDate, i, 24);
              const GAP = 3;
              return (
                <div key={`group:${row.name}`}>
                  {rowDivider}
                  <div
                    className="absolute"
                    style={{ left: groupRect.x, top: groupRect.y, width: groupRect.width, height: BAR_HEIGHT }}
                    title={`${trName(row.name, row.tasks[0]?.groupZh)} (${row.startDate} ~ ${row.dueDate})`}
                  >
                    {row.tasks.map((m) => {
                      const segX = offsetOf(m.startDate) * dayWidth - groupRect.x;
                      const segWidthDays = Math.max(differenceInCalendarDays(parseISO(m.dueDate), parseISO(m.startDate)), 1);
                      const rawWidth = Math.max(segWidthDays * dayWidth, 10);
                      const overdue = isOverdue(m);
                      return (
                        <button
                          key={m.id}
                          onClick={() => onSelectTask?.(m)}
                          className={`absolute top-0 flex h-full items-center overflow-hidden rounded-full px-2 text-xs font-medium text-white shadow-sm transition hover:opacity-90 ${BAR_COLOR[m.status]} ${
                            overdue ? "ring-2 ring-inset ring-red-400" : ""
                          }`}
                          style={{ left: segX + GAP / 2, width: Math.max(rawWidth - GAP, 6) }}
                          title={`${trName(m.name, m.nameZh)} (${m.startDate} ~ ${m.dueDate})`}
                        >
                          {dayWidth >= 16 && <span className="truncate">{m.progress}%</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
