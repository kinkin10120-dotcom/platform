import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

// 협력사용 "정리 도구"(/organize)의 입력창 — 텍스트(+선택적으로 파일/사진)를 하나 던지면
// 이 라우트가 먼저 "이게 자료 정리 요청인지, 견적서/청구서 작성 요청인지, 아니면 단순
// 질문(가격 조회 등)인지"를 스스로 판단해서 그에 맞는 결과만 돌려준다. 실제 저장(Firestore
// 쓰기)은 전혀 하지 않는다 — file_intake는 /organize의 기존 업로드 큐에, quote/invoice는
// 기존 작성 폼에 "채워넣기"만 하고, 사람이 확인한 뒤 각자의 제출 버튼을 눌러야 실제로
// 생성된다.
interface ChecklistItemCandidate { id: string; text: string }
interface TaskCandidate { taskId: string; taskName: string; status: string; description?: string; checklist?: ChecklistItemCandidate[] }
interface ProjectCandidate { projectId: string; projectName: string; clientName: string; tasks: TaskCandidate[] }
interface PriceHistoryEntry { name: string; spec?: string; unit?: string; unitPrice: number; currency: string; quantity?: number; source: "견적서" | "발주서" | "카탈로그"; date: string }

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    text,
    fileName,
    fileType,
    imageBase64,
    fileTextExcerpt,
    pdfBase64,
    groupFiles,
    candidates,
    priceHistory,
    lang,
  }: {
    text?: string;
    fileName?: string;
    fileType?: string;
    imageBase64?: string;
    fileTextExcerpt?: string;
    pdfBase64?: string;
    groupFiles?: { fileName: string; fileType?: string; imageBase64?: string }[];
    candidates: ProjectCandidate[];
    priceHistory?: PriceHistoryEntry[];
    lang?: "ko" | "zh";
  } = body;

  if (!text || !text.trim()) {
    return NextResponse.json({ error: "내용이 비어 있습니다." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const isZh = lang === "zh";
  const hasFiles = !!(imageBase64 || (groupFiles && groupFiles.length > 0) || fileName);

  const contentParts: Anthropic.MessageParam["content"] = [];
  let ctx = "";

  ctx += `너는 제조업 협력사(공급사) 담당자가 쓰는 업무 플랫폼의 AI 비서다. 아래 입력을 보고 네 가지 중 정확히 하나의 의도(intent)를 판단해라:\n\n`;
  ctx += `1. "file_intake" — 사진/파일/메모를 특정 프로젝트의 특정 업무에 자료로 남기려는 것 (가장 흔한 기본 경우 — 파일이 첨부돼 있거나, 현장/진행상황을 설명하는 문장이면 보통 이거다)\n`;
  ctx += `2. "quote" — 아직 발주 전인 품목의 가격을 먼저 제안하는 견적서를 작성해 달라는 것 ("견적서", "견적", "이 가격에 할 수 있다" 류)\n`;
  ctx += `3. "invoice" — 이미 진행했거나 완료한 작업/납품에 대해 대금을 청구하는 청구서를 작성해 달라는 것 ("청구서", "인보이스", "대금 청구" 류)\n`;
  ctx += `4. "question" — 단순히 정보를 물어보는 것 (예: "이 제품 단가 얼마였지?", "저번에 얼마에 했지?") — 아무것도 만들거나 첨부하지 않고 답만 하면 되는 경우\n\n`;

  if (hasFiles) {
    ctx += `※ 파일/사진이 함께 첨부되어 있다. 첨부물이 있는데 문장에서 명시적으로 "견적서"/"청구서"를 요청하지 않는 이상, 기본적으로 file_intake로 판단해라.\n\n`;
  }

  const projectListText = candidates
    .map(
      (p) =>
        `- 프로젝트 "${p.projectName}" (클라이언트: ${p.clientName}, projectId: ${p.projectId})\n` +
        p.tasks.map((t) => `  - 업무 "${t.taskName}" (taskId: ${t.taskId}, 상태: ${t.status}${t.description ? `, 설명: ${t.description}` : ""})`).join("\n")
    )
    .join("\n");
  ctx += `[현재 진행 중인 프로젝트·업무 목록 — file_intake일 때만 사용]\n${projectListText}\n\n`;

  if (priceHistory && priceHistory.length > 0) {
    const priceListText = priceHistory
      .slice(0, 300)
      .map((p) => `- ${p.name}${p.spec ? ` (${p.spec})` : ""}: ${p.unitPrice.toLocaleString()} ${p.currency}${p.unit ? `/${p.unit}` : ""} — ${p.source}, ${p.date}`)
      .join("\n");
    ctx += `[이 협력사가 과거에 제출한 견적서·받은 발주서의 품목·단가 이력 — question이거나, quote/invoice 작성 시 과거 단가를 참고할 때 사용]\n${priceListText}\n\n`;
  }

  if (text) ctx += `[입력 텍스트]\n${text}\n\n`;
  if (fileName) ctx += `[첨부 파일명]\n${fileName} (${fileType || "알 수 없는 형식"})\n\n`;
  if (groupFiles && groupFiles.length > 0) {
    ctx += `[첨부 자료 묶음 — 총 ${groupFiles.length}개]\n${groupFiles.map((f) => `- ${f.fileName}`).join("\n")}\n\n`;
  }
  if (fileTextExcerpt) ctx += `[파일에서 추출한 내용 일부]\n${fileTextExcerpt}\n\n`;
  if (pdfBase64) {
    try {
      const pdfResult = await pdfParse(Buffer.from(pdfBase64, "base64"));
      if (pdfResult.text.trim()) ctx += `[PDF에서 추출한 내용 일부]\n${pdfResult.text.trim().slice(0, 4000)}\n\n`;
    } catch (e) {
      console.error("pdf-parse error:", e);
    }
  }

  ctx +=
    `판단한 intent에 따라 아래 JSON 형식 중 그 intent에 해당하는 형식으로만, 다른 말 없이 답해라. 다른 intent의 필드는 아예 넣지 마라. 모든 형식에 "replyLang" 필드를 공통으로 포함해라.\n\n` +
    `intent가 "file_intake"면:\n{"intent": "file_intake", "projectId": "..." | null, "taskId": "..." | null, "confidence": "high" | "medium" | "low", "comment": "...", "replyLang": "ko" | "zh"}\n` +
    `- comment는 담당자 본인 말투로, 업무 기록에 남길 법한 구체적인 코멘트를 대신 써주는 것이다. 확실히 관련된 업무를 못 찾으면 projectId/taskId는 null로 해라.\n\n` +
    `intent가 "quote" 또는 "invoice"면:\n{"intent": "quote" | "invoice", "items": [{"name": "...", "spec": "...", "quantity": 0, "unit": "EA", "unitPrice": 0}], "currency": "USD" | "CNY" | "KRW" | null, "memo": "...", "replyLang": "ko" | "zh"}\n` +
    `- 품목이 여러 개면 전부 나눠라. "만원"은 ×10000, "천원"은 ×1000. "$"/달러=USD, "¥"/위안/元=CNY, "원"/₩=KRW.\n` +
    `- 단가를 직접 언급 안 했는데 과거 단가 이력에 같은/비슷한 품목이 있으면 그 단가를 참고해 채워도 좋다(그 경우 memo에 "이전 단가 기준"이라고 밝혀라).\n\n` +
    `intent가 "question"이면:\n{"intent": "question", "answer": "...", "replyLang": "ko" | "zh"}\n` +
    `- answer는 위 단가 이력을 근거로 실제 담당자가 답하듯 구체적으로(언제, 얼마였는지) 작성해라. 이력에서 못 찾으면 모른다고 솔직히 답해라. 지어내지 마라.\n\n` +
    `공통: 숫자(JSON number)는 따옴표 없이, 모르는 선택 필드는 생략하거나 빈 문자열로 둬라.\n\n` +
    `언어 — 클로드처럼 그때그때 사용자가 입력한 문장의 언어를 그대로 따라가라: 이번 [입력 텍스트]가 한국어면 "replyLang"을 "ko"로 하고 comment/memo/answer 등 텍스트 필드도 전부 한국어로 써라. 중국어로 입력했으면 "replyLang"을 "zh"로 하고 그 필드들을 중국어 간체(简体中文)로 써라. ` +
    `이 협력사 계정은 평소 ${isZh ? "중국어" : "한국어"}를 쓰지만, 그건 텍스트가 아예 없고 사진/파일만 왔을 때만 참고하는 기본값일 뿐이다 — 입력 텍스트가 있으면 계정 기본 언어보다 그 텍스트의 실제 언어를 반드시 우선해라(계정은 중국어가 기본이어도 이번에 한국어로 물었으면 한국어로 답한다).`;

  contentParts.push({ type: "text", text: ctx });

  if (groupFiles && groupFiles.length > 0) {
    for (const f of groupFiles) {
      if (f.imageBase64 && f.fileType?.startsWith("image/")) {
        contentParts.push({ type: "image", source: { type: "base64", media_type: f.fileType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: f.imageBase64 } });
      }
    }
  } else if (imageBase64 && fileType?.startsWith("image/")) {
    contentParts.push({ type: "image", source: { type: "base64", media_type: fileType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: imageBase64 } });
  }

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [{ role: "user", content: contentParts }],
    });
    const textBlock = msg.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    return NextResponse.json(parsed);
  } catch (e) {
    console.error("assistant error:", e);
    return NextResponse.json({ error: "AI 비서 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
