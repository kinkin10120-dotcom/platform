"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PurchaseOrder } from "@/lib/types";
import { OrderTotals } from "@/lib/orderCalc";

export interface MonthPoint {
  key: string;
  label: string;
  total: number;
}

// 최근 6개월(이번 달 포함) 발주 금액 합계 — 취소된 발주는 매출로 잡지 않는다.
// 원화와 달러 품목은 raw totalAmount를 그냥 더하면 서로 다른 통화가 한 숫자로 섞여버리므로,
// KRW/USD 통화별 합계(calcOrderTotals)를 이미 계산해둔 값을 받아서만 쓴다 — 호출 측(홈
// 대시보드)에서 발주 하나당 그 계산을 정확히 한 번만 하고, 여기서는 재사용만 한다.
export function buildMonthlyOrderData(
  orders: (Pick<PurchaseOrder, "createdAt" | "status"> & { totals: OrderTotals })[]
): { krw: MonthPoint[]; usd: MonthPoint[] } {
  const now = new Date();
  const krw: MonthPoint[] = [];
  const usd: MonthPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const label = `${d.getMonth() + 1}월`;
    krw.push({ key, label, total: 0 });
    usd.push({ key, label, total: 0 });
  }
  const krwByKey = new Map(krw.map((m) => [m.key, m]));
  const usdByKey = new Map(usd.map((m) => [m.key, m]));
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    const d = new Date(o.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const krwBucket = krwByKey.get(key);
    const usdBucket = usdByKey.get(key);
    if (krwBucket) krwBucket.total += o.totals.krwTotal;
    if (usdBucket) usdBucket.total += o.totals.usdTotal;
  }
  return { krw, usd };
}

interface Props {
  data: MonthPoint[];
  currency: "KRW" | "USD";
}

export default function MonthlyOrderChart({ data, currency }: Props) {
  const unit = currency === "USD" ? "$" : "원";

  return (
    <div className="rounded-3xl bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold text-[#1d1d1f]">최근 6개월 발주 금액{currency === "USD" ? " (USD)" : ""}</h3>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#86868b" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: "#86868b" }}
              axisLine={false}
              tickLine={false}
              width={56}
              tickFormatter={(v: number) =>
                currency === "USD" ? `$${v.toLocaleString()}` : v >= 10000 ? `${Math.round(v / 10000)}만` : `${v}`
              }
            />
            <Tooltip
              cursor={{ fill: "#f5f5f7" }}
              formatter={(value: number) => [currency === "USD" ? `$${value.toLocaleString()}` : `${value.toLocaleString()}${unit}`, "발주 금액"]}
              contentStyle={{ borderRadius: 12, border: "1px solid #e5e5e5", fontSize: 12 }}
            />
            <Bar dataKey="total" fill="#1d1d1f" radius={[6, 6, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
