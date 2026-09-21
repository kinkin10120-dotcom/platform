"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, Trash2, X, Pencil, ChevronDown, ChevronUp, ListTodo, Copy } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenTemplates, createTemplate, updateTemplate, deleteTemplate } from "@/lib/firestore/templates";
import { TemplateStep, WorkflowTemplate } from "@/lib/types";

const emptyStep: TemplateStep = { name: "", offsetDays: 0, durationDays: 3, dependsOnIndex: null, checklist: [] };

export default function TemplatesPage() {
  const { appUser } = useAuth();
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<TemplateStep[]>([{ ...emptyStep }]);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [checklistDraft, setChecklistDraft] = useState<Record<number, string>>({});
  const [checklistOpen, setChecklistOpen] = useState<Record<number, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<WorkflowTemplate | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const DELETE_KEYWORD = "바로삭제";

  async function handleConfirmDelete() {
    if (!deleteTarget || deleteConfirmText !== DELETE_KEYWORD) return;
    await deleteTemplate(deleteTarget.id);
    setDeleteTarget(null);
    setDeleteConfirmText("");
  }

  useEffect(() => listenTemplates(setTemplates), []);

  // 선행 단계가 지정된 스텝은 "선행의 시작일+소요일" 다음날 자동 시작하도록 offsetDays를
  // 매번 다시 계산한다. 선행이 여러 단계로 이어진 체인도 반영되도록 변화가 없을 때까지 반복한다.
  function recalcDependentOffsets(list: TemplateStep[]): TemplateStep[] {
    let result = list;
    for (let pass = 0; pass < list.length; pass++) {
      let changed = false;
      result = result.map((s) => {
        if (s.dependsOnIndex === null) return s;
        const dep = result[s.dependsOnIndex];
        if (!dep) return s;
        const expected = dep.offsetDays + dep.durationDays;
        if (s.offsetDays !== expected) {
          changed = true;
          return { ...s, offsetDays: expected };
        }
        return s;
      });
      if (!changed) break;
    }
    return result;
  }

  function updateStep(index: number, patch: Partial<TemplateStep>) {
    setSteps((prev) => recalcDependentOffsets(prev.map((s, i) => (i === index ? { ...s, ...patch } : s))));
  }

  function addStep() {
    setSteps((prev) => [...prev, { ...emptyStep }]);
  }

  function removeStep(index: number) {
    setSteps((prev) =>
      recalcDependentOffsets(
        prev
          .filter((_, i) => i !== index)
          .map((s) => (s.dependsOnIndex === index ? { ...s, dependsOnIndex: null } : s))
      )
    );
  }

  function moveStep(index: number, dir: -1 | 1) {
    const swapIndex = index + dir;
    setSteps((prev) => {
      if (swapIndex < 0 || swapIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return recalcDependentOffsets(next.map((s) => {
        if (s.dependsOnIndex === index) return { ...s, dependsOnIndex: swapIndex };
        if (s.dependsOnIndex === swapIndex) return { ...s, dependsOnIndex: index };
        return s;
      }));
    });
  }

  function addChecklistItem(stepIndex: number) {
    const text = (checklistDraft[stepIndex] ?? "").trim();
    if (!text) return;
    setSteps((prev) =>
      prev.map((s, i) => (i === stepIndex ? { ...s, checklist: [...(s.checklist ?? []), text] } : s))
    );
    setChecklistDraft((prev) => ({ ...prev, [stepIndex]: "" }));
  }

  function removeChecklistItem(stepIndex: number, itemIndex: number) {
    setSteps((prev) =>
      prev.map((s, i) =>
        i === stepIndex ? { ...s, checklist: (s.checklist ?? []).filter((_, ci) => ci !== itemIndex) } : s
      )
    );
  }

  function reset() {
    setName("");
    setDescription("");
    setSteps([{ ...emptyStep }]);
    setEditingId(null);
    setChecklistDraft({});
  }

  function startCreate() {
    reset();
    setOpen(true);
  }

  function startEdit(t: WorkflowTemplate) {
    setName(t.name);
    setDescription(t.description ?? "");
    setSteps(t.steps.map((s) => ({ ...s, checklist: s.checklist ?? [] })));
    setEditingId(t.id);
    setOpen(true);
  }

  function startDuplicate(t: WorkflowTemplate) {
    setName(`${t.name} 사본`);
    setDescription(t.description ?? "");
    setSteps(t.steps.map((s) => ({ ...s, checklist: s.checklist ?? [] })));
    setEditingId(null);
    setChecklistDraft({});
    setChecklistOpen({});
    setOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!appUser || !name || steps.some((s) => !s.name)) return;
    setSubmitting(true);
    try {
      if (editingId) {
        await updateTemplate(editingId, { name, description, steps });
      } else {
        await createTemplate({ name, description, steps, createdBy: appUser.uid });
      }
      reset();
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-[#1d1d1f]">
            <span className="h-2 w-2 rounded-full bg-[#1d1d1f]" />
            업무 템플릿
          </h1>
          <p className="mt-1 pl-4 text-sm text-[#86868b]">반복 업무를 템플릿으로 만들어 자동 적용하세요.</p>
        </div>
        {!open && (
          <button
            onClick={startCreate}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1 self-start whitespace-nowrap rounded-full bg-[#1d1d1f] px-4 text-sm font-medium text-white transition hover:bg-black"
          >
            <Plus size={16} />
            템플릿 추가
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#1d1d1f]">{editingId ? "템플릿 수정" : "새 템플릿"}</h3>
            <button type="button" onClick={() => { reset(); setOpen(false); }} className="text-[#86868b] hover:text-[#1d1d1f]">
              <X size={16} />
            </button>
          </div>

          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs text-[#86868b]">템플릿명</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-xl border border-[#d1d1d6] px-2.5 py-1.5 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[#86868b]">설명 (선택)</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-[#d1d1d6] px-2.5 py-1.5 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="mb-1 block text-xs text-[#86868b]">
              업무 단계 (적용 시 프로젝트 시작일 기준 +N일로 자동 계산됩니다)
            </label>
            {steps.map((step, i) => {
              const checklistCount = step.checklist?.length ?? 0;
              const showChecklist = checklistOpen[i] || checklistCount > 0;
              return (
              <div key={i} className="rounded-xl bg-[#f5f5f7] p-2.5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex shrink-0 flex-col">
                    <button
                      type="button"
                      onClick={() => moveStep(i, -1)}
                      disabled={i === 0}
                      className="rounded p-0.5 text-[#86868b] hover:bg-white disabled:opacity-20"
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStep(i, 1)}
                      disabled={i === steps.length - 1}
                      className="rounded p-0.5 text-[#86868b] hover:bg-white disabled:opacity-20"
                    >
                      <ChevronDown size={13} />
                    </button>
                  </div>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-medium text-[#86868b]">
                    {i + 1}
                  </span>
                  <input
                    value={step.name}
                    onChange={(e) => updateStep(i, { name: e.target.value })}
                    placeholder={`${i + 1}단계 업무명`}
                    required
                    className="min-w-[120px] flex-1 rounded-lg border border-[#d1d1d6] bg-white px-2 py-1.5 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
                  />
                  <button
                    type="button"
                    onClick={() => removeStep(i)}
                    disabled={steps.length === 1}
                    className="shrink-0 text-[#d1d1d6] hover:text-red-500 disabled:opacity-30"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-8 text-xs text-[#86868b]">
                  <label className="flex shrink-0 items-center gap-1">
                    <input
                      type="number"
                      value={step.offsetDays}
                      onChange={(e) => updateStep(i, { offsetDays: Number(e.target.value) })}
                      disabled={step.dependsOnIndex !== null}
                      title={step.dependsOnIndex !== null ? "선행 단계 완료일 기준으로 자동 계산됩니다" : undefined}
                      className="w-11 rounded-md border border-[#d1d1d6] bg-white px-1 py-0.5 text-xs text-[#1d1d1f] outline-none focus:border-[#86868b] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[#f5f5f7] disabled:text-[#86868b]"
                    />
                    일 후 시작
                  </label>
                  <label className="flex shrink-0 items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      value={step.durationDays}
                      onChange={(e) => updateStep(i, { durationDays: Number(e.target.value) })}
                      className="w-11 rounded-md border border-[#d1d1d6] bg-white px-1 py-0.5 text-xs text-[#1d1d1f] outline-none focus:border-[#86868b]"
                    />
                    일간
                  </label>
                  <select
                    value={step.dependsOnIndex ?? ""}
                    onChange={(e) => updateStep(i, { dependsOnIndex: e.target.value === "" ? null : Number(e.target.value) })}
                    className="shrink-0 appearance-none rounded-md border border-[#d1d1d6] bg-white bg-[length:10px] bg-[right_0.3rem_center] bg-no-repeat py-0.5 pl-1.5 pr-5 text-xs text-[#1d1d1f] outline-none focus:border-[#86868b]"
                    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")" }}
                  >
                    <option value="">선행 없음</option>
                    {steps.map((s, idx) =>
                      idx !== i ? (
                        <option key={idx} value={idx}>
                          {idx + 1}단계 후
                        </option>
                      ) : null
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => setChecklistOpen((prev) => ({ ...prev, [i]: !prev[i] }))}
                    className={`flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 ${checklistCount > 0 ? "text-[#1d1d1f]" : ""}`}
                  >
                    <ListTodo size={12} />
                    {checklistCount > 0 ? `체크리스트 ${checklistCount}` : "체크리스트"}
                  </button>
                </div>

                {showChecklist && (
                  <div className="flex flex-wrap items-center gap-1.5 pl-8">
                    {(step.checklist ?? []).map((item, ci) => (
                      <span
                        key={ci}
                        className="inline-flex items-center gap-1 rounded-full border border-[#d1d1d6] bg-white py-0.5 pl-2.5 pr-1.5 text-xs text-[#1d1d1f]"
                      >
                        {item}
                        <button
                          type="button"
                          onClick={() => removeChecklistItem(i, ci)}
                          className="text-[#d1d1d6] hover:text-red-500"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                    <input
                      value={checklistDraft[i] ?? ""}
                      onChange={(e) => setChecklistDraft((prev) => ({ ...prev, [i]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          addChecklistItem(i);
                        }
                      }}
                      placeholder="체크리스트 항목 입력 후 Enter"
                      className="min-w-[140px] flex-1 rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-xs text-[#1d1d1f] outline-none placeholder:text-[#c7c7cc] focus:border-[#d1d1d6] focus:bg-white"
                    />
                  </div>
                )}
              </div>
              );
            })}
            <button
              type="button"
              onClick={addStep}
              className="text-xs font-medium text-[#1d1d1f] hover:text-[#86868b]"
            >
              + 단계 추가
            </button>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
            >
              {submitting ? "저장 중..." : editingId ? "수정 저장" : "템플릿 저장"}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        {templates.map((t) => {
          const expanded = expandedId === t.id;
          return (
          <div key={t.id} className="rounded-3xl bg-white p-5">
            <div className="flex w-full items-start justify-between gap-3">
              <button
                onClick={() => setExpandedId(expanded ? null : t.id)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate font-semibold text-[#1d1d1f]">{t.name}</p>
                {t.description && <p className="truncate text-xs text-[#86868b]">{t.description}</p>}
                <p className="mt-1 text-xs text-[#86868b]">{t.steps.length}단계</p>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => startEdit(t)}
                  className="rounded-full p-1.5 text-[#d1d1d6] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                  title="수정"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => startDuplicate(t)}
                  className="rounded-full p-1.5 text-[#d1d1d6] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                  title="복제해서 새 템플릿 만들기"
                >
                  <Copy size={15} />
                </button>
                <button
                  onClick={() => { setDeleteTarget(t); setDeleteConfirmText(""); }}
                  className="rounded-full p-1.5 text-[#d1d1d6] hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 size={15} />
                </button>
                <button
                  onClick={() => setExpandedId(expanded ? null : t.id)}
                  className="rounded-full p-1.5 text-[#86868b] hover:bg-[#f5f5f7]"
                >
                  <ChevronDown size={16} className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>
              </div>
            </div>
            {expanded && (
              <ol className="mt-3 divide-y divide-[#f0f0f0] text-sm text-[#1d1d1f]">
                {t.steps.map((s, i) => {
                  const stepKey = `${t.id}-${i}`;
                  const hasChecklist = s.checklist && s.checklist.length > 0;
                  const stepExpanded = expandedStep === stepKey;
                  return (
                  <li key={i} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f5f5f7] text-xs font-medium text-[#86868b]">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[#1d1d1f]">{s.name}</p>
                      {hasChecklist ? (
                        <button
                          type="button"
                          onClick={() => setExpandedStep(stepExpanded ? null : stepKey)}
                          className="mt-0.5 flex items-center gap-1 text-xs text-[#86868b] hover:text-[#1d1d1f]"
                        >
                          +{s.offsetDays}일 시작 · {s.durationDays}일 소요{s.dependsOnIndex !== null ? ` · ${s.dependsOnIndex + 1}단계 선행` : ""}
                          {` · 체크리스트 ${s.checklist!.length}개`}
                          <ChevronDown size={12} className={`transition-transform ${stepExpanded ? "rotate-180" : ""}`} />
                        </button>
                      ) : (
                        <p className="mt-0.5 text-xs text-[#86868b]">
                          +{s.offsetDays}일 시작 · {s.durationDays}일 소요{s.dependsOnIndex !== null ? ` · ${s.dependsOnIndex + 1}단계 선행` : ""}
                        </p>
                      )}
                      {hasChecklist && stepExpanded && (
                        <ul className="mt-1.5 space-y-0.5">
                          {s.checklist!.map((c, ci) => (
                            <li key={ci} className="flex items-center gap-1.5 text-xs text-[#86868b]">
                              <span className="h-1 w-1 shrink-0 rounded-full bg-[#d1d1d6]" />
                              {c}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                  );
                })}
              </ol>
            )}
          </div>
          );
        })}
        {templates.length === 0 && !open && (
          <div className="col-span-full rounded-3xl border border-dashed border-[#d1d1d6] bg-white p-10 text-center text-sm text-[#86868b]">
            등록된 템플릿이 없습니다. 프로젝트 화면의 &quot;템플릿으로 업무 일괄 생성&quot;에서 사용할 템플릿을 먼저 만들어보세요.
          </div>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h2 className="text-lg font-semibold text-[#1d1d1f]">템플릿 삭제</h2>
              <p className="mt-1.5 text-sm text-[#86868b]">
                <span className="font-medium text-[#1d1d1f]">{deleteTarget.name}</span> 템플릿을 삭제합니다. 이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[#86868b]">
                삭제하려면 <span className="font-semibold text-[#1d1d1f]">{DELETE_KEYWORD}</span>를 입력하세요
              </label>
              <input
                autoFocus
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleConfirmDelete(); }}
                placeholder={DELETE_KEYWORD}
                className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-full border border-[#d1d1d6] px-4 py-2 text-sm text-[#1d1d1f] hover:bg-[#f5f5f7]"
              >
                취소
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteConfirmText !== DELETE_KEYWORD}
                className="rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
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
