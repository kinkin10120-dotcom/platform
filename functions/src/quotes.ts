import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { contractEmailMatches } from "./emailMatch";
import { db, storage, internalNotifySecret, sendNotifyEmail, formatMoneySimple } from "./shared";

/* ------------------------------------------------------------------ */
/* 4-2) 새 견적 요청 접수 시 관리자 전원에게 알림                              */
/*    - /api/quote 라우트는 인증 없는 공개 요청이라(클라이언트 SDK, 서버)       */
/*      Firestore 규칙상 notifications를 직접 쓸 수 없다. 대신 quoteRequests   */
/*      문서 생성을 여기서 감지해 관리자 권한(Admin SDK)으로 알림을 생성한다.    */
/* ------------------------------------------------------------------ */
export const onQuoteRequestCreated = onDocumentCreated("quoteRequests/{quoteId}", async (event) => {
  const quote = event.data?.data();
  if (!quote) return;

  const adminsSnap = await db.collection("users").where("role", "==", "admin").get();
  const message = `${quote.name}${quote.company ? ` (${quote.company})` : ""}님이 견적을 요청했습니다.`;
  const details = [
    ...(quote.stage ? [`개발 단계: ${quote.stage}`] : []),
    ...(quote.description ? [`제품 개요: ${quote.description}`] : []),
  ];

  await Promise.all(
    adminsSnap.docs.map((a) =>
      db.collection("notifications").add({
        userId: a.id,
        type: "quote_request",
        message,
        ...(details.length > 0 ? { details } : {}),
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      })
    )
  );
});

/* ------------------------------------------------------------------ */
/* 정식 견적서 발행/열람/응답 — quoteRequests 컬렉션도 contracts와 마찬가지로  */
/* Firestore 규칙상 관리자 전용이라, 비로그인 고객 쪽 열람·응답은 이메일      */
/* 대조(emailMatch.ts)로 본인확인하는 Admin SDK 우회 경로로만 처리한다.       */
/* ------------------------------------------------------------------ */
async function sendQuoteIssuedEmail(
  email: string,
  info: { quoteId: string; name: string; company?: string }
) {
  const viewLink = `https://handyhand.co.kr/quotes/view/${info.quoteId}`;
  const html = `
    <h2 style="color: #1d1d1f; margin: 0 0 16px; font-size: 19px;">견적서가 도착했습니다</h2>
    <p style="font-size: 13px; color: #86868b; line-height: 1.6;">
      안녕하세요. ${info.company ? `${info.company} ` : ""}${info.name}님<br/><br/>
      먼저 저희 HANDYHAND에 견적을 문의해 주셔서 진심으로 감사드립니다. 요청하신 내용을 바탕으로
      견적서를 준비하여 보내드리오니 확인 부탁드립니다.<br/><br/>
      아래 버튼을 눌러 견적 내용을 확인해주세요. 요청하실 때 남겨주신 이메일로 본인 확인 후 견적서를
      보실 수 있고, 그 자리에서 바로 수락 또는 거절하실 수 있습니다. 자세한 내용이 궁금하시거나
      추가로 요청하실 사항이 있으시면 언제든 편하게 연락 주시기 바랍니다.
    </p>
    <div style="background: #ffffff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 16px; font-size: 14px; margin: 20px 0 0;">
      <p style="margin: 0; color: #1d1d1f;">${info.company ? `${info.company} · ` : ""}${info.name}님</p>
    </div>
    <div style="text-align: center; margin-top: 20px;"><a href="${viewLink}" style="display: inline-block; background: #1d1d1f; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 999px; font-size: 14px; font-weight: 600;">견적서 확인하기</a></div>
  `;
  await sendNotifyEmail(email, "[HANDYWORKS] 견적서가 도착했습니다", html);
}

