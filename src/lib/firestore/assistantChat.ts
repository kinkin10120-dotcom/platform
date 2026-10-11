import {
  addDoc,
  collection,
  doc,
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
}

export async function addMessage(conversationId: string, input: AddMessageInput) {
  await addDoc(collection(db, "assistantConversations", conversationId, "messages"), {
    role: input.role,
    text: input.text,
    ...(input.attachmentNames && input.attachmentNames.length > 0 ? { attachmentNames: input.attachmentNames } : {}),
    ...(input.intent ? { intent: input.intent } : {}),
    ...(input.fileIntakeSummary ? { fileIntakeSummary: input.fileIntakeSummary } : {}),
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, "assistantConversations", conversationId), { updatedAt: serverTimestamp() }, { merge: true });
}
