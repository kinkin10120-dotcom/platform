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

// Vercel 플랫폼 자체가 우리 함수에 도달하기도 전에 요청 바디를 막는 한계가 약 4~4.3MB
// 선에서 걸린다는 걸 실측으로 확인함(코드 버그가 아니라 인프라 제약 — 413은
// deploymentId 로그의 "source":"static"으로 찍혀, 우리 Edge 라우트가 실행되기 전에
// 거부당한다는 뜻). 사진 등 흔한 용량의 첨부파일이 쉽게 이 선을 넘기므로, 이 크기를
// 넘는 파일은 Firebase Storage의 resumable 업로드 프로토콜로 청크 단위로 쪼개서 보낸다
// (각 청크는 한계보다 훨씬 작게). 직접 호출 + 우리 프록시 경유 둘 다 실측으로 검증함.
const DIRECT_UPLOAD_LIMIT = 3 * 1024 * 1024; // 3MB까지는 기존 단건 업로드 그대로 사용
const CHUNK_SIZE = 3 * 1024 * 1024; // 256KB의 배수여야 함(Google 요구사항) — 3MB는 배수

// 실제 버그로 확인된 부분: Firebase Storage는 객체가 업로드되는 순간 downloadTokens를
// 자동으로 생성해서 응답 JSON에 그대로 실어준다(실측으로 직접 확인함 — 업로드 직후 메타데이터
// 조회 없이도 POST/PUT finalize 응답 자체에 이미 들어있다). 그런데도 이후 PATCH로 토큰을
// "직접" 심는 불필요한 2차 요청을 보내고 있었는데, 그 PATCH 자체가 늘 "Not allowed to set
// custom metadata for firebaseStorageDownloadTokens"로 거부당해 업로드가 매번 실패하고
// 있었다 — 애초에 필요 없는 요청이었다. 업로드 응답에 이미 있는 토큰을 그대로 쓴다.
function extractDownloadToken(body: unknown): string {
  const token = (body as { downloadTokens?: string } | null)?.downloadTokens;
  if (!token) throw new Error("다운로드 토큰을 받지 못했습니다.");
  return token.split(",")[0];
}

async function uploadSmallFile(origin: string, token: string, encodedPath: string, file: Blob, contentType: string, onProgress?: (ratio: number) => void): Promise<string> {
  const body = await new Promise<unknown>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${origin}/v0/b/${BUCKET}/o?uploadType=media&name=${encodedPath}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", contentType || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) { reject(new Error(`업로드 실패 (${xhr.status})`)); return; }
      try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error("업로드 응답을 읽지 못했습니다.")); }
    };
    xhr.onerror = () => reject(new Error("네트워크 오류로 업로드에 실패했습니다."));
    xhr.send(file);
  });
  return extractDownloadToken(body);
}

async function uploadLargeFileResumable(origin: string, token: string, encodedPath: string, file: Blob, contentType: string, onProgress?: (ratio: number) => void): Promise<string> {
  const startRes = await fetch(`${origin}/v0/b/${BUCKET}/o?uploadType=resumable&name=${encodedPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Type": contentType || "application/octet-stream",
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: "{}",
  });
  if (!startRes.ok) throw new Error(`업로드 세션 생성 실패 (${startRes.status})`);
  const sessionUrl = startRes.headers.get("x-goog-upload-url");
  if (!sessionUrl) throw new Error("업로드 세션 주소를 받지 못했습니다.");
  const proxiedSessionUrl = sessionUrl.replace("https://firebasestorage.googleapis.com", origin);

  let offset = 0;
  while (offset < file.size) {
    const end = Math.min(offset + CHUNK_SIZE, file.size);
    const isLast = end >= file.size;
    const chunkRes = await fetch(proxiedSessionUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Goog-Upload-Command": isLast ? "upload, finalize" : "upload",
        "X-Goog-Upload-Offset": String(offset),
      },
      body: file.slice(offset, end),
    });
    if (!chunkRes.ok) throw new Error(`업로드 실패 (${chunkRes.status})`);
    if (isLast) return extractDownloadToken(await chunkRes.json());
    offset = end;
    onProgress?.(offset / file.size);
  }
  throw new Error("업로드가 끝까지 완료되지 않았습니다.");
}

// uploadBytesResumable + getDownloadURL을 대신한다.
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

  const downloadToken =
    file.size > DIRECT_UPLOAD_LIMIT
      ? await uploadLargeFileResumable(origin, token, encodedPath, file, contentType, onProgress)
      : await uploadSmallFile(origin, token, encodedPath, file, contentType, onProgress);

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
