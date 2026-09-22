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
//
// getBlob()으로 await한 "후에" window.open()을 부르면, 브라우저가 이 호출을
// 클릭에서 비롯된 것으로 보지 않고 팝업 차단기로 조용히 막아버릴 수 있다(에러도 안 나서
// 버튼을 눌러도 아무 반응이 없는 것처럼 보인다). 그래서 클릭 즉시(await 이전에) 빈 탭을
// 먼저 열어 참조를 확보해둔다.
//
// blob: URL은 그걸 만든 창(origin document)에 묶여 있어서, 새로 연 다른 탭의 주소를
// 그 blob: URL로 옮기면 사파리에서는 빈 화면만 뜨고 내용이 안 열리는 경우가 있다(실제로
// 확인된 증상). 창을 넘나들어도 항상 재현되는 data: URL(base64로 파일 내용을 통째로
// 담음)로 옮겨서 이 문제를 피한다.
export async function openAuthenticatedStorageFile(url: string) {
  const win = window.open("", "_blank");
  try {
    const blob = await getBlob(ref(storage, url));
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    if (win) {
      win.location.href = dataUrl;
    } else {
      // 빈 탭 열기 자체가 막혔던 경우(팝업 차단기 설정 등) 마지막으로 한 번 더 시도
      window.open(dataUrl, "_blank", "noopener,noreferrer");
    }
  } catch (e) {
    // 예전엔 실패해도 아무 반응이 없어서(콘솔에만 남고 화면엔 표시 안 됨), 버튼을 눌러도
    // "왜 안 열리지?" 상태로 남았다 — 최소한의 안내는 뜨도록 한다.
    console.error("파일 열람 실패:", e);
    win?.close();
    alert("파일을 여는 데 실패했습니다. 잠시 후 다시 시도해주세요.");
  }
}

export default app;
