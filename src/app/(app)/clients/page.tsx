"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, GripVertical } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenClients, createClient, updateClient } from "@/lib/firestore/clients";
import { Client } from "@/lib/types";

export default function ClientsPage() {
  const { appUser } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [sorted, setSorted] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const dragIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);

  useEffect(() => listenClients(setClients), []);

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

  function onDragStart(index: number) {
    dragIndex.current = index;
  }

  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    dragOverIndex.current = index;
    if (dragIndex.current === null || dragIndex.current === index) return;
    const next = [...sorted];
    const [moved] = next.splice(dragIndex.current, 1);
    next.splice(index, 0, moved);
    dragIndex.current = index;
    setSorted(next);
  }

  async function onDrop() {
    await Promise.all(sorted.map((c, i) => updateClient(c.id, { sortOrder: i })));
    dragIndex.current = null;
    dragOverIndex.current = null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">클라이언트 관리</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus size={16} /> 클라이언트 추가
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">클라이언트(회사)명</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="예: 주식회사 핸디핸드"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">비고</label>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="담당자, 연락처 등 자유 메모"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            저장
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="w-8 px-2 py-3" />
              <th className="px-4 py-3">클라이언트</th>
              <th className="px-4 py-3">비고</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => (
              <tr
                key={c.id}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragOver={(e) => onDragOver(e, i)}
                onDrop={onDrop}
                className="border-t border-gray-100 transition-colors hover:bg-gray-50"
              >
                <td className="px-2 py-3 text-gray-300 cursor-grab active:cursor-grabbing">
                  <GripVertical size={15} />
                </td>
                <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                <td className="px-4 py-3 text-gray-500">{c.memo}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/clients/${c.id}`} className="text-brand-600 hover:underline">
                    관리 →
                  </Link>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  등록된 클라이언트가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
