import { NextRequest, NextResponse } from "next/server";

// 서버 사이드에서 Firebase Storage URL을 fetch해 클라이언트에 전달
// → 브라우저 CORS 제한을 우회
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "url 파라미터가 필요합니다." }, { status: 400 });
  }

  // Firebase Storage URL만 허용
  if (!url.startsWith("https://firebasestorage.googleapis.com/")) {
    return NextResponse.json({ error: "허용되지 않는 URL입니다." }, { status: 403 });
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: `Storage 응답 오류: ${res.status}` }, { status: 502 });
    }

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("Content-Type") ?? "application/octet-stream";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
