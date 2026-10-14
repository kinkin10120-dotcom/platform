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
  profileLoadError: boolean;
  retryProfile: () => void;
  signOut: () => Promise<void>;
  updateUserName: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  appUser: null,
  loading: true,
  authStuck: false,
  profileLoadError: false,
  retryProfile: () => {},
  signOut: async () => {},
  updateUserName: async () => {},
});

// users/{uid} 조회(getDoc)는 로그인 직후 딱 한 번만 호출되는데, 특히 중국 우회 세션은
// 막 로그인한 시점(프록시가 아직 "웜업" 안 됐을 수 있는 첫 요청)이라 일시적으로 실패하기
// 쉽다 — 그 한 번이 실패하면 지금까지는 "계정 권한 정보가 아직 설정되지 않았습니다"라는,
// 마치 관리자가 계정을 안 만들어준 것 같은 오해를 주는 영구 메시지로 고정돼버렸다(재시도
// 방법 자체가 없었음). 문서가 "진짜 없는" 경우와 "조회 자체가 실패한" 경우를 구분해서,
// 후자는 재시도하게 한다.
async function fetchUserProfile(uid: string, attempt = 1): Promise<{ data: AppUser | null; failed: boolean }> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return { data: snap.exists() ? ({ uid, ...(snap.data() as Omit<AppUser, "uid">) }) : null, failed: false };
  } catch (e) {
    // 느린 연결에서 재시도를 여러 번 쌓으면(대기 시간 누적) 오히려 더 오래 멈춰 보인다 —
    // 딱 한 번만, 지연 없이 바로 재시도한다.
    if (attempt < 2) {
      return fetchUserProfile(uid, attempt + 1);
    }
    console.error("사용자 프로필 조회 실패", e);
    return { data: null, failed: true };
  }
}

// 로그인 페이지에서 "우회 접속"을 켠 적이 있어도, iOS에서 홈 화면에 추가해 연 앱은
// Safari 탭과 저장공간(localStorage)이 분리된 별도 컨테이너라 그 설정이 안 넘어온다 —
// 그 상태로 세션 복원(onAuthStateChanged)이 막힌 네트워크에 직접 접속을 시도하면 로고
// 화면에서 영원히 멈춘다(에러조차 안 뜸). 여기서도 로그인 페이지와 같은 보호장치를
// 둔다: 일정 시간 응답이 없으면 우회를 자동으로 한 번 켜고 새로고침한다(두 번째도
// 막히면 무한 새로고침 대신 화면에 안내를 띄운다 — 아래 authStuck).
// 타임아웃을 너무 짧게 잡으면(예전 12초) 중국 우회 경로처럼 원래 느리지만 결국 성공하는
// 연결을 중간에 끊고 처음부터 다시 시작시켜서, 오히려 "거의 다 됐는데 매번 리셋되는"
// 체감 지연을 키웠다 — 실제로 서버 로그에서 로그인 자체는 성공하고 있는데 그 직후
// 다시 로그인 화면으로 돌아가는 패턴이 확인됐다. 충분히 넉넉하게 기다려준다.
const AUTO_RETRY_KEY = "fbProxyCNAutoRetried";
const STUCK_TIMEOUT_MS = 30000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authStuck, setAuthStuck] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState(false);

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
      if (typeof window !== "undefined" && localStorage.getItem("fbProxyCN") === "1" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/debug-auth-restore", JSON.stringify({ stage: "resolved", userFound: !!user }));
      }
      setFirebaseUser(user);
      if (user) {
        const { data, failed } = await fetchUserProfile(user.uid);
        setAppUser(data);
        setProfileLoadError(failed);
      } else {
        setAppUser(null);
        setProfileLoadError(false);
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
      profileLoadError,
      retryProfile: () => {
        if (!firebaseUser) return;
        setProfileLoadError(false);
        fetchUserProfile(firebaseUser.uid).then(({ data, failed }) => {
          setAppUser(data);
          setProfileLoadError(failed);
        });
      },
      signOut: async () => {
        await fbSignOut(auth);
      },
      updateUserName: async (name: string) => {
        if (!firebaseUser) return;
        await updateDoc(doc(db, "users", firebaseUser.uid), { name });
        setAppUser((prev) => (prev ? { ...prev, name } : prev));
      },
    }),
    [firebaseUser, appUser, loading, authStuck, profileLoadError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
