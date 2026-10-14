import { NextRequest, NextResponse } from "next/server";

// 중국 우회 세션에서 "자동 로그인이 풀린다" 문제를 진단하기 위한 임시 라우트 — 클라이언트
// 콘솔 로그는 서버에서 못 보니, 재현 순간 무슨 상태였는지를 여기로 보내 Vercel 로그에서
// 직접 확인한다. 원인을 찾으면 이 라우트와 호출부는 지운다.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  console.log("[auth-restore-debug]", JSON.stringify(body));
  return NextResponse.json({ ok: true });
}
