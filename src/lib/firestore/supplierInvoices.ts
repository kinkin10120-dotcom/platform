import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { SupplierCurrency, SupplierInvoice, SupplierInvoiceLineItem, SupplierInvoiceStatus } from "@/lib/types";

// 협력사(공급사) → HANDYHAND 방향 청구서. 우리가 협력사에게 내는 발주(supplierOrders)와는
// 돈의 방향이 반대라 완전히 별도 컬렉션으로 둔다.
const colRef = collection(db, "supplierInvoices");

function fromDoc(d: any): SupplierInvoice {
  const data = d.data();
  return {
    id: d.id,
    invoiceNumber: data.invoiceNumber,
    partnerId: data.partnerId,
    partnerName: data.partnerName,
    currency: data.currency ?? "USD",
    items: data.items ?? [],
    totalAmount: data.totalAmount ?? 0,
    memo: data.memo || undefined,
    memoKo: data.memoKo || undefined,
    status: data.status === "paid" ? "paid" : "submitted",
    submittedAt: data.submittedAt?.toMillis ? data.submittedAt.toMillis() : Date.now(),
    paidAt: data.paidAt?.toMillis ? data.paidAt.toMillis() : undefined,
    receiptUrl: data.receiptUrl || undefined,
    receiptStoragePath: data.receiptStoragePath || undefined,
    receiptName: data.receiptName || undefined,
    createdBy: data.createdBy ?? "",
  };
}

export function listenAllSupplierInvoices(cb: (invoices: SupplierInvoice[]) => void) {
  return onSnapshot(colRef, (snap) => cb(snap.docs.map(fromDoc).sort((a, b) => b.submittedAt - a.submittedAt)));
}

// 협력사 계정 전용 — 자기 앞으로 제출한 청구서만 조회한다. onError 없이는 권한 오류가
// 조용히 삼켜져 "불러오는 중..."에 무한정 멈춘다(이 레포에서 반복적으로 겪은 함정).
export function listenSupplierInvoicesByPartner(
  partnerId: string,
  cb: (invoices: SupplierInvoice[]) => void,
  onError?: (e: Error) => void
) {
  const q = query(colRef, where("partnerId", "==", partnerId));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map(fromDoc).sort((a, b) => b.submittedAt - a.submittedAt)),
    (e) => {
      console.error("[listenSupplierInvoicesByPartner] 청구서 조회 실패", e);
      onError?.(e);
    }
  );
}

export function listenSupplierInvoice(id: string, cb: (invoice: SupplierInvoice | null) => void) {
  return onSnapshot(doc(db, "supplierInvoices", id), (snap) => cb(snap.exists() ? fromDoc(snap) : null));
}

export interface CreateSupplierInvoiceInput {
  partnerId: string;
  partnerName: string;
  currency: SupplierCurrency;
  items: SupplierInvoiceLineItem[];
  memo?: string;
  memoKo?: string;
  createdBy: string;
}

export async function createSupplierInvoice(input: CreateSupplierInvoiceInput) {
  // 발주번호와 같은 방식 — 문서 ID를 먼저 만들어 청구서번호에 쓰고 쓰기 한 번으로 끝낸다.
  const docRef = doc(colRef);
  const d = new Date();
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const invoiceNumber = `INV-${dateStr}-${docRef.id.slice(0, 4).toUpperCase()}`;
  const totalAmount = input.items.reduce((sum, it) => sum + (it.amount || 0), 0);

  await setDoc(docRef, {
    invoiceNumber,
    partnerId: input.partnerId,
    partnerName: input.partnerName,
    currency: input.currency,
    items: input.items,
    totalAmount,
    memo: input.memo ?? "",
    memoKo: input.memoKo ?? "",
    status: "submitted" as SupplierInvoiceStatus,
    submittedAt: serverTimestamp(),
    createdBy: input.createdBy,
  });
  return docRef;
}

// 협력사 본인이 제출 직후 실수를 되돌릴 때만 — "제출됨" 상태일 때만 호출하게 UI에서 막는다.
export async function deleteSupplierInvoice(id: string) {
  return deleteDoc(doc(db, "supplierInvoices", id));
}

// 관리자 전용 — 송금 영수증을 첨부하며 지급 완료로 바꾼다.
export async function markSupplierInvoicePaid(id: string, receiptFile: File, onProgress?: (ratio: number) => void) {
  const storagePath = `supplierInvoiceReceipts/${id}/${Date.now()}_${receiptFile.name}`;
  const storageRef = ref(storage, storagePath);
  const url = await new Promise<string>((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, receiptFile);
    uploadTask.on(
      "state_changed",
      (snap) => onProgress?.(snap.bytesTransferred / snap.totalBytes),
      reject,
      () => getDownloadURL(uploadTask.snapshot.ref).then(resolve, reject)
    );
  });
  return updateDoc(doc(db, "supplierInvoices", id), {
    status: "paid" as SupplierInvoiceStatus,
    paidAt: serverTimestamp(),
    receiptUrl: url,
    receiptStoragePath: storagePath,
    receiptName: receiptFile.name,
  });
}

// 지급 완료 처리를 실수로 했을 때 되돌리는 용도 — 영수증 파일도 같이 정리한다.
export async function unmarkSupplierInvoicePaid(invoice: SupplierInvoice) {
  if (invoice.receiptStoragePath) {
    try {
      await deleteObject(ref(storage, invoice.receiptStoragePath));
    } catch (e) {
      console.warn("청구서 영수증 스토리지 삭제 실패(이미 삭제되었을 수 있음)", e);
    }
  }
  return updateDoc(doc(db, "supplierInvoices", invoice.id), {
    status: "submitted" as SupplierInvoiceStatus,
    paidAt: null,
    receiptUrl: null,
    receiptStoragePath: null,
    receiptName: null,
  });
}
