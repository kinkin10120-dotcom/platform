import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

interface TaskCandidate {
  taskId: string;
  taskName: string;
  status: string;
}
interface ProjectCandidate {
  projectId: string;
  projectName: string;
  clientName: string;
  tasks: TaskCandidate[];
}

// /organize(협력사 정리 도구)에서 쓴다 — 회의/현장에서 여러 프로젝트를 한 번에 언급하며
// 남긴 긴 음성/텍스트 메모 하나를, 프로젝트/업무별 조각으로 나눈다. classify와 스키마가
// 겹치지만 응답이 단일 객체가 아니라 배열이라 별도 라우트로 뺐다.
export async function POST(req: NextRequest) {
  const { text, candidates, lang }: { text?: string; candidates: ProjectCandidate[]; lang?: "ko" | "zh" } = await req.json();

  if (!text || !text.trim()) {
    return NextResponse.json({ error: "나눌 텍스트가 없습니다." }, { status: 400 });
  }
  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ error: "진행 중인 프로젝트가 없습니다." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const isZh = lang === "zh";
  const projectListText = candidates
    .map(
      (p) =>
        `- 프로젝트 "${p.projectName}" (클라이언트: ${p.clientName}, projectId: ${p.projectId})\n` +
        p.tasks.map((t) => `  - 업무 "${t.taskName}" (taskId: ${t.taskId}, 상태: ${t.status})`).join("\n")
    )
    .join("\n");

  const prompt =
    `아래는 회의나 현장에서 여러 프로젝트/업무를 한 번에 얘기하며 남긴 긴 메모/브리핑이다. ` +
    `이 내용을 프로젝트/업무별로 나눠라 — 서로 다른 프로젝트나 업무를 언급하는 부분은 별도 조각으로 분리하고, ` +
    `같은 프로젝트/업무에 대한 내용은 하나로 묶어라.\n\n` +
    `현재 진행 중인 프로젝트와 업무 목록:\n${projectListText}\n\n` +
    `원문:\n"""\n${text}\n"""\n\n` +
    `아래 JSON 배열 형식으로만, 다른 말 없이 답해라:\n` +
    `[{"text": "...", "projectId": "..." | null, "taskId": "..." | null, "confidence": "high" | "medium" | "low", "comment": "..."}]\n\n` +
    `각 조각의 text는 원문에서 그 부분만 발췌하거나 간결하게 정리한 것이다. 어느 프로젝트/업무인지 확실치 않으면 projectId/taskId를 null로 해라. ` +
    `comment는 그 업무 담당자가 실제로 업무 기록에 남길 법한 코멘트를 담당자 본인 말투로 1~2문장, 담백한 구어체 존댓말로 써라 ` +
    `("자동으로 첨부했습니다" 같은 기계적 문구는 쓰지 마라). ` +
    (isZh ? `comment는 반드시 자연스러운 중국어 간체(简体中文)로 작성해라.\n\n` : "\n") +
    `전체가 사실 하나의 프로젝트/업무 얘기면 배열에 항목 하나만 담아도 된다.`;

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = msg.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "[]";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    const segments = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    return NextResponse.json({ segments });
  } catch (e) {
    console.error("split-briefing error:", e);
    return NextResponse.json({ error: "브리핑을 나누는 중 오류가 발생했습니다." }, { status: 500 });
  }
}
