"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Trash2, CalendarDays, UserRound, Flag, ListTodo, GitBranch, Paperclip, MessageSquare, History, AlertCircle, ChevronDown, EyeOff } from "lucide-react";
import { ChecklistItem, Task, TaskStatus, TASK_STATUS_LABEL, TASK_STATUS_ORDER, AppUser } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { updateTaskFields, updateTaskDates, updateTaskStatus, assignTask, updateChecklist, deleteTask, requestTaskDecision, resolveTaskDecision, updateOpenDecisionNote, deleteDecisionHistoryEntry, updateTaskDependsOn } from "@/lib/firestore/tasks";
import { isOverdue, isDueSoon } from "@/lib/bottleneck";
import StatusBadge from "@/components/StatusBadge";
import CommentThread from "@/components/CommentThread";
import FileUploader from "@/components/FileUploader";
import { zh, usePartnerZh } from "@/lib/i18n";

interface Props {
  task: Task;
  allTasks: Task[];
  assigneeOptions: AppUser[];
  onClose: () => void;
}

export default function TaskDetailDrawer({ task, allTasks, assigneeOptions, onClose }: Props) {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin";
  const isZh = usePartnerZh();

  const [name, setName] = useState(task.name);
  const [description, setDescription] = useState(task.description ?? "");
  const [group, setGroup] = useState(task.group ?? "");
  const groupMeasureRef = useRef<HTMLSpanElement>(null);
  const [groupChipWidth, setGroupChipWidth] = useState(64);

  useLayoutEffect(() => {
    if (groupMeasureRef.current) {
      setGroupChipWidth(groupMeasureRef.current.offsetWidth + 22);
    }
  }, [group]);
  const [startDate, setStartDate] = useState(task.startDate);
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [progress, setProgress] = useState(task.progress);
  const [saving, setSaving] = useState(false);
  const [newChecklistText, setNewChecklistText] = useState("");
  const [shiftMessage, setShiftMessage] = useState("");
  const [showDecisionForm, setShowDecisionForm] = useState(false);
  const [decisionNote, setDecisionNote] = useState("");
  const [responseNote, setResponseNote] = useState("");
  const [decisionError, setDecisionError] = useState("");
  const [editingNote, setEditingNote] = useState(false);
  const [editNoteText, setEditNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  function toggleSection(key: string) {
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));
  }

  useEffect(() => {
    setName(task.name);
    setDescription(task.description ?? "");
    setGroup(task.group ?? "");
    setStartDate(task.startDate);
    setDueDate(task.dueDate);
    setProgress(task.progress);
  }, [task.id, task.name, task.description, task.group, task.startDate, task.dueDate, task.progress]);

  const dependsOnTasks = allTasks.filter((t) => task.dependsOn.includes(t.id));
  const dependsOnEntries = dependsOnTasks.map((t) => ({ id: t.id, task: t }));
  const existingGroups = Array.from(
    new Set(allTasks.map((t) => t.group?.trim()).filter((g): g is string => !!g && g !== task.group))
  );

  // 선행 업무로 지정된 업무가 삭제되어 dependsOn에 유령 id만 남아있는 경우, 화면엔 아예
  // 안 보이게 하고(위 dependsOnEntries가 이미 걸러줌) 조용히 정리해 데이터도 맞춰둔다.
  // 정리 자체가 관리자 전용 쓰기(선행 업무 변경)라 클라이언트가 실행하면 어차피 권한 거부로
  // 실패하고, 내부적으로 도는 업무 조회도 규칙상 클라이언트에겐 거부된다 — 관리자만 실행한다.
  useEffect(() => {
    if (!isAdmin) return;
    const danglingIds = task.dependsOn.filter((id) => !allTasks.some((t) => t.id === id));
    if (danglingIds.length === 0) return;
    updateTaskDependsOn(task, task.dependsOn.filter((id) => !danglingIds.includes(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, task.id, task.dependsOn.join(","), allTasks.length]);
  const overdue = isOverdue(task);
  const dueSoon = isDueSoon(task);

  // candidateId가 (직접 또는 간접적으로) task에 이미 의존하고 있는지 확인 — 순환 의존 방지용
  function dependsOnTransitively(candidateId: string, targetId: string, seen = new Set<string>()): boolean {
    if (seen.has(candidateId)) return false;
    seen.add(candidateId);
    const t = allTasks.find((x) => x.id === candidateId);
    if (!t) return false;
    if (t.dependsOn.includes(targetId)) return true;
    return t.dependsOn.some((depId) => dependsOnTransitively(depId, targetId, seen));
  }

  const dependencyCandidates = allTasks.filter(
    (t) => t.id !== task.id && !task.dependsOn.includes(t.id) && !dependsOnTransitively(t.id, task.id)
  );

  async function handleAddDependency(depId: string) {
    if (!depId) return;
    await updateTaskDependsOn(task, [...task.dependsOn, depId]);
  }

  async function handleRemoveDependency(depId: string) {
    await updateTaskDependsOn(task, task.dependsOn.filter((id) => id !== depId));
  }

  async function handleDelete() {
    if (!confirm(`"${task.name}" 업무를 삭제하시겠습니까?\n첨부파일과 댓글도 함께 삭제되며 복구할 수 없습니다.`)) return;
    await deleteTask(task);
    onClose();
  }

  async function handleToggleHiddenFromPartner() {
    await updateTaskFields(task.id, { hiddenFromPartner: !task.hiddenFromPartner });
  }

  async function handleSaveBasics() {
    setSaving(true);
    try {
      await updateTaskFields(task.id, { name, description, group });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDates() {
    if (startDate === task.startDate && dueDate === task.dueDate) return;
    setSaving(true);
    try {
      const result = await updateTaskDates(task, startDate, dueDate, allTasks, appUser?.name ?? "알 수 없음", appUser?.uid);
      if (result.shiftedCount > 0) {
        const direction = result.deltaDays > 0 ? "지연" : "단축";
        setShiftMessage(`후속 업무 ${result.shiftedCount}건 일정이 ${Math.abs(result.deltaDays)}일 함께 ${direction}됐습니다.`);
        setTimeout(() => setShiftMessage(""), 4000);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(status: TaskStatus) {
    if (!appUser) return;
    await updateTaskStatus(task, status, appUser.name);
  }

  const openDecision = [...(task.decisionHistory ?? [])].reverse().find((h) => !h.decidedAt);

  async function handleRequestDecision() {
    if (!appUser || !decisionNote.trim()) return;
    setDecisionError("");
    try {
      await requestTaskDecision(task, decisionNote.trim(), appUser.uid, appUser.name);
      setDecisionNote("");
      setShowDecisionForm(false);
    } catch (e) {
      setDecisionError(e instanceof Error ? e.message : "요청 처리 중 오류가 발생했습니다.");
    }
  }

  async function handleCancelDecision() {
    if (!appUser) return;
    setDecisionError("");
    try {
      await resolveTaskDecision(task, appUser.uid, appUser.name, undefined, "cancelled");
    } catch (e) {
      setDecisionError(e instanceof Error ? e.message : "요청 취소 중 오류가 발생했습니다.");
    }
  }

  async function handleDeleteDecisionEntry(originalIndex: number) {
    if (!confirm("이 확인/승인 이력을 삭제하시겠습니까?")) return;
    try {
      await deleteDecisionHistoryEntry(task, originalIndex);
    } catch (e) {
      setDecisionError(e instanceof Error ? e.message : "이력 삭제 중 오류가 발생했습니다.");
    }
  }

  async function handleResolveDecision() {
    if (!appUser) return;
    setDecisionError("");
    try {
      await resolveTaskDecision(task, appUser.uid, appUser.name, responseNote.trim() || undefined);
      setResponseNote("");
    } catch (e) {
      setDecisionError(e instanceof Error ? e.message : zh(isZh, "확인 처리 중 오류가 발생했습니다."));
    }
  }

  function startEditNote() {
    setEditNoteText(openDecision?.note ?? "");
    setEditingNote(true);
  }

  async function handleSaveNote() {
    if (!editNoteText.trim()) return;
    setSavingNote(true);
    setDecisionError("");
    try {
      await updateOpenDecisionNote(task, editNoteText.trim());
      setEditingNote(false);
    } catch (e) {
      setDecisionError(e instanceof Error ? e.message : "사유 수정 중 오류가 발생했습니다.");
    } finally {
      setSavingNote(false);
    }
  }

  async function handleAssign(uid: string) {
    if (!uid) {
      await assignTask(task, "", "");
      return;
    }
    const person = assigneeOptions.find((u) => u.uid === uid);
    if (!person) return;
    await assignTask(task, person.uid, person.name);
  }

  function handleToggleChecklist(itemId: string) {
    const next = task.checklist.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i));
    updateChecklist(task.id, next);
  }

  function handleAddChecklistItem() {
    const text = newChecklistText.trim();
    if (!text) return;
    const item: ChecklistItem = { id: `${Date.now()}`, text, done: false };
    updateChecklist(task.id, [...task.checklist, item]);
    setNewChecklistText("");
  }

  function handleDeleteChecklistItem(itemId: string) {
    updateChecklist(task.id, task.checklist.filter((i) => i.id !== itemId));
  }

  return createPortal(
    <div className="fixed inset-0 z-30 flex justify-end bg-black/30" onClick={onClose}>
      <div className="scrollbar-thin h-full w-full max-w-lg overflow-y-auto bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#f0f0f0] bg-white/95 px-6 py-4 backdrop-blur">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#86868b]">{zh(isZh, "업무 상세")}</span>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <button onClick={handleDelete} className="rounded-full p-1.5 text-[#d1d1d6] transition hover:bg-red-50 hover:text-red-500">
                <Trash2 size={16} />
              </button>
            )}
            <button onClick={onClose} className="rounded-full p-1.5 text-[#86868b] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6">
          {task.needsDecision && (
            <div className="mb-4 rounded-2xl bg-violet-50 px-4 py-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-violet-600" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-violet-700">
                      {isAdmin ? "클라이언트 확인/승인 대기 중" : zh(isZh, "확인/승인이 필요합니다")}
                    </p>
                    {isAdmin && openDecision && !editingNote && (
                      <button onClick={startEditNote} className="shrink-0 text-xs font-medium text-violet-600 underline underline-offset-2 hover:text-violet-700">
                        사유 수정
                      </button>
                    )}
                  </div>
                  {editingNote ? (
                    <div className="mt-1.5 space-y-2">
                      <textarea
                        value={editNoteText}
                        onChange={(e) => setEditNoteText(e.target.value)}
                        rows={2}
                        className="w-full resize-none rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-violet-400"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveNote}
                          disabled={savingNote || !editNoteText.trim()}
                          className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-40"
                        >
                          {savingNote ? "저장 중..." : "저장"}
                        </button>
                        <button
                          onClick={() => setEditingNote(false)}
                          className="rounded-full border border-[#d1d1d6] px-3 py-1.5 text-xs text-[#1d1d1f] hover:bg-white"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    openDecision && (
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-violet-800">{openDecision.note}</p>
                    )
                  )}
                </div>
              </div>
              {decisionError && (
                <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-500">{decisionError}</p>
              )}
              {!isAdmin && (
                <div className="mt-3 space-y-2">
                  <input
                    value={responseNote}
                    onChange={(e) => setResponseNote(e.target.value)}
                    placeholder={zh(isZh, "응답 메모(선택)")}
                    className="w-full rounded-xl border border-violet-200 bg-white px-3 py-1.5 text-sm text-[#1d1d1f] outline-none focus:border-violet-400"
                  />
                  <button
                    onClick={handleResolveDecision}
                    className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700"
                  >
                    {zh(isZh, "확인했습니다")}
                  </button>
                </div>
              )}
            </div>
          )}

          {isAdmin ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleSaveBasics}
              className="mb-2 w-full rounded-xl border border-transparent px-1 py-1 text-xl font-bold text-[#1d1d1f] hover:border-[#e5e5e5] focus:border-[#86868b] focus:outline-none"
            />
          ) : (
            <h2 className="mb-2 px-1 text-xl font-bold text-[#1d1d1f]">{task.name}</h2>
          )}

          <div className="mb-4 flex flex-wrap items-center gap-2 px-1">
            <StatusBadge status={task.status} />
            {isAdmin ? (
              <>
                <span
                  ref={groupMeasureRef}
                  aria-hidden
                  className="pointer-events-none absolute -left-[9999px] -top-[9999px] whitespace-pre text-xs font-medium"
                >
                  {group || "그룹 없음"}
                </span>
                <input
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  onBlur={handleSaveBasics}
                  placeholder="그룹 없음"
                  title="업무 목록에서 묶어 보기 위한 그룹명 — 이미 있는 그룹명을 입력하면 그 그룹에 합류합니다"
                  list="task-group-options"
                  style={{ width: groupChipWidth }}
                  className="chip-input rounded-full bg-[#1d1d1f] px-2.5 py-0.5 text-xs font-medium leading-4 text-white outline-none placeholder:text-white/40"
                />
                {existingGroups.length > 0 && (
                  <datalist id="task-group-options">
                    {existingGroups.map((g) => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                )}
              </>
            ) : (
              task.group && (
                <span className="inline-flex items-center rounded-full bg-[#1d1d1f] px-2.5 py-0.5 text-xs font-medium text-white">{task.group}</span>
              )
            )}
            {overdue && (
              <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-500">{zh(isZh, "지연")}</span>
            )}
            {!overdue && dueSoon && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-600">{zh(isZh, "마감임박")}</span>
            )}
            {isAdmin && (
              <button
                onClick={handleToggleHiddenFromPartner}
                title="협력사(파트너) 계정에게는 이 업무 자체가 안 보이게 됩니다 — 계약체결처럼 노출하면 안 되는 업무에 사용하세요"
                className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition ${
                  task.hiddenFromPartner
                    ? "bg-[#1d1d1f] text-white hover:bg-black"
                    : "border border-[#d1d1d6] text-[#86868b] hover:border-[#86868b] hover:text-[#1d1d1f]"
                }`}
              >
                <EyeOff size={12} />
                {task.hiddenFromPartner ? "협력사에게 숨김" : "협력사에게 숨기기"}
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => (task.needsDecision ? handleCancelDecision() : setShowDecisionForm((v) => !v))}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition ${
                  task.needsDecision
                    ? "bg-violet-600 text-white hover:bg-violet-700"
                    : "border border-[#d1d1d6] text-[#86868b] hover:border-violet-400 hover:text-violet-600"
                }`}
              >
                <AlertCircle size={12} />
                {task.needsDecision ? "확인 요청 취소" : "클라이언트 확인 요청"}
              </button>
            )}
          </div>

          {isAdmin && showDecisionForm && !task.needsDecision && (
            <div className="mb-4 space-y-2 rounded-2xl bg-violet-50 px-4 py-3">
              <label className="block text-xs font-medium text-violet-700">무엇에 대한 확인/승인이 필요한가요?</label>
              <textarea
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                rows={2}
                placeholder="예: 디자인 시안 A/B 중 선택해주세요"
                className="w-full resize-none rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-violet-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleRequestDecision}
                  disabled={!decisionNote.trim()}
                  className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-40"
                >
                  요청 보내기
                </button>
                <button
                  onClick={() => { setShowDecisionForm(false); setDecisionNote(""); }}
                  className="rounded-full border border-[#d1d1d6] px-3 py-1.5 text-xs text-[#1d1d1f] hover:bg-white"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {isAdmin ? (
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleSaveBasics}
              placeholder="업무 설명을 입력하세요"
              rows={3}
              className="mb-5 w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
            />
          ) : (
            task.description && <p className="mb-5 whitespace-pre-wrap px-1 text-sm text-[#1d1d1f]">{task.description}</p>
          )}

          {/* 일정 */}
          <section className="mb-5 rounded-2xl bg-[#f5f5f7] p-4">
            <button
              onClick={() => toggleSection("schedule")}
              className="flex w-full items-center justify-between text-xs font-semibold text-[#86868b]"
            >
              <span className="flex items-center gap-1.5"><CalendarDays size={13} />{zh(isZh, "일정")}</span>
              <ChevronDown size={14} className={`shrink-0 transition-transform ${openSections.schedule ? "rotate-180" : ""}`} />
            </button>
            {openSections.schedule && (
            <div className="mt-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="mb-1 block text-xs text-[#86868b]">{zh(isZh, "시작일")}</label>
                {isAdmin ? (
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    onBlur={handleSaveDates}
                    className="w-full appearance-none rounded-xl border border-[#d1d1d6] bg-white px-2 py-1.5 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
                  />
                ) : (
                  <p className="text-[#1d1d1f]">{task.startDate}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#86868b]">{zh(isZh, "마감일")}</label>
                {isAdmin ? (
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    onBlur={handleSaveDates}
                    className="w-full appearance-none rounded-xl border border-[#d1d1d6] bg-white px-2 py-1.5 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
                  />
                ) : (
                  <p className="text-[#1d1d1f]">{task.dueDate}</p>
                )}
              </div>
            </div>

            {shiftMessage && (
              <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                {shiftMessage}
              </div>
            )}

            {task.dateHistory && task.dateHistory.length > 0 && (
              <div className="mt-3 border-t border-black/5 pt-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs text-[#86868b]">
                  <History size={12} />
                  {zh(isZh, "일정 변경 이력")}
                </p>
                <div className="max-h-40 space-y-1.5 overflow-y-auto scrollbar-thin">
                  {[...task.dateHistory].reverse().map((h, i) => (
                    <div key={i} className="rounded-xl bg-white px-3 py-2 text-xs text-[#86868b]">
                      {h.fromStartDate !== h.toStartDate && (
                        <p>{zh(isZh, "시작일")} {h.fromStartDate} → <span className="font-medium text-[#1d1d1f]">{h.toStartDate}</span></p>
                      )}
                      {h.fromDueDate !== h.toDueDate && (
                        <p>{zh(isZh, "마감일")} {h.fromDueDate} → <span className="font-medium text-[#1d1d1f]">{h.toDueDate}</span></p>
                      )}
                      <p className="mt-0.5 text-[10px] text-[#c7c7cc]">
                        {h.changedBy} · {new Date(h.changedAt).toLocaleDateString("ko-KR")}
                        {h.cascaded ? ` · ${zh(isZh, "선행 업무 변경으로 자동 조정")}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>
            )}
          </section>

          {/* 담당·상태·진행률 */}
          <section className="mb-5 rounded-2xl bg-[#f5f5f7] p-4">
            <button
              onClick={() => toggleSection("assignee")}
              className="flex w-full items-center justify-between text-xs font-semibold text-[#86868b]"
            >
              <span className="flex items-center gap-1.5"><UserRound size={13} />{zh(isZh, "담당 및 진행 상태")}</span>
              <ChevronDown size={14} className={`shrink-0 transition-transform ${openSections.assignee ? "rotate-180" : ""}`} />
            </button>
            {openSections.assignee && (
            <div className="mt-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="mb-1 block text-xs text-[#86868b]">{zh(isZh, "담당자")}</label>
                {isAdmin ? (
                  <select
                    value={task.assigneeId || ""}
                    onChange={(e) => handleAssign(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-[#d1d1d6] bg-white bg-[length:14px] bg-[right_0.75rem_center] bg-no-repeat px-2 py-1.5 pr-8 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
                    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")" }}
                  >
                    <option value="">미지정</option>
                    {assigneeOptions.map((u) => (
                      <option key={u.uid} value={u.uid}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-[#1d1d1f]">{task.assigneeName || zh(isZh, "미지정")}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#86868b]">{zh(isZh, "상태")}</label>
                {isAdmin ? (
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                    className="w-full appearance-none rounded-xl border border-[#d1d1d6] bg-white bg-[length:14px] bg-[right_0.75rem_center] bg-no-repeat px-2 py-1.5 pr-8 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b] disabled:opacity-50"
                    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")" }}
                  >
                    {TASK_STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {TASK_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="pt-1"><StatusBadge status={task.status} /></div>
                )}
              </div>
            </div>
            {task.status === "pending" && (
              <p className="mt-2 text-xs text-[#86868b]">{zh(isZh, "선행 업무가 모두 완료되면 자동으로 시작 가능 상태로 전환됩니다.")}</p>
            )}

            <div className="mt-4 border-t border-black/5 pt-4">
              <label className="mb-2 flex items-center justify-between text-xs text-[#86868b]">
                <span className="flex items-center gap-1.5"><Flag size={12} /> {zh(isZh, "진행률")}</span>
                <span className="font-semibold text-[#1d1d1f]">{progress}%</span>
              </label>
              {task.checklist.length > 0 ? (
                <>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-[#1d1d1f] transition-all" style={{ width: `${task.progress}%` }} />
                  </div>
                  <p className="mt-1.5 text-[11px] text-[#86868b]">{zh(isZh, "체크리스트 완료 항목 기준으로 자동 계산됩니다.")}</p>
                </>
              ) : isAdmin ? (
                <>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={progress}
                    disabled={task.status === "done"}
                    onChange={(e) => setProgress(Number(e.target.value))}
                    onMouseUp={() => updateTaskFields(task.id, { progress })}
                    onTouchEnd={() => updateTaskFields(task.id, { progress })}
                    className="w-full accent-[#1d1d1f]"
                  />
                  <div className="mt-1 flex justify-between text-xs text-[#d1d1d6]">
                    <span>0%</span><span>50%</span><span>100%</span>
                  </div>
                </>
              ) : (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-[#1d1d1f]" style={{ width: `${task.progress}%` }} />
                </div>
              )}
            </div>
            </div>
            )}
          </section>

          {/* 체크리스트 */}
          <section className="mb-5 rounded-2xl bg-[#f5f5f7] p-4">
            <button
              onClick={() => toggleSection("checklist")}
              className="flex w-full items-center justify-between text-xs font-semibold text-[#86868b]"
            >
              <span className="flex items-center gap-1.5"><ListTodo size={13} />{zh(isZh, "체크리스트")}</span>
              <span className="flex items-center gap-2">
                {task.checklist.length > 0 && (
                  <span className="text-xs font-semibold text-[#1d1d1f]">
                    {task.checklist.filter((i) => i.done).length}/{task.checklist.length} {zh(isZh, "완료")}
                  </span>
                )}
                <ChevronDown size={14} className={`shrink-0 transition-transform ${openSections.checklist ? "rotate-180" : ""}`} />
              </span>
            </button>
            {openSections.checklist && (
            <div className="mt-3">
            {task.checklist.length > 0 && (
              <ul className="mb-2 space-y-1.5">
                {task.checklist.map((item) => (
                  <li key={item.id} className="group flex items-center gap-2 rounded-xl bg-white px-3 py-2">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => isAdmin && handleToggleChecklist(item.id)}
                      disabled={!isAdmin}
                      className="h-4 w-4 shrink-0 accent-[#1d1d1f] disabled:cursor-default"
                    />
                    <span className={`flex-1 text-sm ${item.done ? "text-[#86868b] line-through" : "text-[#1d1d1f]"}`}>
                      {item.text}
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteChecklistItem(item.id)}
                        className="shrink-0 text-[#d1d1d6] opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {isAdmin && (
              <div className="flex gap-2">
                <input
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); handleAddChecklistItem(); } }}
                  placeholder="세부 항목 추가"
                  className="min-w-0 flex-1 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
                />
                <button
                  onClick={handleAddChecklistItem}
                  disabled={!newChecklistText.trim()}
                  className="shrink-0 rounded-xl border border-[#d1d1d6] bg-white px-3 text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f] disabled:opacity-40"
                >
                  <Plus size={15} />
                </button>
              </div>
            )}
            </div>
            )}
          </section>

          {/* 선행 업무 */}
          {(isAdmin || dependsOnTasks.length > 0) && (
            <section className="mb-5 rounded-2xl bg-[#f5f5f7] p-4">
              <button
                onClick={() => toggleSection("dependsOn")}
                className="flex w-full items-center justify-between text-xs font-semibold text-[#86868b]"
              >
                <span className="flex items-center gap-1.5"><GitBranch size={13} />{zh(isZh, "선행 업무")}</span>
                <ChevronDown size={14} className={`shrink-0 transition-transform ${openSections.dependsOn ? "rotate-180" : ""}`} />
              </button>
              {openSections.dependsOn && (
              <div className="mt-3">
              {dependsOnEntries.length > 0 ? (
                <ul className="space-y-1.5">
                  {dependsOnEntries.map((entry) => (
                    <li key={entry.id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-[#1d1d1f]">
                      <StatusBadge status={entry.task.status} />
                      <span className="min-w-0 flex-1 truncate">{entry.task.name}</span>
                      {isAdmin && (
                        <button
                          onClick={() => handleRemoveDependency(entry.id)}
                          className="shrink-0 rounded-full p-1 text-[#c7c7cc] transition hover:bg-red-50 hover:text-red-500"
                          title="선행 업무 해제"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                isAdmin && <p className="text-xs text-[#86868b]">등록된 선행 업무가 없습니다.</p>
              )}
              {isAdmin && dependencyCandidates.length > 0 && (
                <select
                  value=""
                  onChange={(e) => handleAddDependency(e.target.value)}
                  className="mt-3 w-full rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
                >
                  <option value="">+ 선행 업무 추가...</option>
                  {dependencyCandidates.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              </div>
              )}
            </section>
          )}

          {/* 확인/승인 이력 */}
          {task.decisionHistory && task.decisionHistory.length > 0 && (
            <section className="mb-5 rounded-2xl border border-violet-200 bg-violet-100/70 p-4">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-violet-700">
                <AlertCircle size={13} />
                {zh(isZh, "확인/승인 이력")}
              </p>
              <div className="max-h-56 space-y-2 overflow-y-auto scrollbar-thin">
                {[...task.decisionHistory].reverse().map((h, i) => {
                  const originalIndex = task.decisionHistory!.length - 1 - i;
                  return (
                    <div key={i} className="rounded-xl border border-violet-100 bg-white px-3 py-2.5 text-xs shadow-[0_1px_4px_rgba(124,58,237,0.06)]">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-[#1d1d1f]">{h.note}</p>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteDecisionEntry(originalIndex)}
                            className="shrink-0 text-[#d1d1d6] hover:text-red-500"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      <p className="mt-1 text-[#86868b]">
                        {zh(isZh, "요청")} · {h.requestedBy} · {new Date(h.requestedAt).toLocaleDateString("ko-KR")}
                      </p>
                      {h.decidedAt ? (
                        h.resolution === "cancelled" ? (
                          <p className="mt-0.5 font-medium text-[#86868b]">
                            {zh(isZh, "요청 취소됨")} · {h.decidedBy} · {new Date(h.decidedAt).toLocaleDateString("ko-KR")}
                          </p>
                        ) : (
                          <p className="mt-0.5 font-medium text-violet-600">
                            {zh(isZh, "확인 완료")} · {h.decidedBy} · {new Date(h.decidedAt).toLocaleDateString("ko-KR")}
                            {h.responseNote && <span className="ml-1 font-normal text-[#1d1d1f]">· {h.responseNote}</span>}
                          </p>
                        )
                      ) : (
                        <p className="mt-0.5 font-medium text-amber-600">{zh(isZh, "대기 중")}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 첨부 자료 */}
          <section className="mb-5">
            <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-[#86868b]">
              <Paperclip size={13} />
              {zh(isZh, "첨부 자료")}
            </p>
            <FileUploader projectId={task.projectId} taskId={task.id} />
          </section>

          {/* 코멘트 */}
          <section>
            <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-[#86868b]">
              <MessageSquare size={13} />
              {zh(isZh, "코멘트")}
            </p>
            <CommentThread taskId={task.id} task={task} projectUsers={assigneeOptions} />
          </section>

          {saving && <p className="mt-3 text-xs text-[#d1d1d6]">{zh(isZh, "저장 중...")}</p>}
        </div>
      </div>
    </div>,
    document.body
  );
}
