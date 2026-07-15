import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppUser } from "@/lib/types";

const colRef = collection(db, "users");

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
