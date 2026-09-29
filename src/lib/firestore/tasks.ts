import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { deleteObject, listAll, ref } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { ChecklistItem, DateChangeEntry, DecisionEntry, Task, TaskStatus, TASK_STATUS_LABEL } from "@/lib/types";
import { createNotification } from "@/lib/firestore/notifications";
import { getUsersByClient, getAdmins } from "@/lib/firestore/users";
import { translateForCache } from "@/lib/i18n";

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
    needsDecision: !!data.needsDecision,
    decisionHistory: (data.decisionHistory ?? []).map((h: any) => ({
      note: h.note,
      requestedAt: toMillis(h.requestedAt),
      requestedBy: h.requestedBy,
      decidedAt: h.decidedAt ? toMillis(h.decidedAt) : undefined,
      decidedBy: h.decidedBy ?? undefined,
      responseNote: h.responseNote ?? undefined,
      resolution: h.resolution ?? undefined,
    })),
    checklist: data.checklist ?? [],
    order: data.order ?? 0,
    dependsOn: data.dependsOn ?? [],
    templateId: data.templateId ?? undefined,
    group: data.group ?? undefined,
    hiddenFromPartner: !!data.hiddenFromPartner,
    nameZh: data.nameZh ?? undefined,
    groupZh: data.groupZh ?? undefined,
    statusHistory: (data.statusHistory ?? []).map((h: any) => ({
      status: h.status,
      enteredAt: toMillis(h.enteredAt),
    })),
    dateHistory: (data.dateHistory ?? []).map((h: any) => ({
      fromStartDate: h.fromStartDate,
      toStartDate: h.toStartDate,
      fromDueDate: h.fromDueDate,
      toDueDate: h.toDueDate,
      changedAt: toMillis(h.changedAt),
      changedBy: h.changedBy,
      cascaded: !!h.cascaded,
    })),
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    completedAt: data.completedAt ? toMillis(data.completedAt) : undefined,
  };
}

// clientId는 클라이언트 계정으로 조회할 때 반드시 넘겨야 한다(관리자는 생략).
// Firestore의 list 규칙은 문서를 하나씩 걸러주는 필터가 아니라, "쿼리가 반환할 수 있는 문서가
// 전부 규칙을 만족한다"는 걸 쿼리의 제약조건만 보고 증명할 수 있어야 통과시킨다. tasks 규칙은
// resource.data.clientId가 내 clientId와 같을 것을 요구하는데, projectId로만 좁힌 쿼리로는
// 그게 증명되지 않아 쿼리 전체가 permission-denied로 실패했다(관리자는 isAdmin()이
// resource.data를 보지 않아 정적으로 통과해서 이 문제가 드러나지 않았다).
// 실제로 고객 화면에서만 간트 차트가 "등록된 업무가 없습니다"로 비어 보이던 원인이다.
// onError를 넘기지 않으면 이런 실패가 조용히 삼켜져 원인 추적이 불가능하므로 콜백도 받는다.
export function listenTasksByProject(
  projectId: string,
  cb: (tasks: Task[]) => void,
  onError?: (e: Error) => void,
  clientId?: string
) {
  const q = clientId
    ? query(colRef, where("projectId", "==", projectId), where("clientId", "==", clientId))
    : query(colRef, where("projectId", "==", projectId));
  return onSnapshot(
    q,
    (snap) => {
      const tasks = snap.docs.map(fromDoc).sort((a, b) => a.order - b.order);
      cb(tasks);
    },
    (e) => {
      console.error("[listenTasksByProject] 업무 조회 실패", e);
      onError?.(e);
    }
  );
}

/** 관리자 전용: 전체 프로젝트를 아우르는 업무 목록(홈 화면 통합 요약용) */
export function listenAllTasks(cb: (tasks: Task[]) => void) {
  return onSnapshot(colRef, (snap) => {
    cb(snap.docs.map(fromDoc));
  });
}

