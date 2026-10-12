"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import Sidebar from "@/components/Sidebar";
import NotificationBell from "@/components/NotificationBell";
import GlobalSearch from "@/components/GlobalSearch";
import AddToHomeScreenBanner from "@/components/AddToHomeScreenBanner";
import SystemAlertBanner from "@/components/SystemAlertBanner";
import AiAssistantFab from "@/components/AiAssistantFab";
import { usePartnerZh } from "@/lib/i18n";

function TodayDate() {
  const isZh = usePartnerZh();
  const today = new Date();
  const formatted = today.toLocaleDateString(isZh ? "zh-CN" : "ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
  return <span className="text-sm text-[#86868b]">{formatted}</span>;
}

export default function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const { firebaseUser, appUser, loading } = useAuth();
  const isZh = usePartnerZh();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.replace("/login");
    }
  }, [loading, firebaseUser, router]);

  // 중국 협력사 계정이면 <html lang>을 zh-CN으로 바꿔, globals.css의 :lang(zh) 서체
  // 지정이 적용되게 한다(Pretendard가 한자 글리프를 자체 포함해 폴백이 안 일어나던 문제).
  useEffect(() => {
    document.documentElement.lang = isZh ? "zh-CN" : "ko";
    return () => { document.documentElement.lang = "ko"; };
  }, [isZh]);

  // html/body 기본 배경은 마케팅 사이트의 검정 히어로 섹션 오버스크롤 대응용(#000000)이라
  // 밝은 배경인 내부 앱 화면에서는 스크롤 바운스 시 검은 화면이 번쩍이는 원인이 된다.
  // 앱 레이아웃이 떠 있는 동안만 배경을 앱 배경색으로 덮어쓰고, 벗어나면 원복한다.
  useEffect(() => {
    document.documentElement.style.backgroundColor = "#f5f5f7";
    document.body.style.backgroundColor = "#f5f5f7";
    return () => {
      document.documentElement.style.backgroundColor = "";
      document.body.style.backgroundColor = "";
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="HANDYHAND" className="h-6 w-auto animate-pulse opacity-40" style={{ filter: "brightness(0)" }} />
      </div>
    );
  }

  if (!firebaseUser) return null;

  if (!appUser) {
    return (
      <div className="flex h-dvh items-center justify-center px-6 text-center text-sm text-[#86868b]">
        계정 권한 정보가 아직 설정되지 않았습니다. 관리자에게 문의해주세요.
      </div>
    );
  }

  return (
    <div className="flex h-dvh">
      {/* 모바일 backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 스크롤과 무관하게 화면에 완전히 고정 — 일반 플로우 요소로 두면 body 레벨 스크롤이
            생길 때 헤더까지 같이 밀려 올라가는 문제가 있어 position:fixed로 뷰포트에 고정한다. */}
        {/* 홈 화면에 추가한 iOS 앱(standalone)에서는 상태 표시줄이 웹 콘텐츠 위에 오버레이로
            그려져서, 안전영역 패딩이 없으면 검색/날짜/알림 아이콘 줄이 상태 표시줄과 겹친다 —
            pt로 그 높이만큼 밀어내고, h-14였던 실제 콘텐츠 줄은 그 아래 그대로 유지한다. */}
        <header
          className="fixed inset-x-0 top-0 z-20 flex h-14 shrink-0 items-center border-b border-[#e5e5e5] bg-white px-4 gap-3 md:left-56"
          style={{ height: "calc(env(safe-area-inset-top) + 3.5rem)", paddingTop: "env(safe-area-inset-top)" }}
        >
          <button
            className="rounded-lg p-1.5 text-[#86868b] hover:bg-[#f5f5f7] md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <GlobalSearch />
          <TodayDate />
          <NotificationBell />
        </header>
        <main
          className="no-scrollbar flex-1 overflow-y-auto bg-[#f5f5f7] px-4 pb-4 pt-[calc(env(safe-area-inset-top)+4.5rem)] md:px-6 md:pb-6 md:pt-[calc(env(safe-area-inset-top)+5.5rem)]"
        >
          <AddToHomeScreenBanner />
          <SystemAlertBanner />
          {children}
        </main>
      </div>
      <AiAssistantFab />
    </div>
  );
}
