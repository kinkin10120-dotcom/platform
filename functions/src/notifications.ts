import { FieldValue } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { db, messaging, internalNotifySecret, sendNotifyEmail, recordSystemAlert } from "./shared";

/* ------------------------------------------------------------------ */
/* 5) 알림 생성 시 이메일 발송                                             */
/*    - notifications 문서가 생성되면(발생 경로 무관: 클라이언트/서버 공통)   */
/*      수신자 이메일로 알림 내용을 전송한다.                               */
/*    - Resend API 키는 Vercel 환경에만 있으므로, 공유 시크릿으로 보호된      */
/*      /api/notify-email 라우트를 통해 실제 발송을 위임한다.                */
/* ------------------------------------------------------------------ */
const NOTIFICATION_TITLE: Record<string, string> = {
  assigned: "새 업무가 배정되었습니다",
  status_change: "업무 상태가 변경되었습니다",
  comment: "새 코멘트가 등록되었습니다",
  unblocked: "업무를 시작할 수 있습니다",
  due_soon: "마감일이 임박했습니다",
  overdue: "마감일이 지났습니다",
  rescheduled: "일정이 조정되었습니다",
  weekly_summary: "이번 주 업무 요약",
  notice: "새 공지사항이 등록되었습니다",
  decision_needed: "확인/승인이 필요합니다",
  inquiry: "새 문의가 도착했습니다",
  inquiry_answered: "문의에 답변이 등록되었습니다",
  quote_request: "새 견적 요청이 도착했습니다",
  quote_response: "견적서 응답이 도착했습니다",
  purchase_order: "새 발주가 접수되었습니다",
  order_status_change: "발주 상태가 변경되었습니다",
  order_cancel_request: "발주 취소 요청이 접수되었습니다",
  contract_signed: "계약서 서명이 완료되었습니다",
  contract_revision_requested: "계약서 수정 요청이 도착했습니다",
  contract_expiring: "계약 만료가 임박했습니다",
  partner_archive: "협력사 자료함에 새 활동이 있습니다",
  supplier_invoice_submitted: "협력사 청구서가 제출되었습니다",
  supplier_invoice_paid: "청구서 지급이 완료되었습니다",
  supplier_quote_submitted: "협력사 견적서가 제출되었습니다",
  supplier_quote_approved: "견적서가 승인되었습니다",
  supplier_quote_rejected: "견적서가 반려되었습니다",
  supplier_quote_revision_requested: "견적서에 수정 요청이 왔습니다",
};

// 중국 협력사 계정(partnerLang === "zh")에게 가는 푸시·이메일 제목 — 본문(notif.message)은
// 만드는 쪽에서 이미 수신자 언어에 맞춰 쓰거나, 인앱 목록에서는 화면에서 자동 번역된다.
const NOTIFICATION_TITLE_ZH: Record<string, string> = {
  assigned: "已分配新任务",
  status_change: "任务状态已变更",
  comment: "有新留言",
  unblocked: "任务可以开始了",
  due_soon: "截止日期临近",
  overdue: "已超过截止日期",
  rescheduled: "日程已调整",
  weekly_summary: "本周工作摘要",
  notice: "发布了新公告",
  decision_needed: "需要确认/批准",
  inquiry: "收到新咨询",
  inquiry_answered: "咨询已回复",
  quote_request: "收到新报价请求",
  quote_response: "收到报价单回复",
  purchase_order: "收到新订单",
  order_status_change: "订单状态已变更",
  order_cancel_request: "收到订单取消请求",
  contract_signed: "合同签署已完成",
  contract_revision_requested: "收到合同修改请求",
  contract_expiring: "合同即将到期",
  partner_archive: "合作伙伴资料库有新动态",
  supplier_invoice_submitted: "已提交合作伙伴账单",
  supplier_invoice_paid: "账单已支付完成",
  supplier_quote_submitted: "已提交合作伙伴报价单",
  supplier_quote_approved: "报价单已批准",
  supplier_quote_rejected: "报价单已驳回",
  supplier_quote_revision_requested: "报价单收到修改请求",
};

