// 엑셀은 파일명만으로는 AI가 내용을 전혀 모른 채 분류해야 해서 사진보다 정확도가 크게
// 떨어진다. 분류 요청 전에 텍스트를 미리 뽑아 함께 보내 정확도를 올린다.
// (PDF는 여기서 다루지 않는다 — pdfjs-dist를 브라우저 번들에 넣으면 Next.js 웹팩 빌드가
// "import.meta" 파싱 오류로 깨져서, 대신 /api/classify에서 pdf-parse로 서버에서 처리한다.)
import * as XLSX from "xlsx";

const MAX_CHARS = 4000;

export async function extractFileText(file: File): Promise<string | null> {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".xls") && !name.endsWith(".csv")) return null;
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    let text = "";
    for (const sheetName of wb.SheetNames) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
      text += `[시트: ${sheetName}]\n${csv}\n\n`;
      if (text.length > MAX_CHARS) break;
    }
    return text.slice(0, MAX_CHARS);
  } catch {
    // 추출 실패해도 분류 자체는 파일명만으로 계속 진행한다 — 여기서 막지 않는다.
    return null;
  }
}
