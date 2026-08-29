import { FieldValue } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { db, internalNotifySecret, formatMoneySimple } from "./shared";

/* ------------------------------------------------------------------ */
/* 미수금 리마인더 — checkStaleQuotes(quotes.ts)와 같은 패턴.               */
/*   청구서를 발행(issuedAt)해놓고 일정 기간이 지나도 입금 확인(paid)이 안    */
/*   되면, 발주한 고객에게 알림(=이메일)을 한 번 보낸다. 회차별로            */
/*   paymentReminderSentAt을 남겨 중복 발송을 막는다.                       */
/* ------------------------------------------------------------------ */
export const checkOverdueInvoices = onSchedule(
  { schedule: "0 9 * * *", timeZone: "Asia/Seoul", secrets: [internalNotifySecret] },
  async () => {
    const snap = await db.collection("purchaseOrders").get();
    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      if (data.status === "cancelled") continue;
      const installments = (data.payment?.installments ?? []) as {
        label: string;
        amount: number;
        currency?: string;
        paid: boolean;
        issuedAt?: number;
        paymentReminderSentAt?: number;
      }[];
      if (installments.length === 0) continue;

      // 원화/달러가 섞인 발주는 없다고 가정하지 않고, 품목 통화 구성으로 청구서 쪽에서 하던
      // 것과 같은 방식으로 판단한다 — 발주 품목이 전부 USD면 이 발주는 달러 청구다.
      const items = (data.items ?? []) as { currency?: string }[];
      const isUsdOrder = items.length > 0 && items.every((it) => it.currency === "USD");

      let changed = false;
      const updatedInstallments = installments.map((it) => {
        if (!it.issuedAt || it.paid || it.paymentReminderSentAt) return it;
        if (now - it.issuedAt < SEVEN_DAYS_MS) return it;
        changed = true;
        return { ...it, paymentReminderSentAt: now };
      });
      if (!changed) continue;

      await docSnap.ref.update({ "payment.installments": updatedInstallments });

      const overdue = installments.filter(
        (it, i) => updatedInstallments[i].paymentReminderSentAt && !it.paymentReminderSentAt
      );
      for (const it of overdue) {
        try {
          await db.collection("notifications").add({
            userId: data.orderedBy,
            type: "order_status_change",
            orderId: docSnap.id,
            invoiceIndex: installments.indexOf(it),
            message: `발주(${data.poNumber}) ${it.label} 청구서(${formatMoneySimple(it.amount, isUsdOrder ? "USD" : "KRW")})가 아직 입금 확인되지 않았습니다. 확인 부탁드립니다.`,
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          });
        } catch (e) {
          console.error("미수금 리마인더 알림 생성 실패:", e);
        }
      }
    }
  }
);
