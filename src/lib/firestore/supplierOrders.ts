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
import { SupplierCostItem, SupplierCurrency, SupplierOrder, SupplierOrderItem, SupplierOrderStatus } from "@/lib/types";

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
    installmentType: data.installmentType === "deposit" || data.installmentType === "balance" ? data.installmentType : undefined,
    linkedPurchaseOrderId: data.linkedPurchaseOrderId || undefined,
    linkedPurchaseOrderNo: data.linkedPurchaseOrderNo || undefined,
    partnerId: data.partnerId || undefined,
    partnerName: data.partnerName || undefined,
    // 예전에 쓰던 상태값(공장 확인·종료)이 남아 있는 문서는 "발행됨"으로 본다 — 어차피
    // 발주서를 이미 내보낸 건들이다.
    status: data.status === "draft" || !data.status ? "draft" : "issued",
    issuedAt: data.issuedAt?.toMillis ? data.issuedAt.toMillis() : data.issuedAt,
    createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
    updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now(),
    createdBy: data.createdBy ?? "",
  };
}

// 한 품목의 합계 = 단가 × 수량 + 이번 로트에 담은 부대비용. 부대비용은 이미 "이 발주에 들어갈
// 금액"으로 확정된 값이라 수량을 곱하지 않는다(조립비를 로트 단위로 받는 실제 거래 방식과 같다).
export function calcSupplierItemTotal(item: SupplierOrderItem): number {
  const base = item.unitPrice * item.quantity;
  const costs = calcCostsTotal(item.costs);
  return base + costs;
}

// 부대비용 합계 — 부품과 같이 "단가 × 개수"로 더한다. 개수를 안 넣은 항목(과거 데이터 포함)은
// 1개로 본다. 완제품 수량을 곱하지는 않는다 — 조립비를 로트 단위로 받는 경우가 있어서,
// 몇 개분인지는 이 개수 칸으로 직접 적는 쪽이 실제 거래 방식과 맞는다.
export function calcCostsTotal(costs?: SupplierCostItem[]): number {
  return (costs ?? []).reduce((sum, c) => sum + (c.amount || 0) * (c.quantity ?? 1), 0);
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

export function listenSupplierOrder(id: string, cb: (order: SupplierOrder | null) => void) {
  return onSnapshot(doc(db, "supplierOrders", id), (snap) => cb(snap.exists() ? fromDoc(snap) : null));
}

// 협력사 계정 전용 — 자기 앞으로 연동된 발주서만 조회한다(firestore.rules 참고).
// onError를 안 넘기면 permission-denied 같은 실패가 조용히 삼켜져 화면이 "불러오는 중..."에
// 무한정 멈춘다(listenTasksByProject와 같은 이유로 반드시 받는다).
export function listenSupplierOrdersByPartner(
  partnerId: string,
  cb: (orders: SupplierOrder[]) => void,
  onError?: (e: Error) => void
) {
  const q = query(colRef, where("partnerId", "==", partnerId));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map(fromDoc).sort((a, b) => b.createdAt - a.createdAt));
    },
    (e) => {
      console.error("[listenSupplierOrdersByPartner] 발주 목록 조회 실패", e);
      onError?.(e);
    }
  );
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
  installmentType?: "deposit" | "balance";
  linkedPurchaseOrderId?: string;
  linkedPurchaseOrderNo?: string;
  partnerId?: string;
  partnerName?: string;
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
    installmentType: input.installmentType ?? null,
    linkedPurchaseOrderId: input.linkedPurchaseOrderId ?? "",
    linkedPurchaseOrderNo: input.linkedPurchaseOrderNo ?? "",
    partnerId: input.partnerId ?? "",
    partnerName: input.partnerName ?? "",
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
    | "installmentType"
    | "linkedPurchaseOrderId"
    | "linkedPurchaseOrderNo"
    | "partnerId"
    | "partnerName"
  >
>;

export async function updateSupplierOrder(id: string, patch: SupplierOrderPatch) {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  // Firestore는 undefined를 값으로 받지 않고 예외를 던진다 — "비웠다"는 뜻이면 null로 보낸다
  // (읽어올 때 fromDoc이 null을 다시 undefined로 되돌린다).
  for (const [key, value] of Object.entries(patch)) {
    payload[key] = value === undefined ? null : value;
  }
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

export async function deleteSupplierOrder(id: string) {
  return deleteDoc(doc(db, "supplierOrders", id));
}
