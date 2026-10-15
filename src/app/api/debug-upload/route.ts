import { NextRequest, NextResponse } from "next/server";

// 임시 진단(2차) — "첨부해도 반응 없다"가 재배포 후에도 재현된다는 보고라, 이번엔
// state 반영까지 실제로 커밋됐는지(렌더까지 갔는지)와, 지금 돌고 있는 JS가 최신
// 배포본인지(마운트 마커)를 같이 본다. 원인 찾으면 지운다.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  console.log("[debug-upload]", JSON.stringify(body));
  return NextResponse.json({ ok: true });
}
