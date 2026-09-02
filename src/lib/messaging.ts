import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import app, { db } from "@/lib/firebase";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export async function enablePushNotifications(uid: string): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === "undefined") return { ok: false, error: "브라우저 환경이 아닙니다." };
  if (!("Notification" in window)) return { ok: false, error: "이 브라우저는 알림을 지원하지 않습니다." };
  if (!VAPID_KEY) return { ok: false, error: "푸시 알림이 아직 설정되지 않았습니다." };
  // 이전에 알림을 거부한 적이 있으면 브라우저가 권한 팝업을 다시 띄우지 않고 조용히
  // "거부됨"을 반환한다 — 그러면 아무 반응도 없는 것처럼 보이므로 미리 구분해서 안내한다.
  if (Notification.permission === "denied") {
    return { ok: false, error: "알림 권한이 차단되어 있습니다. 브라우저의 사이트 설정에서 알림을 '허용'으로 바꾼 뒤 다시 시도해주세요." };
  }

  try {
    // 사용자가 버튼을 클릭한 직후의 유효 시간(user activation) 안에 요청해야 팝업이 뜨는
    // 브라우저가 있어, 다른 비동기 작업(isSupported 등)보다 이 요청을 먼저 실행한다.
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, error: "알림 권한이 거부되었습니다." };

    if (!(await isSupported())) return { ok: false, error: "이 브라우저는 푸시 알림을 지원하지 않습니다." };

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (!token) return { ok: false, error: "토큰을 발급받지 못했습니다." };

    await updateDoc(doc(db, "users", uid), { fcmTokens: arrayUnion(token) });
    localStorage.setItem("pushEnabled", "true");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "푸시 알림 설정에 실패했습니다." };
  }
}

// 이미 알림 권한이 허용된 상태에서 토큰만 다시 등록한다(권한 팝업 없음).
// 서버는 만료된 토큰을 자동으로 지우는데(onNotificationCreated의 stale token 정리),
// 그러면 브라우저 권한은 그대로인데 서버에 보낼 대상이 없어 푸시만 조용히 끊긴다.
// 앱을 열 때마다 이 함수로 토큰을 다시 심어 그 상태를 사용자 조작 없이 복구한다.
export async function syncPushToken(uid: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  if (!VAPID_KEY) return false;
  try {
    if (!(await isSupported())) return false;
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (!token) return false;
    await updateDoc(doc(db, "users", uid), { fcmTokens: arrayUnion(token) });
    localStorage.setItem("pushEnabled", "true");
    return true;
  } catch {
    return false;
  }
}

export async function disablePushNotifications(uid: string) {
  if (typeof window === "undefined") return;
  try {
    // 토큰 하나만 골라 지우는 대신 전체를 비운다 — 예전 등록·재등록 과정에서 남은
    // 유효한 옛 토큰이 함께 있으면 같은 알림이 기기에 두 번 오는 원인이 되기 때문에,
    // "알림 끄기"는 이 계정에 등록된 모든 푸시 구독을 정리하는 것으로 취급한다.
    await updateDoc(doc(db, "users", uid), { fcmTokens: [] });
  } finally {
    localStorage.setItem("pushEnabled", "false");
  }
}
