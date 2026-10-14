import { NextRequest, NextResponse } from "next/server";

// 중국 등 일부 해외 네트워크에서 브라우저가 *.googleapis.com에 직접 접속을 못 하는
// 협력사 계정을 위한 투명 프록시 — 우리 도메인(handyhand.co.kr, 차단 안 됨)이 중간에서
// 대신 Google에 요청해준다. 요청/응답 내용을 전혀 들여다보거나 바꾸지 않고 그대로
// 전달만 한다(인증 로직·보안 규칙은 전혀 건드리지 않음 — 그냥 네트워크 경로만 우회).
// 관리자·고객 계정, 그리고 이 우회를 켜지 않은 모든 세션은 이 라우트 자체를 호출하지
// 않는다(src/lib/firebase.ts의 opt-in 플래그 참고).
const HOP_BY_HOP_REQUEST_HEADERS = new Set(["host", "connection", "content-length", "cookie"]);
const HOP_BY_HOP_RESPONSE_HEADERS = new Set(["content-encoding", "content-length", "transfer-encoding", "connection"]);

export async function forwardToHost(req: NextRequest, targetHost: string, pathSegments: string[]) {
  // 실제 버그로 확인된 부분: 우리 라우트는 전부 [...path] 캐치올 세그먼트를 쓰는데,
  // 요청 경로에 콜론이 들어가면(Firestore의 documents:batchGet처럼 RPC 메서드를 콜론으로
  // 붙이는 형식 — getDoc()이 내부적으로 이 방식을 쓴다) Next.js/Vercel이 그 경로 매칭을
  // 쿼리 파라미터 "path="로도 흘려보낸다. 이걸 그대로 업스트림에 전달하면 Google API가
  // "Unknown name \"path\""로 거부한다(직접 호출과 비교해 실제로 재현·확인함) — 우리
  // 라우팅이 만든 파라미터일 뿐 원래 요청에는 없던 것이라 제거하고 보낸다.
  const search = new URLSearchParams(req.nextUrl.search);
  search.delete("path");
  const query = search.toString();
  const targetUrl = `https://${targetHost}/${pathSegments.join("/")}${query ? `?${query}` : ""}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const res = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
    redirect: "manual",
  });

  const outHeaders = new Headers();
  res.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_RESPONSE_HEADERS.has(key.toLowerCase())) outHeaders.set(key, value);
  });

  return new NextResponse(res.body, { status: res.status, headers: outHeaders });
}
