import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Firebase Cloud Functions(주간 요약 스케줄러)에서만 호출하는 내부 전용 엔드포인트.
// ANTHROPIC_API_KEY는 Vercel에만 있으므로, Functions는 이 라우트를 통해 AI 요약을 받는다.
// /api/project-insight와 같은 패턴(실제 계산된 수치만 근거로 요약)이되, 여러 프로젝트를
// 한 번에 요약하는 주간 다이제스트용으로 프롬프트만 다르다.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_NOTIFY_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const body = await req.json();
  const { audience, overdueCount, dueSoonCount, details } = body as {
    audience: "admin" | "client";
    overdueCount: number;
    dueSoonCount: number;
    details: string[];
  };

  const audienceGuide =
    audience === "client"
      ? "이 요약은 고객(클라이언트)에게 이메일로 바로 발송됩니다. 담당 업체를 대하는 정중하고 신뢰감 있는 어조로, 프로젝트가 어떻게 진행되고 있는지 알려주는 톤으로 작성하세요."
      : "이 요약은 내부 관리자에게 가는 것으로, 담백하고 간결한 업무 보고 톤으로 작성하세요.";

  const prompt = `당신은 제품 개발 프로젝트의 주간 진행 현황을 요약하는 어시스턴트입니다.
아래는 실제 업무 데이터에서 자동 계산된 수치와 목록입니다. 이 정보 외의 어떠한 내용도 알지 못합니다.

지연 중인 업무: ${overdueCount}건
이번 주 마감 예정 업무: ${dueSoonCount}건
세부 내역: ${JSON.stringify(details, null, 2)}

${audienceGuide}

규칙:
- 반드시 위 수치와 목록만 근거로 판단하세요. 그 외의 내용(품질, 예산, 고객 만족도 등)은 절대 언급하거나 추측하지 마세요.
- 지연 건이 0건이면 순조롭게 진행 중이라는 긍정적인 톤으로, 지연 건이 있으면 어떤 업무가 지연 중인지 자연스럽게 언급하세요.
- 과장하지 말고 담백한 사실 기반으로, 2~3문장 이내로 작성하세요.
- 목록의 프로젝트명·업무명을 문장에 자연스럽게 녹여 쓰되, 목록을 그대로 나열하지 마세요.

다음 JSON 형식으로만 응답하세요:
{ "summary": "2~3문장 한국어 요약" }`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") throw new Error("응답 형식 오류");

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("분석 결과를 파싱할 수 없습니다.");

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "분석 중 오류 발생";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
