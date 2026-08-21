import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ClientProductInternal, PurchaseType, ShippingTerm } from "@/lib/types";

const colRef = collection(db, "clientProductInternal");

function fromDoc(d: any): ClientProductInternal {
  const data = d.data();
  return {
    id: d.id,
    clientId: data.clientId,
    purchaseType: data.purchaseType,
    shippingTerm: data.shippingTerm,
    customsNote: data.customsNote,
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

export async function setClientProductInternal(
  productId: string,
  clientId: string,
  input: { purchaseType?: PurchaseType; shippingTerm?: ShippingTerm; customsNote?: string }
) {
  return setDoc(doc(db, "clientProductInternal", productId), {
    clientId,
    purchaseType: input.purchaseType ?? null,
    shippingTerm: input.shippingTerm ?? null,
    customsNote: input.customsNote ?? "",
    updatedAt: serverTimestamp(),
  });
}

export async function deleteClientProductInternal(productId: string) {
  return deleteDoc(doc(db, "clientProductInternal", productId));
}
