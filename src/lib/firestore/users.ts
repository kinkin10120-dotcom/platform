import { collection, doc, getDocs, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppUser, NotificationType } from "@/lib/types";

const colRef = collection(db, "users");

export async function updateNotificationPrefs(uid: string, prefs: Partial<Record<NotificationType, boolean>>) {
  return updateDoc(doc(db, "users", uid), { notificationPrefs: prefs });
}

export async function updateUserName(uid: string, name: string) {
  return updateDoc(doc(db, "users", uid), { name });
}

export async function getAllUsers(): Promise<AppUser[]> {
  const snap = await getDocs(colRef);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: d.id,
      email: data.email,
      name: data.name,
      role: data.role,
      clientId: data.clientId,
      createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
    } as AppUser;
  });
}

export async function getUsersByClient(clientId: string): Promise<AppUser[]> {
  const snap = await getDocs(query(colRef, where("clientId", "==", clientId)));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: d.id,
      email: data.email,
      name: data.name,
      role: data.role,
      clientId: data.clientId,
      createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
    } as AppUser;
  });
}

export async function getAdmins(): Promise<AppUser[]> {
  const snap = await getDocs(query(colRef, where("role", "==", "admin")));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: d.id,
      email: data.email,
      name: data.name,
      role: data.role,
      createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
    } as AppUser;
  });
}

export function listenAdmins(cb: (users: AppUser[]) => void) {
  const q = query(colRef, where("role", "==", "admin"));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          email: data.email,
          name: data.name,
          role: data.role,
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
        } as AppUser;
      })
    );
  });
}

// 협력사(파트너) 계정 목록 — 관리자 전용 화면(/partners)에서만 호출한다.
export function listenPartners(cb: (users: AppUser[]) => void) {
  const q = query(colRef, where("role", "==", "partner"));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          email: data.email,
          name: data.name,
          role: data.role,
          projectIds: data.projectIds ?? [],
          partnerLang: data.partnerLang ?? "ko",
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
        } as AppUser;
      })
    );
  });
}

export function listenUsersByClient(clientId: string, cb: (users: AppUser[]) => void) {
  const q = query(colRef, where("clientId", "==", clientId));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          email: data.email,
          name: data.name,
          role: data.role,
          clientId: data.clientId,
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
        } as AppUser;
      })
    );
  });
}
