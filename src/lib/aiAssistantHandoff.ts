import { SupplierCurrency } from "@/lib/types";

export interface AiAssistantDraftItem {
  name: string;
  spec?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
}

export interface AiAssistantDraft {
  kind: "quote" | "invoice";
  items: AiAssistantDraftItem[];
  // invoice일 때만 — 이미 발행된 발주서를 그대로 담을 soNumber 목록.
  orderNumbers?: string[];
  currency?: SupplierCurrency | null;
  memo?: string;
}

const KEY = "hh-ai-assistant-draft";

// /organize의 AI 비서 입력창에서 견적서/청구서 작성 의도로 판단되면, 그 결과를 각자의
// 작성 페이지(/my-quotes, /my-invoices)로 넘겨준다. 두 페이지가 서로 다른 탭/history
// 항목이라 React 상태로는 못 넘기므로 세션스토리지로 1회성 전달한다 — 받는 쪽에서
// 꺼내는 즉시 지운다(새로고침해도 같은 초안이 또 열리지 않도록).
export function setAiAssistantDraft(draft: AiAssistantDraft) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // 세션스토리지를 못 쓰는 환경이면 그냥 넘어간다 — 받는 페이지가 수동 입력으로 대체된다.
  }
}

export function takeAiAssistantDraft(kind: "quote" | "invoice"): AiAssistantDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as AiAssistantDraft;
    if (draft.kind !== kind) return null;
    sessionStorage.removeItem(KEY);
    return draft;
  } catch {
    return null;
  }
}
