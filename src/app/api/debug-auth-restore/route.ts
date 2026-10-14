import { NextRequest, NextResponse } from "next/server";

// 임시 진단 — 원인 찾으면 지운다.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  console.log("[auth-restore-debug]", JSON.stringify(body));
  return NextResponse.json({ ok: true });
}