export const issueQuote = onCall({ invoker: "public", secrets: [internalNotifySecret] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  }
  const callerSnap = await db.collection("users").doc(request.auth.uid).get();
  if (!callerSnap.exists || callerSnap.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "관리자만 발행할 수 있습니다.");
  }

  const { quoteId, items, memo } = request.data as {
    quoteId?: string;
    items?: { name: string; unitPrice: number; currency: string; quantity: number; unit?: string; vatApplicable?: boolean }[];
    memo?: string;
  };
  if (!quoteId || !items?.length) {
    throw new HttpsError("invalid-argument", "quoteId, items는 필수입니다.");
  }
  const snap = await db.collection("quoteRequests").doc(quoteId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "존재하지 않는 견적 요청입니다.");
  }
  const data = snap.data()!;

  await snap.ref.update({
    quoteItems: items,
    quoteMemo: memo || "",
    quoteStatus: "sent",
    quoteIssuedAt: FieldValue.serverTimestamp(),
    quoteIssuedBy: "주식회사 핸디핸드 최형준 대표",
    quoteRespondedAt: FieldValue.delete(),
    quoteDeclineReason: FieldValue.delete(),
    // 정식 견적서를 발행했다는 건 이미 담당자와 소통이 끝났다는 뜻이라, 리드 관리용
    // 상태(검토중/검토완료/연락완료)도 자동으로 "연락완료"로 맞춰준다 — 그래야 상단 목록의
    // "미처리 N건" 카운트와 상세 화면 배지가 실제 발행된 견적서 상태와 어긋나지 않는다.
    status: "contacted",
  });

  await sendQuoteIssuedEmail(data.email, { quoteId, name: data.name, company: data.company });

  return { ok: true };
});

export const getQuoteForViewing = onCall({ invoker: "public" }, async (request) => {
  const { quoteId, email } = request.data as { quoteId?: string; email?: string };
  if (!quoteId || !email) {
    throw new HttpsError("invalid-argument", "quoteId, email은 필수입니다.");
  }
  const snap = await db.collection("quoteRequests").doc(quoteId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "존재하지 않는 견적입니다.");
  }
  const data = snap.data()!;
  if (!contractEmailMatches(data.email, email)) {
    throw new HttpsError("permission-denied", "이메일이 일치하지 않습니다.");
  }
  if (!data.quoteStatus) {
    throw new HttpsError("not-found", "아직 발행되지 않은 견적입니다.");
  }

  // 고객이 링크를 열어봤는지(최초 1회) — 리마인더가 "안 열어본 건지 열어보고 고민 중인
  // 건지"를 구분할 수 있게, 관리자 목록에 배지로 노출한다.
  if (!data.quoteViewedAt) {
    await snap.ref.update({ quoteViewedAt: FieldValue.serverTimestamp() });
  }

  return {
    quoteId,
    name: data.name,
    company: data.company,
    items: data.quoteItems ?? [],
    quoteMemo: data.quoteMemo ?? "",
    quoteStatus: data.quoteStatus,
    quoteIssuedAt: data.quoteIssuedAt?.toMillis ? data.quoteIssuedAt.toMillis() : data.quoteIssuedAt,
    quoteIssuedBy: data.quoteIssuedBy,
    bizRegCertUploaded: !!data.bizRegCertUrl,
  };
});

