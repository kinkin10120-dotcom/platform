import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const material = (formData.get("material") as string | null) ?? "미정";
  const purpose = (formData.get("purpose") as string | null) ?? "";
  const quantity = (formData.get("quantity") as string | null) ?? "";

  if (!file) {
    return NextResponse.json({ error: "파일이 필요합니다." }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!["stp", "step", "dxf", "dwg"].includes(ext ?? "")) {
    return NextResponse.json(
      { error: "STP, STEP, DXF 또는 DWG 파일만 지원합니다." },
      { status: 400 }
    );
  }

  const isDwg = ext === "dwg";
  let fileContent: string;

  if (isDwg) {
    const buf = await file.arrayBuffer();
    const header = new TextDecoder("ascii", { fatal: false }).decode(buf.slice(0, 6));
    const versionMap: Record<string, string> = {
      AC1036: "AutoCAD 2023",
      AC1032: "AutoCAD 2018",
      AC1027: "AutoCAD 2013",
      AC1024: "AutoCAD 2010",
      AC1021: "AutoCAD 2007",
      AC1015: "AutoCAD 2000",
    };
    const acVersion = versionMap[header] ?? (header.startsWith("AC") ? `AutoCAD (${header})` : "AutoCAD");
    fileContent = `[DWG 바이너리 파일 — 텍스트 파싱 불가]\n파일명: ${file.name}\n파일 크기: ${(file.size / 1024).toFixed(0)} KB\nCAD 버전: ${acVersion}`;
  } else {
    fileContent = await file.text();
    if (fileContent.length > 60000) {
      fileContent = fileContent.slice(0, 60000) + "\n... (이하 생략)";
    }
  }

  const contextLines = [
    purpose ? `제품 용도: "${purpose}"` : "",
    quantity ? `생산 수량: ${quantity}` : "",
  ].filter(Boolean).join("\n");

  const isAssembly = material === "조립품";
  const dwgNote = isDwg
    ? "\n※ 이 파일은 DWG 바이너리 형식입니다. 파일명과 메타데이터를 기반으로 추정 분석하며, 정확도가 낮을 수 있습니다."
    : "";

  const prompt = isAssembly
    ? `당신은 제조 공학 전문가입니다. 아래 CAD 파일은 조립품입니다. 파일에서 개별 파트를 식별하고 각 파트별로 재질, 최적 제조방법, 표면처리를 추천하세요.
${contextLines}${dwgNote}

CAD 파일:
\`\`\`
${fileContent}
\`\`\`

다음 JSON 형식으로만 응답하세요:
{
  "isAssembly": true,
  "assemblyName": "조립품명 추정 (한국어만, 영문 병기 금지)",
  "parts": [
    {
      "partName": "파트명 (한국어만, 영문 병기 금지)",
      "material": "추정 재질",
      "method": "제조방법",
      "confidence": 85,
      "reason": "한 줄 이유",
      "surfaceTreatment": "표면처리 추천 (없으면 '없음')"
    }
  ],
  "summary": "전체 조립품 한 줄 요약"
}

제조방법: CNC가공 / 사출금형 / 다이캐스팅 / 압출프레임 / 레이저커팅 / 톰슨칼금형 / 실리콘금형 / 판금가공 / 3D프린팅
파트는 최대 6개까지만 식별하세요. confidence는 0~100 정수.`
    : `당신은 제조 공학 전문가입니다. 아래 CAD 파일을 분석해 최적 제조방법을 추천하세요.
${material !== "미정" ? `지정 재질: ${material}` : "재질 미지정 — 형상으로 추정하세요."}
${contextLines}${dwgNote}

CAD 파일:
\`\`\`
${fileContent}
\`\`\`

다음 JSON 형식으로만 응답하세요:
{
  "isAssembly": false,
  "partName": "부품명 추정 (한국어만, 영문 병기 금지)",
  "complexity": "단순 | 중간 | 복잡",
  "size": "소형(~100mm) | 중형(100~500mm) | 대형(500mm~) | 판단불가",
  "recommendedMethods": [
    { "method": "제조방법명", "confidence": 85, "reason": "한 줄 이유" }
  ],
  "material": "재질명만 간단히",
  "surfaceTreatment": "표면처리 추천 (예: 아노다이징, 도장, 도금, 없음)",
  "considerations": ["주의사항 (최대 2개, 짧게)"],
  "summary": "한 문장 요약"
}

제조방법: CNC가공 / 사출금형 / 다이캐스팅 / 압출프레임 / 레이저커팅 / 톰슨칼금형 / 실리콘금형 / 판금가공 / 3D프린팅
recommendedMethods는 상위 3개만, confidence는 0~100 정수, 추천 순서대로.`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
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
