import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// 협력사 견적서·청구서 작성 화면의 "AI로 작성" 입력창에서 쓴다. 자유 텍스트(품명·수량·단가를
// 사람이 말하듯 쓴 문장)를 받아 품목 배열로 구조화해서 돌려주기만 한다 — Firestore에 아무것도
// 쓰지 않고, 돌아온 결과는 항상 기존 작성 폼에 "채워넣기"만 해서 사람이 확인·수정 후 직접
// 제출하게 한다(금액이 걸린 문서라 AI가 잘못 읽어도 바로 발행되지 않도록).
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { text, lang }: { text?: string; lang?: "ko" | "zh" } = body;

  if (!text || !text.trim()) {
    return NextResponse.json({ error: "내용이 비어 있습니다." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const isZh = lang === "zh";

  const prompt =
    `아래는 협력사(공급사) 담당자가 견적서/청구서에 넣을 품목을 말하듯이 적은 문장이다. ` +
    `이 안에서 품목(명칭), 사양(있으면), 수량, 단가, 통화를 최대한 정확히 뽑아내라.\n\n` +
    `[입력]\n${text.trim()}\n\n` +
    `규칙:\n` +
    `- 품목이 여러 개면(줄바꿈, 쉼표, "그리고" 등으로 구분) 전부 각각의 항목으로 나눠라.\n` +
    `- 수량 표기(개, EA, SET, pcs, 세트, 件, 个 등)가 있으면 unit에 그대로(원문 표기 존중) 넣고, 없으면 "EA"로 둬라.\n` +
    `- 단가 표기 중 "만원"은 ×10000, "천원"은 ×1000으로 환산해 숫자(KRW)로 바꿔라. "$"나 "달러"는 USD, "¥"나 "위안"이나 "元"은 CNY, "원"이나 "₩"는 KRW로 판단해 currency를 하나로 정해라(섞여 있으면 가장 많이 쓰인 통화로).\n` +
    `- "개당", "단가", "씩" 뒤에 오는 숫자는 단가(unitPrice)다. 총액만 말하고 단가가 없으면(예: "총 50만원") unitPrice = 총액/수량으로 계산해라.\n` +
    `- 사양(색상·재질·치수 등 품명과 구분되는 부가 설명)이 문장에 있으면 spec에 넣고, 없으면 생략해라.\n` +
    `- 수량·단가를 전혀 알 수 없는 품목은 quantity 또는 unitPrice를 0으로 두되 name은 반드시 채워라.\n` +
    `- 품목과 무관한 말(인사말 등)은 무시해라.\n\n` +
    `아래 JSON 형식으로만, 다른 말 없이 답해라:\n` +
    `{"items": [{"name": "...", "spec": "...", "quantity": 0, "unit": "EA", "unitPrice": 0}], "currency": "USD" | "CNY" | "KRW" | null, "memo": "..." }\n` +
    `memo는 품목에 안 들어가는 나머지 전달사항(납기, 결제조건 등 비고성 문장)이 있을 때만 채우고, 없으면 빈 문자열로 해라.` +
    (isZh ? `\n\nname/spec/memo는 입력 문장의 언어를 그대로 따라가되, 입력이 중국어면 중국어 간체(简体中文)로 답해라.` : "");

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1200,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    });
    const textBlock = msg.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    return NextResponse.json(parsed);
  } catch (e) {
    console.error("parse-line-items error:", e);
    return NextResponse.json({ error: "AI 인식 중 오류가 발생했습니다." }, { status: 500 });
  }
}
