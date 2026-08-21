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

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.data?.title ?? "HANDYWORKS";
  const body = payload.data?.body ?? "";
  self.registration.showNotification(title, {
    body,
    icon: "/logo.png",
    data: payload.data,
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link ?? "/home";
  event.waitUntil(clients.openWindow(link));
});
