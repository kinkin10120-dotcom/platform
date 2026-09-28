"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutGrid, Building2, ListChecks, LogOut, Pencil, Check, X, Megaphone, MessageCircleQuestion, FileText, Bell, TrendingUp, ShoppingCart, FileSignature, Factory } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useState, useRef, useEffect } from "react";

type NavItem = { href: string; label: string; icon: React.ElementType; show: boolean };

// v3로 올려서, 예전에 드래그로 저장해둔 순서(v2)를 더 이상 읽지 않고 새 기본 순서부터
// 다시 시작하게 한다 — 기본 순서를 코드에서 바꿔도 각자 브라우저에 저장된 예전 순서가
// 그대로 우선 적용되어(loadOrder는 localStorage를 최우선으로 봄) 반영이 안 되는 것처럼
// 보였다. 드래그로 순서를 바꾸는 기능 자체는 그대로 유지된다.
const STORAGE_KEY = "sidebar-order-v3";

export default function Sidebar({ open = true, onClose }: { open?: boolean; onClose?: () => void }) {
  const { appUser, signOut, updateUserName } = useAuth();
  const pathname = usePathname();
  const isAdmin = appUser?.role === "admin";
  // 협력사(파트너) 계정 — 지정된 프로젝트만 보는 최소 권한이라, 발주·계약·문의 등 클라이언트
  // 전용 메뉴는 노출되면 안 된다(계약·견적 절대 비노출 요구사항).
  const isPartner = appUser?.role === "partner";
  const isClient = !isAdmin && !isPartner;

  const [editing, setEditing] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const allItems: NavItem[] = [
    { href: "/home", label: "홈", icon: LayoutGrid, show: true },
    { href: "/clients", label: "클라이언트 관리", icon: Building2, show: isAdmin },
    { href: "/partners", label: "협력사 관리", icon: Factory, show: isAdmin },
    { href: "/quotes", label: "견적 관리", icon: FileText, show: isAdmin },
    { href: "/inquiries", label: "문의 관리", icon: MessageCircleQuestion, show: isAdmin },
    { href: "/orders", label: "발주 관리", icon: ShoppingCart, show: isAdmin },
    { href: "/contracts", label: "계약 관리", icon: FileSignature, show: isAdmin },
    { href: "/schedule-report", label: "일정 변경 리포트", icon: TrendingUp, show: isAdmin },
    { href: "/templates", label: "업무 템플릿", icon: ListChecks, show: isAdmin },
    { href: "/my-orders", label: "발주하기", icon: ShoppingCart, show: isClient },
    { href: "/my-contracts", label: "계약", icon: FileSignature, show: isClient },
    { href: "/my-inquiries", label: "문의하기", icon: MessageCircleQuestion, show: isClient },
    { href: "/notification-settings", label: "알림 설정", icon: Bell, show: true },
    { href: "/notices", label: "공지사항", icon: Megaphone, show: true },
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
    if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSave();
    if (e.key === "Escape") setEditing(false);
  };

  return (
    <aside className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-56 shrink-0 flex-col border-r border-[#e5e5e5] bg-white transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="px-5 pb-4 pt-6">
        <Link href="/handyworks" className="group block">
          <Image src="/handyworks-logo.png" alt="HANDYWORKS" width={120} height={36} style={{ objectFit: "contain", filter: "brightness(0)" }} />
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-[#86868b]">
            제품개발·제조 올인원 플랫폼
          </p>
        </Link>
      </div>
      <div className="mx-5 border-t border-[#e5e5e5]" />

      <nav className="flex-1 space-y-0.5 px-3 pt-4">
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
                  ? "bg-[#1d1d1f] font-medium text-white"
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

      {!isAdmin && (
        <div className="relative px-6 pb-2">
          <button
            onClick={() => setDocsOpen((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-[#86868b] transition hover:text-[#1d1d1f]"
          >
            <FileText size={11} /> 핸디핸드 사업자 서류
          </button>
          {docsOpen && (
            <div className="absolute bottom-full left-6 mb-1.5 w-40 space-y-0.5 rounded-xl border border-[#e5e5e5] bg-white p-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
              <a
                href="https://firebasestorage.googleapis.com/v0/b/handyhand-a175a.firebasestorage.app/o/assets%2Fhandyhand-biz-reg-cert.pdf?alt=media"
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg px-2 py-1.5 text-xs text-[#1d1d1f] hover:bg-[#f5f5f7]"
              >
                사업자등록증
              </a>
              <a
                href="https://firebasestorage.googleapis.com/v0/b/handyhand-a175a.firebasestorage.app/o/assets%2Fhandyhand-bankbook.pdf?alt=media"
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg px-2 py-1.5 text-xs text-[#1d1d1f] hover:bg-[#f5f5f7]"
              >
                통장사본
              </a>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-[#e5e5e5] px-3 py-4">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1d1d1f] text-xs font-bold text-white">
            {(appUser?.name ?? "?").slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
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
        </div>
      </div>
    </aside>
  );
}
