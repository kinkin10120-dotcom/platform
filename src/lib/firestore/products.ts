import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { ClientProduct } from "@/lib/types";
import { compressImage } from "@/lib/imageCompress";

const colRef = collection(db, "clientProducts");

function fromDoc(d: any): ClientProduct {
  const data = d.data();
  return {
    id: d.id,
    clientId: data.clientId,
    name: data.name,
    imageUrl: data.imageUrl,
    unitPrice: data.unitPrice,
    currency: data.currency ?? "KRW",
    vatApplicable: data.vatApplicable,
    unit: data.unit,
    active: data.active !== false,
    createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
  };
}

export function listenClientProducts(clientId: string, cb: (products: ClientProduct[]) => void) {
  const q = query(colRef, where("clientId", "==", clientId));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(fromDoc).sort((a, b) => a.name.localeCompare(b.name, "ko"));
    cb(items);
  });
}

// 구매 카탈로그용 — 모든 클라이언트의 제품을 한 번에 읽는다. clientProducts의 list 규칙은
// "isAdmin() || belongsToClient(...)"라 관리자면 앞쪽에서 정적으로 참이 되어, 제약 없는 쿼리도
// 통과한다(관리자가 아닌 계정은 이 함수를 쓰면 안 된다 — 뒤쪽 분기는 where 제약을 요구한다).
export function listenAllClientProducts(cb: (products: ClientProduct[]) => void) {
  return onSnapshot(colRef, (snap) => {
    cb(snap.docs.map(fromDoc).sort((a, b) => a.name.localeCompare(b.name, "ko")));
  });
}

export async function createClientProduct(input: {
  clientId: string;
  name: string;
  unitPrice: number;
  currency: "KRW" | "USD";
  vatApplicable?: boolean;
  unit?: string;
}) {
  return addDoc(colRef, {
    clientId: input.clientId,
    name: input.name,
    unitPrice: input.unitPrice,
    currency: input.currency,
    vatApplicable: input.vatApplicable ?? false,
    unit: input.unit ?? "",
    active: true,
    createdAt: serverTimestamp(),
  });
}

export async function updateClientProduct(
  id: string,
  input: Partial<Pick<ClientProduct, "name" | "unitPrice" | "currency" | "vatApplicable" | "unit" | "active" | "imageUrl">>
) {
  return updateDoc(doc(db, "clientProducts", id), input);
}

export async function uploadClientProductImage(productId: string, file: File): Promise<string> {
  const compressed = await compressImage(file);
  const storageRef = ref(storage, `clientProducts/${productId}/image`);
  await uploadBytes(storageRef, compressed);
  const url = await getDownloadURL(storageRef);
  await updateClientProduct(productId, { imageUrl: url });
  return url;
}

export async function deleteClientProduct(id: string) {
  return deleteDoc(doc(db, "clientProducts", id));
}
