import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, FieldPath, Timestamp } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentUpdated, onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";

initializeApp();
const db = getFirestore();
const auth = getAuth();

const REGION = "asia-northeast3";
setGlobalOptions({ region: REGION });

type TaskStatus = "pending" | "todo" | "in_progress" | "done";

/* ------------------------------------------------------------------ */
/* 1) 클라이언트 계정 생성 (관리자 전용 callable)                          */
/*    - 클라이언트 SDK로 직접 생성하면 현재 로그인한 관리자가 로그아웃되므로,   */
/*      서버(Admin SDK)에서 대신 계정을 만들어 이메일 없이도 즉시 발급한다.   */
/* ------------------------------------------------------------------ */
export const createClientAccount = onCall({ invoker: "public" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const callerSnap = await db.collection("users").doc(request.auth.uid).get();
  if (!callerSnap.exists || callerSnap.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "관리자만 계정을 생성할 수 있습니다.");
  }

  const { email, password, name, clientId } = request.data as {
    email?: string;
    password?: string;
    name?: string;
    clientId?: string;
  };

  if (!email || !password || !name || !clientId) {
    throw new HttpsError("invalid-argument", "email, password, name, clientId는 필수입니다.");
  }
  if (password.length < 8) {
    throw new HttpsError("invalid-argument", "비밀번호는 8자 이상이어야 합니다.");
  }

  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) {
    throw new HttpsError("not-found", "존재하지 않는 클라이언트입니다.");
  }

  let userRecord;
  try {
    userRecord = await auth.createUser({ email, password, displayName: name });
  } catch (err: any) {
    if (err?.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "이미 사용 중인 이메일입니다.");
    }
    throw new HttpsError("internal", `계정 생성 중 오류가 발생했습니다: ${err?.message ?? err}`);
  }

  await db.collection("users").doc(userRecord.uid).set({
    email,
    name,
    role: "client",
    clientId,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { uid: userRecord.uid };
});

/* ------------------------------------------------------------------ */
/* 2) 업무 상태 변경 트리거                                                */
/*    - 'done'으로 바뀐 업무를 선행 업무로 둔 'pending' 업무 중,             */
/*      모든 선행 업무가 완료된 업무를 자동으로 'todo'로 전환하고 알림 발송.   */
/*    - 클라이언트(src/lib/firestore/tasks.ts)에도 동일 로직이 있으나,       */
/*      이 트리거가 서버 측 단일 진실 공급원(authoritative) 역할을 한다.      */
/* ------------------------------------------------------------------ */
export const onTaskStatusChange = onDocumentUpdated("tasks/{taskId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  if (before.status === after.status) return;
  if (after.status !== "done") return;

  const completedTaskId = event.params.taskId;
  const projectId = after.projectId as string;

  const pendingSnap = await db
    .collection("tasks")
    .where("projectId", "==", projectId)
    .where("status", "==", "pending")
    .get();

  for (const docSnap of pendingSnap.docs) {
    const data = docSnap.data();
    const dependsOn: string[] = data.dependsOn ?? [];
    if (!dependsOn.includes(completedTaskId)) continue;
    if (dependsOn.length === 0 || dependsOn.length > 10) continue;

    const depTasksSnap = await db
      .collection("tasks")
      .where(FieldPath.documentId(), "in", dependsOn)
      .get();
    const allDone = depTasksSnap.docs.every((d) => d.data().status === "done");
    if (!allDone) continue;

    await docSnap.ref.update({
      status: "todo" as TaskStatus,
      statusHistory: FieldValue.arrayUnion({ status: "todo", enteredAt: Timestamp.now() }),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (data.assigneeId) {
      await db.collection("notifications").add({
        userId: data.assigneeId,
        projectId,
        taskId: docSnap.id,
        type: "unblocked",
        message: `선행 업무가 모두 완료되어 "${data.name}" 업무를 시작할 수 있습니다.`,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }
});

/* ------------------------------------------------------------------ */
/* 3) 코멘트 작성 시 상대방에게 자동 알림                                   */
/*    - 클라이언트가 코멘트를 달면 담당자(주로 운영팀)에게,                  */
/*      운영팀이 코멘트를 달면 해당 업무 담당자(클라이언트)에게 알린다.        */
/* ------------------------------------------------------------------ */
export const onCommentCreated = onDocumentCreated("tasks/{taskId}/comments/{commentId}", async (event) => {
  const comment = event.data?.data();
  if (!comment) return;

  const taskId = event.params.taskId;
  const taskSnap = await db.collection("tasks").doc(taskId).get();
  if (!taskSnap.exists) return;
  const task = taskSnap.data()!;

  const recipientId = task.assigneeId as string | undefined;
  if (!recipientId || recipientId === comment.authorId) return;

  await db.collection("notifications").add({
    userId: recipientId,
    projectId: task.projectId,
    taskId,
    type: "comment",
    message: `${comment.authorName}님이 "${task.name}" 업무에 코멘트를 남겼습니다.`,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
});

/* ------------------------------------------------------------------ */
/* 4) 마감일 임박 업무 매일 알림 (Asia/Seoul 09:00)                         */
/*    - 미완료 업무 중 마감일이 오늘~내일인 업무의 담당자에게 알림을 보낸다.     */
/*    - 같은 날 중복 알림을 막기 위해 lastDueSoonNotifiedDate 필드로 dedupe.  */
/* ------------------------------------------------------------------ */
export const dueSoonReminder = onSchedule(
  { schedule: "0 9 * * *", timeZone: "Asia/Seoul" },
  async () => {
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }); // YYYY-MM-DD
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

    const snap = await db.collection("tasks").where("status", "in", ["todo", "in_progress"]).get();

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const dueDate = data.dueDate as string;
      if (dueDate !== todayStr && dueDate !== tomorrowStr) continue;
      if (data.lastDueSoonNotifiedDate === todayStr) continue;
      if (!data.assigneeId) continue;

      await db.collection("notifications").add({
        userId: data.assigneeId,
        projectId: data.projectId,
        taskId: docSnap.id,
        type: "due_soon",
        message: `"${data.name}" 업무의 마감일이 ${dueDate === todayStr ? "오늘" : "내일"}입니다.`,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });

      await docSnap.ref.update({ lastDueSoonNotifiedDate: todayStr });
    }
  }
);
