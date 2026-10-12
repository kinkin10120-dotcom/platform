"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { zh, usePartnerZh } from "@/lib/i18n";

// 사이드바 메뉴 안에 묻혀 있으면 평소엔 눈에 안 띄어 활용률이 낮을 것 같다는 판단으로,
// 모든 화면 우측 하단에 떠 있는 단축 버튼을 추가한다. 비서 전용 화면을 새로 만들지 않고
// 기존 전체화면 챗(/organize, /admin-assistant)으로 그냥 이동만 시킨다. 비서가 없는
// 클라이언트 계정에는 보이지 않고, 이미 비서 화면에 들어와 있을 때는 스스로를 숨긴다
// (그 화면 자체의 입력창과 겹쳐 보일 필요가 없다).
export default function AiAssistantFab() {
  const { appUser } = useAuth();
  const pathname = usePathname();
  const isZh = usePartnerZh();

  const href = appUser?.role === "partner" ? "/organize" : appUser?.role === "admin" ? "/admin-assistant" : null;
  if (!href || pathname === href) return null;

  return (
    <Link
      href={href}
      title={zh(isZh, "AI 비서")}
      className="fixed right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-[#1d1d1f] text-white shadow-lg shadow-black/20 transition hover:bg-black active:scale-95 md:right-6"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
    >
      <Sparkles size={21} />
    </Link>
  );
}
