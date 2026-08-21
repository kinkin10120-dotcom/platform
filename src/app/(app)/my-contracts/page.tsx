"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileSignature } from "lucide-react";
import { getMyContracts, MyContractSummary } from "@/lib/functions";
import { formatMoney } from "@/lib/orderCalc";
import { CONTRACT_STATUS_LABEL, ContractStatus } from "@/lib/types";

const STATUS_STYLE: Record<ContractStatus, string> = {
  draft: "bg-[#f5f5f7] text-[#86868b]",
  sent: "bg-blue-50 text-blue-600",
  revision_requested: "bg-amber-50 text-amber-600",
  signed: "bg-green-50 text-green-600",
  linked: "bg-green-50 text-green-600",
};

export default function MyContractsPage() {
  const [items, setItems] = useState<MyContractSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyContracts()
      .then(setItems)
      .catch(() => setError("계약 목록을 불러오지 못했습니다."));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-[#1d1d1f]">
          <span className="h-2 w-2 rounded-full bg-[#1d1d1f]" />
          계약
        </h1>
        <p className="mt-1 pl-4 text-sm text-[#86868b]">체결했거나 진행 중인 계약서를 한눈에 확인하세요.</p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {items === null && !error && <p className="text-sm text-[#86868b]">불러오는 중...</p>}

      {items && items.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-3xl bg-white p-10 text-center">
          <FileSignature size={24} className="text-[#c7c7cc]" />
          <p className="text-sm text-[#86868b]">아직 확인할 계약서가 없습니다.</p>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="space-y-2">
          {items.map((c) => (
            <Link
              key={c.id}
              href={`/contracts/sign/${c.id}`}
              className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 transition hover:shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-[#1d1d1f]">{c.title}{c.productName ? ` · ${c.productName}` : ""}</p>
                <p className="mt-0.5 text-xs text-[#86868b]">
                  {formatMoney(c.amount, c.currency)} · {new Date(c.createdAt).toLocaleDateString("ko-KR")}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[c.status]}`}>
                {CONTRACT_STATUS_LABEL[c.status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
