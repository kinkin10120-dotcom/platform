import { NextRequest } from "next/server";
import { forwardToHost } from "@/lib/fbProxyForward";

// connectAuthEmulator가 이 경로 구조("/identitytoolkit.googleapis.com/...")로 요청을
// 보낸다 — Firebase SDK 자체의 동작 방식이라 경로를 임의로 바꿀 수 없다.
// Edge 런타임 — 일반 서버리스 함수보다 콜드스타트가 거의 없고 전세계 더 많은 지점에서
// 실행돼, 중국처럼 먼 지역에서의 왕복 지연을 줄여준다(순수 fetch 중계라 Node 전용 API가
// 필요 없어 Edge로 바꿔도 동작은 동일하다).
export const runtime = "edge";

async function handle(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forwardToHost(req, "identitytoolkit.googleapis.com", params.path);
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
