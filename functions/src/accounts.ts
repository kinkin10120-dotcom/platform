import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, auth, internalNotifySecret, sendNotifyEmail } from "./shared";

/* ------------------------------------------------------------------ */
/* 1) 클라이언트 계정 생성 (관리자 전용 callable)                          */
/*    - 클라이언트 SDK로 직접 생성하면 현재 로그인한 관리자가 로그아웃되므로,   */
/*      서버(Admin SDK)에서 대신 계정을 만들어 이메일 없이도 즉시 발급한다.   */
/* ------------------------------------------------------------------ */
export const createClientAccount = onCall({ invoker: "public", secrets: [internalNotifySecret] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const callerSnap = await db.collection("users").doc(request.auth.uid).get();
  if (!callerSnap.exists || callerSnap.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "관리자만 계정을 생성할 수 있습니다.");
  }

  const { email, name, clientId } = request.data as {
    email?: string;
    name?: string;
    clientId?: string;
  };

  if (!email || !name || !clientId) {
    throw new HttpsError("invalid-argument", "email, name, clientId는 필수입니다.");
  }

  const clientSnap = await db.collection("clients").doc(clientId).get();
  if (!clientSnap.exists) {
    throw new HttpsError("not-found", "존재하지 않는 클라이언트입니다.");
  }

  let userRecord;
  try {
    // 비밀번호 없이 계정만 먼저 만들고, 실제 비밀번호는 클라이언트 본인이 이메일 링크로 직접
    // 설정하게 한다(관리자가 비밀번호를 알거나 평문으로 전달할 필요가 없어짐).
    userRecord = await auth.createUser({ email, displayName: name });
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

  await sendAccountEmail(email, name, "created", clientSnap.data()?.name);

  return { uid: userRecord.uid };
});

/* ------------------------------------------------------------------ */
/* 1-0-1) 협력사(파트너) 계정 생성 (관리자 전용 callable)                    */
/*    - 중국 파트너 공장 등 제조 협력사에게 지정된 프로젝트의 일정·업무·       */
/*      첨부 자료·코멘트만 보여주는 용도. clientId 대신 projectIds 배열로     */
/*      볼 수 있는 프로젝트를 지정한다(firestore.rules의 belongsToPartnerProject). */
/* ------------------------------------------------------------------ */
export const createPartnerAccount = onCall({ invoker: "public", secrets: [internalNotifySecret] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const callerSnap = await db.collection("users").doc(request.auth.uid).get();
  if (!callerSnap.exists || callerSnap.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "관리자만 계정을 생성할 수 있습니다.");
  }

  const { email, name, projectIds, partnerLang } = request.data as {
    email?: string;
    name?: string;
    projectIds?: string[];
    partnerLang?: "ko" | "zh";
  };

  if (!email || !name || !projectIds?.length) {
    throw new HttpsError("invalid-argument", "email, name, projectIds는 필수입니다.");
  }
  if (partnerLang && partnerLang !== "ko" && partnerLang !== "zh") {
    throw new HttpsError("invalid-argument", "partnerLang은 ko 또는 zh만 가능합니다.");
  }

  // 존재하지 않는 프로젝트를 잘못 지정하는 실수를 막는다.
  for (const projectId of projectIds) {
    const snap = await db.collection("projects").doc(projectId).get();
    if (!snap.exists) {
      throw new HttpsError("not-found", `존재하지 않는 프로젝트입니다: ${projectId}`);
    }
  }

  let userRecord;
  try {
    userRecord = await auth.createUser({ email, displayName: name });
  } catch (err: any) {
    if (err?.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "이미 사용 중인 이메일입니다.");
    }
    throw new HttpsError("internal", `계정 생성 중 오류가 발생했습니다: ${err?.message ?? err}`);
  }

  await db.collection("users").doc(userRecord.uid).set({
    email,
    name,
    role: "partner",
    projectIds,
    partnerLang: partnerLang ?? "ko",
    createdAt: FieldValue.serverTimestamp(),
  });

  await sendAccountEmail(email, name, "created");

  return { uid: userRecord.uid };
});

/* ------------------------------------------------------------------ */
/* 1-0-2) 협력사 계정의 프로젝트 접근 범위·UI 언어 수정 (관리자 전용 callable)   */
/* ------------------------------------------------------------------ */
export const updatePartnerProjects = onCall({ invoker: "public" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  const callerSnap = await db.collection("users").doc(request.auth.uid).get();
  if (!callerSnap.exists || callerSnap.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "관리자만 사용할 수 있습니다.");
  }
  const { uid, projectIds, partnerLang } = request.data as {
    uid?: string;
    projectIds?: string[];
    partnerLang?: "ko" | "zh";
  };
  if (!uid || !projectIds) {
    throw new HttpsError("invalid-argument", "uid, projectIds는 필수입니다.");
  }
  if (partnerLang && partnerLang !== "ko" && partnerLang !== "zh") {
    throw new HttpsError("invalid-argument", "partnerLang은 ko 또는 zh만 가능합니다.");
  }
  const targetSnap = await db.collection("users").doc(uid).get();
  if (!targetSnap.exists || targetSnap.data()?.role !== "partner") {
    throw new HttpsError("not-found", "존재하지 않는 협력사 계정입니다.");
  }
  await targetSnap.ref.update({ projectIds, ...(partnerLang ? { partnerLang } : {}) });
  return { ok: true };
});

