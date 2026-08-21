import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ContractTemplate } from "@/lib/types";

const colRef = collection(db, "contractTemplates");

function fromDoc(d: any): ContractTemplate {
  const data = d.data();
  return {
    id: d.id,
    name: data.name,
    bodyHtml: data.bodyHtml ?? "",
    createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
    updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now(),
    createdBy: data.createdBy,
  };
}

export function listenContractTemplates(cb: (templates: ContractTemplate[]) => void) {
  const q = query(colRef, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map(fromDoc)));
}

export async function createContractTemplate(input: { name: string; bodyHtml: string; createdBy: string }) {
  const ref = doc(colRef);
  await setDoc(ref, {
    name: input.name,
    bodyHtml: input.bodyHtml,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: input.createdBy,
  });
  return ref;
}

export async function updateContractTemplate(id: string, patch: { name?: string; bodyHtml?: string }) {
  return updateDoc(doc(db, "contractTemplates", id), { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteContractTemplate(id: string) {
  return deleteDoc(doc(db, "contractTemplates", id));
}
