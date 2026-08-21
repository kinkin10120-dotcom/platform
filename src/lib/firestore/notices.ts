import { addDoc, arrayUnion, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Notice } from "@/lib/types";
import { getAllUsers } from "@/lib/firestore/users";
import { createNotification } from "@/lib/firestore/notifications";

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
        readBy: data.readBy ?? [],
      } as Notice;
    }));
  });
}

export async function createNotice(title: string, content: string, createdBy: string, createdByName: string) {
  const ref = await addDoc(colRef, { title, content, createdBy, createdByName, readBy: [], createdAt: serverTimestamp() });

  // 전체 유저에게 알림 발송 (작성자 본인 제외)
  const users = await getAllUsers();
  await Promise.all(
    users
      .filter((u) => u.uid !== createdBy)
      .map((u) =>
        createNotification({
          userId: u.uid,
          noticeId: ref.id,
          type: "notice",
          message: `새 공지사항: ${title}`,
        })
      )
  );

  return ref;
}

export async function markNoticeRead(noticeId: string, uid: string) {
  return updateDoc(doc(db, "notices", noticeId), { readBy: arrayUnion(uid) });
}

export async function deleteNotice(id: string) {
  return deleteDoc(doc(db, "notices", id));
}
