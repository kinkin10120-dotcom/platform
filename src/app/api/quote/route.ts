import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createQuoteRequest } from "@/lib/firestore/quotes";

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const formData = await req.formData();
  const name = formData.get("name") as string;
  const company = formData.get("company") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const stage = formData.get("stage") as string;
  const description = formData.get("description") as string;
  // 프론트(QuoteModal.tsx)는 여러 파일을 전부 "files"(복수) 키로 append한다 — 예전엔 여기서
  // 단수 "file" 키로 찾고 있어서 이름이 안 맞아 항상 null이었고, 그 결과 고객이 파일을
  // 첨부해도 관리자 메일엔 첨부파일이 하나도 붙지 않은 채 조용히 누락되고 있었다.
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  if (!name || !company || !email || !phone || !description) {
    return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
  }

  const attachments = await Promise.all(
    files.map(async (f) => ({
      filename: f.name,
      content: Buffer.from(await f.arrayBuffer()).toString("base64"),
    }))
  );

  const { data, error } = await resend.emails.send({
    from: "HANDYHAND <noreply@handyhand.co.kr>",
    to: "handyhand91@naver.com",
    subject: `[HANDYHAND] 견적 요청 — ${name}${company ? ` / ${company}` : ""}`,
    attachments,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1d1d1f; margin: 0 0 20px;">새 견적 요청이 도착했습니다</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 10px 0; color: #86868b; width: 90px; vertical-align: top;">이름</td>
            <td style="padding: 10px 0; color: #1d1d1f; font-weight: 600;">${name}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #86868b; vertical-align: top;">회사/브랜드</td>
            <td style="padding: 10px 0; color: #1d1d1f;">${company || "-"}</td>
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
            <td style="padding: 10px 0; color: #86868b; vertical-align: top;">개발 단계</td>
            <td style="padding: 10px 0; color: #1d1d1f;">${stage || "-"}</td>
          </tr>
        </table>
        <div style="margin-top: 20px; background: #f5f5f7; border-radius: 12px; padding: 16px; font-size: 14px;">
          <p style="color: #86868b; margin: 0 0 8px; font-size: 12px;">제품 개요</p>
          <p style="margin: 0; color: #1d1d1f; line-height: 1.6; white-space: pre-line;">${description}</p>
        </div>
        ${attachments.length > 0 ? `<p style="margin-top: 16px; font-size: 13px; color: #86868b;">📎 첨부파일: ${attachments.map((a) => a.filename).join(", ")}</p>` : ""}
        <p style="margin-top: 24px; font-size: 12px; color: #86868b;">handyhand.co.kr 견적 요청 폼을 통해 접수된 내용입니다.</p>
      </div>
    `,
  });

  if (error) {
    console.error("Resend error:", JSON.stringify(error));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log("Resend sent:", data?.id);

  try {
    await createQuoteRequest({ name, company, email, phone, stage, description, hasAttachment: attachments.length > 0 });
  } catch (e) {
    console.error("견적 요청 저장 실패:", e);
  }

  return NextResponse.json({ ok: true });
}
