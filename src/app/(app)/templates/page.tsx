"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenTemplates, createTemplate, deleteTemplate } from "@/lib/firestore/templates";
import { TemplateStep, WorkflowTemplate } from "@/lib/types";

const emptyStep: TemplateStep = { name: "", offsetDays: 0, durationDays: 3, dependsOnIndex: null };

export default function TemplatesPage() {
  const { appUser } = useAuth();
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<TemplateStep[]>([{ ...emptyStep }]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => listenTemplates(setTemplates), []);

  function updateStep(index: number, patch: Partial<TemplateStep>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addStep() {
    setSteps((prev) => [...prev, { ...emptyStep }]);
  }

  function removeStep(index: number) {
    setSteps((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((s) => (s.dependsOnIndex === index ? { ...s, dependsOnIndex: null } : s))
    );
  }

  function reset() {
    setName("");
    setDescription("");
    setSteps([{ ...emptyStep }]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!appUser || !name || steps.some((s) => !s.name)) return;
    setSubmitting(true);
    try {
      await createTemplate({ name, description, steps, createdBy: appUser.uid });
      reset();
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">업무 템플릿</h1>
          <p className="mt-1 text-sm text-gray-400">
            반복되는 업무 흐름을 템플릿으로 만들어두면, 프로젝트에 한 번에 적용해 업무 목록을 자동 생성할 수 있습니다.
          </p>
        </div>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus size={16} />
            템플릿 추가
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">새 템플릿</h3>
            <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>

          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-400">템플릿명</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">설명 (선택)</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="mb-1 block text-xs text-gray-400">
              업무 단계 (적용 시 프로젝트 시작일 기준 +N일로 자동 계산됩니다)
            </label>
            {steps.map((step, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2 rounded-lg border border-gray-100 p-2">
                <input
                  value={step.name}
                  onChange={(e) => updateStep(i, { name: e.target.value })}
                  placeholder={`${i + 1}단계 업무명`}
                  required
                  className="col-span-4 rounded-md border border-gray-200 px-2 py-1.5 text-sm"
                />
                <div className="col-span-3 flex items-center gap-1 text-xs text-gray-400">
                  시작
                  <input
                    type="number"
                    value={step.offsetDays}
                    onChange={(e) => updateStep(i, { offsetDays: Number(e.target.value) })}
                    className="w-16 rounded-md border border-gray-200 px-2 py-1 text-sm"
                  />
                  일 후
                </div>
                <div className="col-span-3 flex items-center gap-1 text-xs text-gray-400">
                  기간
                  <input
                    type="number"
                    min={1}
                    value={step.durationDays}
                    onChange={(e) => updateStep(i, { durationDays: Number(e.target.value) })}
                    className="w-16 rounded-md border border-gray-200 px-2 py-1 text-sm"
                  />
                  일
                </div>
                <select
                  value={step.dependsOnIndex ?? ""}
                  onChange={(e) => updateStep(i, { dependsOnIndex: e.target.value === "" ? null : Number(e.target.value) })}
                  className="col-span-1 rounded-md border border-gray-200 px-1 py-1.5 text-xs"
                >
                  <option value="">-</option>
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
                  onClick={() => removeStep(i)}
                  disabled={steps.length === 1}
                  className="col-span-1 text-gray-300 hover:text-red-500 disabled:opacity-30"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addStep}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              + 단계 추가
            </button>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting ? "저장 중..." : "템플릿 저장"}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {templates.map((t) => (
          <div key={t.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{t.name}</p>
                {t.description && <p className="text-xs text-gray-400">{t.description}</p>}
              </div>
              <button onClick={() => deleteTemplate(t.id)} className="text-gray-300 hover:text-red-500">
                <Trash2 size={15} />
              </button>
            </div>
            <ol className="space-y-1 text-sm text-gray-600">
              {t.steps.map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-500">
                    {i + 1}
                  </span>
                  {s.name}
                  <span className="text-xs text-gray-300">
                    (+{s.offsetDays}일, {s.durationDays}일 소요{s.dependsOnIndex !== null ? `, ${s.dependsOnIndex + 1}단계 선행` : ""})
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
        {templates.length === 0 && !open && (
          <div className="col-span-full rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
            등록된 템플릿이 없습니다. 프로젝트 화면의 &quot;템플릿으로 업무 일괄 생성&quot;에서 사용할 템플릿을 먼저 만들어보세요.
          </div>
        )}
      </div>
    </div>
  );
}
