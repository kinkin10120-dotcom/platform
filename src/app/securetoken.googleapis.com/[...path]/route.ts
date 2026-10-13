import { NextRequest } from "next/server";
import { forwardToHost } from "@/lib/fbProxyForward";

// 로그인 세션 유지(ID 토큰 갱신)에 쓰인다 — connectAuthEmulator가 자동으로 이 경로로
// 보낸다.
export const dynamic = "force-dynamic";

async function handle(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forwardToHost(req, "securetoken.googleapis.com", params.path);
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
