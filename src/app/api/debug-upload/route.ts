import { NextRequest, NextResponse } from "next/server";

// 임시 진단 — "파일 첨부해도 아무 반응 없다" 문제의 원인을 알아내기 위해, 첨부 input의
// onChange가 실제로 발생하는지, 어디서 멈추는지를 서버 로그로 받는다. 원인 찾으면 지운다.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  console.log("[debug-upload]", JSON.stringify(body));
  return NextResponse.json({ ok: true });
}
