import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

interface TaskActivity {
  taskName: string;
  status: string;
  comments: string[];
  fileNames: string[];
}

// 협력사용 "정리 도구"(/organize)에서 쓴다 — 최근 며칠간 업무별 코멘트·업로드 자료를 모아
// 보고서 초안을 써준다. 발송은 하지 않는다 — 초안까지만 만들고 사람이 검토·전달한다.
export async function POST(req: NextRequest) {
  const {
    projectName,
    clientName,
    days,
    taskActivities,
    lang,
  }: { projectName?: string; clientName?: string; days?: number; taskActivities: TaskActivity[]; lang?: "ko" | "zh" } =
    await req.json();

  if (!projectName || !taskActivities || taskActivities.length === 0) {
    return NextResponse.json({ error: "최근 활동 내역이 없어 보고서를 만들 수 없습니다." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const isZh = lang === "zh";

  const activityText = taskActivities
    .map((t) => {
      const lines = [`- 업무 "${t.taskName}" (상태: ${t.status})`];
      if (t.comments.length > 0) lines.push(`  기록된 코멘트:\n${t.comments.map((c) => `    · ${c}`).join("\n")}`);
      if (t.fileNames.length > 0) lines.push(`  올라온 자료: ${t.fileNames.join(", ")}`);
      return lines.join("\n");
    })
    .join("\n\n");

  const prompt =
    `당신은 제조 컨설팅 회사 "핸디핸드"의 PM입니다. 아래는 프로젝트 "${projectName}"${clientName ? `(클라이언트: ${clientName})` : ""}의 ` +
    `최근 ${days ?? 7}일간 업무별 코멘트·자료 업로드 내역입니다. 이를 바탕으로 클라이언트에게 그대로 보낼 수 있는 수준의 ` +
    `주간 진행상황 보고서 초안을 작성하세요.\n\n${activityText}\n\n` +
    `작성 지침:\n` +
    `- 격식 있는 존댓말(~합니다체)을 끝까지 유지하세요. "~해요" 같은 부드러운 말투는 쓰지 마세요.\n` +
    `- 업무별로 무엇을 진행했는지 자연스러운 문단으로 정리하고, 완료/진행 중 여부를 명확히 밝히세요.\n` +
    `- 위 내역에 없는 내용은 절대 지어내지 마세요 — 근거 없는 추측이나 일정 약속은 하지 마세요.\n` +
    `- 코멘트가 없고 상태만 있는 업무는 굳이 언급하지 않아도 됩니다.\n` +
    `- 이모지는 쓰지 마세요.\n` +
    `- 마지막에 "핸디핸드 드림" 같은 맺음말은 넣지 말고, 본문 내용만 작성하세요(발송 형식은 사람이 붙일 것입니다).\n\n` +
    (isZh ? `보고서 본문은 반드시 자연스러운 중국어 간체(简体中文)로, 정중한 격식체로 작성하세요.\n\n` : "") +
    `다른 설명 없이 보고서 본문만 답하세요.`;

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = msg.content.find((b) => b.type === "text");
    const report = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
    if (!report) throw new Error("보고서 생성 실패");
    return NextResponse.json({ report });
  } catch (e) {
    console.error("weekly-report error:", e);
    return NextResponse.json({ error: "보고서를 만드는 중 오류가 발생했습니다." }, { status: 500 });
  }
}
