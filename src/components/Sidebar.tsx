"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutGrid, Building2, ListChecks, LogOut, Pencil, Check, X, Megaphone, MessageCircleQuestion, FileText } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useState, useRef, useEffect } from "react";

type NavItem = { href: string; label: string; icon: React.ElementType; show: boolean };

const STORAGE_KEY = "sidebar-order";

export default function Sidebar({ open = true, onClose }: { open?: boolean; onClose?: () => void }) {
  const { appUser, signOut, updateUserName } = useAuth();
  const pathname = usePathname();
  const isAdmin = appUser?.role === "admin";

  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const allItems: NavItem[] = [
    { href: "/home", label: "홈", icon: LayoutGrid, show: true },
    { href: "/notices", label: "공지사항", icon: Megaphone, show: true },
    { href: "/clients", label: "클라이언트 관리", icon: Building2, show: isAdmin },
    { href: "/templates", label: "업무 템플릿", icon: ListChecks, show: isAdmin },
    { href: "/inquiries", label: "문의 관리", icon: MessageCircleQuestion, show: isAdmin },
    { href: "/quotes", label: "견적 관리", icon: FileText, show: isAdmin },
  ];

  const visibleHrefs = allItems.filter((i) => i.show).map((i) => i.href);

  function loadOrder(): string[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return visibleHrefs;
      const parsed: string[] = JSON.parse(saved);
      // 저장된 순서 기준으로, 현재 보이는 항목만 유지 + 새 항목 뒤에 추가
      const ordered = parsed.filter((h) => visibleHrefs.includes(h));
      const added = visibleHrefs.filter((h) => !parsed.includes(h));
      return [...ordered, ...added];
    } catch {
      return visibleHrefs;
    }
  }

  const [orderedHrefs, setOrderedHrefs] = useState<string[]>([]);

  useEffect(() => {
    setOrderedHrefs(loadOrder());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const orderedItems = orderedHrefs
    .map((href) => allItems.find((i) => i.href === href))
    .filter(Boolean) as NavItem[];

  // drag refs
  const dragIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);

  function handleDragStart(index: number) {
    dragIndex.current = index;
  }

  function handleDragEnter(index: number) {
    dragOverIndex.current = index;
  }

  function handleDrop() {
    const from = dragIndex.current;
    const to = dragOverIndex.current;
    if (from === null || to === null || from === to) return;
    const next = [...orderedHrefs];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrderedHrefs(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    dragIndex.current = null;
    dragOverIndex.current = null;
  }

  useEffect(() => {
    if (editing) {
      setNameInput(appUser?.name ?? "");
      inputRef.current?.focus();
    }
  }, [editing, appUser?.name]);

  const handleSave = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === appUser?.name) { setEditing(false); return; }
    setSaving(true);
    await updateUserName(trimmed);
    setSaving(false);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") setEditing(false);
  };

  return (
    <aside className={`fixed inset-y-0 left-0 z-40 flex h-screen w-56 shrink-0 flex-col border-r border-[#e5e5e5] bg-white transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="px-5 py-5">
        <Link href="/handyworks" className="group block">
          <Image src="/handyworks-logo.png" alt="HandyPM" width={120} height={36} style={{ objectFit: "contain", filter: "brightness(0)" }} />
          <p className="mt-1 text-xs text-[#86868b]">제품개발·생산 프로젝트 관리</p>
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {orderedItems.map((item, index) => {
          const active = pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <div
              key={item.href}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition cursor-grab active:cursor-grabbing select-none ${
                active
                  ? "bg-[#f5f5f7] font-medium text-[#1d1d1f]"
                  : "font-normal text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
              }`}
            >
              <Icon size={16} className="shrink-0" />
              <Link href={item.href} draggable={false} className="flex-1" onClick={() => onClose?.()}>
                {item.label}
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-[#e5e5e5] px-3 py-4">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={saving}
              className="w-full rounded-lg border border-[#d1d1d6] px-1.5 py-0.5 text-sm font-medium text-[#1d1d1f] outline-none focus:border-[#86868b]"
            />
            <button onClick={handleSave} disabled={saving} className="shrink-0 text-[#1d1d1f] hover:text-[#86868b]">
              <Check size={14} />
            </button>
            <button onClick={() => setEditing(false)} disabled={saving} className="shrink-0 text-[#86868b] hover:text-[#1d1d1f]">
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="group flex items-center gap-1">
            <p className="truncate text-sm font-semibold text-[#1d1d1f]">{appUser?.name}</p>
            {isAdmin && (
              <button
                onClick={() => setEditing(true)}
                className="shrink-0 text-[#d1d1d6] opacity-0 transition group-hover:opacity-100 hover:text-[#86868b]"
              >
                <Pencil size={13} />
              </button>
            )}
          </div>
        )}
        <p className="truncate text-xs text-[#86868b]">{appUser?.email}</p>
        <button
          onClick={() => signOut()}
          className="mt-3 flex items-center gap-1.5 text-xs text-[#86868b] transition hover:text-red-500"
        >
          <LogOut size={13} /> 로그아웃
        </button>
      </div>
    </aside>
  );
}
