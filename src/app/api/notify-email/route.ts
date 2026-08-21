import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

// Firebase Cloud Functions(알림 생성 트리거)에서만 호출하는 내부 전용 엔드포인트.
// Resend API 키는 Vercel에만 있으므로, Functions는 이 라우트를 통해 이메일을 보낸다.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_NOTIFY_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const body = await req.json();
  const { to, subject, html } = body;

  if (!to || !subject || !html) {
    return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
  }

  const { data, error } = await resend.emails.send({
    from: "HANDYHAND <noreply@handyhand.co.kr>",
    replyTo: "handyhand91@naver.com",
    to,
    subject,
    html,
  });

  if (error) {
    console.error("Resend error:", JSON.stringify(error));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id });
}
