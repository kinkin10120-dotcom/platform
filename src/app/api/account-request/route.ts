import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createAccountRequest } from "@/lib/firestore/accountRequests";

// 로그인 페이지 "계정 생성 문의" 폼 — 관리자가 로그인 상태가 아닐 수도 있는 리드 알림이라
// /api/quote와 동일하게 이메일로 먼저 알리고, Firestore에도 남겨 나중에 참고할 수 있게 한다.
export async function POST(req: NextRequest) {
  const { name, email, company, message } = await req.json();

  if (!name || !email) {
    return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
  }

  // 저장을 먼저 한다 — 이메일 발송(Resend 키 누락/API 장애 등)이 뭔가 잘못돼도 문의 내용
  // 자체는 Firestore에 남아야 나중에라도 확인할 수 있다. 저장까지 실패하면 그제서야 에러로
  // 응답한다(사람에겐 "실패했으니 다시 시도해달라"고 보여야 하므로).
  try {
    await createAccountRequest({ name, email, company, message });
  } catch (e) {
    console.error("계정 생성 문의 저장 실패:", e);
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: "HANDYHAND <noreply@handyhand.co.kr>",
      to: "handyhand91@naver.com",
      subject: `[HANDYHAND] 계정 생성 문의 — ${name}${company ? ` / ${company}` : ""}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1d1d1f; margin: 0 0 20px;">새 계정 생성 문의가 도착했습니다</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 10px 0; color: #86868b; width: 90px; vertical-align: top;">이름</td>
              <td style="padding: 10px 0; color: #1d1d1f; font-weight: 600;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #86868b; vertical-align: top;">이메일</td>
              <td style="padding: 10px 0; color: #1d1d1f;"><a href="mailto:${email}" style="color: #1d1d1f;">${email}</a></td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #86868b; vertical-align: top;">회사명</td>
              <td style="padding: 10px 0; color: #1d1d1f;">${company || "-"}</td>
            </tr>
          </table>
          ${message ? `
          <div style="margin-top: 20px; background: #f5f5f7; border-radius: 12px; padding: 16px; font-size: 14px;">
            <p style="color: #86868b; margin: 0 0 8px; font-size: 12px;">문의 내용</p>
            <p style="margin: 0; color: #1d1d1f; line-height: 1.6; white-space: pre-line;">${message}</p>
          </div>` : ""}
          <p style="margin-top: 24px; font-size: 12px; color: #86868b;">로그인 페이지 "계정 생성 문의"를 통해 접수된 내용입니다.</p>
        </div>
      `,
    });
    if (error) console.error("Resend error:", JSON.stringify(error));
  } catch (e) {
    console.error("계정 생성 문의 메일 발송 실패:", e);
  }

  return NextResponse.json({ ok: true });
}
