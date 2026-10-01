import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ClientProductInternal, PurchaseType, ShippingTerm, SupplierCostItem, SupplierCurrency, SupplierOrderKind, SupplierPartItem } from "@/lib/types";

const colRef = collection(db, "clientProductInternal");

function fromDoc(d: any): ClientProductInternal {
  const data = d.data();
  return {
    id: d.id,
    clientId: data.clientId,
    purchaseType: data.purchaseType,
    shippingTerm: data.shippingTerm,
    customsNote: data.customsNote,
    supplierName: data.supplierName || undefined,
    purchasePrice: typeof data.purchasePrice === "number" && !Number.isNaN(data.purchasePrice) ? data.purchasePrice : undefined,
    purchaseCurrency: data.purchaseCurrency || undefined,
    nameEn: data.nameEn || undefined,
    costItems: Array.isArray(data.costItems) ? data.costItems : undefined,
    parts: Array.isArray(data.parts) ? data.parts : undefined,
    orderKind: data.orderKind || undefined,
    refParts: Array.isArray(data.refParts) ? data.refParts : undefined,
    refCurrency: data.refCurrency || undefined,
    updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now(),
  };
}

// productId를 key로 하는 맵으로 돌려준다 — 카탈로그 화면에서 제품 목록과 1:1로 붙여 쓰기 위함.
export function listenClientProductInternals(clientId: string, cb: (map: Record<string, ClientProductInternal>) => void) {
  const q = query(colRef, where("clientId", "==", clientId));
  return onSnapshot(q, (snap) => {
    const map: Record<string, ClientProductInternal> = {};
    snap.docs.forEach((d) => { map[d.id] = fromDoc(d); });
    cb(map);
  });
}

// 구매 카탈로그(업체별 매입 단가 목록)용 — 클라이언트를 가리지 않고 전부 읽는다. 이 컬렉션의
// list 규칙은 isAdmin() 하나뿐이라 쿼리에 제약이 없어도 통과한다(제약을 요구하는 규칙이면
// where 절 없는 쿼리는 통째로 거부된다 — tasks에서 실제로 겪었던 함정이다).
export function listenAllClientProductInternals(cb: (map: Record<string, ClientProductInternal>) => void) {
  return onSnapshot(colRef, (snap) => {
    const map: Record<string, ClientProductInternal> = {};
    snap.docs.forEach((d) => { map[d.id] = fromDoc(d); });
    cb(map);
  });
}

// 통관 정보 화면과 매입 정보 화면이 같은 문서의 서로 다른 필드를 따로 저장하므로, 넘어온 키만
// 골라 merge로 쓴다 — 예전처럼 문서를 통째로 덮어쓰면 통관 메모만 고쳐도 매입 단가·부대비용이
// 조용히 지워진다.
export async function setClientProductInternal(
  productId: string,
  clientId: string,
  input: {
    purchaseType?: PurchaseType;
    shippingTerm?: ShippingTerm;
    customsNote?: string;
    supplierName?: string;
    purchasePrice?: number | null;
    purchaseCurrency?: SupplierCurrency;
    nameEn?: string;
    costItems?: SupplierCostItem[];
    parts?: SupplierPartItem[];
    orderKind?: SupplierOrderKind;
    refParts?: SupplierPartItem[];
    refCurrency?: SupplierCurrency;
  }
) {
  const payload: Record<string, unknown> = { clientId, updatedAt: serverTimestamp() };
  if ("purchaseType" in input) payload.purchaseType = input.purchaseType ?? null;
  if ("shippingTerm" in input) payload.shippingTerm = input.shippingTerm ?? null;
  if ("customsNote" in input) payload.customsNote = input.customsNote ?? "";
  if ("supplierName" in input) payload.supplierName = input.supplierName ?? "";
  if ("purchasePrice" in input) payload.purchasePrice = typeof input.purchasePrice === "number" ? input.purchasePrice : null;
  if ("purchaseCurrency" in input) payload.purchaseCurrency = input.purchaseCurrency ?? null;
  if ("nameEn" in input) payload.nameEn = input.nameEn ?? "";
  if ("costItems" in input) payload.costItems = input.costItems ?? [];
  if ("parts" in input) payload.parts = input.parts ?? [];
  if ("orderKind" in input) payload.orderKind = input.orderKind ?? null;
  if ("refParts" in input) payload.refParts = input.refParts ?? [];
  if ("refCurrency" in input) payload.refCurrency = input.refCurrency ?? null;
  return setDoc(doc(db, "clientProductInternal", productId), payload, { merge: true });
}

export async function deleteClientProductInternal(productId: string) {
  return deleteDoc(doc(db, "clientProductInternal", productId));
}
