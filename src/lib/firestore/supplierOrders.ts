import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { SupplierCurrency, SupplierOrder, SupplierOrderItem, SupplierOrderStatus } from "@/lib/types";

// 매입(핸디핸드 → 공장) 전용 컬렉션. 매출 쪽 purchaseOrders와 절대 섞지 않는다 — 방향이
// 반대라 금액의 의미가 정반대이고, 무엇보다 이 문서에는 clientId가 없어서 firestore.rules에서
// 고객에게 열어줄 근거 자체가 생기지 않는다(원가 노출 경로를 구조적으로 없앤 것).
const colRef = collection(db, "supplierOrders");

function fromDoc(d: any): SupplierOrder {
  const data = d.data();
  return {
    id: d.id,
    soNumber: data.soNumber,
    supplierName: data.supplierName ?? "",
    items: data.items ?? [],
    currency: data.currency ?? "USD",
    totalAmount: data.totalAmount ?? 0,
    exchangeRate: typeof data.exchangeRate === "number" ? data.exchangeRate : undefined,
    incoterms: data.incoterms || undefined,
    portOfLoading: data.portOfLoading || undefined,
    paymentTerms: data.paymentTerms || undefined,
    leadTimeDays: typeof data.leadTimeDays === "number" ? data.leadTimeDays : undefined,
    packingNote: data.packingNote || undefined,
    memo: data.memo || undefined,
    linkedProjectId: data.linkedProjectId || undefined,
    linkedProjectName: data.linkedProjectName || undefined,
    lotNo: data.lotNo || undefined,
    linkedPurchaseOrderId: data.linkedPurchaseOrderId || undefined,
    linkedPurchaseOrderNo: data.linkedPurchaseOrderNo || undefined,
    status: data.status ?? "draft",
    issuedAt: data.issuedAt?.toMillis ? data.issuedAt.toMillis() : data.issuedAt,
    confirmationFileUrl: data.confirmationFileUrl || undefined,
    confirmationFileName: data.confirmationFileName || undefined,
    confirmedAt: data.confirmedAt?.toMillis ? data.confirmedAt.toMillis() : data.confirmedAt,
    createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
    updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now(),
    createdBy: data.createdBy ?? "",
  };
}

// 한 품목의 합계 = 단가 × 수량 + 이번 로트에 담은 부대비용. 부대비용은 이미 "이 발주에 들어갈
// 금액"으로 확정된 값이라 수량을 곱하지 않는다(조립비를 로트 단위로 받는 실제 거래 방식과 같다).
export function calcSupplierItemTotal(item: SupplierOrderItem): number {
  const base = item.unitPrice * item.quantity;
  const costs = (item.costs ?? []).reduce((sum, c) => sum + (c.amount || 0), 0);
  return base + costs;
}

export function calcSupplierOrderTotal(items: SupplierOrderItem[]): number {
  return items.reduce((sum, it) => sum + calcSupplierItemTotal(it), 0);
}

export function formatSupplierMoney(amount: number, currency: SupplierCurrency): string {
  if (currency === "USD") return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (currency === "CNY") return `¥${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${Math.round(amount).toLocaleString("ko-KR")}원`;
}

export function listenSupplierOrders(cb: (orders: SupplierOrder[]) => void) {
  return onSnapshot(colRef, (snap) => {
    cb(snap.docs.map(fromDoc).sort((a, b) => b.createdAt - a.createdAt));
  });
}

export interface CreateSupplierOrderInput {
  supplierName: string;
  items: SupplierOrderItem[];
  currency: SupplierCurrency;
  exchangeRate?: number;
  incoterms?: string;
  portOfLoading?: string;
  paymentTerms?: string;
  leadTimeDays?: number;
  packingNote?: string;
  memo?: string;
  linkedProjectId?: string;
  linkedProjectName?: string;
  lotNo?: string;
  linkedPurchaseOrderId?: string;
  linkedPurchaseOrderNo?: string;
  createdBy: string;
}

