import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AssistantConversation, AssistantIntent, AssistantMessage } from "@/lib/types";

const convRef = collection(db, "assistantConversations");

function fromConvDoc(d: any): AssistantConversation {
  const data = d.data();
  return {
    id: d.id,
    partnerId: data.partnerId,
    title: data.title,
    createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
    updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now(),
  };
}

function fromMsgDoc(d: any): AssistantMessage {
  const data = d.data();
  return {
    id: d.id,
    role: data.role,
    text: data.text ?? "",
    attachmentNames: data.attachmentNames ?? undefined,
    intent: data.intent ?? undefined,
    fileIntakeSummary: data.fileIntakeSummary ?? undefined,
    draft: data.draft ?? undefined,
    productRegisterDraft: data.productRegisterDraft ?? undefined,
    purchaseOrderDraft: data.purchaseOrderDraft ?? undefined,
    clientInvoiceDraft: data.clientInvoiceDraft ?? undefined,
    actionDone: data.actionDone ?? undefined,
    archiveResults: data.archiveResults ?? undefined,
    createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
  };
}

// 새로고침·기기 교체에도 지난 대화가 안 사라지도록 로컬스토리지 대신 Firestore에 둔다.
export function listenConversations(partnerId: string, cb: (list: AssistantConversation[]) => void, onError?: (e: Error) => void) {
  const q = query(convRef, where("partnerId", "==", partnerId));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map(fromConvDoc).sort((a, b) => b.updatedAt - a.updatedAt)),
    (e) => {
      console.error("[listenConversations] 대화 목록 조회 실패", e);
      onError?.(e as Error);
    }
  );
}

export function listenMessages(conversationId: string, cb: (list: AssistantMessage[]) => void) {
  const q = query(collection(db, "assistantConversations", conversationId, "messages"), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map(fromMsgDoc)));
}

