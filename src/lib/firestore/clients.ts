import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Client } from "@/lib/types";
import { compressImage } from "@/lib/imageCompress";

const colRef = collection(db, "clients");

function docToClient(id: string, data: Record<string, any>): Client {
  return {
    id,
    name: data.name,
    memo: data.memo ?? "",
    logoUrl: data.logoUrl ?? undefined,
    sortOrder: data.sortOrder ?? undefined,
    bizCompanyName: data.bizCompanyName ?? "",
    bizRegNumber: data.bizRegNumber ?? "",
    bizCeoName: data.bizCeoName ?? "",
    bizPhone: data.bizPhone ?? "",
    bizAddress: data.bizAddress ?? "",
    createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
    createdBy: data.createdBy,
  };
}

export function listenClient(clientId: string, cb: (client: Client | null) => void) {
  return onSnapshot(doc(db, "clients", clientId), (snap) => {
    if (!snap.exists()) return cb(null);
    cb(docToClient(snap.id, snap.data()));
  });
}

export function listenClients(cb: (clients: Client[]) => void) {
  const q = query(colRef, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => docToClient(d.id, d.data())));
  });
}

export async function createClient(name: string, memo: string, createdBy: string) {
  return addDoc(colRef, {
    name,
    memo,
    createdAt: serverTimestamp(),
    createdBy,
  });
}

// 협력사 계정은 clients 컬렉션을 못 읽으므로, 프로젝트 헤더에 고객 로고를 보여주기 위해
// name/logoUrl을 그 고객의 모든 projects 문서에 그대로 복사해둔다(clientDisplayName/
// clientLogoUrl). 여기서만 동기화하면 createProject의 최초 복사본도 계속 최신으로 맞는다.
async function syncClientDisplayToProjects(clientId: string) {
  const clientSnap = await getDoc(doc(db, "clients", clientId));
  if (!clientSnap.exists()) return;
  const data = clientSnap.data();
  const projectsSnap = await getDocs(query(collection(db, "projects"), where("clientId", "==", clientId)));
  if (projectsSnap.empty) return;
  const batch = writeBatch(db);
  projectsSnap.docs.forEach((d) => {
    batch.update(d.ref, { clientDisplayName: data.name ?? "", clientLogoUrl: data.logoUrl ?? null });
  });
  await batch.commit();
}

export async function updateClient(id: string, patch: Partial<Pick<Client, "name" | "memo" | "logoUrl" | "sortOrder" | "bizCompanyName" | "bizRegNumber" | "bizCeoName" | "bizPhone" | "bizAddress">>) {
  await updateDoc(doc(db, "clients", id), patch);
  if (patch.name !== undefined || patch.logoUrl !== undefined) {
    await syncClientDisplayToProjects(id);
  }
}

export async function uploadClientLogo(clientId: string, file: File): Promise<string> {
  const compressed = await compressImage(file, 800);
  const storageRef = ref(storage, `clients/${clientId}/logo`);
  await uploadBytes(storageRef, compressed);
  const url = await getDownloadURL(storageRef);
  await updateClient(clientId, { logoUrl: url });
  return url;
}

export async function deleteClient(id: string) {
  return deleteDoc(doc(db, "clients", id));
}
