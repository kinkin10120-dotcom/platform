"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PurchaseOrder } from "@/lib/types";

interface Props {
  orders: PurchaseOrder[];
}

// 최근 6개월(이번 달 포함) 발주 금액 합계 — 취소된 발주는 매출로 잡지 않는다.
function buildMonthlyData(orders: PurchaseOrder[]) {
  const now = new Date();
  const months: { key: string; label: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: `${d.getMonth() + 1}월`, total: 0 });
  }
  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    const d = new Date(o.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.total += o.totalAmount;
  }
  return months;
}

export default function MonthlyOrderChart({ orders }: Props) {
  const data = useMemo(() => buildMonthlyData(orders), [orders]);

  return (
    <div className="rounded-3xl bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold text-[#1d1d1f]">최근 6개월 발주 금액</h3>
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
              tickFormatter={(v: number) => (v >= 10000 ? `${Math.round(v / 10000)}만` : `${v}`)}
            />
            <Tooltip
              cursor={{ fill: "#f5f5f7" }}
              formatter={(value: number) => [`${value.toLocaleString()}원`, "발주 금액"]}
              contentStyle={{ borderRadius: 12, border: "1px solid #e5e5e5", fontSize: 12 }}
            />
            <Bar dataKey="total" fill="#1d1d1f" radius={[6, 6, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