export async function getTask(taskId: string): Promise<Task | null> {
  const snap = await getDoc(doc(db, "tasks", taskId));
  return snap.exists() ? fromDoc(snap) : null;
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
  checklist?: ChecklistItem[];
  group?: string;
}) {
  const initialStatus: TaskStatus = input.dependsOn && input.dependsOn.length > 0 ? "pending" : "todo";
  const trimmedGroup = input.group?.trim() || "";
  // 협력사(중국 업체) 계정이 볼 때 즉석 번역 대신 바로 중국어가 뜨도록, 저장 시점에 미리
  // 번역해둔다 — 실패해도 nameZh/groupZh/textZh 없이 그냥 저장되고 화면에서 즉석 번역으로 대체된다.
  const initialChecklist = input.checklist ?? [];
  const [nameZh, groupZh, ...checklistZh] = await translateForCache([
    input.name,
    trimmedGroup,
    ...initialChecklist.map((i) => i.text),
  ]);
  const checklistWithZh = initialChecklist.map((i, idx) => (checklistZh[idx] ? { ...i, textZh: checklistZh[idx]! } : i));
  return addDoc(colRef, {
    projectId: input.projectId,
    clientId: input.clientId,
    name: input.name,
    ...(nameZh ? { nameZh } : {}),
    description: input.description ?? "",
    assigneeId: input.assigneeId ?? "",
    assigneeName: input.assigneeName ?? "",
    startDate: input.startDate,
    dueDate: input.dueDate,
    status: initialStatus,
    progress: 0,
    checklist: checklistWithZh,
    order: input.order ?? Date.now(),
    dependsOn: input.dependsOn ?? [],
    templateId: input.templateId ?? null,
    group: trimmedGroup || null,
    ...(trimmedGroup && groupZh ? { groupZh } : {}),
    statusHistory: [{ status: initialStatus, enteredAt: Timestamp.now() }],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateTaskFields(
  taskId: string,
  patch: Partial<
    Pick<Task, "name" | "description" | "assigneeId" | "assigneeName" | "startDate" | "dueDate" | "progress" | "group" | "hiddenFromPartner">
  >
) {
  const { group, ...rest } = patch;
  const trimmedGroup = group?.trim() || "";
  // 협력사용 번역 캐시(translateForCache)는 이미 번역된 문구면 API를 다시 호출하지 않으므로,
  // 이름/그룹이 실제로는 안 바뀐 채 다른 필드 때문에 저장이 다시 일어나도 비용이 들지 않는다.
  const [nameZh, groupZh] = await translateForCache([patch.name ?? "", trimmedGroup]);
  return updateDoc(doc(db, "tasks", taskId), {
    ...rest,
    ...(patch.name && nameZh ? { nameZh } : {}),
    ...("group" in patch ? { group: trimmedGroup || null, groupZh: trimmedGroup && groupZh ? groupZh : null } : {}),
    updatedAt: serverTimestamp(),
  });
}

/**
 * 체크리스트가 있는 업무는 담당자가 진행률(%)을 따로 입력하지 않아도 되도록,
 * 체크된 항목 비율로 진행률을 자동 계산해서 함께 저장한다. 체크리스트가 없는 업무는
 * 기존처럼 수동 진행률 입력을 그대로 쓴다.
 */
export async function updateChecklist(taskId: string, checklist: ChecklistItem[]) {
  // 이미 textZh가 있는 항목(체크 토글만 한 기존 항목)은 다시 번역하지 않는다 — 새로 추가된
  // 항목만 번역해서 매 체크박스 클릭마다 불필요한 API 호출이 생기지 않게 한다.
  const needsTranslation = checklist.filter((i) => i.text && i.textZh === undefined);
  let checklistWithZh = checklist;
  if (needsTranslation.length > 0) {
    const translations = await translateForCache(needsTranslation.map((i) => i.text));
    const zhById = new Map(needsTranslation.map((i, idx) => [i.id, translations[idx]]));
    checklistWithZh = checklist.map((i) => {
      const zh = zhById.get(i.id);
      return zh ? { ...i, textZh: zh } : i;
    });
  }
  const patch: Record<string, unknown> = { checklist: checklistWithZh, updatedAt: serverTimestamp() };
  if (checklistWithZh.length > 0) {
    const done = checklistWithZh.filter((i) => i.done).length;
    patch.progress = Math.round((done / checklistWithZh.length) * 100);
  }
  return updateDoc(doc(db, "tasks", taskId), patch);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD
}

/** taskId에 직간접적으로 의존하는(선행 업무로 둔) 모든 업무를 찾는다(전이적 포함) */
function findDownstreamTasks(taskId: string, allTasks: Task[]): Task[] {
  const result: Task[] = [];
  const visited = new Set<string>([taskId]);
  function visit(id: string) {
    for (const t of allTasks) {
      if (!visited.has(t.id) && t.dependsOn.includes(id)) {
        visited.add(t.id);
        result.push(t);
        visit(t.id);
      }
    }
  }
  visit(taskId);
  return result;
}

/**
 * 업무의 시작일/마감일을 수정하고, 마감일이 변경된 만큼(지연 또는 단축) 이 업무에
 * 의존하는 모든 후속 업무의 일정을 동일하게 밀어서 간트차트에 자동 반영한다.
 */
function toStoredDateHistory(entries: DateChangeEntry[] | undefined) {
  return (entries ?? []).map((h) => ({ ...h, changedAt: Timestamp.fromMillis(h.changedAt) }));
}

export async function updateTaskDates(
  task: Task,
  newStartDate: string,
  newDueDate: string,
  allTasks: Task[],
  actorName: string,
  // 일정을 바꾼 사람 본인에게는 알림을 보내지 않기 위한 값. 없으면 담당자에게 그대로 보낸다.
  actorId?: string
) {
  const deltaDays = Math.round(
    (new Date(`${newDueDate}T00:00:00`).getTime() - new Date(`${task.dueDate}T00:00:00`).getTime()) / 86400000
  );
  const dateChanged = newStartDate !== task.startDate || newDueDate !== task.dueDate;

  const batch = writeBatch(db);
  batch.update(doc(db, "tasks", task.id), {
    startDate: newStartDate,
    dueDate: newDueDate,
    updatedAt: serverTimestamp(),
    ...(dateChanged && {
      dateHistory: [
        ...toStoredDateHistory(task.dateHistory),
        {
          fromStartDate: task.startDate,
          toStartDate: newStartDate,
          fromDueDate: task.dueDate,
          toDueDate: newDueDate,
          changedAt: Timestamp.now(),
          changedBy: actorName,
        },
      ],
    }),
  });

  const downstream = deltaDays !== 0 ? findDownstreamTasks(task.id, allTasks) : [];
  for (const t of downstream) {
    const shiftedStart = addDays(t.startDate, deltaDays);
    const shiftedDue = addDays(t.dueDate, deltaDays);
    batch.update(doc(db, "tasks", t.id), {
      startDate: shiftedStart,
      dueDate: shiftedDue,
      updatedAt: serverTimestamp(),
      dateHistory: [
        ...toStoredDateHistory(t.dateHistory),
        {
          fromStartDate: t.startDate,
          toStartDate: shiftedStart,
          fromDueDate: t.dueDate,
          toDueDate: shiftedDue,
          changedAt: Timestamp.now(),
          changedBy: actorName,
          cascaded: true,
        },
      ],
    });
  }

  await batch.commit();

  // 지금까지는 "선행 업무가 밀려서 내 업무도 자동 조정된" 경우에만 알림이 갔고, 정작 일정을
  // 직접 바꾼 그 업무의 담당자에게는 아무 알림도 가지 않았다 — 상태 변경(updateTaskStatus)은
  // 담당자에게 알리는데 날짜 변경만 빠져 있어서, 일정을 바꿔도 아무 연락이 없던 원인이다.
  if (dateChanged && task.assigneeId && task.assigneeId !== actorId) {
    const movedDays = Math.abs(deltaDays);
    const direction = deltaDays > 0 ? "연기" : "단축";
    await createNotification({
      userId: task.assigneeId,
      projectId: task.projectId,
      taskId: task.id,
      type: "rescheduled",
      message:
        movedDays > 0
          ? `${actorName}님이 "${task.name}" 업무 일정을 ${movedDays}일 ${direction}했습니다. (${newStartDate} ~ ${newDueDate})`
          : `${actorName}님이 "${task.name}" 업무 일정을 변경했습니다. (${newStartDate} ~ ${newDueDate})`,
    });
  }

  if (downstream.length > 0) {
    const direction = deltaDays > 0 ? "지연" : "단축";
    // 담당자 한 명에게 여러 업무가 한꺼번에 밀리는 경우, 업무 수만큼 알림/메일이 따로따로
    // 가면(연쇄 조정이 클수록 스팸처럼 느껴진다) — 담당자별로 묶어서 "이번 일정 변경으로
    // 조정된 업무들"을 한 알림(=한 메일)에 나열해 보낸다.
    const byAssignee = new Map<string, Task[]>();
    for (const t of downstream) {
      if (!t.assigneeId) continue;
      const list = byAssignee.get(t.assigneeId) ?? [];
      list.push(t);
      byAssignee.set(t.assigneeId, list);
    }
    await Promise.all(
      Array.from(byAssignee.entries()).map(([assigneeId, tasks]) => {
        const taskNames = tasks.map((t) => `"${t.name}"`).join(", ");
        return createNotification({
          userId: assigneeId,
          projectId: tasks[0].projectId,
          taskId: tasks[0].id,
          type: "rescheduled",
          message: `"${task.name}" 업무 일정이 ${Math.abs(deltaDays)}일 ${direction}되어 ${taskNames} 업무 일정도 함께 조정되었습니다.`,
        });
      })
    );
  }

  return { deltaDays, shiftedCount: downstream.length };
}

/**
 * 업무 상태를 변경하고, statusHistory에 기록을 남긴다.
 * 'done'으로 바뀌면 이 업무에 의존하던(dependsOn에 포함된) 다른 업무 중
 * 모든 선행 업무가 완료된 업무를 자동으로 'pending' -> 'todo' 로 전환한다.
 *
 * 참고: functions/src/index.ts 의 Cloud Function이 동일한 자동 전환을 서버 측에서도 수행하므로,
 * 이 클라이언트 로직은 상태 전환의 중복 안전장치 역할만 한다. 단, "업무 시작 가능" 알림은
 * Cloud Function 쪽에서만 생성한다(중복 알림/이메일 방지).
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
      message: `${actorName}님이 "${task.name}" 업무 상태를 "${TASK_STATUS_LABEL[newStatus]}"(으)로 변경했습니다.`,
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
      // "업무 시작 가능" 알림은 Cloud Function(onTaskStatusChange)에서 생성한다.
    }
  }
}

/**
 * 업무의 선행 업무 목록(dependsOn)을 직접 수정한다.
 * 아직 시작 전인 업무(todo/pending)라면, 남은 선행 업무가 모두 완료(또는 없음)인지에 따라
 * status를 todo <-> pending으로 자동 재조정한다. 이미 진행 중이거나 완료된 업무는 건드리지 않는다.
 */
export async function updateTaskDependsOn(task: Task, newDependsOn: string[]) {
  const patch: Record<string, unknown> = { dependsOn: newDependsOn, updatedAt: serverTimestamp() };

  if (task.status === "pending" || task.status === "todo") {
    let allDone = newDependsOn.length === 0;
    if (!allDone && newDependsOn.length <= 10) {
      const depTasksSnap = await getDocs(query(colRef, where(documentId(), "in", newDependsOn)));
      allDone = depTasksSnap.docs.length === newDependsOn.length && depTasksSnap.docs.every((dep) => dep.data().status === "done");
    }
    const nextStatus: TaskStatus = allDone ? "todo" : "pending";
    if (nextStatus !== task.status) {
      patch.status = nextStatus;
      patch.statusHistory = [
        ...task.statusHistory.map((h) => ({ status: h.status, enteredAt: Timestamp.fromMillis(h.enteredAt) })),
        { status: nextStatus, enteredAt: Timestamp.now() },
      ];
    }
  }

  await updateDoc(doc(db, "tasks", task.id), patch);

  if (patch.status === "todo" && task.assigneeId) {
    await createNotification({
      userId: task.assigneeId,
      projectId: task.projectId,
      taskId: task.id,
      type: "unblocked",
      message: `선행 업무가 정리되어 "${task.name}" 업무를 시작할 수 있습니다.`,
    });
  }
}

export async function reorderTasks(taskIds: string[]) {
  const batch = writeBatch(db);
  taskIds.forEach((id, index) => {
    batch.update(doc(db, "tasks", id), { order: index, updatedAt: serverTimestamp() });
  });
  await batch.commit();
}

export async function deleteTask(task: Task) {
  const [filesSnap, commentsSnap] = await Promise.all([
    getDocs(collection(db, "tasks", task.id, "files")),
    getDocs(collection(db, "tasks", task.id, "comments")),
  ]);
  await Promise.all(commentsSnap.docs.map((c) => deleteDoc(c.ref)));
  await Promise.all(filesSnap.docs.map((f) => deleteDoc(f.ref)));

  try {
    const taskFolder = ref(storage, `projects/${task.projectId}/tasks/${task.id}`);
    const listing = await listAll(taskFolder);
    await Promise.all(listing.items.map((item) => deleteObject(item)));
  } catch (e) {
    console.warn("업무 스토리지 파일 삭제 실패(이미 없을 수 있음)", e);
  }

  await deleteDoc(doc(db, "tasks", task.id));

  await unblockTasksAfterDependencyRemoved(task.projectId, task.id);
}

/**
 * 업무가 삭제되었을 때, 이 업무를 선행 업무로 두던 다른 업무들의 dependsOn에서 제거한다.
 * 대기(pending) 상태였던 업무는 남은 선행 업무가 없거나 모두 완료 상태라면 자동으로 todo로 전환한다.
 * (선행 업무의 상태가 done으로 바뀌는 경우는 unblockDependentTasks가 처리하고, 이 함수는
 * 선행 업무 자체가 삭제되어 dependsOn 목록에서 빠지는 경우를 처리한다.)
 */
async function unblockTasksAfterDependencyRemoved(projectId: string, removedTaskId: string) {
  const q = query(colRef, where("projectId", "==", projectId), where("dependsOn", "array-contains", removedTaskId));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    const data = d.data();
    const dependsOn: string[] = (data.dependsOn ?? []).filter((id: string) => id !== removedTaskId);
    const patch: Record<string, unknown> = { dependsOn, updatedAt: serverTimestamp() };

    if (data.status === "pending") {
      let allDone = dependsOn.length === 0;
      if (!allDone && dependsOn.length <= 10) {
        const depTasksSnap = await getDocs(query(colRef, where(documentId(), "in", dependsOn)));
        allDone = depTasksSnap.docs.every((dep) => dep.data().status === "done");
      }
      if (allDone) {
        patch.status = "todo";
        patch.statusHistory = [...(data.statusHistory ?? []), { status: "todo", enteredAt: Timestamp.now() }];
      }
    }

    await updateDoc(doc(db, "tasks", d.id), patch);

    if (patch.status === "todo" && data.assigneeId) {
      await createNotification({
        userId: data.assigneeId,
        projectId,
        taskId: d.id,
        type: "unblocked",
        message: `선행 업무가 삭제되어 "${data.name}" 업무를 시작할 수 있습니다.`,
      });
    }
  }
}

function toStoredDecisionHistory(entries: DecisionEntry[] | undefined) {
  // Firestore는 필드 값으로 undefined를 허용하지 않는데, 클라이언트 Task 객체의
  // decidedBy/responseNote는 미결 항목일 때 명시적으로 undefined가 들어있어 그대로
  // 스프레드하면 updateDoc()이 "Unsupported field value: undefined" 에러로 실패한다.
  // 값이 실제로 있는 필드만 골라 새 객체를 만들어 이를 방지한다.
  return (entries ?? []).map((h) => ({
    note: h.note,
    requestedAt: Timestamp.fromMillis(h.requestedAt),
    requestedBy: h.requestedBy,
    decidedAt: h.decidedAt ? Timestamp.fromMillis(h.decidedAt) : null,
    ...(h.decidedBy ? { decidedBy: h.decidedBy } : {}),
    ...(h.responseNote ? { responseNote: h.responseNote } : {}),
    ...(h.resolution ? { resolution: h.resolution } : {}),
  }));
}

/**
 * 업무를 "클라이언트 확인/승인 필요" 상태로 표시하고, 무엇에 대한 요청인지 사유(note)를
 * decisionHistory에 새 항목으로 남긴다. 해당 클라이언트 소속 사용자 전원에게 알림을 보낸다.
 */
export async function requestTaskDecision(task: Task, note: string, actorId: string, actorName: string) {
  const entry: DecisionEntry = { note, requestedAt: Date.now(), requestedBy: actorName };
  await updateDoc(doc(db, "tasks", task.id), {
    needsDecision: true,
    decisionHistory: [...toStoredDecisionHistory(task.decisionHistory), entry],
    updatedAt: serverTimestamp(),
  });

  try {
    const clientUsers = await getUsersByClient(task.clientId);
    await Promise.all(
      clientUsers
        .filter((u) => u.uid !== actorId)
        .map((u) =>
          createNotification({
            userId: u.uid,
            projectId: task.projectId,
            taskId: task.id,
            type: "decision_needed",
            message: `${actorName}님이 "${task.name}" 업무에 대한 확인/승인을 요청했습니다.`,
            details: [`요청 내용: ${note}`],
          })
        )
    );
  } catch (e) {
    console.error("확인/승인 요청 알림 발송 실패:", e);
  }
}

/**
 * 진행 중인 확인/승인 요청을 처리(완료 또는 취소)하고 decisionHistory의 마지막 미결 항목에
 * 처리자·처리일시·응답 코멘트를 기록한다. 클라이언트가 확인 완료 처리하면 관리자 전원에게 알림을 보낸다.
 */
export async function resolveTaskDecision(
  task: Task,
  actorId: string,
  actorName: string,
  responseNote?: string,
  resolution: "approved" | "cancelled" = "approved"
) {
  const history = [...toStoredDecisionHistory(task.decisionHistory)];
  const lastOpenIndex = [...history].reverse().findIndex((h: any) => !h.decidedAt);
  if (lastOpenIndex !== -1) {
    const idx = history.length - 1 - lastOpenIndex;
    history[idx] = {
      ...history[idx],
      decidedAt: Timestamp.now(),
      decidedBy: actorName,
      resolution,
      ...(responseNote ? { responseNote } : {}),
    };
  }

  await updateDoc(doc(db, "tasks", task.id), {
    needsDecision: false,
    decisionHistory: history,
    updatedAt: serverTimestamp(),
  });

  if (resolution === "cancelled") return;

  const resolvedEntry = lastOpenIndex !== -1 ? history[history.length - 1 - lastOpenIndex] : undefined;
  const details = [
    ...(resolvedEntry?.note ? [`요청 내용: ${resolvedEntry.note}`] : []),
    ...(responseNote ? [`응답 내용: ${responseNote}`] : []),
  ];

  // 알림 발송은 부가 기능 — 실패하더라도 이미 위에서 완료된 상태 변경(취소/확인 처리) 자체는
  // 성공으로 취급해야 하므로, 여기서 에러를 삼켜 호출자에게 전파되지 않게 한다.
  try {
    const admins = await getAdmins();
    await Promise.all(
      admins
        .filter((u) => u.uid !== actorId)
        .map((u) =>
          createNotification({
            userId: u.uid,
            projectId: task.projectId,
            taskId: task.id,
            type: "decision_needed",
            message: `${actorName}님이 "${task.name}" 업무의 확인/승인 요청을 처리했습니다.`,
            ...(details.length > 0 ? { details } : {}),
          })
        )
    );
  } catch (e) {
    console.error("확인/승인 처리 알림 발송 실패:", e);
  }
}

/** 관리자가 아직 처리되지 않은 확인/승인 요청의 사유(note)를 수정한다. */
export async function updateOpenDecisionNote(task: Task, note: string) {
  const history = [...toStoredDecisionHistory(task.decisionHistory)];
  const lastOpenIndex = [...history].reverse().findIndex((h: any) => !h.decidedAt);
  if (lastOpenIndex === -1) return;
  const idx = history.length - 1 - lastOpenIndex;
  history[idx] = { ...history[idx], note };

  await updateDoc(doc(db, "tasks", task.id), {
    decisionHistory: history,
    updatedAt: serverTimestamp(),
  });
}

/** 관리자가 확인/승인 이력에서 특정 항목을 삭제한다(원본 decisionHistory 배열 기준 인덱스). */
export async function deleteDecisionHistoryEntry(task: Task, entryIndex: number) {
  const history = toStoredDecisionHistory(task.decisionHistory).filter((_, i) => i !== entryIndex);
  await updateDoc(doc(db, "tasks", task.id), {
    decisionHistory: history,
    updatedAt: serverTimestamp(),
  });
}

/** 관리자가 일정 변경 이력에서 특정 항목을 삭제한다(원본 dateHistory 배열 기준 인덱스). 잘못 기록된 변경 이력을 정리할 때 사용. */
export async function deleteDateHistoryEntry(task: Task, entryIndex: number) {
  const history = toStoredDateHistory(task.dateHistory).filter((_, i) => i !== entryIndex);
  await updateDoc(doc(db, "tasks", task.id), {
    dateHistory: history,
    updatedAt: serverTimestamp(),
  });
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
