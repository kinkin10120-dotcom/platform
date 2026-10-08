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
import { db } from "@/lib/firebase";
import { getAdmins } from "@/lib/firestore/users";
import { createNotification } from "@/lib/firestore/notifications";
import { createSupplierOrder } from "@/lib/firestore/supplierOrders";
import { translateForCache } from "@/lib/i18n";
import { SupplierCurrency, SupplierOrderKind, SupplierQuote, SupplierQuoteItem, SupplierQuoteStatus } from "@/lib/types";

// 협력사 → HANDYHAND 견적서. 청구서(supplierInvoices)와 방향은 같지만(협력사가 만든다)
// 의미가 다르다 — 아직 발주되지 않은 건에 대한 사전 제안이라 완전히 별도 컬렉션으로 둔다.
const colRef = collection(db, "supplierQuotes");

function fromDoc(d: any): SupplierQuote {
  const data = d.data();
  return {
    id: d.id,
    quoteNumber: data.quoteNumber,
    partnerId: data.partnerId,
    partnerName: data.partnerName,
    currency: data.currency ?? "USD",
    items: data.items ?? [],
    totalAmount: data.totalAmount ?? 0,
    orderKind: data.orderKind || undefined,
    linkedProjectId: data.linkedProjectId || undefined,
    linkedProjectName: data.linkedProjectName || undefined,
    memo: data.memo || undefined,
    memoKo: data.memoKo || undefined,
    status:
      data.status === "approved" || data.status === "rejected" || data.status === "revision_requested"
        ? data.status
        : "submitted",
    submittedAt: data.submittedAt?.toMillis ? data.submittedAt.toMillis() : Date.now(),
    decidedAt: data.decidedAt?.toMillis ? data.decidedAt.toMillis() : undefined,
    decidedBy: data.decidedBy || undefined,
    rejectReason: data.rejectReason || undefined,
    revisionNote: data.revisionNote || undefined,
    revisionNoteZh: data.revisionNoteZh || undefined,
    linkedSupplierOrderId: data.linkedSupplierOrderId || undefined,
    createdBy: data.createdBy ?? "",
  };
}

export function calcSupplierQuoteTotal(items: SupplierQuoteItem[]): number {
  return items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
}

export function listenAllSupplierQuotes(cb: (quotes: SupplierQuote[]) => void) {
  return onSnapshot(colRef, (snap) => cb(snap.docs.map(fromDoc).sort((a, b) => b.submittedAt - a.submittedAt)));
}

// 협력사 계정 전용 — 자기 앞으로 제출한 견적서만 조회한다. onError 없이는 권한 오류가
// 조용히 삼켜져 "불러오는 중..."에 무한정 멈춘다(이 레포에서 반복적으로 겪은 함정).
export function listenSupplierQuotesByPartner(
  partnerId: string,
  cb: (quotes: SupplierQuote[]) => void,
  onError?: (e: Error) => void
) {
  const q = query(colRef, where("partnerId", "==", partnerId));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map(fromDoc).sort((a, b) => b.submittedAt - a.submittedAt)),
    (e) => {
      console.error("[listenSupplierQuotesByPartner] 견적서 조회 실패", e);
      onError?.(e);
    }
  );
}

export function listenSupplierQuote(id: string, cb: (quote: SupplierQuote | null) => void) {
  return onSnapshot(doc(db, "supplierQuotes", id), (snap) => cb(snap.exists() ? fromDoc(snap) : null));
}

export interface CreateSupplierQuoteInput {
  partnerId: string;
  partnerName: string;
  currency: SupplierCurrency;
  items: SupplierQuoteItem[];
  orderKind?: SupplierOrderKind;
  linkedProjectId?: string;
  linkedProjectName?: string;
  memo?: string;
  memoKo?: string;
  createdBy: string;
}

export async function createSupplierQuote(input: CreateSupplierQuoteInput) {
  const docRef = doc(colRef);
  const d = new Date();
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const quoteNumber = `QT-${dateStr}-${docRef.id.slice(0, 4).toUpperCase()}`;
  const totalAmount = calcSupplierQuoteTotal(input.items);

  await setDoc(docRef, {
    quoteNumber,
    partnerId: input.partnerId,
    partnerName: input.partnerName,
    currency: input.currency,
    items: input.items,
    totalAmount,
    orderKind: input.orderKind ?? null,
    linkedProjectId: input.linkedProjectId ?? "",
    linkedProjectName: input.linkedProjectName ?? "",
    memo: input.memo ?? "",
    memoKo: input.memoKo ?? "",
    status: "submitted" as SupplierQuoteStatus,
    submittedAt: serverTimestamp(),
    createdBy: input.createdBy,
  });

  try {
    const admins = await getAdmins();
    await Promise.all(
      admins.map((u) =>
        createNotification({
          userId: u.uid,
          type: "supplier_quote_submitted",
          supplierQuoteId: docRef.id,
          message: `${input.partnerName}에서 새 견적서(${quoteNumber})를 제출했습니다. 합계 ${totalAmount.toLocaleString()} ${input.currency}`,
        })
      )
    );
  } catch (e) {
    console.error("견적서 제출 알림 발송 실패:", e);
  }

  return docRef;
}

// 협력사 본인이 제출 직후 실수를 되돌릴 때만 — "검토 대기" 상태일 때만 호출하게 UI에서 막는다.
export async function deleteSupplierQuote(id: string) {
  return deleteDoc(doc(db, "supplierQuotes", id));
}

export type UpdateSupplierQuoteInput = Pick<
  CreateSupplierQuoteInput,
  "currency" | "items" | "orderKind" | "linkedProjectId" | "linkedProjectName" | "memo" | "memoKo"
