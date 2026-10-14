import { NextRequest } from "next/server";
import { forwardToHost } from "@/lib/fbProxyForward";

// 로그인 세션 유지(ID 토큰 갱신)에 쓰인다 — connectAuthEmulator가 자동으로 이 경로로
// 보낸다. Edge 런타임 이유는 identitytoolkit.googleapis.com 라우트 주석 참고.
export const runtime = "edge";

async function handle(req: NextRequest) {
  return forwardToHost(req, "securetoken.googleapis.com", "/securetoken.googleapis.com");
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
