import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
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

export async function updateClient(id: string, patch: Partial<Pick<Client, "name" | "memo" | "logoUrl" | "sortOrder" | "bizCompanyName" | "bizRegNumber" | "bizCeoName" | "bizPhone" | "bizAddress">>) {
  return updateDoc(doc(db, "clients", id), patch);
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