export const onNotificationCreated = onDocumentCreated(
  { document: "notifications/{notificationId}", secrets: [internalNotifySecret] },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const notif = snap.data();
    if (!notif) return;

    // Cloud Functions는 드물게 같은 생성 이벤트를 두 번 전달할 수 있다(at-least-once 전달).
    // 트랜잭션으로 "이미 처리됨" 플래그를 확인/기록해서 같은 알림의 푸시·이메일이
    // 중복 발송되지 않게 막는다.
    const alreadyDispatched = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(snap.ref);
      if (fresh.data()?.dispatched) return true;
      tx.update(snap.ref, { dispatched: true });
      return false;
    });
    if (alreadyDispatched) return;

    const userSnap = await db.collection("users").doc(notif.userId).get();
    const userData = userSnap.data();
    const email = userData?.email as string | undefined;
    const fcmTokens = Array.from(new Set((userData?.fcmTokens as string[] | undefined) ?? []));

    // 사용자가 이 알림 유형을 껐으면(기본값 on) 인앱 알림 기록만 남기고
    // 푸시·이메일 발송은 건너뛴다. Firestore notifications 문서 자체는 이미
    // 클라이언트에서 생성된 뒤라 알림 벨(인앱 목록)에는 그대로 남는다.
    const prefs = userData?.notificationPrefs as Record<string, boolean> | undefined;
    if (prefs?.[notif.type as string] === false) return;

    const isZhPartner = userData?.partnerLang === "zh";
    const title = isZhPartner
      ? NOTIFICATION_TITLE_ZH[notif.type as string] ?? "新通知"
      : NOTIFICATION_TITLE[notif.type as string] ?? "새 알림";
    // 새 발주 알림은 관리자가 바로 발주서를 볼 수 있도록, 청구서 발행 알림은 클라이언트가
    // 바로 해당 회차 청구서를 볼 수 있도록 각각 발주서/청구서 페이지로 직접 연결한다.
    const link = notif.projectId
      ? `https://handyhand.co.kr/projects/${notif.projectId}`
      : notif.type === "inquiry"
      ? "https://handyhand.co.kr/inquiries"
      : notif.type === "inquiry_answered"
      ? "https://handyhand.co.kr/my-inquiries"
      : notif.type === "quote_request" || notif.type === "quote_response"
      ? "https://handyhand.co.kr/quotes"
      : notif.type === "notice"
      ? "https://handyhand.co.kr/notices"
      : notif.type === "purchase_order" && notif.orderId
      ? `https://handyhand.co.kr/orders/${notif.orderId}/print`
      : notif.type === "purchase_order"
      ? "https://handyhand.co.kr/orders"
      : notif.type === "order_cancel_request"
      ? "https://handyhand.co.kr/orders"
      : notif.type === "order_status_change" && notif.orderId && notif.invoiceIndex !== undefined
      ? `https://handyhand.co.kr/orders/${notif.orderId}/invoice/${notif.invoiceIndex}`
      : notif.type === "order_status_change"
      ? "https://handyhand.co.kr/my-orders"
      : notif.type === "contract_signed" || notif.type === "contract_revision_requested" || notif.type === "contract_expiring"
      ? "https://handyhand.co.kr/contracts"
      : "https://handyhand.co.kr/home";

    // 홈 화면 앱을 지웠거나 브라우저를 바꾸면 토큰이 사라지는데, 그러면 조용히 푸시만 안 온다 —
    // 관리자 본인 계정에 토큰이 하나도 없으면 그 사실을 화면에 띄운다(고객 계정은 제외:
    // 고객이 푸시를 안 켜두는 건 정상이라 매번 경고가 뜨면 소음이 된다).
    if (fcmTokens.length === 0 && userData?.role === "admin") {
      await recordSystemAlert(
        "push-token",
        "관리자 계정에 등록된 푸시 토큰이 없어 푸시 알림이 가지 않습니다. 홈 화면에 추가한 앱에서 알림을 다시 허용해 주세요."
      );
    }

    if (fcmTokens.length > 0) {
      // 최상위 notification 필드를 넣으면 브라우저가 자동으로 배너를 띄우는 동시에
      // 서비스워커의 onBackgroundMessage도 별도로 showNotification을 호출해서, 기기에
      // 배너가 두 번 뜨는 경우가 있다(FCM 웹 푸시의 알려진 동작). data-only 메시지로
      // 보내고 배너 표시는 서비스워커에서만 하도록 해서 중복을 막는다.
      const res = await messaging.sendEachForMulticast({
        tokens: fcmTokens,
        data: { title, body: notif.message as string, link },
        webpush: { fcmOptions: { link } },
      });
      const staleTokens = res.responses
        .map((r, i) => (!r.success && (r.error?.code === "messaging/registration-token-not-registered") ? fcmTokens[i] : null))
        .filter((t): t is string => !!t);
      if (staleTokens.length > 0) {
        await userSnap.ref.update({ fcmTokens: FieldValue.arrayRemove(...staleTokens) });
      }
      // 만료된 토큰(위에서 정리함)이 아닌 진짜 실패는 관리자 화면에 띄운다 — 여태 이런 실패는
      // Cloud Functions 로그에만 남아서, 푸시가 안 오는 걸 사람이 직접 눈치채야 했다.
      const realFailures = res.responses.filter(
        (r) => !r.success && r.error?.code !== "messaging/registration-token-not-registered"
      );
      if (realFailures.length > 0) {
        await recordSystemAlert(
          "push",
          `푸시 알림 발송이 실패했습니다 (${realFailures.length}건). 사유: ${realFailures[0].error?.code ?? "알 수 없음"}`
        );
      }
    }

    if (!email) return;

    // 클라이언트 계정이면 인사말에 회사명을 같이 붙인다(관리자 계정은 소속 회사가 없어 이름만).
    let companyName: string | undefined;
    if (userData?.role === "client" && userData?.clientId) {
      const clientSnap = await db.collection("clients").doc(userData.clientId as string).get();
      companyName = clientSnap.data()?.name;
    }

    // 메시지 본문(notif.message)은 업무명만 담고 있어 "무슨 업무야?" 싶을 때가 있다 —
    // projectId가 있으면 프로젝트명을 알림 박스 상단에 같이 보여준다. 개별 알림 생성
    // 지점(assignTask 등) 수십 곳을 전부 고치는 대신 공용 발송 지점 한 곳만 손본다.
    let projectName: string | undefined;
    if (notif.projectId) {
      const projectSnap = await db.collection("projects").doc(notif.projectId as string).get();
      projectName = projectSnap.data()?.name;
    }

    const buttonLabel =
      notif.type === "purchase_order" && notif.orderId
        ? "발주서 보기"
        : notif.type === "order_status_change" && notif.orderId && notif.invoiceIndex !== undefined
        ? "청구서 보기"
        : notif.type === "contract_signed" || notif.type === "contract_revision_requested" || notif.type === "contract_expiring"
        ? "계약 확인하기"
        : "HANDYWORKS에서 확인하기";

    const html = `
      <h2 style="color: #1d1d1f; margin: 0 0 16px; font-size: 19px;">${title}</h2>
      <p style="font-size: 13px; color: #86868b; line-height: 1.6;">
        안녕하세요. ${companyName ? companyName + " " : ""}${userData?.name ?? ""}님, HANDYWORKS에서 아래와 같은 소식을 안내드립니다.
      </p>
      ${
        typeof notif.aiSummary === "string" && notif.aiSummary
          ? `<div style="background: #f0f7ff; border-radius: 12px; padding: 14px 16px; margin: 20px 0 0;">
              <p style="margin: 0 0 4px; font-size: 11px; font-weight: 600; color: #4a7fd6; letter-spacing: 0.02em;">AI 요약</p>
              <p style="margin: 0; color: #1d1d1f; font-size: 13px; line-height: 1.6;">${notif.aiSummary}</p>
            </div>`
          : ""
      }
      <div style="background: #ffffff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 16px; font-size: 14px; margin: 20px 0 0;">
        ${projectName ? `<p style="margin: 0 0 6px; color: #1d1d1f; font-weight: 600;">${projectName} 프로젝트</p>` : ""}
        <p style="margin: 0; color: #1d1d1f; line-height: 1.6;">${notif.message}</p>
        ${
          Array.isArray(notif.details) && notif.details.length > 0
            ? `<ul style="margin: 10px 0 0; padding-left: 18px; color: #1d1d1f; font-size: 13px; line-height: 1.9;">${(notif.details as string[])
                .map((d) => `<li>${d}</li>`)
                .join("")}</ul>`
            : ""
        }
      </div>
      <div style="text-align: center; margin-top: 20px;"><a href="${link}" style="display: inline-block; background: #1d1d1f; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 999px; font-size: 14px; font-weight: 600;">${buttonLabel}</a></div>
      <p style="margin-top: 24px; font-size: 12px; color: #86868b;">HANDYWORKS 알림 설정에 따라 자동 발송된 이메일입니다.</p>
    `;

    await sendNotifyEmail(email, `[HANDYWORKS] ${title}`, html);
  }
);
