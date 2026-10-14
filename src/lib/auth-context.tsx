"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { onAuthStateChanged, signOut as fbSignOut, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { AppUser } from "@/lib/types";

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  appUser: AppUser | null;
  loading: boolean;
  authStuck: boolean;
  signOut: () => Promise<void>;
  updateUserName: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  appUser: null,
  loading: true,
  authStuck: false,
  signOut: async () => {},
  updateUserName: async () => {},
});

// 로그인 페이지에서 "우회 접속"을 켠 적이 있어도, iOS에서 홈 화면에 추가해 연 앱은
// Safari 탭과 저장공간(localStorage)이 분리된 별도 컨테이너라 그 설정이 안 넘어온다 —
// 그 상태로 세션 복원(onAuthStateChanged)이 막힌 네트워크에 직접 접속을 시도하면 로고
// 화면에서 영원히 멈춘다(에러조차 안 뜸). 여기서도 로그인 페이지와 같은 보호장치를
// 둔다: 일정 시간 응답이 없으면 우회를 자동으로 한 번 켜고 새로고침한다(두 번째도
// 막히면 무한 새로고침 대신 화면에 안내를 띄운다 — 아래 authStuck).
const AUTO_RETRY_KEY = "fbProxyCNAutoRetried";
const STUCK_TIMEOUT_MS = 12000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authStuck, setAuthStuck] = useState(false);

  useEffect(() => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      const alreadyProxied = localStorage.getItem("fbProxyCN") === "1";
      const alreadyAutoRetried = sessionStorage.getItem(AUTO_RETRY_KEY) === "1";
      if (!alreadyProxied && !alreadyAutoRetried) {
        sessionStorage.setItem(AUTO_RETRY_KEY, "1");
        localStorage.setItem("fbProxyCN", "1");
        window.location.reload();
      } else {
        // 이미 우회를 켰거나 한 번 자동 재시도했는데도 멈춰 있다 — 더 손대지 않고
        // 화면에 안내만 띄운다(무한 새로고침 방지).
        setAuthStuck(true);
      }
    }, STUCK_TIMEOUT_MS);

    const unsub = onAuthStateChanged(auth, async (user) => {
      settled = true;
      clearTimeout(timeoutId);
      setFirebaseUser(user);
      if (user) {
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          if (snap.exists()) {
            setAppUser({ uid: user.uid, ...(snap.data() as Omit<AppUser, "uid">) });
          } else {
            // users/{uid} 문서가 아직 없는 상태 (관리자가 계정 생성을 마무리하지 않은 경우)
            setAppUser(null);
          }
        } catch (e) {
          console.error("사용자 프로필 조회 실패", e);
          setAppUser(null);
        }
      } else {
        setAppUser(null);
      }
      setLoading(false);
    });
    return () => {
      clearTimeout(timeoutId);
      unsub();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      appUser,
      loading,
      authStuck,
      signOut: async () => {
        await fbSignOut(auth);
      },
      updateUserName: async (name: string) => {
        if (!firebaseUser) return;
        await updateDoc(doc(db, "users", firebaseUser.uid), { name });
        setAppUser((prev) => (prev ? { ...prev, name } : prev));
      },
    }),
    [firebaseUser, appUser, loading, authStuck]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
