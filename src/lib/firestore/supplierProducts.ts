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
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { SupplierProduct } from "@/lib/types";
import { compressImage } from "@/lib/imageCompress";

// 매입 전용 품목(금형·부자재 등). 고객 제품 카탈로그(clientProducts)와 달리 clientId가 없고
// 관리자만 읽고 쓴다 — 고객에게 열어줄 근거 자체가 생기지 않게 하려는 것으로, supplierOrders와
// 같은 원칙이다.
const colRef = collection(db, "supplierProducts");

function fromDoc(d: any): SupplierProduct {
  const data = d.data();
  return {
    id: d.id,
    supplierName: data.supplierName ?? "",
    name: data.name ?? "",
    clientName: data.clientName || undefined,
    orderKind: data.orderKind || undefined,
    nameEn: data.nameEn || undefined,
    spec: data.spec || undefined,
    imageUrl: data.imageUrl || undefined,
    purchasePrice: typeof data.purchasePrice === "number" && !Number.isNaN(data.purchasePrice) ? data.purchasePrice : undefined,
    purchaseCurrency: data.purchaseCurrency || undefined,
    unit: data.unit || undefined,
    parts: Array.isArray(data.parts) ? data.parts : undefined,
    costItems: Array.isArray(data.costItems) ? data.costItems : undefined,
    partnerId: data.partnerId || undefined,
    partnerName: data.partnerName || undefined,
    createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
    updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now(),
  };
}

export function listenSupplierProducts(cb: (items: SupplierProduct[]) => void) {
  return onSnapshot(colRef, (snap) => {
    cb(snap.docs.map(fromDoc).sort((a, b) => a.name.localeCompare(b.name, "ko")));
  });
}

// 협력사 계정 전용 — 자기 앞으로 연동된(partnerId == 본인 uid) 품목만 "내 제품 단가"
// 화면에서 조회한다.
export function listenSupplierProductsByPartner(partnerId: string, cb: (items: SupplierProduct[]) => void, onError?: (e: Error) => void) {
  const q = query(colRef, where("partnerId", "==", partnerId));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map(fromDoc).sort((a, b) => a.name.localeCompare(b.name, "ko"))),
    (e) => {
      console.error("[listenSupplierProductsByPartner] 조회 실패", e);
      onError?.(e as Error);
    }
  );
}

export type SupplierProductInput = Omit<SupplierProduct, "id" | "createdAt" | "updatedAt" | "imageUrl">;

export async function createSupplierProduct(input: SupplierProductInput) {
  const ref = doc(colRef);
  await setDoc(ref, {
    supplierName: input.supplierName,
    name: input.name,
    clientName: input.clientName ?? "",
    orderKind: input.orderKind ?? "production",
    nameEn: input.nameEn ?? "",
    spec: input.spec ?? "",
    purchasePrice: input.purchasePrice ?? null,
    purchaseCurrency: input.purchaseCurrency ?? "USD",
    unit: input.unit ?? "",
    parts: input.parts ?? [],
    costItems: input.costItems ?? [],
    partnerId: input.partnerId ?? null,
    partnerName: input.partnerName ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref;
}

export async function updateSupplierProduct(id: string, input: Partial<SupplierProductInput>) {
  // Firestore는 undefined를 값으로 받지 않고 예외를 던진다 — 영문명·사양·단위·고객명 중
  // 하나라도 비운 채 저장하면 updateDoc이 통째로 실패했다(생성 쪽은 ?? ""로 막혀 있어서
  // 새로 만들 때만 멀쩡했다). "비웠다"는 뜻이면 null로 보낸다.
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  for (const [key, value] of Object.entries(input)) {
    payload[key] = value === undefined ? null : value;
  }
  return updateDoc(doc(db, "supplierProducts", id), payload);
}

export async function uploadSupplierProductImage(productId: string, file: File): Promise<string> {
  const compressed = await compressImage(file);
  // 이미지는 발주서 PDF에도 그대로 실려야 해서(인쇄 시점에는 인증 헤더를 못 붙인다) 다른 제품
  // 사진들과 같이 읽기가 열린 경로에 둔다. 사진에는 금액이 없으므로 원가 노출과는 무관하다.
  const ref = storageRef(storage, `supplierProducts/${productId}/image`);
  await uploadBytes(ref, compressed);
  const url = await getDownloadURL(ref);
  await updateDoc(doc(db, "supplierProducts", productId), { imageUrl: url, updatedAt: serverTimestamp() });
  return url;
}

export async function deleteSupplierProduct(id: string) {
  return deleteDoc(doc(db, "supplierProducts", id));
}
