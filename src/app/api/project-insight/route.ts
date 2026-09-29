import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

// 프로젝트 대시보드에서 이미 계산된 "실제 수치"만 입력받아, 그 수치를 근거로 짧은 한국어 요약을
// 생성한다. LLM이 수치에 없는 내용(고객 만족도, 품질, 예산 등)을 추측하지 못하도록 프롬프트로 제한한다.
export async function POST(req: NextRequest) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const body = await req.json();
  const { lang, ...stats } = body as { lang?: "ko" | "zh" };
  // 중국 협력사 계정은 요약을 다시 번역기에 돌리는 대신, 처음부터 중국어로 생성하게 한다
  // (번역 왕복 없이 더 자연스러운 결과 + 딜레이 감소).
  const isZh = lang === "zh";

  const prompt = `당신은 제품 개발 프로젝트의 진행 현황을 요약하는 어시스턴트입니다.
아래는 실제 프로젝트 데이터에서 자동 계산된 수치입니다. 이 수치 외의 어떠한 정보도 알지 못합니다.

${JSON.stringify(stats, null, 2)}

규칙:
- 반드시 위 수치와 delayContext(관리자/클라이언트가 실제로 남긴 코멘트)만 근거로 판단하세요. 그 외의 내용(고객 만족도, 품질, 예산, 소통 상태 등)은 절대 언급하거나 추측하지 마세요.
- delayContext에 지연 사유로 볼 만한 코멘트(예: 설비 문제, 자재 수급 지연, 외부 요인 등)가 있으면, 단순 수치 해석보다 그 코멘트를 지연의 실제 원인으로 우선 인용해 설명하세요. 코멘트를 인용할 때는 어떤 업무의 코멘트인지 밝히세요.
- delayContext의 코멘트에서 클라이언트가 지연 사유를 확인·동의·양해했다는 내용이 확인되면(예: "네 괜찮습니다", "일정 조정 확인했습니다" 등), 해당 업무는 위험 요인으로 보지 말고 riskLevel 산정에서 감점 요인으로 넣지 마세요. summary에는 클라이언트가 확인한 사유임을 짧게 언급하세요.
- delayContext가 비어있거나 관련 없는 내용뿐이면, 코멘트를 근거로 지어내지 말고 수치만으로 판단하세요.
- pendingTasks(대기 중 업무)와 todoTasks(예정 업무)는 아직 시작 시점이 안 된 정상적인 상태일 뿐입니다. 그 자체로는 위험 신호가 아니므로, 단지 개수가 많다는 이유로 summary에 언급하거나 riskLevel을 낮추지 마세요.
- riskLevel은 overdueTaskCount(클라이언트가 확인·양해한 지연은 제외)로만 판단하세요. overdueTaskCount가 0이면 다른 수치와 무관하게 반드시 "low"입니다. dueSoonTaskCount가 여러 건 겹쳐 있으면 "medium"까지는 고려할 수 있습니다.
- averageProgressPercent와 expectedProgressPercent(업무별 일정 기준 예상 진행률)의 차이는 riskLevel을 올리는 근거로 쓰지 마세요. 많은 업무가 "마지막 날 결과물을 등록해야 완료 처리되는" 방식이라, 마감 전 준비 기간에는 진행률이 낮게 보이는 게 정상입니다. 이 두 수치는 summary에서 보조적인 맥락으로만 짧게 언급하세요(굳이 언급할 유의미한 차이가 없으면 아예 언급하지 않아도 됩니다).
- 과장하지 말고 담백한 사실 기반 어조로 작성하세요.
- "~것으로 보입니다", "~점검이 필요해 보입니다"처럼 단정하지 않는 어조를 쓰세요.
- summary 안에서 판단 근거가 된 구체적 수치나 코멘트 인용을 함께 언급해, 사람이 바로 대조 확인할 수 있게 하세요.
- 단, 위 JSON의 영문 필드명(예: overdueTaskCount, expectedProgressPercent)이나 괄호 안 영문 표기는 절대 그대로 인용하지 마세요. 반드시 자연스러운 문장으로 풀어서 표현하세요. (예: "overdueTaskCount: 20" ❌ → "지연된 업무 20건" ✅)
${isZh ? "- summary는 반드시 자연스러운 중국어 간체(简体中文)로만 작성하세요. 한국어를 섞지 마세요." : "- summary는 한국어로 작성하세요."}

다음 JSON 형식으로만 응답하세요:
{
  "summary": "2~4문장 ${isZh ? "중국어" : "한국어"} 요약",
  "riskLevel": "low" | "medium" | "high"
}`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
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
