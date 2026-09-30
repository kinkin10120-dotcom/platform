import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { addDays, format, parseISO } from "date-fns";
import { db } from "@/lib/firebase";
import { WorkflowTemplate, TemplateStep } from "@/lib/types";
import { createTask } from "@/lib/firestore/tasks";

const colRef = collection(db, "templates");

export function listenTemplates(cb: (templates: WorkflowTemplate[]) => void) {
  const q = query(colRef, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name,
          description: data.description ?? "",
          steps: data.steps as TemplateStep[],
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
          createdBy: data.createdBy,
        } as WorkflowTemplate;
      })
    );
  });
}

export async function createTemplate(input: {
  name: string;
  description?: string;
  steps: TemplateStep[];
  createdBy: string;
}) {
  return addDoc(colRef, { ...input, createdAt: serverTimestamp() });
}

export async function updateTemplate(
  id: string,
  input: { name: string; description?: string; steps: TemplateStep[] }
) {
  return updateDoc(doc(db, "templates", id), { ...input });
}

export async function deleteTemplate(id: string) {
  return deleteDoc(doc(db, "templates", id));
}

/**
 * 템플릿을 프로젝트에 적용해 업무들을 한번에 생성한다.
 * steps[i].dependsOnIndex가 가리키는 같은 템플릿 내 업무를 선행 업무로 연결한다.
 */
export async function applyTemplateToProject(
  template: WorkflowTemplate,
  projectId: string,
  clientId: string | undefined,
  baseDate: string // YYYY-MM-DD, 보통 프로젝트 시작일
) {
  const base = parseISO(baseDate);
  const createdIds: string[] = [];

  for (let i = 0; i < template.steps.length; i++) {
    const step = template.steps[i];
    const startDate = format(addDays(base, step.offsetDays), "yyyy-MM-dd");
    const dueDate = format(addDays(base, step.offsetDays + step.durationDays), "yyyy-MM-dd");
    const dependsOn = step.dependsOnIndex !== null ? [createdIds[step.dependsOnIndex]] : [];

    const ref = await createTask({
      projectId,
      clientId,
      name: step.name,
      startDate,
      dueDate,
      dependsOn: dependsOn.filter(Boolean),
      order: Date.now() + i,
      templateId: template.id,
      checklist: (step.checklist ?? []).map((text, ci) => ({ id: `${Date.now()}-${i}-${ci}`, text, done: false })),
    });
    createdIds.push(ref.id);
  }

  return createdIds;
}
