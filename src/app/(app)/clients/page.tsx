"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ChevronUp, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenClients, createClient, updateClient } from "@/lib/firestore/clients";
import { Client } from "@/lib/types";

export default function ClientsPage() {
  const { appUser } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [sorted, setSorted] = useState<Client[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = appUser?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    return listenClients((data) => { setClients(data); setLoaded(true); });
  }, [isAdmin]);

  useEffect(() => {
    setSorted([...clients].sort((a, b) => {
      if (a.sortOrder !== undefined && b.sortOrder !== undefined) return a.sortOrder - b.sortOrder;
      if (a.sortOrder !== undefined) return -1;
      if (b.sortOrder !== undefined) return 1;
      return a.name.localeCompare(b.name, "ko");
    }));
  }, [clients]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!appUser) return;
    setSubmitting(true);
    try {
      await createClient(name.trim(), memo.trim(), appUser.uid);
      setName("");
      setMemo("");
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function moveClient(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= sorted.length) return;
    const a = sorted[index];
    const b = sorted[target];
    await Promise.all([
      updateClient(a.id, { sortOrder: target }),
      updateClient(b.id, { sortOrder: index }),
    ]);
  }

  if (appUser && !isAdmin) {
    return <p className="text-sm text-[#86868b]">접근 권한이 없습니다.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-[#1d1d1f]">
            <span className="h-2 w-2 rounded-full bg-[#1d1d1f]" />
            클라이언트 관리
          </h1>
          <p className="mt-1 pl-4 text-sm text-[#86868b]">클라이언트별 프로젝트와 담당자 계정을 관리합니다.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1 self-start whitespace-nowrap rounded-full bg-[#1d1d1f] px-4 text-sm font-medium text-white transition hover:bg-black"
        >
          <Plus size={16} /> 클라이언트 추가
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-3xl bg-white p-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#86868b]">클라이언트(회사)명</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
              placeholder="예: 주식회사 핸디핸드"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#86868b]">비고</label>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
              placeholder="담당자, 연락처 등 자유 메모"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
          >
            저장
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-3xl bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#ececef] text-left font-medium text-[#86868b]">
            <tr>
              <th className="w-8 px-2 py-3" />
              <th className="px-4 py-3">클라이언트</th>
              <th className="hidden px-4 py-3 sm:table-cell">비고</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => (
              <tr
                key={c.id}
                className="border-t border-[#f0f0f0] transition-colors hover:bg-[#f5f5f7]"
              >
                <td className="px-1 py-3">
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => moveClient(i, -1)}
                      disabled={i === 0}
                      className="rounded p-0.5 text-[#86868b] hover:bg-[#f5f5f7] disabled:opacity-20"
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      onClick={() => moveClient(i, 1)}
                      disabled={i === sorted.length - 1}
                      className="rounded p-0.5 text-[#86868b] hover:bg-[#f5f5f7] disabled:opacity-20"
                    >
                      <ChevronDown size={13} />
                    </button>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-[#1d1d1f]">{c.name}</td>
                <td className="hidden px-4 py-3 text-[#86868b] sm:table-cell">{c.memo}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/clients/${c.id}`} className="text-[#1d1d1f] font-medium hover:underline">
                    관리 →
                  </Link>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[#86868b]">
                  {loaded ? "등록된 클라이언트가 없습니다." : "불러오는 중..."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
