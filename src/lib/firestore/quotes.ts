import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Currency } from "@/lib/types";

export type QuoteStatus = "pending" | "reviewed" | "contacted";

// 정식 견적서 자체의 생명주기 — 위 QuoteStatus(리드 관리용)와는 별개 축.
// "expired"는 고객이 거절한 게 아니라 그냥 응답이 없어 자동으로 정리된 상태다 — "declined"와
// 의도적으로 구분해서, 나중에 고객이 다시 연락 와도 "거절했었다"는 오해가 생기지 않게 한다.
export type FormalQuoteStatus = "sent" | "accepted" | "declined" | "expired";

export interface QuoteLineItem {
  name: string;
  unitPrice: number;
  currency: Currency;
  quantity: number;
  unit?: string;
  vatApplicable?: boolean;
}

export interface QuoteRequest {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  description: string;
  stage: string;
  status: QuoteStatus;
  createdAt: number;
  memo: string;
  hasAttachment?: boolean;
  quoteItems?: QuoteLineItem[];
  quoteMemo?: string;
  quoteStatus?: FormalQuoteStatus;
  quoteIssuedAt?: number;
  quoteIssuedBy?: string;
  quoteRespondedAt?: number;
  quoteDeclineReason?: string;
  bizRegCertUrl?: string;
  quoteReminderSentAt?: number;
}

function fromDoc(d: any): QuoteRequest {
  const data = d.data();
  return {
    id: d.id,
    name: data.name ?? "",
    company: data.company ?? "",
    email: data.email ?? "",
    phone: data.phone ?? "",
    description: data.description ?? "",
    stage: data.stage ?? "",
    status: data.status ?? "pending",
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now(),
    memo: data.memo ?? "",
    hasAttachment: !!data.hasAttachment,
    quoteItems: data.quoteItems,
    quoteMemo: data.quoteMemo,
    quoteStatus: data.quoteStatus,
    quoteIssuedAt: data.quoteIssuedAt?.toMillis ? data.quoteIssuedAt.toMillis() : data.quoteIssuedAt,
    quoteIssuedBy: data.quoteIssuedBy,
    quoteRespondedAt: data.quoteRespondedAt?.toMillis ? data.quoteRespondedAt.toMillis() : data.quoteRespondedAt,
    quoteDeclineReason: data.quoteDeclineReason,
    bizRegCertUrl: data.bizRegCertUrl,
    quoteReminderSentAt: data.quoteReminderSentAt?.toMillis ? data.quoteReminderSentAt.toMillis() : data.quoteReminderSentAt,
  };
}

export async function createQuoteRequest(input: {
  name: string;
  company?: string;
  email: string;
  phone?: string;
  stage?: string;
  description: string;
  hasAttachment?: boolean;
}) {
  return addDoc(collection(db, "quoteRequests"), {
    name: input.name,
    company: input.company || "",
    email: input.email,
    phone: input.phone || "",
    stage: input.stage || "",
    description: input.description,
    hasAttachment: !!input.hasAttachment,
    status: "pending",
    memo: "",
    createdAt: serverTimestamp(),
  });
}

export function listenQuoteRequests(cb: (quotes: QuoteRequest[]) => void) {
  const q = query(collection(db, "quoteRequests"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map(fromDoc)));
}

export async function updateQuote(id: string, patch: { status?: QuoteStatus; memo?: string }) {
  return updateDoc(doc(db, "quoteRequests", id), { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteQuote(id: string) {
  return deleteDoc(doc(db, "quoteRequests", id));
}

// 견적 요청 상담(대면/화상 미팅) 중 이메일 등으로 추가로 받는 자료 아카이브 — 최초 제출 시
// 첨부(hasAttachment)와 달리, 상담이 진행되며 여러 건이 계속 쌓일 수 있어 별도 서브컬렉션으로 둔다.
export interface QuoteFile {
  id: string;
  name: string;
  url: string;
  storagePath: string;
  size: number;
  contentType: string;
  uploadedByName: string;
  uploadedAt: number;
}

function quoteFilesColRef(quoteId: string) {
  return collection(db, "quoteRequests", quoteId, "files");
}

export function listenQuoteFiles(quoteId: string, cb: (files: QuoteFile[]) => void) {
  const q = query(quoteFilesColRef(quoteId), orderBy("uploadedAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name,
          url: data.url,
          storagePath: data.storagePath,
          size: data.size,
          contentType: data.contentType,
          uploadedByName: data.uploadedByName,
          uploadedAt: data.uploadedAt?.toMillis ? data.uploadedAt.toMillis() : Date.now(),
        } as QuoteFile;
      })
    );
  });
}

export async function uploadQuoteFile(quoteId: string, file: File, uploadedByName: string) {
  const storagePath = `quoteRequests/${quoteId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  return addDoc(quoteFilesColRef(quoteId), {
    name: file.name,
    url,
    storagePath,
    size: file.size,
    contentType: file.type || "application/octet-stream",
    uploadedByName,
    uploadedAt: serverTimestamp(),
  });
}

export async function deleteQuoteFile(quoteId: string, fileId: string, storagePath: string) {
  await deleteDoc(doc(db, "quoteRequests", quoteId, "files", fileId));
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (e) {
    console.warn("스토리지 파일 삭제 실패(이미 삭제되었을 수 있음)", e);
  }
}
