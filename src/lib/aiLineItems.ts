import { SupplierCurrency } from "@/lib/types";

export interface ParsedLineItem {
  name: string;
  spec?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
}

export interface ParseLineItemsResult {
  items: ParsedLineItem[];
  currency?: SupplierCurrency | null;
  memo?: string;
}

// 협력사가 "A제품 100개 5000원씩" 식으로 자유롭게 적은 문장을 품목 배열로 구조화한다
// (/api/parse-line-items, Claude 기반). Firestore에는 아무것도 쓰지 않고 결과만 돌려주므로,
// 호출 쪽(견적서/청구서 작성 폼)에서 기존 입력란에 채워넣고 사람이 확인한 뒤 직접 제출한다.
export async function parseLineItems(text: string, lang: "ko" | "zh"): Promise<ParseLineItemsResult> {
  const res = await fetch("/api/parse-line-items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, lang }),
  });
  const raw = await res.text();
  let data: { error?: string; items?: ParsedLineItem[]; currency?: SupplierCurrency | null; memo?: string };
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`서버 응답을 읽을 수 없습니다 (${res.status}).`);
  }
  if (!res.ok) throw new Error(data.error ?? "AI 인식 요청에 실패했습니다.");
  return { items: data.items ?? [], currency: data.currency ?? null, memo: data.memo ?? undefined };
}
