import { NextRequest } from "next/server";
import { forwardToHost } from "@/lib/fbProxyForward";

// connectAuthEmulator가 이 경로 구조("/identitytoolkit.googleapis.com/...")로 요청을
// 보낸다 — Firebase SDK 자체의 동작 방식이라 경로를 임의로 바꿀 수 없다.
export const dynamic = "force-dynamic";

async function handle(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forwardToHost(req, "identitytoolkit.googleapis.com", params.path);
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
