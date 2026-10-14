import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
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

export const auth = getAuth(app);
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

// 프록시 경유 첫 요청(특히 Edge 함수 콜드스타트 + 중국→Vercel→Google 왕복)이 느려서,
// 로그인 직후 바로 이어지는 users/{uid} 조회가 어쩌다 한 번 실패하는 사례가 있었다 —
// 로그인을 시도하기도 전에, 페이지가 뜨자마자 미리 한 번 "가짜" 요청을 보내 프록시
// 경로를 데워둔다(응답 내용은 안 쓴다, 실패해도 무시). 실제 로그인·데이터 요청이 도착할
// 때는 이미 한 번 열린 경로라 더 빠르게 응답할 가능성이 높다.
if (useCnProxy) {
  fetch(`${window.location.origin}/api/fbproxy/firestore/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`, {
    method: "GET",
  }).catch(() => {});
  fetch(`${window.location.origin}/identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  }).catch(() => {});
}

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
