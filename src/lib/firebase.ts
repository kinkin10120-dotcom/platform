import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage, ref, getBlob } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Next.js의 핫 리로드 환경에서 앱이 중복 초기화되는 것을 방지
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// 로그인(관리자 등)이 있어야 열리는 스토리지 파일용 — <a href={url}> 방식은 브라우저가
// 인증 헤더를 붙이지 않아 보안 규칙이 401/403으로 막으므로, SDK의 인증된 요청으로 받아온
// blob을 새 탭에 띄운다. quoteRequests의 사업자등록증(bizRegCert)처럼 원래 공개 읽기였다가
// 로그인 필요로 좁힌 파일에 사용한다.
export async function openAuthenticatedStorageFile(url: string) {
  const blob = await getBlob(ref(storage, url));
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
}

export default app;
