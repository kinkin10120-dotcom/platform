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

// 관리자 전용 — 협력사가 견적서·청구서를 발행할 때 상단 HANDYHAND 로고 자리에 대신
// 띄울 텍스트. 비우면("") 다시 기본 로고로 돌아간다.
export async function updatePartnerBrandName(uid: string, brandName: string) {
  return updateDoc(doc(db, "users", uid), { brandName: brandName.trim() });
}

// 발행 주체(견적서·청구서) 화면에서, 보는 사람이 관리자든 그 협력사 본인이든 상관없이
// 그 문서를 "낸 협력사"의 프로필(특히 brandName)을 조회해야 해서 단건 조회가 필요하다.
export function listenUser(uid: string, cb: (user: AppUser | null) => void) {
  return onSnapshot(doc(db, "users", uid), (snap) => {
    if (!snap.exists()) { cb(null); return; }
    const data = snap.data();
    cb({
      uid: snap.id,
      email: data.email,
      name: data.name,
      role: data.role,
      clientId: data.clientId,
      projectIds: data.projectIds,
      partnerLang: data.partnerLang,
      brandName: data.brandName || undefined,
      createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
    } as AppUser);
  });
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

// 특정 프로젝트에 배정된 협력사 계정들 — 협력사 자료함에 관리자가 글을 남겼을 때 알림 대상을
// 찾는 데 쓴다. isAdmin() 호출 경로에서만 쓴다(firestore.rules의 users list 규칙은 role=='admin'
// 조회만 누구에게나 허용하고, role=='partner' 조회는 admin만 허용한다).
export async function getPartnersByProject(projectId: string): Promise<AppUser[]> {
  const snap = await getDocs(query(colRef, where("role", "==", "partner"), where("projectIds", "array-contains", projectId)));
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
          brandName: data.brandName || undefined,
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
