"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import Sidebar from "@/components/Sidebar";
import NotificationBell from "@/components/NotificationBell";
import InquiryWidget from "@/components/InquiryWidget";

const PAGE_TITLES: Record<string, string> = {
  "/home": "홈",
  "/notices": "공지사항",
  "/clients": "클라이언트 관리",
  "/templates": "업무 템플릿",
  "/inquiries": "문의 관리",
  "/quotes": "견적 관리",
};

function usePageTitle() {
  const pathname = usePathname();
  if (!pathname) return "";
  const match = Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key));
  return match ? match[1] : "";
}

function TodayDate() {
  const today = new Date();
  const formatted = today.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
  return <span className="text-sm text-[#86868b]">{formatted}</span>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { firebaseUser, appUser, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pageTitle = usePageTitle();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.replace("/login");
    }
  }, [loading, firebaseUser, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="HANDYHAND" className="h-6 w-auto animate-pulse opacity-40" style={{ filter: "brightness(0)" }} />
      </div>
    );
  }

  if (!firebaseUser) return null;

  if (!appUser) {
    return (
      <div className="flex h-screen items-center justify-center px-6 text-center text-sm text-gray-500">
        계정 권한 정보가 아직 설정되지 않았습니다. 관리자에게 문의해주세요.
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* 모바일 backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center border-b border-[#e5e5e5] bg-white px-4 gap-3">
          <button
            className="rounded-lg p-1.5 text-[#86868b] hover:bg-[#f5f5f7] md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          {pageTitle && (
            <span className="text-sm font-semibold text-[#1d1d1f] md:hidden">{pageTitle}</span>
          )}
          <div className="flex-1" />
          <TodayDate />
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto bg-[#f5f5f7] p-4 md:p-6">{children}</main>
      </div>
      <InquiryWidget />
    </div>
  );
}