>;

// 협력사 본인이 "검토 대기" 또는 "수정 요청됨" 상태일 때만 수정할 수 있다 — 가격이 나중에
// 조정되는 경우가 많아서 생긴 기능이지만, 관리자가 이미 승인/반려 판단을 내린 뒤에 내용이
// 바뀌면 안 되므로 그 두 상태로만 제한한다(Firestore 규칙에서도 동일하게 강제한다). 수정
// 저장은 항상 "검토 대기"로 되돌아간다 — 수정 요청에 대한 응답이든 그냥 고친 것이든, 관리자가
// 다시 봐야 하는 상태이기 때문이다. 이전 수정 요청 메모는 더 이상 유효하지 않으니 비운다.
export async function updateSupplierQuote(id: string, input: UpdateSupplierQuoteInput) {
  const totalAmount = calcSupplierQuoteTotal(input.items);
  return updateDoc(doc(db, "supplierQuotes", id), {
    currency: input.currency,
    items: input.items,
    totalAmount,
    orderKind: input.orderKind ?? null,
    linkedProjectId: input.linkedProjectId ?? "",
    linkedProjectName: input.linkedProjectName ?? "",
    memo: input.memo ?? "",
    memoKo: input.memoKo ?? "",
    status: "submitted" as SupplierQuoteStatus,
    revisionNote: null,
    revisionNoteZh: null,
  });
}

// 관리자 전용 — 승인하면 같은 내용으로 매입 발주서(작성중 상태)를 자동 생성해, 다시
// 입력할 필요 없이 거기서 바로 검토·발행만 하면 되게 한다.
export async function approveSupplierQuote(quote: SupplierQuote, decidedBy: string) {
  const orderRef = await createSupplierOrder({
    supplierName: quote.partnerName,
    // Firestore는 undefined 필드가 섞인 객체를 그대로 setDoc에 넘기면 거부한다 — 견적서
    // 품목엔 nameEn/spec/unit처럼 비어 있는 선택 필드가 흔해서, 값이 있을 때만 키를 넣는다.
    items: quote.items.map((it) => ({
      name: it.nameKo || it.name,
      ...(it.nameEn ? { nameEn: it.nameEn } : {}),
      ...(it.spec ? { spec: it.spec } : {}),
      unitPrice: it.unitPrice,
      quantity: it.quantity,
      ...(it.unit ? { unit: it.unit } : {}),
      ...(quote.orderKind ? { orderKind: quote.orderKind } : {}),
    })),
    currency: quote.currency,
    linkedProjectId: quote.linkedProjectId,
    linkedProjectName: quote.linkedProjectName,
    memo: quote.memoKo || quote.memo,
    partnerId: quote.partnerId,
    partnerName: quote.partnerName,
    createdBy: decidedBy,
  });

  await updateDoc(doc(db, "supplierQuotes", quote.id), {
    status: "approved" as SupplierQuoteStatus,
    decidedAt: serverTimestamp(),
    decidedBy,
    linkedSupplierOrderId: orderRef.id,
  });

  try {
    await createNotification({
      userId: quote.partnerId,
      type: "supplier_quote_approved",
      supplierQuoteId: quote.id,
      message: `제출하신 견적서(${quote.quoteNumber})가 승인되어 발주서로 전환되었습니다.`,
    });
  } catch (e) {
    console.error("견적서 승인 알림 발송 실패:", e);
  }

  return orderRef;
}

// 관리자가 그냥 반려하는 대신, 구체적으로 뭘 고쳐야 하는지 적어서 협력사에게 돌려준다.
// 협력사는 이 메모를 보고 "수정" 버튼으로 내용을 고쳐 다시 제출할 수 있다(updateSupplierQuote
// 가 저장 시 자동으로 "검토 대기"로 되돌린다). 중국 협력사는 한국어 원문 대신
// revisionNoteZh(저장 시점에 미리 번역)를 본다.
export async function requestSupplierQuoteRevision(quote: SupplierQuote, decidedBy: string, note: string) {
  const [noteZh] = await translateForCache([note]);
  await updateDoc(doc(db, "supplierQuotes", quote.id), {
    status: "revision_requested" as SupplierQuoteStatus,
    decidedAt: serverTimestamp(),
    decidedBy,
    revisionNote: note,
    revisionNoteZh: noteZh ?? null,
  });

  try {
    await createNotification({
      userId: quote.partnerId,
      type: "supplier_quote_revision_requested",
      supplierQuoteId: quote.id,
      message: `제출하신 견적서(${quote.quoteNumber})에 수정 요청이 왔습니다: ${note}`,
    });
  } catch (e) {
    console.error("견적서 수정 요청 알림 발송 실패:", e);
  }
}

export async function rejectSupplierQuote(quote: SupplierQuote, decidedBy: string, reason?: string) {
  await updateDoc(doc(db, "supplierQuotes", quote.id), {
    status: "rejected" as SupplierQuoteStatus,
    decidedAt: serverTimestamp(),
    decidedBy,
    rejectReason: reason ?? "",
  });

  try {
    await createNotification({
      userId: quote.partnerId,
      type: "supplier_quote_rejected",
      supplierQuoteId: quote.id,
      message: reason
        ? `제출하신 견적서(${quote.quoteNumber})가 반려되었습니다: ${reason}`
        : `제출하신 견적서(${quote.quoteNumber})가 반려되었습니다.`,
    });
  } catch (e) {
    console.error("견적서 반려 알림 발송 실패:", e);
  }
}
