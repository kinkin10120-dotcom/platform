import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Notice } from "@/lib/types";

const colRef = collection(db, "notices");

export function listenNotices(cb: (notices: Notice[]) => void) {
  const q = query(colRef, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title,
        content: data.content,
        createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
        createdBy: data.createdBy,
        createdByName: data.createdByName,
      } as Notice;
    }));
  });
}

export async function createNotice(title: string, content: string, createdBy: string, createdByName: string) {
  return addDoc(colRef, { title, content, createdBy, createdByName, createdAt: serverTimestamp() });
}

export async function deleteNotice(id: string) {
  return deleteDoc(doc(db, "notices", id));
}