export const respondToQuote = onCall({ invoker: "public" }, async (request) => {
  const { quoteId, email, accept, reason } = request.data as {
    quoteId?: string;
    email?: string;
    accept?: boolean;
    reason?: string;
  };
  if (!quoteId || !email || typeof accept !== "boolean") {
    throw new HttpsError("invalid-argument", "quoteId, email, accept는 필수입니다.");
  }
  const snap = await db.collection("quoteRequests").doc(quoteId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "존재하지 않는 견적입니다.");
  }
  const data = snap.data()!;
  if (!contractEmailMatches(data.email, email)) {
    throw new HttpsError("permission-denied", "이메일이 일치하지 않습니다.");
  }
  if (data.quoteStatus !== "sent") {
    throw new HttpsError("failed-precondition", "지금은 응답할 수 없는 상태입니다.");
  }

  await snap.ref.update({
    quoteStatus: accept ? "accepted" : "declined",
    quoteRespondedAt: FieldValue.serverTimestamp(),
    // issueQuote에서 발행 시점에 리드 상태(status)를 "연락완료"로 맞춰주지만, 그 이전에
    // 발행된 오래된 문서는 status가 여전히 "pending"으로 남아있을 수 있다 — 고객이 실제로
    // 응답한 시점에도 다시 한 번 맞춰줘서, 상세/목록 배지가 어긋나지 않게 한다.
    status: "contacted",
    ...(accept ? {} : { quoteDeclineReason: reason || "" }),
  });

  const adminsSnap = await db.collection("users").where("role", "==", "admin").get();
  const message = `${data.name}${data.company ? ` (${data.company})` : ""}님이 견적서를 ${accept ? "수락" : "거절"}했습니다.`;
  const quoteItems = (data.quoteItems ?? []) as { name: string; unitPrice: number; currency: string; quantity: number; unit?: string }[];
  const details = [
    ...quoteItems.map((it) => `${it.name} × ${it.quantity}${it.unit || "개"} — ${formatMoneySimple(it.unitPrice * it.quantity, it.currency)}`),
    ...(!accept && reason ? [`거절 사유: ${reason}`] : []),
  ];
  await Promise.all(
    adminsSnap.docs.map((a) =>
      db.collection("notifications").add({
        userId: a.id,
        type: "quote_response",
        message,
        ...(details.length > 0 ? { details } : {}),
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      })
    )
  );

  return { ok: true };
});

// 견적서를 수락한 자리에서 바로 사업자등록증을 첨부할 수 있게 한다 — uploadContractBizRegCert와
// 동일한 패턴. 여기서 첨부해두면, 이 견적에서 "계약서 작성하기"로 이어서 만든 계약은
// bizRegCertUrl을 그대로 이어받아 서명 페이지에서 첨부를 다시 요구하지 않는다(중복 방지).
export const uploadQuoteBizRegCert = onCall({ invoker: "public" }, async (request) => {
  const { quoteId, email, fileDataUrl } = request.data as { quoteId?: string; email?: string; fileDataUrl?: string };
  if (!quoteId || !email) {
    throw new HttpsError("invalid-argument", "quoteId, email은 필수입니다.");
  }
  const snap = await db.collection("quoteRequests").doc(quoteId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "존재하지 않는 견적입니다.");
  }
  const data = snap.data()!;
  if (!contractEmailMatches(data.email, email)) {
    throw new HttpsError("permission-denied", "이메일이 일치하지 않습니다.");
  }
  if (!fileDataUrl) {
    throw new HttpsError("invalid-argument", "파일이 필요합니다.");
  }

  const match = /^data:([\w/+.-]+);base64,(.*)$/.exec(fileDataUrl);
  if (!match) {
    throw new HttpsError("invalid-argument", "파일 형식이 올바르지 않습니다.");
  }
  const contentType = match[1];
  const ext = contentType === "application/pdf" ? "pdf" : contentType.split("/")[1] ?? "bin";
  const buffer = Buffer.from(match[2], "base64");
  const bucket = storage.bucket();
  const certPath = `quoteRequests/${snap.id}/bizRegCert.${ext}`;
  await bucket.file(certPath).save(buffer, { contentType });
  const bizRegCertUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(certPath)}?alt=media`;

  await snap.ref.update({ bizRegCertUrl, updatedAt: FieldValue.serverTimestamp() });

  const adminsSnap = await db.collection("users").where("role", "==", "admin").get();
  const bizRegCertQuoteItems = (data.quoteItems ?? []) as { name: string; unitPrice: number; currency: string; quantity: number; unit?: string }[];
  const bizRegCertDetails = bizRegCertQuoteItems.map(
    (it) => `${it.name} × ${it.quantity}${it.unit || "개"} — ${formatMoneySimple(it.unitPrice * it.quantity, it.currency)}`
  );
  await Promise.all(
    adminsSnap.docs.map((a) =>
      db.collection("notifications").add({
        userId: a.id,
        type: "quote_response",
        message: `${data.name}${data.company ? ` (${data.company})` : ""}님이 견적서 수락 후 사업자등록증을 첨부했습니다.`,
        ...(bizRegCertDetails.length > 0 ? { details: bizRegCertDetails } : {}),
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      })
    )
  );

  return { ok: true, bizRegCertUrl };
});

async function sendQuoteReminderEmail(
  email: string,
  info: { quoteId: string; name: string; company?: string; items?: { name: string }[] }
) {
  const viewLink = `https://handyhand.co.kr/quotes/view/${info.quoteId}`;
  const itemNames = (info.items ?? []).map((it) => it.name).filter(Boolean).join(", ");
  const html = `
    <h2 style="color: #1d1d1f; margin: 0 0 16px; font-size: 19px;">견적서 검토 회신을 기다리고 있습니다</h2>
    <p style="font-size: 13px; color: #86868b; line-height: 1.6;">
      안녕하세요. ${info.company ? `${info.company} ` : ""}${info.name}님<br/><br/>
      먼저 저희 HANDYHAND에 견적을 문의해 주셔서 진심으로 감사드립니다.<br/><br/>
      지난번 보내드린 견적서에 대해 아직 회신을 받지 못하여 다시 한번 안내 말씀드립니다.
      바쁘신 업무 중 번거로우시겠지만, 아래 버튼을 통해 내용을 확인하신 후 수락 또는 거절 여부를
      회신해 주시면 감사하겠습니다.<br/><br/>
      검토 중 궁금하신 점이나 조율이 필요한 부분이 있으시면 언제든 편하게 회신 부탁드립니다.
    </p>
    <div style="background: #ffffff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 16px; font-size: 14px; margin: 20px 0 0;">
      ${itemNames ? `<p style="margin: 0 0 6px; color: #1d1d1f;">견적 항목: ${itemNames}</p>` : ""}
      <p style="margin: 0; color: #1d1d1f;">${info.company ? `${info.company} · ` : ""}${info.name}님</p>
    </div>
    <div style="text-align: center; margin-top: 20px;"><a href="${viewLink}" style="display: inline-block; background: #1d1d1f; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 999px; font-size: 14px; font-weight: 600;">견적서 확인하기</a></div>
  `;
  await sendNotifyEmail(email, "[HANDYWORKS] 견적서 검토 회신을 기다리고 있습니다", html);
}

