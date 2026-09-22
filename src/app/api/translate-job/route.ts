import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Firebase Cloud Functions(입찰 공고 RSS 수집 스케줄러)에서만 호출하는 내부 전용 엔드포인트.
// ANTHROPIC_API_KEY는 Vercel에만 있으므로, Functions는 이 라우트를 통해 번역을 받는다.
// /api/weekly-summary-insight와 같은 패턴.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_NOTIFY_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const body = await req.json();
  const { title, description } = body as { title: string; description: string };

  const prompt = `아래는 해외 프리랜서 플랫폼(Upwork)에 올라온 영문 채용/외주 공고입니다. 한국인 기계설계/판금 제조 엔지니어가 이 공고를 보고 지원할지 빠르게 판단할 수 있도록 자연스러운 한국어로 번역하세요.

제목: ${title}

본문: ${description}

규칙:
- 번역만 하고 내용을 추가하거나 요약하지 마세요(길이가 길면 그대로 다 번역).
- 고유명사(회사명 등)와 금액(예: $500, $20-40/hr)은 원문 표기를 그대로 유지하세요.
- 어색한 직역 대신 자연스러운 한국어 문장으로 쓰세요.

다음 JSON 형식으로만 응답하세요:
{ "titleKo": "번역된 제목", "descriptionKo": "번역된 본문" }`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") throw new Error("응답 형식 오류");

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("번역 결과를 파싱할 수 없습니다.");

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "번역 중 오류 발생";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
