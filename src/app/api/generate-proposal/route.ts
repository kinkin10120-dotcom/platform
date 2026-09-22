import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 관리자 화면(/freelance-jobs)에서 공고를 검토하다가 지원하기로 한 건에 한해, 눌렀을 때만
// 초안을 생성한다(모든 신규 공고에 자동으로 만들지 않음 — 실제로 지원할 건만 비용을 쓴다).
// 실제 제출은 이 초안을 복사해 Upwork에서 관리자가 직접 하므로, 오작동으로 실제 고객에게
// 잘못된 제안서가 나가는 사고 위험이 없다.
export async function POST(req: NextRequest) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const { title, description } = (await req.json()) as { title: string; description: string };

  const prompt = `당신은 HANDYHAND(대한민국 소재 제품개발·제조 컨설팅 회사)를 대신해 Upwork 채용공고에 제출할 제안서(Proposal) 초안을 영어로 작성하는 어시스턴트입니다.

[공고]
제목: ${title}
본문: ${description}

[회사 실제 정보 — 이 사실만 근거로 쓰고, 그 외의 구체적 실적·고객사명은 절대 지어내지 마세요]
- 판금(sheet metal) 제품의 디자인부터 시제품, 양산까지 직접 수행
- 한국과 중국 양쪽에 자체 양산 인프라 보유
- 기계설계 엔지니어들의 실무 경력 합산 40년 이상
- 레이저 커팅 등 판금 가공 서비스 자체 보유

규칙:
- 실제 Upwork에 바로 제출할 수 있는 완성된 영어 제안서를 작성하세요(설명이나 메타 코멘트 없이 제안서 본문만).
- 공고 내용에 실제로 언급된 요구사항에 구체적으로 반응하세요 — 일반적인 자기소개로 때우지 마세요.
- 위에 없는 특정 고객사명·프로젝트명·숫자(예: "우리는 200개 프로젝트를 완료했습니다")를 지어내지 마세요.
- 정확한 견적/일정은 클라이언트와의 논의 후 조정이 필요하다는 취지를 자연스럽게 포함하세요.
- 문단 3~5개 정도의 적당한 길이로, 과장 없이 전문적인 톤으로 작성하세요.
- 마지막은 다음 대화를 유도하는 짧은 문장으로 마무리하세요.

제안서 본문만 그대로 출력하세요(따옴표나 JSON 없이).`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1536,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") throw new Error("응답 형식 오류");

    return NextResponse.json({ proposal: content.text.trim() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "제안서 생성 중 오류 발생";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