/* ------------------------------------------------------------------ */
/* 1-1) 비밀번호 설정/재설정 링크 이메일 발송 (관리자 전용 callable)          */
/*    - 계정 생성 시 자동으로 한 번 호출되고, 클라이언트가 비밀번호를 잊었을 때  */
/*      관리자가 계정 관리 화면에서 다시 트리거할 수도 있다.                  */
/* ------------------------------------------------------------------ */
export const sendPasswordResetLink = onCall({ invoker: "public", secrets: [internalNotifySecret] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  }
  const callerSnap = await db.collection("users").doc(request.auth.uid).get();
  if (!callerSnap.exists || callerSnap.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "관리자만 사용할 수 있습니다.");
  }

  const { email, name, company } = request.data as { email?: string; name?: string; company?: string };
  if (!email) {
    throw new HttpsError("invalid-argument", "email은 필수입니다.");
  }

  await sendAccountEmail(email, name ?? "", "reset", company);
  return { ok: true };
});

/* ------------------------------------------------------------------ */
/* 1-2) 클라이언트 계정 삭제 (관리자 전용 callable)                        */
/*    - Firebase Auth 계정과 users/{uid} Firestore 문서를 함께 삭제한다.    */
/* ------------------------------------------------------------------ */
export const deleteClientAccount = onCall({ invoker: "public" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  const callerSnap = await db.collection("users").doc(request.auth.uid).get();
  if (!callerSnap.exists || callerSnap.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "관리자만 사용할 수 있습니다.");
  }
  const { uid, email } = request.data as { uid?: string; email?: string };
  if (!uid && !email) throw new HttpsError("invalid-argument", "uid 또는 email이 필요합니다.");

  const targetUid = uid ?? (await auth.getUserByEmail(email!)).uid;
  await auth.deleteUser(targetUid);
  await db.collection("users").doc(targetUid).delete().catch(() => {});
  return { ok: true, uid: targetUid };
});

async function sendAccountEmail(email: string, name: string, kind: "created" | "reset", company?: string) {
  const resetLink = await auth.generatePasswordResetLink(email, {
    url: "https://handyhand.co.kr/login",
  });
  const greeting = kind === "created"
    ? `안녕하세요. ${company ? company + " " : ""}${name}님<br/><br/>저희 HANDYHAND와 함께해 주셔서 감사드립니다.<br/>원활한 소통과 투명한 프로젝트 관리를 위해 HANDYWORKS 계정을 발급해 드렸으며, 이를 통해 제품개발·제조 전 과정의 진행 상황을 실시간으로 확인하실 수 있습니다.`
    : `안녕하세요. ${company ? company + " " : ""}${name}님<br/>비밀번호 재설정을 요청해 주셔서 안내드립니다. 아래 버튼을 눌러 새 비밀번호를 설정하신 후 다시 로그인해 주시기 바랍니다.`;
  const title = kind === "created" ? "HANDYWORKS 계정이 생성되었습니다" : "비밀번호 재설정 안내";
  const cta = kind === "created" ? "비밀번호 설정하고 시작하기" : "비밀번호 재설정하기";

  const html = `
    <h2 style="color: #1d1d1f; margin: 0 0 16px; font-size: 19px;">${title}</h2>
    <p style="color: #1d1d1f; font-size: 14px; line-height: 1.6;">${greeting}</p>
    <p style="color: #86868b; font-size: 13px; margin: 16px 0;">아래 버튼을 눌러 비밀번호를 설정한 뒤 로그인해주세요. 로그인 이메일은 <b style="color:#1d1d1f">${email}</b> 입니다.</p>
    <p style="color: #86868b; font-size: 13px; margin: 0 0 16px;">이 링크는 <b style="color:#1d1d1f">1시간 동안만</b> 유효합니다. 시간이 지나면 다시 요청해주세요.</p>
    ${kind === "reset" ? `
    <p style="color: #86868b; font-size: 13px; margin: 0 0 16px;">안전한 계정 관리를 위해 이 링크는 요청하신 분께만 개별적으로 발급되었으니, 타인에게 공유되지 않도록 유의해 주시기 바랍니다.</p>` : ""}
    <div style="text-align: center; margin-top: 20px;"><a href="${resetLink}" style="display: inline-block; background: #1d1d1f; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 999px; font-size: 14px; font-weight: 600;">${cta}</a></div>
    ${kind === "created" ? `
    <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e5e5e5;">
      <p style="color: #1d1d1f; font-size: 14px; font-weight: 600; margin: 0 0 10px;">간단 사용법</p>
      <ul style="color: #1d1d1f; font-size: 13px; line-height: 1.9; margin: 0; padding-left: 18px;">
        <li>홈 화면에서 프로젝트 진행률과 업무 일정을 한눈에 확인할 수 있어요.</li>
        <li>업무를 클릭하면 상세 내용, 첨부 파일, 코멘트를 볼 수 있어요.</li>
        <li>확인/승인이 필요한 업무는 화면 상단에 강조되어 표시돼요.</li>
        <li>궁금한 점은 사이드바의 "문의하기" 메뉴로 언제든 남겨주세요.</li>
      </ul>
    </div>` : ""}
    <p style="margin-top: 24px; font-size: 12px; color: #86868b;">${kind === "reset" ? "본인이 요청하지 않으신 경우라면 별도의 조치 없이 이 메일을 무시하셔도 무방합니다. 궁금하신 점이 있으시면 언제든 편하게 문의해 주시기 바랍니다." : "이 이메일에 대한 요청을 하지 않으셨다면 무시하셔도 됩니다."}</p>
  `;

  await sendNotifyEmail(email, `[HANDYWORKS] ${title}`, html);
}
