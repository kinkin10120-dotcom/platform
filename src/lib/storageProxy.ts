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

// Vercel 플랫폼 자체가 우리 함수에 도달하기도 전에 요청 바디를 막는 한계가 있다(코드
// 버그가 아니라 인프라 제약 — 413은 deploymentId 로그의 "source":"static"으로 찍혀,
// 우리 Edge 라우트가 실행되기 전에 거부당한다는 뜻). 정확한 경계를 이진 탐색으로 재보니
// 4,480,000바이트까지는 통과하고 4,500,000바이트부터 막힌다(Vercel이 공개 문서에서
// 말하는 "4.5MB" 그대로) — 청크를 이 한계에 최대한 가깝게 키울수록 큰 파일 업로드 시
// 왕복 횟수가 줄어 중국 우회 경로에서 체감 속도가 빨라진다. 4MB(256KB의 배수, Google
// 요구사항)로 두면 여유 있게 안전하면서도 예전 3MB보다 왕복이 1/4 정도 줄어든다.
const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB — 256KB의 배수, 4.5MB 한계보다 충분히 작음
const DIRECT_UPLOAD_LIMIT = CHUNK_SIZE; // 청크 하나에 다 들어가는 크기까지는 단건 업로드가
// resumable 세션 시작 왕복 1회를 아낄 수 있어 더 빠르다

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

// 실제 버그로 확인된 부분: 관리자(직접 접속)는 <a href target="_blank">로 PDF를 열면
// 사파리가 미리보기/공유 시트를 띄우는데, 협력사(프록시 경유) 세션은 같은 링크로도 그게
// 안 뜬다. 직접 접속·프록시 응답 헤더를 실측 비교해보니 Content-Length만 빠져 있었는데,
// Vercel 플랫폼이 함수 응답에서 이 헤더를 항상 제거하는 것으로 보여(Edge/Node 런타임,
// 스트림/버퍼 바디 다 시도해도 그대로 빠짐) 프록시 쪽에서는 고칠 방법이 없었다. 대신
// src/lib/firebase.ts의 openAuthenticatedStorageFile과 같은 이미 검증된 방식(새 탭/
// blob: URL 이동은 사파리에서 빈 화면만 뜨는 게 이미 확인된 적 있어 피하고, blob을 받아
// <a download>를 코드로 클릭)을 그대로 따른다 — Content-Length 유무와 무관하게 동작한다.
export async function openFileViaProxy(proxiedUrl: string, fileName: string): Promise<void> {
  const res = await fetch(proxiedUrl);
  if (!res.ok) throw new Error(`파일을 여는 데 실패했습니다. (${res.status})`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = fileName || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
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
