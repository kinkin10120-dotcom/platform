import { NextRequest, NextResponse } from "next/server";

// 구매발주서의 "환율" 칸을 자동으로 채우기 위한 조회용 라우트.
//
// 브라우저에서 외부 API를 직접 부르면 제공처의 CORS 정책에 매여서, 어느 날 조용히 막히면
// 화면에서만 실패한다 — 서버를 거치면 제공처를 갈아끼워도 화면 코드는 그대로다.
//
// 여기서 돌려주는 값은 시장 환율(무료 공개 데이터)이라 은행 매매기준율과 소수점 단위로
// 다를 수 있다. 발주서에는 참고 환산액을 적는 용도이므로 이 정도 오차는 문제되지 않지만,
// 실제 송금액은 언제나 은행 고시 환율을 따른다.
const SUPPORTED = ["USD", "CNY"] as const;

interface FxResult {
  rate: number;
  date: string;
  source: string;
}

async function fromErApi(base: string): Promise<FxResult | null> {
  const res = await fetch(`https://open.er-api.com/v6/latest/${base}`, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  const data = await res.json();
  const rate = data?.rates?.KRW;
  if (typeof rate !== "number") return null;
  return { rate, date: String(data.time_last_update_utc ?? ""), source: "exchangerate-api" };
}

async function fromFrankfurter(base: string): Promise<FxResult | null> {
  const res = await fetch(`https://api.frankfurter.app/latest?from=${base}&to=KRW`, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  const data = await res.json();
  const rate = data?.rates?.KRW;
  if (typeof rate !== "number") return null;
  return { rate, date: String(data.date ?? ""), source: "ECB" };
}

export async function GET(req: NextRequest) {
  const base = (req.nextUrl.searchParams.get("base") ?? "").toUpperCase();
  if (!SUPPORTED.includes(base as (typeof SUPPORTED)[number])) {
    return NextResponse.json({ error: "지원하지 않는 통화입니다." }, { status: 400 });
  }

  try {
    // 한 곳이 죽어도 환율 칸이 비지 않도록 두 곳을 순서대로 시도한다.
    const result = (await fromErApi(base).catch(() => null)) ?? (await fromFrankfurter(base).catch(() => null));
    if (!result) {
      return NextResponse.json({ error: "환율을 가져오지 못했습니다." }, { status: 502 });
    }
    // 원 단위 소수 둘째 자리까지면 충분하다(발주서에는 참고 환산액만 적는다).
    return NextResponse.json({ ...result, rate: Math.round(result.rate * 100) / 100 });
  } catch {
    return NextResponse.json({ error: "환율을 가져오지 못했습니다." }, { status: 502 });
  }
}
