import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppNotification, NotificationType } from "@/lib/types";

const colRef = collection(db, "notifications");

export function listenNotifications(userId: string, cb: (items: AppNotification[]) => void) {
  const q = query(colRef, where("userId", "==", userId));
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: data.userId,
          projectId: data.projectId,
          taskId: data.taskId,
          type: data.type,
          message: data.message,
          read: !!data.read,
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
        } as AppNotification;
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 30);
    cb(items);
  });
}

export async function createNotification(input: {
  userId: string;
  projectId: string;
  taskId?: string;
  type: NotificationType;
  message: string;
}) {
  if (!input.userId) return;
  return addDoc(colRef, { ...input, read: false, createdAt: serverTimestamp() });
}

export async function markNotificationRead(id: string) {
  return updateDoc(doc(db, "notifications", id), { read: true });
}
