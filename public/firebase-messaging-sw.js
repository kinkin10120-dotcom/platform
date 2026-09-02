importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyA7k89x2WQ99xqy_aqj8MnBObY5gBJKzuI",
  authDomain: "handyhand-a175a.firebaseapp.com",
  projectId: "handyhand-a175a",
  storageBucket: "handyhand-a175a.firebasestorage.app",
  messagingSenderId: "911592308829",
  appId: "1:911592308829:web:18e058b917b32874364db4",
});

// 새 서비스워커가 배포되어도 기존 창이 열려있으면 "대기" 상태로 남아 갱신이 안 되는
// 경우가 많다(특히 iOS PWA). 설치되는 즉시 활성화하고 열려있는 클라이언트도 바로
// 새 버전이 제어하도록 강제한다.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// firebase.messaging()은 토큰 발급·갱신에 필요해서 초기화만 해두고, 배너 표시는
// 아래 push 이벤트 한 곳에서만 한다.
//
// 배너를 띄울 수 있는 경로가 두 개(FCM SDK의 onBackgroundMessage, 표준 push 이벤트)인데
// 둘 다 등록하면 iOS 홈 화면 앱에서 같은 알림이 두 번 뜬다(같은 tag를 줘도 합쳐지지
// 않는다 — iOS는 tag 기반 대체를 보장하지 않는다). 반대로 onBackgroundMessage만 쓰면
// iOS에서는 데이터 전용 메시지에 아예 호출되지 않아 알림이 오지 않는다.
// 그래서 모든 플랫폼에서 확실히 동작하는 표준 push 이벤트 하나만 남긴다.
firebase.messaging();

self.addEventListener("push", (event) => {
  let data = {};
  try {
    const raw = event.data ? event.data.json() : {};
    // FCM은 data-only 메시지를 { data: {...} }, 알림 메시지는 { notification: {...} }
    // 형태로 실어 보낸다 — 둘 다 받아준다.
    data = raw.data ?? raw.notification ?? raw;
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  // iOS는 푸시를 받고도 아무것도 표시하지 않으면 푸시 권한을 회수하므로 항상 표시한다.
  event.waitUntil(
    self.registration.showNotification(data?.title ?? "HANDYWORKS", {
      body: data?.body ?? "",
      icon: "/logo.png",
      data: data ?? {},
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link ?? "/home";
  event.waitUntil(clients.openWindow(link));
});
