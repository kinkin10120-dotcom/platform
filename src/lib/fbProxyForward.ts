import { NextRequest, NextResponse } from "next/server";

// 중국 등 일부 해외 네트워크에서 브라우저가 *.googleapis.com에 직접 접속을 못 하는
// 협력사 계정을 위한 투명 프록시 — 우리 도메인(handyhand.co.kr, 차단 안 됨)이 중간에서
// 대신 Google에 요청해준다. 요청/응답 내용을 전혀 들여다보거나 바꾸지 않고 그대로
// 전달만 한다(인증 로직·보안 규칙은 전혀 건드리지 않음 — 그냥 네트워크 경로만 우회).
// 관리자·고객 계정, 그리고 이 우회를 켜지 않은 모든 세션은 이 라우트 자체를 호출하지
// 않는다(src/lib/firebase.ts의 opt-in 플래그 참고).
const HOP_BY_HOP_REQUEST_HEADERS = new Set(["host", "connection", "content-length", "cookie"]);
const HOP_BY_HOP_RESPONSE_HEADERS = new Set(["content-encoding", "content-length", "transfer-encoding", "connection"]);

export async function forwardToHost(req: NextRequest, targetHost: string, localPrefix: string) {
  // 실제 버그로 확인된 부분 ①: 우리 라우트는 전부 [...path] 캐치올 세그먼트를 쓰는데,
  // 요청 경로에 콜론이 들어가면(Firestore의 documents:batchGet처럼 RPC 메서드를 콜론으로
  // 붙이는 형식 — getDoc()이 내부적으로 이 방식을 쓴다) Next.js/Vercel이 그 경로 매칭을
  // 쿼리 파라미터 "path="로도 흘려보낸다. 이걸 그대로 업스트림에 전달하면 Google API가
  // "Unknown name \"path\""로 거부한다(직접 호출과 비교해 실제로 재현·확인함) — 우리
  // 라우팅이 만든 파라미터일 뿐 원래 요청에는 없던 것이라 제거하고 보낸다.
  const search = new URLSearchParams(req.nextUrl.search);
  search.delete("path");
  const query = search.toString();

  // 실제 버그로 확인된 부분 ②(더 치명적): 예전엔 params.path(캐치올이 "/"로 쪼개서 넘겨준
  // 배열)를 다시 join("/")해서 업스트림 경로를 만들었는데, Storage 파일 경로처럼 객체 이름
  // 자체에 "/"가 들어있어 %2F로 인코딩된 경우(예: clientProducts%2F{id}%2Fimage — 폴더가
  // 아니라 flat 키 안에 슬래시가 든 것), Next.js 라우팅이 %2F를 먼저 디코딩해 추가 세그먼트로
  // 쪼개버린다. join("/")하면 인코딩이 사라진 채(clientProducts/{id}/image, 리터럴 슬래시
  // 3개짜리 경로)로 보내져 Google이 "Invalid HTTP method/URL pair"로 거부했다(직접 호출은
  // 200, 프록시만 400 — 실제로 재현·확인함. GET으로 파일을 내려받는 모든 요청, 즉 화면에 뜨는
  // 로고·이미지·첨부파일 전부가 여기 해당해서 영향 범위가 가장 컸다). req.nextUrl.pathname은
  // 이런 재분해 없이 원래 인코딩을 그대로 유지하고 있어(디버그 로그로 직접 확인함), 이걸
  // 그대로 쓰고 우리 라우트 자신의 경로(localPrefix)만 떼어내는 방식으로 바꿨다.
  const upstreamPath = req.nextUrl.pathname.slice(localPrefix.length);
  const targetUrl = `https://${targetHost}${upstreamPath}${query ? `?${query}` : ""}`;

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
