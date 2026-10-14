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
  writeBatch,
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
    title: data.title || undefined,
    titleKo: data.titleKo || undefined,
    memo: data.memo || undefined,
    memoKo: data.memoKo || undefined,
    status: data.status === "paid" ? "paid" : "submitted",
    submittedAt: data.submittedAt?.toMillis ? data.submittedAt.toMillis() : Date.now(),
    paidAt: data.paidAt?.toMillis ? data.paidAt.toMillis() : undefined,
    paidAmount: typeof data.paidAmount === "number" ? data.paidAmount : undefined,
    carriedForward: data.carriedForward === true,
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
  title?: string;
  titleKo?: string;
  memo?: string;
  memoKo?: string;
  createdBy: string;
  // 이번 청구서의 "adjustment" 항목이 반영한 과거 청구서들 — 새 청구서 생성과 한 배치로
  // carriedForward: true 처리해서, 생성은 됐는데 표시만 안 되는 식의 불일치가 안 생기게 한다.
  adjustmentSourceInvoiceIds?: string[];
}

export async function createSupplierInvoice(input: CreateSupplierInvoiceInput) {
  // 발주번호와 같은 방식 — 문서 ID를 먼저 만들어 청구서번호에 쓰고 쓰기 한 번으로 끝낸다.
  const docRef = doc(colRef);
  const d = new Date();
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const invoiceNumber = `INV-${dateStr}-${docRef.id.slice(0, 4).toUpperCase()}`;
  const totalAmount = input.items.reduce((sum, it) => sum + (it.amount || 0), 0);
  // 프로젝트 미지정 발주건처럼 linkedProjectId/linkedProjectName(그 외 선택 필드들)이
  // undefined인 품목이 섞이면 Firestore가 setDoc 전체를 거부한다(중첩 객체 안의 undefined도
  // 허용 안 함) — 필드 단위로 있는 값만 골라 넣는다.
  const items = input.items.map((it) => ({
    id: it.id,
    source: it.source,
    description: it.description,
    amount: it.amount,
    ...(it.supplierOrderId ? { supplierOrderId: it.supplierOrderId } : {}),
    ...(it.soNumber ? { soNumber: it.soNumber } : {}),
    ...(it.linkedProjectId ? { linkedProjectId: it.linkedProjectId } : {}),
    ...(it.linkedProjectName ? { linkedProjectName: it.linkedProjectName } : {}),
    ...(it.descriptionKo ? { descriptionKo: it.descriptionKo } : {}),
  }));

  const batch = writeBatch(db);
  batch.set(docRef, {
    invoiceNumber,
    partnerId: input.partnerId,
    partnerName: input.partnerName,
    currency: input.currency,
    items,
    totalAmount,
    title: input.title ?? "",
    titleKo: input.titleKo ?? "",
    memo: input.memo ?? "",
    memoKo: input.memoKo ?? "",
    status: "submitted" as SupplierInvoiceStatus,
    submittedAt: serverTimestamp(),
    createdBy: input.createdBy,
  });
  (input.adjustmentSourceInvoiceIds ?? []).forEach((id) => {
    batch.update(doc(db, "supplierInvoices", id), { carriedForward: true });
  });
  await batch.commit();
  return docRef;
}

// 협력사 본인이 제출 직후 실수를 되돌릴 때만 — "제출됨" 상태일 때만 호출하게 UI에서 막는다.
export async function deleteSupplierInvoice(id: string) {
  return deleteDoc(doc(db, "supplierInvoices", id));
}

// 관리자 전용 — 송금 영수증을 첨부하며 지급 완료로 바꾼다. paidAmount(실제 입금액)를 따로
// 지정하지 않으면 청구액 전액이 입금된 것으로 본다 — 지금까지의 동작과 동일하게 유지된다.
export async function markSupplierInvoicePaid(
  id: string,
  receiptFile: File,
  paidAmount?: number,
  onProgress?: (ratio: number) => void
) {
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
    ...(typeof paidAmount === "number" ? { paidAmount } : {}),
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
    paidAmount: null,
    carriedForward: false,
    receiptUrl: null,
    receiptStoragePath: null,
    receiptName: null,
  });
}