export async function createSupplierOrder(input: CreateSupplierOrderInput) {
  // purchaseOrders와 같은 방식 — 문서 ID를 먼저 만들어 발주번호에 쓰고 쓰기 한 번으로 끝낸다.
  // 접두사는 SO(supplier order)로, 매출 쪽 PO/INV/RCP와 한눈에 구분되게 한다.
  const ref = doc(colRef);
  const d = new Date();
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const soNumber = `SO-${dateStr}-${ref.id.slice(0, 4).toUpperCase()}`;

  await setDoc(ref, {
    soNumber,
    supplierName: input.supplierName,
    items: input.items,
    currency: input.currency,
    totalAmount: calcSupplierOrderTotal(input.items),
    exchangeRate: input.exchangeRate ?? null,
    incoterms: input.incoterms ?? "",
    portOfLoading: input.portOfLoading ?? "",
    paymentTerms: input.paymentTerms ?? "",
    leadTimeDays: input.leadTimeDays ?? null,
    packingNote: input.packingNote ?? "",
    memo: input.memo ?? "",
    linkedProjectId: input.linkedProjectId ?? "",
    linkedProjectName: input.linkedProjectName ?? "",
    lotNo: input.lotNo ?? "",
    linkedPurchaseOrderId: input.linkedPurchaseOrderId ?? "",
    linkedPurchaseOrderNo: input.linkedPurchaseOrderNo ?? "",
    status: "draft" as SupplierOrderStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: input.createdBy,
  });
  return ref;
}

export type SupplierOrderPatch = Partial<
  Pick<
    SupplierOrder,
    | "supplierName"
    | "items"
    | "currency"
    | "exchangeRate"
    | "incoterms"
    | "portOfLoading"
    | "paymentTerms"
    | "leadTimeDays"
    | "packingNote"
    | "memo"
    | "linkedProjectId"
    | "linkedProjectName"
    | "lotNo"
    | "linkedPurchaseOrderId"
    | "linkedPurchaseOrderNo"
  >
>;

export async function updateSupplierOrder(id: string, patch: SupplierOrderPatch) {
  const payload: Record<string, unknown> = { ...patch, updatedAt: serverTimestamp() };
  // 합계는 항목이 바뀔 때마다 다시 계산해서 저장해둔다 — 목록에서 문서마다 항목을 훑지 않고
  // 바로 원가를 더할 수 있어야 한다.
  if (patch.items) payload.totalAmount = calcSupplierOrderTotal(patch.items);
  return updateDoc(doc(db, "supplierOrders", id), payload);
}

export async function setSupplierOrderStatus(id: string, status: SupplierOrderStatus) {
  return updateDoc(doc(db, "supplierOrders", id), {
    status,
    // 발행 시각은 처음 발행할 때만 남기면 되지만, 되돌렸다 다시 발행하는 경우도 있어 매번 갱신한다.
    ...(status === "issued" ? { issuedAt: serverTimestamp() } : {}),
    updatedAt: serverTimestamp(),
  });
}

// 공장이 도장(公章)을 찍어 회신한 스캔본. 이게 올라오면 상태를 "공장 확인"으로 올린다 —
// 전자서명 루프를 만들지 않고 실제 거래 방식(위챗·메일로 주고받고 스캔본 회신)을 그대로 기록한다.
export async function uploadSupplierOrderConfirmation(orderId: string, file: File) {
  const fileRef = storageRef(storage, `supplierOrders/${orderId}/confirmation-${Date.now()}-${file.name}`);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  await updateDoc(doc(db, "supplierOrders", orderId), {
    confirmationFileUrl: url,
    confirmationFileName: file.name,
    confirmedAt: serverTimestamp(),
    status: "confirmed" as SupplierOrderStatus,
    updatedAt: serverTimestamp(),
  });
  return url;
}

export async function deleteSupplierOrder(id: string) {
  return deleteDoc(doc(db, "supplierOrders", id));
}
