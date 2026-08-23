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
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Inquiry } from "@/lib/types";
import { createNotification } from "@/lib/firestore/notifications";
import { getAdmins } from "@/lib/firestore/users";

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
    email: data.email,
    phone: data.phone,
    type: data.type,
  };
}

export async function createInquiry(input: {
  userId: string;
  userName: string;
  clientId?: string;
  title: string;
  content: string;
}) {
  const ref = await addDoc(colRef, {
    ...input,
    status: "pending",
    createdAt: serverTimestamp(),
  });

  try {
    const admins = await getAdmins();
    await Promise.all(
      admins.map((u) =>
        createNotification({
          userId: u.uid,
          type: "inquiry",
          message: `${input.userName}님이 문의를 남겼습니다: "${input.title}"`,
          details: [`문의 내용: ${input.content}`],
        })
      )
    );
  } catch (e) {
    console.error("문의 알림 발송 실패:", e);
  }

  return ref;
}

export async function createPublicInquiry(input: {
  name: string;
  email: string;
  phone?: string;
  type?: string;
  message: string;
}) {
  return addDoc(colRef, {
    userId: "website",
    userName: input.name,
    email: input.email,
    phone: input.phone || "",
    type: input.type || "",
    title: input.type ? `[${input.type}] ${input.name}` : `${input.name}님의 문의`,
    content: input.message,
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

export async function updateMyInquiry(id: string, title: string, content: string) {
  return updateDoc(doc(db, "inquiries", id), { title, content });
}

export async function answerInquiry(id: string, answer: string, answeredBy: string) {
  return updateDoc(doc(db, "inquiries", id), {
    answer,
    answeredBy,
    status: "answered",
    answeredAt: serverTimestamp(),
  });
}

export async function deleteInquiry(id: string) {
  return deleteDoc(doc(db, "inquiries", id));
}
