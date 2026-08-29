import { FieldValue, FieldPath, Timestamp } from "firebase-admin/firestore";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { db, internalNotifySecret, generateWeeklySummaryInsight } from "./shared";

type TaskStatus = "pending" | "todo" | "in_progress" | "done";

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
/*    - src/components/CommentThread.tsx(클라이언트)에서 프로젝트 관련자   */
/*      전원에게 직접 알림을 생성하므로, 여기서는 중복 생성하지 않는다.       */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* 4-0-1) 마감일이 지난 업무 재알림 (Asia/Seoul 09:00)                       */
/*    - dueSoonReminder는 마감 당일~하루 전에 딱 한 번만 알리고 끝나서,        */
/*      마감일이 실제로 지나버린 뒤로는 담당자가 잊으면 계속 방치될 수 있다.    */
/*      완료 전까지 3일 간격으로 계속 재알림한다(lastOverdueNotifiedAt 기준). */
/* ------------------------------------------------------------------ */
export const overdueTaskReminder = onSchedule(
  { schedule: "0 9 * * *", timeZone: "Asia/Seoul" },
  async () => {
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }); // YYYY-MM-DD
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const snap = await db.collection("tasks").where("status", "in", ["todo", "in_progress"]).get();

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const dueDate = data.dueDate as string;
      if (!dueDate || dueDate >= todayStr) continue; // 마감일이 지나지 않았으면 대상 아님
      if (!data.assigneeId) continue;

      const lastOverdueMs = data.lastOverdueNotifiedAt?.toMillis
        ? data.lastOverdueNotifiedAt.toMillis()
        : data.lastOverdueNotifiedAt;
      if (lastOverdueMs && now - lastOverdueMs < THREE_DAYS_MS) continue;

      const overdueDays = Math.round(
        (new Date(`${todayStr}T00:00:00+09:00`).getTime() - new Date(`${dueDate}T00:00:00+09:00`).getTime()) /
          (24 * 60 * 60 * 1000)
      );

      await db.collection("notifications").add({
        userId: data.assigneeId,
        projectId: data.projectId,
        taskId: docSnap.id,
        type: "overdue",
        message: `"${data.name}" 업무의 마감일이 ${overdueDays}일 지났습니다.`,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });

      await docSnap.ref.update({ lastOverdueNotifiedAt: FieldValue.serverTimestamp() });
    }
  }
);

