import { NextRequest } from "next/server";
import { forwardToHost } from "@/lib/fbProxyForward";

// initializeFirestore(app, { host: ".../api/fbproxy/firestore" })로 연결된 협력사(중국
// 우회) 세션의 모든 Firestore 트래픽(문서 읽기/쓰기, 실시간 리스너의 long-polling 채널
// 포함)이 이 경로를 거친다. experimentalForceLongPolling과 함께 써야 한다 — 기본
// WebChannel(HTTP/2 스트리밍)은 서버리스 함수로 투명하게 중계하기 어렵다.
// Edge 런타임 — identitytoolkit.googleapis.com 라우트 주석 참고. long-polling은 매
// 리스너마다 반복적으로 짧은 요청을 계속 보내는 방식이라, 요청당 콜드스타트가 거의 없는
// Edge가 특히 체감 속도에 큰 영향을 준다.
export const runtime = "edge";

async function handle(req: NextRequest) {
  return forwardToHost(req, "firestore.googleapis.com", "/api/fbproxy/firestore");
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
