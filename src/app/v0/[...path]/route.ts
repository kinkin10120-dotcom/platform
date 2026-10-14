import { NextRequest } from "next/server";
import { forwardToHost } from "@/lib/fbProxyForward";

// 중국 우회 세션의 Storage 업로드/다운로드가 이 경로를 거친다(src/lib/storageProxy.ts
// 참고) — Storage SDK의 emulator 연결 기능은 프로토콜을 http로 고정해버려 HTTPS
// 페이지에서 못 쓰기 때문에, Storage는 SDK를 안 거치고 REST API를 이 프록시로 직접
// 호출하는 방식을 쓴다.
export const runtime = "edge";

async function handle(req: NextRequest) {
  // 라우트 폴더명 "v0" 자체가 실제 Storage REST 경로의 첫 세그먼트와 같아서, 로컬 경로와
  // 업스트림 경로가 동일하다 — 떼어낼 접두사가 없다.
  return forwardToHost(req, "firebasestorage.googleapis.com", "");
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
