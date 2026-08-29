import { FieldValue } from "firebase-admin/firestore";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { db, internalNotifySecret, sendNotifyEmail } from "./shared";

async function sendInquiryAnsweredEmail(email: string, info: { title: string; answer: string }) {
  const html = `
    <h2 style="color: #1d1d1f; margin: 0 0 16px; font-size: 19px;">문의에 답변이 등록되었습니다</h2>
    <p style="font-size: 13px; color: #86868b; line-height: 1.6;">
      안녕하세요.<br/><br/>
      남겨주신 문의에 담당자가 답변을 등록했습니다. 아래 내용을 확인해주세요.
      추가로 궁금하신 점이 있으시면 언제든 편하게 다시 문의해 주시기 바랍니다.
    </p>
    <div style="background: #ffffff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 16px; font-size: 14px; margin: 20px 0 0;">
      <p style="margin: 0 0 6px; color: #1d1d1f; font-weight: 600;">${info.title}</p>
      <p style="margin: 0; color: #1d1d1f; line-height: 1.6; white-space: pre-line;">${info.answer}</p>
    </div>
  `;
  await sendNotifyEmail(email, "[HANDYWORKS] 문의에 답변이 등록되었습니다", html);
}

// 문의 답변 등록 시점을 감지해 문의자에게 알려준다. 로그인 계정으로 남긴 문의("내 문의")면
// 기존 알림(bell+푸시+이메일) 파이프라인을 그대로 태우고, 계정 없이 홈페이지에서 남긴 문의
// (userId: "website")는 알림 문서를 걸 사용자 자체가 없으므로 저장된 이메일로 직접 발송한다.
export const onInquiryAnswered = onDocumentUpdated(
  { document: "inquiries/{inquiryId}", secrets: [internalNotifySecret] },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (before.status === "answered" || after.status !== "answered") return;

    if (after.userId && after.userId !== "website") {
      await db.collection("notifications").add({
        userId: after.userId,
        type: "inquiry_answered",
        message: `"${after.title}" 문의에 답변이 등록되었습니다.`,
        details: [`답변 내용: ${after.answer}`],
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    if (after.email) {
      await sendInquiryAnsweredEmail(after.email, { title: after.title, answer: after.answer });
    }
  }
);

// 답변 안 된 문의가 방치되는 걸 막는 리마인더 — 다른 리마인더(견적/청구서/계약서/업무)는 전부
// "우리가 보낸 걸 상대가 방치"하는 쪽이었는데, 이건 반대로 "고객이 보낸 걸 우리가 방치"하는
// 쪽이라 응대 품질에 직접 영향을 준다. 최초 접수는 이미 즉시 알림(관리자 전원 알림 또는
// /api/contact의 직접 이메일)이 가므로, 여기서는 그 후 3일 간격으로 미답변 상태만 재알린다.
export const checkPendingInquiries = onSchedule(
  { schedule: "0 9 * * *", timeZone: "Asia/Seoul", secrets: [internalNotifySecret] },
  async () => {
    const snap = await db.collection("inquiries").where("status", "==", "pending").get();
    const now = Date.now();
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

    const adminsSnap = await db.collection("users").where("role", "==", "admin").get();
    if (adminsSnap.empty) return;

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const createdAtMs = data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt;
      if (!createdAtMs) continue;
      const lastReminderMs = data.lastAnswerReminderNotifiedAt?.toMillis
        ? data.lastAnswerReminderNotifiedAt.toMillis()
        : data.lastAnswerReminderNotifiedAt;
      const reference = lastReminderMs ?? createdAtMs;
      if (now - reference < THREE_DAYS_MS) continue;

      await docSnap.ref.update({ lastAnswerReminderNotifiedAt: FieldValue.serverTimestamp() });

      const daysWaiting = Math.round((now - createdAtMs) / (24 * 60 * 60 * 1000));
      await Promise.all(
        adminsSnap.docs.map((a) =>
          db.collection("notifications").add({
            userId: a.id,
            type: "inquiry",
            message: `${data.userName}님의 문의("${data.title}")가 ${daysWaiting}일째 답변되지 않았습니다.`,
            details: [`문의 내용: ${data.content}`],
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          })
        )
      );
    }
  }
);
