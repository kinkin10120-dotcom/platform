import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, phone, type, message } = body;

  if (!name || !email || !message) {
    return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
  }

  const { error } = await resend.emails.send({
    from: "HANDYHAND <noreply@handyhand.co.kr>",
    to: "handyhand91@naver.com",
    subject: `[HANDYHAND] 새 문의 — ${name}${type ? ` (${type})` : ""}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1d1d1f; margin: 0 0 20px;">새 문의가 도착했습니다</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 10px 0; color: #86868b; width: 80px; vertical-align: top;">이름</td>
            <td style="padding: 10px 0; color: #1d1d1f; font-weight: 600;">${name}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #86868b; vertical-align: top;">이메일</td>
            <td style="padding: 10px 0; color: #1d1d1f;"><a href="mailto:${email}" style="color: #1d1d1f;">${email}</a></td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #86868b; vertical-align: top;">연락처</td>
            <td style="padding: 10px 0; color: #1d1d1f;">${phone || "-"}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #86868b; vertical-align: top;">문의 유형</td>
            <td style="padding: 10px 0; color: #1d1d1f;">${type || "-"}</td>
          </tr>
        </table>
        <div style="margin-top: 20px; background: #f5f5f7; border-radius: 12px; padding: 16px; font-size: 14px;">
          <p style="color: #86868b; margin: 0 0 8px; font-size: 12px;">문의 내용</p>
          <p style="margin: 0; color: #1d1d1f; line-height: 1.6; white-space: pre-line;">${message}</p>
        </div>
        <p style="margin-top: 24px; font-size: 12px; color: #86868b;">handyhand.co.kr 문의 폼을 통해 접수된 내용입니다.</p>
      </div>
    `,
  });

  if (error) {
    console.error("Resend error:", JSON.stringify(error));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
