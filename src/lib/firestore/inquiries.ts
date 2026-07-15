import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Inquiry } from "@/lib/types";

const colRef = collection(db, "inquiries");

function fromDoc(d: any): Inquiry {
  const data = d.data();
  return {
    id: d.id,
    userId: data.userId,
    userName: data.userName,
    clientId: data.clientId,
    title: data.title,
    content: data.content,
    status: data.status ?? "pending",
    answer: data.answer,
    answeredAt: data.answeredAt?.toMillis ? data.answeredAt.toMillis() : data.answeredAt,
    answeredBy: data.answeredBy,
    createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
  };
}

export async function createInquiry(input: {
  userId: string;
  userName: string;
  clientId?: string;
  title: string;
  content: string;
}) {
  return addDoc(colRef, {
    ...input,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export function listenAllInquiries(cb: (inquiries: Inquiry[]) => void) {
  const q = query(colRef, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map(fromDoc)));
}

export function listenMyInquiries(userId: string, cb: (inquiries: Inquiry[]) => void) {
  const q = query(colRef, where("userId", "==", userId), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map(fromDoc)));
}

export async function answerInquiry(id: string, answer: string, answeredBy: string) {
  return updateDoc(doc(db, "inquiries", id), {
    answer,
    answeredBy,
    status: "answered",
    answeredAt: serverTimestamp(),
  });
}
