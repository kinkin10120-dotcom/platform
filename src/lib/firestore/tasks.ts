import {
  addDoc,
  collection,
  doc,
  documentId,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Task, TaskStatus } from "@/lib/types";
import { createNotification } from "@/lib/firestore/notifications";

const colRef = collection(db, "tasks");

function toMillis(v: any): number {
  if (!v) return Date.now();
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v?.toMillis === "function") return v.toMillis();
  return Date.now();
}

function fromDoc(d: any): Task {
  const data = d.data();
  return {
    id: d.id,
    projectId: data.projectId,
    clientId: data.clientId,
    name: data.name,
    description: data.description ?? "",
    assigneeId: data.assigneeId ?? "",
    assigneeName: data.assigneeName ?? "",
    startDate: data.startDate,
    dueDate: data.dueDate,
    status: data.status,
    progress: data.progress ?? 0,
    order: data.order ?? 0,
    dependsOn: data.dependsOn ?? [],
    templateId: data.templateId ?? undefined,
    statusHistory: (data.statusHistory ?? []).map((h: any) => ({
      status: h.status,
      enteredAt: toMillis(h.enteredAt),
    })),
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    completedAt: data.completedAt ? toMillis(data.completedAt) : undefined,
  };
}

export function listenTasksByProject(projectId: string, cb: (tasks: Task[]) => void) {
  const q = query(colRef, where("projectId", "==", projectId));
  return onSnapshot(q, (snap) => {
    const tasks = snap.docs.map(fromDoc).sort((a, b) => a.order - b.order);
    cb(tasks);
  });
}

export async function createTask(input: {
  projectId: string;
  clientId: string;
  name: string;
  description?: string;
  assigneeId?: string;
  assigneeName?: string;
  startDate: string;
  dueDate: string;
  dependsOn?: string[];
  order?: number;
  templateId?: string;
}) {
  const initialStatus: TaskStatus = input.dependsOn && input.dependsOn.length > 0 ? "pending" : "todo";
  return addDoc(colRef, {
    projectId: input.projectId,
    clientId: input.clientId,
    name: input.name,
    description: input.description ?? "",
    assigneeId: input.assigneeId ?? "",
    assigneeName: input.assigneeName ?? "",
    startDate: input.startDate,
    dueDate: input.dueDate,
    status: initialStatus,
    progress: 0,
    order: input.order ?? Date.now(),
    dependsOn: input.dependsOn ?? [],
    templateId: input.templateId ?? null,
    statusHistory: [{ status: initialStatus, enteredAt: Timestamp.now() }],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateTaskFields(
  taskId: string,
  patch: Partial<
    Pick<Task, "name" | "description" | "assigneeId" | "assigneeName" | "startDate" | "dueDate" | "progress">
  >
) {
  return updateDoc(doc(db, "tasks", taskId), { ...patch, updatedAt: serverTimestamp() });
}

/**
 * 업무 상태를 변경하고, statusHistory에 기록을 남긴다.
 * 'done'으로 바뀌면 이 업무에 의존하던(dependsOn에 포함된) 다른 업무 중
 * 모든 선행 업무가 완료된 업무를 자동으로 'pending' -> 'todo' 로 전환하고 담당자에게 알림을 보낸다.
 *
 * 참고: functions/src/index.ts 의 Cloud Function이 동일한 자동 전환을 서버 측에서도 수행하므로,
 * Cloud Functions를 배포한 경우 이 클라이언트 로직은 중복 안전장치 역할만 한다.
 */
export async function updateTaskStatus(task: Task, newStatus: TaskStatus, actorName: string) {
  const taskRef = doc(db, "tasks", task.id);
  const batch = writeBatch(db);

  const historyEntry = { status: newStatus, enteredAt: Timestamp.now() };
  batch.update(taskRef, {
    status: newStatus,
    statusHistory: [...task.statusHistory.map((h) => ({ status: h.status, enteredAt: Timestamp.fromMillis(h.enteredAt) })), historyEntry],
    updatedAt: serverTimestamp(),
    ...(newStatus === "done" ? { progress: 100, completedAt: serverTimestamp() } : {}),
  });

  await batch.commit();

  if (task.assigneeId) {
    await createNotification({
      userId: task.assigneeId,
      projectId: task.projectId,
      taskId: task.id,
      type: "status_change",
      message: `${actorName}님이 "${task.name}" 업무 상태를 변경했습니다 → ${newStatus}`,
    });
  }

  if (newStatus === "done") {
    await unblockDependentTasks(task.projectId, task.id);
  }
}

/** taskId가 done이 되었을 때, 이 업무를 선행 업무로 둔 pending 업무들을 검사해 todo로 전환 */
async function unblockDependentTasks(projectId: string, completedTaskId: string) {
  const q = query(colRef, where("projectId", "==", projectId), where("status", "==", "pending"));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    const data = d.data();
    const dependsOn: string[] = data.dependsOn ?? [];
    if (!dependsOn.includes(completedTaskId)) continue;

    // 모든 선행 업무가 완료되었는지 확인 (Firestore 'in' 쿼리는 최대 10개까지만 지원)
    if (dependsOn.length === 0 || dependsOn.length > 10) continue;
    const depTasksSnap = await getDocs(query(colRef, where(documentId(), "in", dependsOn)));
    const allDone = depTasksSnap.docs.every((dep) => dep.data().status === "done");
    if (allDone) {
      await updateDoc(doc(db, "tasks", d.id), {
        status: "todo",
        statusHistory: [...(data.statusHistory ?? []), { status: "todo", enteredAt: Timestamp.now() }],
        updatedAt: serverTimestamp(),
      });
      if (data.assigneeId) {
        await createNotification({
          userId: data.assigneeId,
          projectId,
          taskId: d.id,
          type: "unblocked",
          message: `선행 업무가 모두 완료되어 "${data.name}" 업무를 시작할 수 있습니다.`,
        });
      }
    }
  }
}

export async function reorderTasks(taskIds: string[]) {
  const batch = writeBatch(db);
  taskIds.forEach((id, index) => {
    batch.update(doc(db, "tasks", id), { order: index, updatedAt: serverTimestamp() });
  });
  await batch.commit();
}

export async function assignTask(task: Task, assigneeId: string, assigneeName: string) {
  await updateDoc(doc(db, "tasks", task.id), {
    assigneeId,
    assigneeName,
    updatedAt: serverTimestamp(),
  });
  await createNotification({
    userId: assigneeId,
    projectId: task.projectId,
    taskId: task.id,
    type: "assigned",
    message: `"${task.name}" 업무에 담당자로 지정되었습니다.`,
  });
}
