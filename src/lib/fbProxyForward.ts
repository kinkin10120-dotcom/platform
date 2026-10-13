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
  const targetUrl = `https://${targetHost}/${pathSegments.join("/")}${req.nextUrl.search}`;

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
