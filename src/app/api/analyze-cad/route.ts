import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

// 내부용 별도 앱(work-intake, intake.handyhand.co.kr)이 CAD 파일 업로드 시 이 분석을 그대로
// 재사용한다 — 이 라우트 자체는 원래 세션 인증이 없는 공개 API라 노출 범위가 늘어나진 않고,
// 다른 오리진에서 fetch로 호출만 가능하게 CORS만 열어준다.
const ALLOWED_ORIGIN = "https://intake.handyhand.co.kr";

function withCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function POST(req: NextRequest) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const lang = (formData.get("lang") as string | null) === "en" ? "en" : "ko";
  const unspecified = lang === "en" ? "Unspecified" : "미정";
  const material = (formData.get("material") as string | null) ?? unspecified;
  const purpose = (formData.get("purpose") as string | null) ?? "";
  const quantity = (formData.get("quantity") as string | null) ?? "";

  if (!file && !purpose.trim()) {
    return withCors(NextResponse.json(
      { error: lang === "en" ? "Please upload a file or enter the product's intended use." : "파일을 업로드하거나 제품 용도를 입력해주세요." },
      { status: 400 }
    ));
  }

  const TEXT_EXTS = ["stp", "step", "dxf"];
  const BINARY_EXTS = ["dwg", "ipt", "iam", "sldprt", "sldasm"];
  const BINARY_LABELS: Record<string, string> = lang === "en"
    ? {
      dwg: "AutoCAD DWG",
      ipt: "Autodesk Inventor part",
      iam: "Autodesk Inventor assembly",
      sldprt: "SolidWorks part",
      sldasm: "SolidWorks assembly",
    }
    : {
      dwg: "AutoCAD DWG",
      ipt: "Autodesk Inventor 파트",
      iam: "Autodesk Inventor 조립품",
      sldprt: "SolidWorks 파트",
      sldasm: "SolidWorks 조립품",
    };

  const ext = file?.name.split(".").pop()?.toLowerCase();

  if (file && !TEXT_EXTS.includes(ext ?? "") && !BINARY_EXTS.includes(ext ?? "")) {
    return withCors(NextResponse.json(
      { error: lang === "en" ? "Only STP, STEP, DXF, DWG, IPT, IAM, SLDPRT, and SLDASM files are supported." : "STP, STEP, DXF, DWG, IPT, IAM, SLDPRT, SLDASM 파일만 지원합니다." },
      { status: 400 }
    ));
  }

  const isBinary = !!file && BINARY_EXTS.includes(ext ?? "");
  let fileContent: string;
  let accuracyNote = "";

  if (!file) {
    fileContent = "";
    accuracyNote = lang === "en"
      ? "\n※ This result is estimated from the text description alone, without a drawing file. Since the actual shape was not reviewed, accuracy may be very low."
      : "\n※ 도면 파일 없이 텍스트 설명만으로 추정한 결과입니다. 실제 형상을 확인하지 않은 추정치이므로 정확도가 매우 낮을 수 있습니다.";
  } else if (isBinary) {
    if (ext === "dwg") {
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
      fileContent = lang === "en"
        ? `[DWG binary file — text parsing not possible]\nFile name: ${file.name}\nFile size: ${(file.size / 1024).toFixed(0)} KB\nCAD version: ${acVersion}`
        : `[DWG 바이너리 파일 — 텍스트 파싱 불가]\n파일명: ${file.name}\n파일 크기: ${(file.size / 1024).toFixed(0)} KB\nCAD 버전: ${acVersion}`;
    } else {
      fileContent = lang === "en"
        ? `[${BINARY_LABELS[ext ?? ""]} binary file — shape parsing not possible]\nFile name: ${file.name}\nFile size: ${(file.size / 1024).toFixed(0)} KB`
        : `[${BINARY_LABELS[ext ?? ""]} 바이너리 파일 — 형상 파싱 불가]\n파일명: ${file.name}\n파일 크기: ${(file.size / 1024).toFixed(0)} KB`;
    }
    accuracyNote = lang === "en"
      ? `\n※ This file is a ${BINARY_LABELS[ext ?? ""]} binary format. Analysis is estimated from the filename and metadata and may be less accurate. For a more accurate analysis, export to STP/STEP and upload again.`
      : `\n※ 이 파일은 ${BINARY_LABELS[ext ?? ""]} 바이너리 형식입니다. 파일명과 메타데이터를 기반으로 추정 분석하며, 정확도가 낮을 수 있습니다. 더 정확한 분석을 원하시면 STP/STEP 파일로 내보내기 후 업로드해주세요.`;
  } else {
    fileContent = await file.text();
    if (fileContent.length > 60000) {
      fileContent = fileContent.slice(0, 60000) + (lang === "en" ? "\n... (truncated)" : "\n... (이하 생략)");
    }
  }

  const contextLines = lang === "en"
    ? [
      purpose ? `Intended use: "${purpose}"` : "",
      quantity ? `Production quantity: ${quantity}` : "",
    ].filter(Boolean).join("\n")
    : [
      purpose ? `제품 용도: "${purpose}"` : "",
      quantity ? `생산 수량: ${quantity}` : "",
    ].filter(Boolean).join("\n");

  const assemblyKeyword = lang === "en" ? "Assembly" : "조립품";
  const isAssembly = material.startsWith(assemblyKeyword);
  const assemblyMaterialHint = lang === "en"
    ? material.match(/Main material: (.+)\)$/)?.[1] ?? ""
    : material.match(/주요 재질: (.+)\)$/)?.[1] ?? "";
  const dwgNote = accuracyNote;
  const fileSection = file
    ? (lang === "en" ? `CAD file:\n\`\`\`\n${fileContent}\n\`\`\`` : `CAD 파일:\n\`\`\`\n${fileContent}\n\`\`\``)
    : (lang === "en" ? `No drawing file was provided. Estimate a general manufacturing method from the text description alone.` : `도면 파일이 제공되지 않았습니다. 아래 텍스트 설명만으로 일반적인 제조 방법을 추정하세요.`);

  const METHOD_ENUM_EN = "CNC Machining / Injection Molding / Die Casting / Extruded Profile / Laser Cutting / Sheet Metal Fabrication / Silicone Compression Molding / Silicone Injection Molding / Silicone Extrusion / Silicone Sample Tooling / Press Tooling / 3D Printing / Vacuum Casting";
  const METHOD_ENUM_KO = "CNC가공 / 사출금형 / 다이캐스팅 / 압출 프로파일 / 레이저 커팅 / 판금가공 / 실리콘 압축성형 / 실리콘 사출성형 / 실리콘 압출성형 / 실리콘 샘플금형 / 프레스금형 / 3D프린팅 / 진공주형";

  const prompt = lang === "en"
    ? (isAssembly
      ? `You are a manufacturing engineering expert. The CAD file below is an assembly. Identify the individual parts in the file and recommend a material, optimal manufacturing method, and surface treatment for each part.
${assemblyMaterialHint ? `Main material of the overall assembly: ${assemblyMaterialHint} (use this as a reference when estimating each part's material, but estimate differently if a part's material is clearly different)` : ""}
${contextLines}${dwgNote}

${fileSection}

Respond only in the following JSON format:
{
  "isAssembly": true,
  "assemblyName": "Estimated assembly name (English only, no Korean)",
  "parts": [
    {
      "partName": "Part name (English only, no Korean)",
      "material": "Estimated material",
      "method": "Manufacturing method",
      "confidence": 85,
      "reason": "One-line reason",
      "surfaceTreatment": "Recommended surface treatment (or 'None')",
      "initialCostLevel": 2,
      "unitCostLevel": 2
    }
  ],
  "summary": "One-line summary of the overall assembly"
}

Manufacturing methods: ${METHOD_ENUM_EN}
Identify at most 6 parts. confidence is an integer from 0-100.
Independently rate initialCostLevel (upfront tooling/equipment investment) and unitCostLevel (per-unit cost at the given quantity) each as an integer from 1 (low) to 3 (high). Reflect real tradeoffs — e.g. silicone molding tends to have low initialCostLevel and high unitCostLevel, while injection molding/die casting tend to have high initialCostLevel and low unitCostLevel. Never mention absolute prices.`
      : `You are a manufacturing engineering expert. Analyze the CAD file below and recommend the best manufacturing method.
${material !== unspecified ? `Specified material: ${material}` : "Material not specified — estimate from the shape."}
${contextLines}${dwgNote}

${fileSection}

Respond only in the following JSON format:
{
  "isAssembly": false,
  "partName": "Estimated part name (English only, no Korean)",
  "complexity": "Simple | Medium | Complex",
  "size": "Small (~100mm) | Medium (100-500mm) | Large (500mm+) | Undetermined",
  "recommendedMethods": [
    { "method": "Manufacturing method name", "confidence": 85, "reason": "One-line reason", "initialCostLevel": 2, "unitCostLevel": 2 }
  ],
  "material": "Material name only, briefly",
  "surfaceTreatment": "Recommended surface treatment (e.g. anodizing, painting, plating, or 'None')",
  "considerations": ["Notes (at most 2, brief)"],
  "summary": "One-sentence summary"
}

Manufacturing methods: ${METHOD_ENUM_EN}
List only the top 2 recommendedMethods, confidence as an integer from 0-100, in recommended order.
Independently rate initialCostLevel (upfront tooling/equipment investment) and unitCostLevel (per-unit cost at the given quantity) each as an integer from 1 (low) to 3 (high). Reflect real tradeoffs — e.g. silicone molding tends to have low initialCostLevel and high unitCostLevel, while injection molding/die casting tend to have high initialCostLevel and low unitCostLevel. Never mention absolute prices.`)
    : (isAssembly
      ? `당신은 제조 공학 전문가입니다. 아래 CAD 파일은 조립품입니다. 파일에서 개별 파트를 식별하고 각 파트별로 재질, 최적 제조방법, 표면처리를 추천하세요.
${assemblyMaterialHint ? `전체 조립품의 주요 재질: ${assemblyMaterialHint} (각 파트 재질 추정 시 참고하되, 파트별로 다른 재질이 명백하면 그에 맞게 추정하세요)` : ""}
${contextLines}${dwgNote}

${fileSection}

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
      "surfaceTreatment": "표면처리 추천 (없으면 '없음')",
      "initialCostLevel": 2,
      "unitCostLevel": 2
    }
  ],
  "summary": "전체 조립품 한 줄 요약"
}

제조방법: ${METHOD_ENUM_KO}
파트는 최대 6개까지만 식별하세요. confidence는 0~100 정수.
initialCostLevel(금형·설비 등 초기 투자비)과 unitCostLevel(생산 수량 기준 개당 단가)을 각각 1(낮음)~3(높음) 정수로 독립적으로 평가하세요. 예: 실리콘금형은 initialCostLevel 낮음·unitCostLevel 높음, 사출금형/다이캐스팅은 initialCostLevel 높음·unitCostLevel 낮음처럼 트레이드오프를 반영하세요. 절대 금액은 언급하지 마세요.`
      : `당신은 제조 공학 전문가입니다. 아래 CAD 파일을 분석해 최적 제조방법을 추천하세요.
${material !== unspecified ? `지정 재질: ${material}` : "재질 미지정 — 형상으로 추정하세요."}
${contextLines}${dwgNote}

${fileSection}

다음 JSON 형식으로만 응답하세요:
{
  "isAssembly": false,
  "partName": "부품명 추정 (한국어만, 영문 병기 금지)",
  "complexity": "단순 | 중간 | 복잡",
  "size": "소형(~100mm) | 중형(100~500mm) | 대형(500mm~) | 판단불가",
  "recommendedMethods": [
    { "method": "제조방법명", "confidence": 85, "reason": "한 줄 이유", "initialCostLevel": 2, "unitCostLevel": 2 }
  ],
  "material": "재질명만 간단히",
  "surfaceTreatment": "표면처리 추천 (예: 아노다이징, 도장, 도금, 없음)",
  "considerations": ["주의사항 (최대 2개, 짧게)"],
  "summary": "한 문장 요약"
}

제조방법: ${METHOD_ENUM_KO}
recommendedMethods는 상위 2개만, confidence는 0~100 정수, 추천 순서대로.
initialCostLevel(금형·설비 등 초기 투자비)과 unitCostLevel(생산 수량 기준 개당 단가)을 각각 1(낮음)~3(높음) 정수로 독립적으로 평가하세요. 예: 실리콘금형은 initialCostLevel 낮음·unitCostLevel 높음, 사출금형/다이캐스팅은 initialCostLevel 높음·unitCostLevel 낮음처럼 트레이드오프를 반영하세요. 절대 금액은 언급하지 마세요.`);

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") throw new Error(lang === "en" ? "Invalid response format" : "응답 형식 오류");

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(lang === "en" ? "Could not parse the analysis result." : "분석 결과를 파싱할 수 없습니다.");

    const result = JSON.parse(jsonMatch[0]);
    result.isAssembly = isAssembly;
    return withCors(NextResponse.json(result));
  } catch (e) {
    const msg = e instanceof Error ? e.message : (lang === "en" ? "An error occurred during analysis" : "분석 중 오류 발생");
    return withCors(NextResponse.json({ error: msg }, { status: 500 }));
  }
}
