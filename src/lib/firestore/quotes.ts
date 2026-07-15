import { collection, doc, onSnapshot, orderBy, query, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type QuoteStatus = "pending" | "reviewed" | "contacted";

export interface QuoteRequest {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  description: string;
  stage: string;
  status: QuoteStatus;
  createdAt: number;
  memo: string;
}

function fromDoc(d: any): QuoteRequest {
  const data = d.data();
  return {
    id: d.id,
    name: data.name ?? "",
    company: data.company ?? "",
    email: data.email ?? "",
    phone: data.phone ?? "",
    description: data.description ?? "",
    stage: data.stage ?? "",
    status: data.status ?? "pending",
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now(),
    memo: data.memo ?? "",
  };
}

export function listenQuoteRequests(cb: (quotes: QuoteRequest[]) => void) {
  const q = query(collection(db, "quoteRequests"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map(fromDoc)));
}

export async function updateQuote(id: string, patch: { status?: QuoteStatus; memo?: string }) {
  return updateDoc(doc(db, "quoteRequests", id), { ...patch, updatedAt: serverTimestamp() });
}
