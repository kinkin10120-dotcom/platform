import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
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
          noticeId: data.noticeId,
          orderId: data.orderId,
          invoiceIndex: data.invoiceIndex,
          contractId: data.contractId,
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
  projectId?: string;
  taskId?: string;
  noticeId?: string;
  orderId?: string;
  invoiceIndex?: number;
  type: NotificationType;
  message: string;
}) {
  if (!input.userId) return;
  return addDoc(colRef, { ...input, read: false, createdAt: serverTimestamp() });
}

export async function markNotificationRead(id: string) {
  return updateDoc(doc(db, "notifications", id), { read: true });
}

export async function markAllNotificationsRead(unreadIds: string[]) {
  if (unreadIds.length === 0) return;
  const batch = writeBatch(db);
  unreadIds.forEach((id) => batch.update(doc(db, "notifications", id), { read: true }));
  await batch.commit();
}

export async function deleteNotification(id: string) {
  return deleteDoc(doc(db, "notifications", id));
}

export async function deleteAllNotifications(ids: string[]) {
  if (ids.length === 0) return;
  const batch = writeBatch(db);
  ids.forEach((id) => batch.delete(doc(db, "notifications", id)));
  await batch.commit();
}
