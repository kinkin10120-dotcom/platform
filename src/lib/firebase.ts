import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, initializeAuth, browserLocalPersistence, browserSessionPersistence, connectAuthEmulator } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";
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

// 중국 등 일부 해외 네트워크에서는 브라우저가 *.googleapis.com에 직접 접속을 못 해서
// 로그인·데이터 로딩이 전부 멈춘다. 로그인 화면에서 "우회 접속"을 직접 선택한 세션에만
// 이 플래그가 켜지고(src/app/login/page.tsx 참고), 그 세션에서만 우리 도메인을 경유하는
// 프록시(src/app/identitytoolkit.googleapis.com, securetoken.googleapis.com,
// api/fbproxy/firestore)를 거친다 — 인증 로직·보안 규칙은 그대로이고 네트워크 경로만
// 바뀐다. 이 플래그를 켜지 않는 한(관리자·고객 포함 거의 모든 세션) 아래 분기는 전혀
// 실행되지 않고 지금까지와 똑같이 Firebase에 직접 접속한다.
const useCnProxy = typeof window !== "undefined" && localStorage.getItem("fbProxyCN") === "1";

// 중국 우회 세션은 "자동 로그인"이 계속 풀리는 문제가 있었다 — 로그인 직후엔 세션이
// localStorage에 정상 저장되는데, getAuth()의 기본 저장소 우선순위([indexedDB, localStorage,
// sessionStorage]) 때문에 다음 로딩 때 Firebase가 그걸 IndexedDB로 옮겨버리고, iOS에서
// "홈 화면에 추가"한 PWA는 IndexedDB가 안정적으로 안 남아(실제 기기 로그로 확인함 —
// 재로딩 시점엔 localStorage가 비어있고 IndexedDB만 있음) 세션이 사라졌다. localStorage만
// 쓰도록 강제해서 이 경로 자체를 없앤다 — 우회를 안 쓰는 세션은 지금까지와 동일하게
// getAuth()의 기본 동작(IndexedDB 우선)을 그대로 쓴다.
export const auth = useCnProxy
  ? initializeAuth(app, { persistence: [browserLocalPersistence, browserSessionPersistence] })
  : getAuth(app);
if (useCnProxy) {
  connectAuthEmulator(auth, window.location.origin, { disableWarnings: true });
}

// initializeFirestore는 같은 app에 대해 getFirestore보다 먼저, 딱 한 번만 호출해야 한다 —
// 이 파일이 db를 export하는 유일한 지점이라 조건은 여기서만 갈린다.
export const db = useCnProxy
  ? initializeFirestore(app, {
      host: `${window.location.host}/api/fbproxy/firestore`,
      ssl: true,
      experimentalForceLongPolling: true,
    })
  : getFirestore(app);

export const storage = getStorage(app);

// 로그인(관리자 등)이 있어야 열리는 스토리지 파일용 — <a href={url}> 방식은 브라우저가
// 인증 헤더를 붙이지 않아 보안 규칙이 401/403으로 막으므로, SDK의 인증된 요청으로 받아온
// blob을 사용한다. quoteRequests의 사업자등록증(bizRegCert)처럼 원래 공개 읽기였다가
// 로그인 필요로 좁힌 파일에 사용한다.
//
// 처음엔 새 탭을 열어 그 안에서 보여주려 했다(window.open으로 새 탭 → blob: URL로 이동
// → 안 되길래 data: URL로 이동) — 그런데 사파리에서 매번 빈 화면만 뜨는 게 실제로
// 확인됐다: 새로 연 탭(다른 창)의 주소를 blob:/data: URL로 옮기는 방식 자체가 사파리와
// 잘 안 맞는 것으로 보인다. 그래서 새 창을 아예 열지 않고, 지금 페이지 안에서 파일을
// 그대로 다운로드시키는 방식으로 바꿨다 — <a download> 클릭은 팝업 차단기·탭 전환 문제와
// 무관해서 훨씬 안정적이다.
export async function openAuthenticatedStorageFile(url: string) {
  try {
    const fileRef = ref(storage, url);
    const blob = await getBlob(fileRef);
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = fileRef.name || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
  } catch (e) {
    // 예전엔 실패해도 아무 반응이 없어서(콘솔에만 남고 화면엔 표시 안 됨), 버튼을 눌러도
    // "왜 안 열리지?" 상태로 남았다 — 최소한의 안내는 뜨도록 한다.
    console.error("파일 열람 실패:", e);
    alert("파일을 여는 데 실패했습니다. 잠시 후 다시 시도해주세요.");
  }
}

export default app;