export async function createConversation(partnerId: string, title: string): Promise<string> {
  const docRef = await addDoc(convRef, {
    partnerId,
    title,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function renameConversation(conversationId: string, title: string) {
  await updateDoc(doc(db, "assistantConversations", conversationId), { title, updatedAt: serverTimestamp() });
}

export interface AddMessageInput {
  role: "user" | "assistant";
  text: string;
  attachmentNames?: string[];
  intent?: AssistantIntent;
  fileIntakeSummary?: { projectName?: string; taskName?: string; confidence?: "high" | "medium" | "low" };
  draft?: {
    items: { name: string; spec?: string; quantity: number; unit?: string; unitPrice: number }[];
    orderNumbers?: string[];
    currency?: "USD" | "CNY" | "KRW" | null;
    memo?: string;
  };
  productRegisterDraft?: {
    clientName: string;
    matchedClientId?: string;
    matchedClientName?: string;
    productName: string;
    unitPrice: number;
    currency: "KRW" | "USD";
    unit?: string;
    existingProductId?: string;
  };
  purchaseOrderDraft?: {
    supplierName: string;
    matchedPartnerId?: string;
    matchedPartnerName?: string;
    items: { name: string; spec?: string; quantity: number; unit?: string; unitPrice: number }[];
    currency: "USD" | "CNY" | "KRW";
    memo?: string;
  };
  clientInvoiceDraft?: {
    clientId: string;
    clientName: string;
    orderId: string;
    poNumber: string;
    installmentIndex: number;
    installmentLabel: string;
    amount: number;
    currency: "KRW" | "USD";
  }[];
  archiveResults?: {
    id: string;
    name: string;
    url: string;
    projectName?: string;
    taskName?: string;
    uploadedAt: number;
  }[];
}

export async function addMessage(conversationId: string, input: AddMessageInput) {
  // fileIntakeSummary 안의 taskName/confidence는 업무를 못 찾거나 확신도가 없을 때 개별적으로
  // undefined일 수 있다 — Firestore는 중첩 객체 안의 undefined 값도 거부하므로, 있는 키만 골라
  // 넣는다(객체 전체가 아니라 필드 단위로 conditional spread).
  const fileIntakeSummary = input.fileIntakeSummary
    ? {
        ...(input.fileIntakeSummary.projectName ? { projectName: input.fileIntakeSummary.projectName } : {}),
        ...(input.fileIntakeSummary.taskName ? { taskName: input.fileIntakeSummary.taskName } : {}),
        ...(input.fileIntakeSummary.confidence ? { confidence: input.fileIntakeSummary.confidence } : {}),
      }
    : undefined;
  // draft.items의 각 품목도 spec/unit이 개별적으로 비어있을 수 있어 같은 방식으로 정리한다.
  const draft = input.draft
    ? {
        items: input.draft.items.map((it) => ({
          name: it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          ...(it.spec ? { spec: it.spec } : {}),
          ...(it.unit ? { unit: it.unit } : {}),
        })),
        ...(input.draft.orderNumbers && input.draft.orderNumbers.length > 0 ? { orderNumbers: input.draft.orderNumbers } : {}),
        ...(input.draft.currency ? { currency: input.draft.currency } : {}),
        ...(input.draft.memo ? { memo: input.draft.memo } : {}),
      }
    : undefined;
  // productRegisterDraft/purchaseOrderDraft도 draft와 같은 이유로 필드 단위로 정리한다
  // (매칭 실패 시 matchedClientId/matchedPartnerId 등이 개별적으로 undefined일 수 있다).
  const productRegisterDraft = input.productRegisterDraft
    ? {
        clientName: input.productRegisterDraft.clientName,
        productName: input.productRegisterDraft.productName,
        unitPrice: input.productRegisterDraft.unitPrice,
        currency: input.productRegisterDraft.currency,
        ...(input.productRegisterDraft.matchedClientId ? { matchedClientId: input.productRegisterDraft.matchedClientId } : {}),
        ...(input.productRegisterDraft.matchedClientName ? { matchedClientName: input.productRegisterDraft.matchedClientName } : {}),
        ...(input.productRegisterDraft.unit ? { unit: input.productRegisterDraft.unit } : {}),
        ...(input.productRegisterDraft.existingProductId ? { existingProductId: input.productRegisterDraft.existingProductId } : {}),
      }
    : undefined;
  const purchaseOrderDraft = input.purchaseOrderDraft
    ? {
        supplierName: input.purchaseOrderDraft.supplierName,
        currency: input.purchaseOrderDraft.currency,
        items: input.purchaseOrderDraft.items.map((it) => ({
          name: it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          ...(it.spec ? { spec: it.spec } : {}),
          ...(it.unit ? { unit: it.unit } : {}),
        })),
        ...(input.purchaseOrderDraft.matchedPartnerId ? { matchedPartnerId: input.purchaseOrderDraft.matchedPartnerId } : {}),
        ...(input.purchaseOrderDraft.matchedPartnerName ? { matchedPartnerName: input.purchaseOrderDraft.matchedPartnerName } : {}),
        ...(input.purchaseOrderDraft.memo ? { memo: input.purchaseOrderDraft.memo } : {}),
      }
    : undefined;

  await addDoc(collection(db, "assistantConversations", conversationId, "messages"), {
    role: input.role,
    text: input.text,
    ...(input.attachmentNames && input.attachmentNames.length > 0 ? { attachmentNames: input.attachmentNames } : {}),
    ...(input.intent ? { intent: input.intent } : {}),
    ...(fileIntakeSummary && Object.keys(fileIntakeSummary).length > 0 ? { fileIntakeSummary } : {}),
    ...(draft ? { draft } : {}),
    ...(productRegisterDraft ? { productRegisterDraft } : {}),
    ...(purchaseOrderDraft ? { purchaseOrderDraft } : {}),
    ...(input.clientInvoiceDraft && input.clientInvoiceDraft.length > 0 ? { clientInvoiceDraft: input.clientInvoiceDraft } : {}),
    ...(input.archiveResults && input.archiveResults.length > 0
      ? {
          archiveResults: input.archiveResults.map((r) => ({
            id: r.id,
            name: r.name,
            url: r.url,
            uploadedAt: r.uploadedAt,
            ...(r.projectName ? { projectName: r.projectName } : {}),
            ...(r.taskName ? { taskName: r.taskName } : {}),
          })),
        }
      : {}),
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, "assistantConversations", conversationId), { updatedAt: serverTimestamp() }, { merge: true });
}

// 제품등록/발주서작성/청구서발행 카드의 버튼을 눌러 실제 처리를 마친 뒤 호출 — 다시 들어와도
// 버튼이 "완료됨"으로 보여 중복 실행(제품 중복 등록, 청구서 중복 발행 등)을 막는다.
export async function markMessageActionDone(conversationId: string, messageId: string) {
  await updateDoc(doc(db, "assistantConversations", conversationId, "messages", messageId), { actionDone: true });
}

// Firestore는 상위 문서를 지워도 서브컬렉션(messages)이 자동으로 안 지워지므로, 대화를
// 지울 때는 메시지들을 먼저 하나씩 지운 뒤 대화 문서 자체를 지운다.
export async function deleteConversation(conversationId: string) {
  const msgsSnap = await getDocs(collection(db, "assistantConversations", conversationId, "messages"));
  await Promise.all(msgsSnap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, "assistantConversations", conversationId));
}