/* ------------------------------------------------------------------ */
/* 4-1) 주간 요약 리포트 (매주 월요일 Asia/Seoul 09:00)                     */
/*    - 관리자 전원에게 "이번 주 마감 예정 / 지연 중" 업무 건수를 요약해       */
/*      notifications 문서로 남긴다. 실제 발송(푸시+이메일)은 기존            */
/*      onNotificationCreated 트리거가 그대로 처리한다.                     */
/* ------------------------------------------------------------------ */
export const weeklySummaryReport = onSchedule(
  { schedule: "0 9 * * 1", timeZone: "Asia/Seoul", secrets: [internalNotifySecret] },
  async () => {
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    const weekLater = new Date();
    weekLater.setDate(weekLater.getDate() + 7);
    const weekLaterStr = weekLater.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

    const snap = await db.collection("tasks").where("status", "in", ["todo", "in_progress"]).get();

    const dueThisWeekTasks: { name: string; projectId: string; dueDate: string }[] = [];
    const overdueTasks: { name: string; projectId: string; dueDate: string }[] = [];
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const dueDate = data.dueDate as string;
      const entry = { name: data.name as string, projectId: data.projectId as string, dueDate };
      if (dueDate < todayStr) overdueTasks.push(entry);
      else if (dueDate <= weekLaterStr) dueThisWeekTasks.push(entry);
    }

    if (dueThisWeekTasks.length === 0 && overdueTasks.length === 0) return;

    // 이메일에 프로젝트명을 같이 보여주기 위해 관련된 프로젝트만 한 번에 조회한다.
    const projectIds = Array.from(new Set([...dueThisWeekTasks, ...overdueTasks].map((t) => t.projectId)));
    const projectNames = new Map<string, string>();
    await Promise.all(
      projectIds.map(async (id) => {
        const projectSnap = await db.collection("projects").doc(id).get();
        if (projectSnap.exists) projectNames.set(id, projectSnap.data()?.name ?? "");
      })
    );
    const formatEntry = (t: { name: string; projectId: string; dueDate: string }) =>
      `${projectNames.get(t.projectId) ? projectNames.get(t.projectId) + " · " : ""}${t.name} (${t.dueDate})`;

    const adminsSnap = await db.collection("users").where("role", "==", "admin").get();
    const message = `이번 주 마감 예정 ${dueThisWeekTasks.length}건, 지연 중 ${overdueTasks.length}건입니다.`;
    const details = [
      ...overdueTasks.map((t) => `[지연] ${formatEntry(t)}`),
      ...dueThisWeekTasks.map((t) => `[마감 예정] ${formatEntry(t)}`),
    ];
    const aiSummary = await generateWeeklySummaryInsight("admin", overdueTasks.length, dueThisWeekTasks.length, details);

    for (const adminDoc of adminsSnap.docs) {
      await db.collection("notifications").add({
        userId: adminDoc.id,
        type: "weekly_summary",
        message,
        details,
        ...(aiSummary ? { aiSummary } : {}),
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }
);

// 관리자용과 같은 스케줄(매주 월요일 09:00)로, 고객에게는 전체가 아니라 "본인 회사(clientId)"
// 소속 업무만 필터링해 별도로 보낸다 — 같은 회사에 계정이 여러 개여도 회사당 한 번만
// 계산해서(digestByClientId 캐시) 재사용한다. tasks 컬렉션에 clientId 인덱스가 이미
// 있으므로(firestore.rules의 belongsToClient 패턴과 동일) 별도 복합 인덱스 없이 조회 가능.
export const clientWeeklySummaryReport = onSchedule(
  { schedule: "0 9 * * 1", timeZone: "Asia/Seoul", secrets: [internalNotifySecret] },
  async () => {
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    const weekLater = new Date();
    weekLater.setDate(weekLater.getDate() + 7);
    const weekLaterStr = weekLater.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

    const clientUsersSnap = await db.collection("users").where("role", "==", "client").get();

    interface ClientDigest {
      overdueCount: number;
      dueSoonCount: number;
      details: string[];
      aiSummary?: string;
    }
    const digestByClientId = new Map<string, ClientDigest | null>();

    for (const userDoc of clientUsersSnap.docs) {
      const clientId = userDoc.data().clientId as string | undefined;
      if (!clientId) continue;

      if (!digestByClientId.has(clientId)) {
        const tasksSnap = await db.collection("tasks").where("clientId", "==", clientId).get();
        const dueThisWeekTasks: { name: string; projectId: string; dueDate: string }[] = [];
        const overdueTasks: { name: string; projectId: string; dueDate: string }[] = [];
        for (const docSnap of tasksSnap.docs) {
          const data = docSnap.data();
          if (data.status !== "todo" && data.status !== "in_progress") continue;
          const dueDate = data.dueDate as string;
          const entry = { name: data.name as string, projectId: data.projectId as string, dueDate };
          if (dueDate < todayStr) overdueTasks.push(entry);
          else if (dueDate <= weekLaterStr) dueThisWeekTasks.push(entry);
        }

        if (dueThisWeekTasks.length === 0 && overdueTasks.length === 0) {
          digestByClientId.set(clientId, null);
        } else {
          const projectIds = Array.from(new Set([...dueThisWeekTasks, ...overdueTasks].map((t) => t.projectId)));
          const projectNames = new Map<string, string>();
          await Promise.all(
            projectIds.map(async (id) => {
              const projectSnap = await db.collection("projects").doc(id).get();
              if (projectSnap.exists) projectNames.set(id, projectSnap.data()?.name ?? "");
            })
          );
          const formatEntry = (t: { name: string; projectId: string; dueDate: string }) =>
            `${projectNames.get(t.projectId) ? projectNames.get(t.projectId) + " · " : ""}${t.name} (${t.dueDate})`;
          const details = [
            ...overdueTasks.map((t) => `[지연] ${formatEntry(t)}`),
            ...dueThisWeekTasks.map((t) => `[마감 예정] ${formatEntry(t)}`),
          ];
          const aiSummary = await generateWeeklySummaryInsight("client", overdueTasks.length, dueThisWeekTasks.length, details);
          digestByClientId.set(clientId, {
            overdueCount: overdueTasks.length,
            dueSoonCount: dueThisWeekTasks.length,
            details,
            aiSummary,
          });
        }
      }

      const digest = digestByClientId.get(clientId);
      if (!digest) continue;

      await db.collection("notifications").add({
        userId: userDoc.id,
        type: "weekly_summary",
        message: `이번 주 마감 예정 ${digest.dueSoonCount}건, 지연 중 ${digest.overdueCount}건입니다.`,
        details: digest.details,
        ...(digest.aiSummary ? { aiSummary: digest.aiSummary } : {}),
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }
);
