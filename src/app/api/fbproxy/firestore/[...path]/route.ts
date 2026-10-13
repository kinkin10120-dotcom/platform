import { NextRequest } from "next/server";
import { forwardToHost } from "@/lib/fbProxyForward";

// initializeFirestore(app, { host: ".../api/fbproxy/firestore" })로 연결된 협력사(중국
// 우회) 세션의 모든 Firestore 트래픽(문서 읽기/쓰기, 실시간 리스너의 long-polling 채널
// 포함)이 이 경로를 거친다. experimentalForceLongPolling과 함께 써야 한다 — 기본
// WebChannel(HTTP/2 스트리밍)은 서버리스 함수로 투명하게 중계하기 어렵다.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forwardToHost(req, "firestore.googleapis.com", params.path);
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
