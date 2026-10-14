import { auth } from "@/lib/firebase";

// 중국 우회 세션(localStorage.fbProxyCN==="1")에서 Storage 파일을 다루기 위한 헬퍼 —
// Storage SDK의 emulator 연결 기능(connectStorageEmulator)은 프로토콜을 http로
// 고정해버려 HTTPS 페이지에서 "혼합 콘텐츠"로 막힌다(SDK 소스로 직접 확인). 그래서
// Storage는 SDK를 아예 안 거치고, REST API를 우리 프록시(/v0/...)로 직접 호출한다.
// 관리자·고객, 그리고 우회를 켜지 않은 모든 세션은 이 파일의 함수들이 그냥 기존
// Storage SDK 호출로 바로 넘어가므로 전혀 영향이 없다.

function isCnProxyOn(): boolean {
  return typeof window !== "undefined" && localStorage.getItem("fbProxyCN") === "1";
}

const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

// 이미 업로드된 파일의 실제 주소(f.url 등, firebasestorage.googleapis.com으로 저장돼
// 있다 — 우회를 안 쓰는 계정이 올린 것이든, 아래 uploadFileViaProxy로 올린 것이든 항상
// 이 형태로 저장한다)를, "지금 보는 사람"이 우회 세션이면 우리 도메인 경유 주소로
// 그 자리에서 바꿔서 보여준다. 저장된 데이터 자체는 건드리지 않는다.
export function toProxiedUrl(url: string): string {
  if (!url || !isCnProxyOn() || typeof window === "undefined") return url;
  if (!url.startsWith("https://firebasestorage.googleapis.com/")) return url;
  return url.replace("https://firebasestorage.googleapis.com", window.location.origin);
}

// uploadBytesResumable + getDownloadURL을 대신한다 — 업로드 후 다른 사람(프록시를 안 쓰는
// 관리자 등)도 그대로 열 수 있도록, Firebase SDK가 getDownloadURL에서 자동으로 해주는
// "다운로드 토큰 심기"를 PATCH로 직접 해준다.
export async function uploadFileViaProxy(
  storagePath: string,
  file: Blob,
  contentType: string,
  onProgress?: (ratio: number) => void
): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  if (!BUCKET) throw new Error("Storage 버킷 설정을 찾을 수 없습니다.");

  const encodedPath = encodeURIComponent(storagePath);
  const origin = window.location.origin;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${origin}/v0/b/${BUCKET}/o?uploadType=media&name=${encodedPath}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", contentType || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`업로드 실패 (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("네트워크 오류로 업로드에 실패했습니다."));
    xhr.send(file);
  });

  const downloadToken =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const patchRes = await fetch(`${origin}/v0/b/${BUCKET}/o/${encodedPath}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ metadata: { firebaseStorageDownloadTokens: downloadToken } }),
  });
  if (!patchRes.ok) throw new Error("파일 등록에 실패했습니다.");

  // 실제 주소는 항상 firebasestorage.googleapis.com 형태로 저장한다(toProxiedUrl이
  // 보는 사람에 따라 그때그때 바꿔주므로, 데이터에는 "진짜" 주소만 남겨 다른 세션에서도
  // 똑같이 쓸 수 있게 한다).
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodedPath}?alt=media&token=${downloadToken}`;
}

export async function deleteFileViaProxy(storagePath: string): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token || !BUCKET) return;
  const origin = window.location.origin;
  await fetch(`${origin}/v0/b/${BUCKET}/o/${encodeURIComponent(storagePath)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export { isCnProxyOn };
