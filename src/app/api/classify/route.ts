import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
// 최상위 index.js에는 module.parent가 없으면(웹팩 번들 환경이 늘 그렇다) 존재하지 않는
// 테스트 PDF를 읽으려는 디버그 코드가 있어 빌드가 깨진다 — 실제 구현체를 직접 가져온다.
import pdfParse from "pdf-parse/lib/pdf-parse.js";

// 협력사용 "정리 도구"(/organize)에서 쓴다 — 텍스트/사진을 보고 후보 프로젝트·업무 중
// 가장 관련 깊은 것을 고르고, 담당자가 남길 법한 코멘트를 대신 써준다. 분류 결과 자체는
// 조회용일 뿐이라 인증 없이 호출 가능하지만(project-insight와 같은 패턴), candidates는
// 항상 호출 쪽(클라이언트)이 자기 권한 범위로 미리 제한해서 넘긴다 — 이 라우트는 그
// 범위를 모른다.
interface ChecklistItemCandidate {
  id: string;
  text: string;
}
interface TaskCandidate {
  taskId: string;
  taskName: string;
  status: string;
  description?: string;
  checklist?: ChecklistItemCandidate[];
}
interface ProjectCandidate {
  projectId: string;
  projectName: string;
  clientName: string;
  tasks: TaskCandidate[];
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    text,
    memo,
    fileName,
    fileType,
    imageBase64,
    fileTextExcerpt,
    pdfBase64,
    groupFiles,
    candidates,
    fixedProjectName,
    fixedTaskName,
    lang,
  }: {
    text?: string;
    memo?: string;
    fileName?: string;
    fileType?: string;
    imageBase64?: string;
    // 엑셀처럼 이미지로 못 보내는 파일에서 미리 추출해온 텍스트 일부(lib/extractFileText.ts)
    fileTextExcerpt?: string;
    // PDF 원본(base64) — pdfjs 계열을 브라우저 번들에 넣으면 Next.js 빌드가 깨져서, 여기
    // 서버에서 pdf-parse로 텍스트를 뽑는다.
    pdfBase64?: string;
    groupFiles?: { fileName: string; fileType?: string; imageBase64?: string }[];
    candidates: ProjectCandidate[];
    fixedProjectName?: string;
    fixedTaskName?: string;
    // 협력사 계정의 언어 설정 — zh면 AI가 쓰는 코멘트를 바로 중국어로 작성한다(번역 왕복 없이).
    lang?: "ko" | "zh";
  } = body;

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ error: "진행 중인 프로젝트가 없습니다." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const isZh = lang === "zh";

  const contentParts: Anthropic.MessageParam["content"] = [];
  let contextText = "";

  if (fixedProjectName && fixedTaskName) {
    contextText += `이 업무 자료는 이미 프로젝트 "${fixedProjectName}"의 업무 "${fixedTaskName}"에 첨부하기로 정해졌다. 프로젝트/업무는 다시 고르지 말고, 이 업무 기준으로 코멘트만 새로 써라.\n\n`;
  } else {
    const projectListText = candidates
      .map(
        (p) =>
          `- 프로젝트 "${p.projectName}" (클라이언트: ${p.clientName}, projectId: ${p.projectId})\n` +
          p.tasks
            .map((t) => `  - 업무 "${t.taskName}" (taskId: ${t.taskId}, 상태: ${t.status}${t.description ? `, 설명: ${t.description}` : ""})`)
            .join("\n")
      )
      .join("\n");
    contextText += `아래는 현재 진행 중인 프로젝트와 그 안의 업무 목록이다:\n\n${projectListText}\n\n`;
    contextText += `방금 새로 들어온 업무 자료를 보고, 위 목록 중 어느 프로젝트의 어느 업무와 가장 관련이 깊은지 판단해라.\n\n`;
  }
  if (text) contextText += `[붙여넣은 텍스트 내용]\n${text}\n\n`;
  if (memo) contextText += `[사용자가 남긴 메모]\n${memo}\n\n`;
  if (fileName) contextText += `[첨부 파일명]\n${fileName} (${fileType || "알 수 없는 형식"})\n\n`;
  if (groupFiles && groupFiles.length > 0) {
    const fileListText = groupFiles.map((f) => `- ${f.fileName} (${f.fileType || "알 수 없는 형식"})`).join("\n");
    contextText += `[첨부 자료 묶음 — 총 ${groupFiles.length}개, 사용자가 모두 같은 내용/현장을 촬영한 자료로 직접 묶었다]\n${fileListText}\n\n`;
  }
  if (fileTextExcerpt) contextText += `[파일에서 추출한 내용 일부]\n${fileTextExcerpt}\n\n`;
  if (pdfBase64) {
    try {
      const pdfResult = await pdfParse(Buffer.from(pdfBase64, "base64"));
      if (pdfResult.text.trim()) {
        contextText += `[PDF에서 추출한 내용 일부]\n${pdfResult.text.trim().slice(0, 4000)}\n\n`;
      }
    } catch (e) {
      console.error("pdf-parse error:", e);
      // 추출 실패해도 분류 자체는 파일명만으로 계속 진행한다.
    }
  }

  contextText +=
    fixedProjectName && fixedTaskName
      ? `아래 JSON 형식으로만, 다른 말 없이 답해라:\n{"comment": "..."}\n\n`
      : `아래 JSON 형식으로만, 다른 말 없이 답해라:\n` +
        `{"projectId": "...", "taskId": "...", "confidence": "high" | "medium" | "low", "comment": "..."}\n` +
        `확실히 관련된 업무를 찾을 수 없으면 projectId/taskId를 null로 해라.\n\n`;
  contextText +=
    `comment는 ${fixedTaskName ? `"${fixedTaskName}" 업무` : "그 업무"} 담당자가 실제로 업무 기록에 남길 법한 코멘트를 담당자 본인 말투로 대신 써주는 것이다. ` +
    `"자동으로 첨부했습니다", "~관련 자료입니다", "~사진을 올려둡니다" 같은 두루뭉술한 한 줄 요약은 쓰지 마라 — 그런 문장은 사진을 ` +
    `안 보고도 쓸 수 있는 내용이라 의미가 없다. 대신 사진/자료 안에 실제로 무엇이 보이는지 구체적으로 묘사해라: 어떤 제품·부품이 ` +
    `찍혀 있는지, 어떤 각도·상태(조립 전/후, 완성/미완성)인지, 눈에 띄는 색상·재질·표면 마감·치수나 수치·화면에 보이는 텍스트·` +
    `숫자·불량/결함 여부 등 사진만 보고 알 수 있는 구체적인 정보를 코멘트에 그대로 녹여라. 이 코멘트만 읽어도 사진을 안 본 사람이 ` +
    `내용을 짐작할 수 있을 정도로 써야 한다. 텍스트(메모)가 함께 왔으면 그 내용도 자연스럽게 녹여라. 담백한 구어체 존댓말로 ` +
    `2~4문장 정도로 쓰고, 이모지나 따옴표로 파일명을 억지로 넣지 마라. 사진에서 확인할 수 없는 내용은 지어내지 마라.` +
    (isZh ? `\n\ncomment는 반드시 자연스러운 중국어 간체(简体中文)로 작성해라 — 한국어로 쓰지 마라.` : "");
  if (groupFiles && groupFiles.length > 0) {
    contextText +=
      `\n\n이번 comment는 묶음 전체(${groupFiles.length}개)에 대해 딱 한 번만 작성해라 — 파일마다 따로 쓰지 마라. ` +
      `"사진 ${groupFiles.length}장 올려둡니다" 처럼 개수를 자연스럽게 언급해도 좋다.`;
  }

  contentParts.push({ type: "text", text: contextText });

  if (groupFiles && groupFiles.length > 0) {
    for (const f of groupFiles) {
      if (f.imageBase64 && f.fileType?.startsWith("image/")) {
        contentParts.push({
          type: "image",
          source: { type: "base64", media_type: f.fileType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: f.imageBase64 },
        });
      }
    }
  } else if (imageBase64 && fileType?.startsWith("image/")) {
    contentParts.push({
      type: "image",
      source: { type: "base64", media_type: fileType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: imageBase64 },
    });
  }

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 500,
      messages: [{ role: "user", content: contentParts }],
    });
    const textBlock = msg.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    return NextResponse.json(parsed);
  } catch (e) {
    console.error("classify error:", e);
    return NextResponse.json({ error: "AI 분류 중 오류가 발생했습니다." }, { status: 500 });
  }
}