// 발행된 지 6일 지나도 응답 없는 견적서엔 한 번 리마인드 메일을 보내고, 7일이 지나면
// "기간만료"로 자동 전환한다 — 거절(고객이 명시적으로 거부)과는 다른 상태로 둬서, 나중에
// 고객이 다시 연락해도 "거절했었다"는 오해가 생기지 않게 한다. 만료된 건은 관리자가
// 상세 화면에서 같은 내용으로 다시 발송(리마인드)할 수 있다.
export const checkStaleQuotes = onSchedule(
  { schedule: "0 9 * * *", timeZone: "Asia/Seoul", secrets: [internalNotifySecret] },
  async () => {
    const snap = await db.collection("quoteRequests").where("quoteStatus", "==", "sent").get();
    const now = Date.now();
    const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const issuedAt = data.quoteIssuedAt?.toMillis ? data.quoteIssuedAt.toMillis() : data.quoteIssuedAt;
      if (!issuedAt) continue;
      const age = now - issuedAt;

      if (age >= SEVEN_DAYS_MS) {
        await docSnap.ref.update({
          quoteStatus: "expired",
          quoteRespondedAt: FieldValue.serverTimestamp(),
        });
        continue;
      }

      if (age >= SIX_DAYS_MS && !data.quoteReminderSentAt) {
        await docSnap.ref.update({ quoteReminderSentAt: FieldValue.serverTimestamp() });
        try {
          await sendQuoteReminderEmail(data.email, { quoteId: docSnap.id, name: data.name, company: data.company, items: data.quoteItems });
        } catch (e) {
          console.error("견적 리마인더 메일 발송 실패:", e);
        }
      }
    }
  }
);
