import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

// 협력사(중국 업체) 계정에게 프로젝트명·업무명처럼 관리자가 직접 입력한 자유 텍스트를
// 중국어로 보여주기 위한 번역 전용 엔드포인트. 고정 UI 문구는 src/lib/i18n.ts의 사전으로
// 처리하고, 이 라우트는 매번 달라지는 실제 데이터(업무명 등)만 담당한다. 클라이언트가
// 번역 결과를 캐싱해서 같은 텍스트를 반복 요청하지 않는다(useZhTranslate 참고).
// direction: "ko-zh"(기본)는 관리자가 쓴 한국어를 중국 협력사에게 보여줄 때, "zh-ko"는
// 반대로 중국 협력사가 입력한 중국어를 관리자가 한국어로 읽을 때 쓴다(협력사 자료함 코멘트).
export const dynamic = "force-dynamic";

const MAX_TEXTS = 50;
const MAX_TEXT_LENGTH = 200;

// 내부용 별도 앱(work-intake, intake.handyhand.co.kr)의 협력사 화면이 올린 코멘트를
// 관리자가 보는 즉시 한국어로 보이게 하기 위해 그대로 재사용한다 — CORS만 열어준다.
const ALLOWED_ORIGIN = "https://intake.handyhand.co.kr";

function withCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const texts = (body?.texts as unknown[]) ?? [];
  const direction = body?.direction === "zh-ko" ? "zh-ko" : "ko-zh";

  if (!Array.isArray(texts) || texts.length === 0) {
    return withCors(NextResponse.json({ error: "texts는 비어있지 않은 배열이어야 합니다." }, { status: 400 }));
  }
  if (texts.length > MAX_TEXTS || texts.some((t) => typeof t !== "string" || t.length > MAX_TEXT_LENGTH)) {
    return withCors(NextResponse.json({ error: "텍스트 개수 또는 길이가 허용 범위를 초과했습니다." }, { status: 400 }));
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const list = texts as string[];

  const prompt =
    direction === "zh-ko"
      ? `다음은 제품 개발·제조 프로젝트 관리 플랫폼에서 협력사(중국 업체)가 입력한 중국어 문구 목록입니다. 각 항목을 자연스러운 한국어로 번역하세요.

규칙:
- 원문 배열과 같은 순서, 같은 개수로 번역하세요.
- 고유명사(회사명, 제품명 등으로 보이는 경우)는 발음을 살려 음역하거나 그대로 두는 등 문맥상 가장 자연스러운 방식을 쓰세요.
- 이미 영어나 숫자, 코드명(예: T0, BOM)인 부분은 그대로 유지하세요.
- 설명을 덧붙이지 말고 번역문만 반환하세요.

원문:
${JSON.stringify(list)}

다음 JSON 형식으로만 응답하세요: {"translations": ["...", "...", ...]}`
      : `다음은 제품 개발·제조 프로젝트 관리 플랫폼에서 쓰이는 한국어 문구 목록입니다(프로젝트명, 업무명 등). 각 항목을 자연스러운 중국어 간체(简体中文)로 번역하세요.

규칙:
- 원문 배열과 같은 순서, 같은 개수로 번역하세요.
- 고유명사(회사명, 제품명 등으로 보이는 경우)는 발음을 살려 음역하거나 그대로 두는 등 문맥상 가장 자연스러운 방식을 쓰세요.
- 이미 영어나 숫자, 코드명(예: T0, BOM)인 부분은 그대로 유지하세요.
- 설명을 덧붙이지 말고 번역문만 반환하세요.

원문:
${JSON.stringify(list)}

다음 JSON 형식으로만 응답하세요: {"translations": ["...", "...", ...]}`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") throw new Error("응답 형식 오류");

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("번역 결과를 파싱할 수 없습니다.");

    const result = JSON.parse(jsonMatch[0]) as { translations?: unknown };
    if (!Array.isArray(result.translations) || result.translations.length !== list.length) {
      throw new Error("번역 결과 개수가 원문과 일치하지 않습니다.");
    }

    return withCors(NextResponse.json({ translations: result.translations }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "번역 중 오류 발생";
    return withCors(NextResponse.json({ error: msg }, { status: 500 }));
  }
}
