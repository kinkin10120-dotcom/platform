"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, Menu, X, BarChart3, Sparkles, ScanSearch, CalendarDays, BellRing, MessageSquare, FileEdit, Video, FileSignature, UserPlus, Rocket, PackageCheck, Mail, ShieldCheck, Search, ChevronDown, ShoppingCart } from "lucide-react";
import { ContactModal } from "@/components/ContactModal";
import { HandyworksAnimation } from "@/components/HandyworksAnimation";
import { useAuth } from "@/lib/auth-context";

const FEATURES = [
  {
    icon: BarChart3,
    title: "실시간 프로젝트 대시보드",
    desc: "간트차트와 업무 리스트, 진행률을 한 화면에서 확인하고, 일정이 밀리면 뒤따르는 업무 일정도 자동으로 조정됩니다.",
    isNew: false,
  },
  {
    icon: Sparkles,
    title: "AI 프로젝트 진단",
    desc: "진행률과 지연 현황, 실제 코멘트를 근거로 AI가 일정 위험도를 짚어드립니다. 감이 아니라 데이터로 판단합니다.",
    isNew: true,
  },
  {
    icon: ScanSearch,
    title: "도면만 올리면 AI가 자동 분석",
    desc: "STEP·DXF·DWG 도면을 올리면 AI가 형상을 분석해 예상 제조 방법과 원가 수준을 알려드립니다.",
    isNew: true,
  },
  {
    icon: CalendarDays,
    title: "캘린더 자동 연동",
    desc: "구글·애플 캘린더에 구독 링크 한 번만 등록하면, 일정이 바뀔 때마다 자동으로 반영됩니다.",
    isNew: true,
  },
  {
    icon: ShieldCheck,
    title: "확인·승인 이력까지 자동 기록",
    desc: "확인이 필요한 사항은 요청으로 남기고, 누가 언제 무엇을 승인했는지 이력이 그대로 남습니다. 말이 바뀌는 구두 승인은 이제 없습니다.",
    isNew: true,
  },
  {
    icon: Search,
    title: "통합 검색",
    desc: "⌘K 한 번이면 프로젝트·업무·코멘트·첨부파일을 한 번에 검색합니다. 그 코멘트가 어디 달렸는지 더 이상 헤매지 않아도 됩니다.",
    isNew: true,
  },
  {
    icon: BellRing,
    title: "꼭 필요한 알림만",
    desc: "담당자 배정이나 마감 임박, 새 코멘트, 승인 요청을 이메일과 브라우저 푸시로 바로 알려드립니다. 알림 종류별로 켜고 꺼서 필요한 것만 받아보실 수 있습니다.",
    isNew: false,
  },
  {
    icon: MessageSquare,
    title: "견적부터 문의까지 한 곳에서",
    desc: "초기 견적 요청부터 계약 이후 문의까지, 모든 대화를 한 플랫폼에서 이어갑니다.",
    isNew: false,
  },
  {
    icon: FileSignature,
    title: "계약서 작성부터 전자서명까지",
    desc: "표·이미지까지 자유롭게 넣는 계약서 편집기로 문서를 만들어 보내면, 상대방은 로그인 없이 확인 후 전자서명으로 체결합니다. 서명 이력과 위변조 확인용 해시까지 자동 보관됩니다.",
    isNew: true,
  },
  {
    icon: ShoppingCart,
    title: "발주부터 청구까지 한 번에",
    desc: "제품 카탈로그에서 담아 발주를 넣으면 전자서명으로 확정되고, 계약금·잔금은 회차별로 나눠 발주서·청구서가 자동 발행됩니다.",
    isNew: true,
  },
  {
    icon: FileEdit,
    title: "견적서 확인부터 수락까지 한 번에",
    desc: "품목별 단가가 담긴 정식 견적서를 이메일로 받아보고, 그 자리에서 내용을 확인한 뒤 수락 여부를 알려주시면 바로 다음 단계로 진행됩니다.",
    isNew: true,
  },
  {
    icon: Mail,
    title: "매주 받아보는 프로젝트 요약",
    desc: "매주 월요일, 내 프로젝트의 마감 임박·지연 현황을 AI가 요약해 정리한 리포트를 이메일로 받아보실 수 있습니다.",
    isNew: true,
  },
];

const STEPS = [
  { step: "01", title: "견적 요청", desc: "홈페이지에서 제품 개요와 개발 단계를 입력해 견적을 요청하면, 정식 견적서를 받아보고 그 자리에서 확인 후 진행 여부를 결정하실 수 있습니다.", icon: FileEdit },
  { step: "02", title: "첫 미팅", desc: "대면 또는 화상으로 핸디핸드와 제품 방향, 일정, 예산을 구체적으로 논의합니다.", icon: Video },
  { step: "03", title: "계약 체결", desc: "논의된 범위와 일정을 바탕으로 정식 계약을 체결합니다.", icon: FileSignature },
  { step: "04", title: "HANDYWORKS 계정 발급", desc: "계약 후 핸디핸드가 클라이언트 전용 계정을 만들면, 이메일로 비밀번호 설정 링크와 간단한 사용법이 자동으로 발송됩니다.", icon: UserPlus },
  { step: "05", title: "프로젝트 시작", desc: "로그인 후 프로젝트 일정·업무·공지를 실시간으로 함께 확인합니다.", icon: Rocket },
  { step: "06", title: "납품까지 투명하게", desc: "계약 이후 진행되는 모든 생산 과정을 플랫폼 안에서 그대로 추적합니다.", icon: PackageCheck },
];

const OLD_WAY = [
  "메신저·이메일로 파편화된 소통",
  "진행 상황을 매번 물어봐야 함",
  "파일 버전 관리 혼란",
  "구두 승인이라 나중에 말이 바뀜",
  "담당자 부재 시 업무 공백",
  "마감일을 따로 캘린더에 옮겨 적어야 함",
  "코멘트·파일을 어디 뒀는지 못 찾음",
];

const NEW_WAY = [
  "하나의 플랫폼에서 모든 소통",
  "실시간으로 현황 확인 가능",
  "파일·버전 이력 자동 기록",
  "확인/승인 요청·처리 이력 기록",
  "팀 전체가 현황을 공유",
  "캘린더 구독으로 마감일 자동 동기화",
  "통합 검색으로 바로 찾기",
];

function AnimatedStat({ target, suffix = "", label }: { target: number; suffix?: string; label: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const duration = 1100;
    const steps = 30;
    const intervalMs = duration / steps;
    let current = 0;
    let timer: ReturnType<typeof setInterval>;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          timer = setInterval(() => {
            current += 1;
            const value = Math.min(target, Math.round((current / steps) * target));
            setDisplay(value);
            if (current >= steps) clearInterval(timer);
          }, intervalMs);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => { observer.disconnect(); clearInterval(timer); };
  }, [target]);

  return (
    <div ref={ref} className="text-center">
      <p className="text-3xl font-bold text-white sm:text-4xl">{display < target ? display : `${target}${suffix}`}</p>
      <p className="mt-1 text-xs text-white/40">{label}</p>
    </div>
  );
}

const FAQS = [
  { q: "기존에 진행 중이던 프로젝트도 옮길 수 있나요?", a: "네, 진행 중인 프로젝트도 언제든 등록해서 이어서 관리할 수 있습니다. 핸디핸드에 요청해주시면 됩니다." },
  { q: "클라이언트도 별도로 가입해야 하나요?", a: "아니요. 계약 후 핸디핸드가 계정을 만들면 이메일로 초대 링크가 발송되고, 비밀번호만 설정하면 바로 이용하실 수 있습니다." },
  { q: "모바일에서도 사용할 수 있나요?", a: "네, 별도 앱 설치 없이 PC·태블릿·모바일 어디서든 브라우저로 바로 접속됩니다." },
  { q: "알림은 어떻게 오나요?", a: "이메일과 브라우저 푸시 알림으로 받아보실 수 있고, 업무 배정·마감 임박 등 알림 종류별로 켜고 끌 수 있습니다." },
  { q: "파일이나 도면은 안전하게 보관되나요?", a: "네, 프로젝트별로 접근 권한이 분리되어 있어 해당 프로젝트 관계자만 파일을 볼 수 있습니다." },
  { q: "이용 비용이 따로 드나요?", a: "아니요. 핸디핸드와 프로젝트를 진행하는 고객사라면 별도 비용 없이 이용하실 수 있습니다." },
];

export default function HandyPMPage() {
  const [contactOpen, setContactOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { firebaseUser } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const liveShotVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const tryPlay = () => v.play().catch(() => {});

    tryPlay();
    v.addEventListener("loadeddata", tryPlay);
    document.addEventListener("visibilitychange", tryPlay);

    const onFirstInteraction = () => {
      tryPlay();
      window.removeEventListener("touchstart", onFirstInteraction);
      window.removeEventListener("click", onFirstInteraction);
    };
    window.addEventListener("touchstart", onFirstInteraction, { once: true, passive: true });
    window.addEventListener("click", onFirstInteraction, { once: true });

    return () => {
      v.removeEventListener("loadeddata", tryPlay);
      document.removeEventListener("visibilitychange", tryPlay);
      window.removeEventListener("touchstart", onFirstInteraction);
      window.removeEventListener("click", onFirstInteraction);
    };
  }, []);

  useEffect(() => {
    const v = liveShotVideoRef.current;
    if (!v) return;

    const tryPlay = () => v.play().catch(() => {});

    // 네이티브 loop는 끝-처음 경계에서 브라우저가 재탐색하며 검은 프레임이 튀는
    // 경우가 있어, 끝나기 직전 미리 0초로 되감아 그 경계를 아예 건너뛴다.
    const onTimeUpdate = () => {
      if (v.duration && v.currentTime >= v.duration - 0.2) {
        v.currentTime = 0;
        tryPlay();
      }
    };

    tryPlay();
    v.addEventListener("loadeddata", tryPlay);
    v.addEventListener("timeupdate", onTimeUpdate);
    document.addEventListener("visibilitychange", tryPlay);

    const onFirstInteraction = () => {
      tryPlay();
      window.removeEventListener("touchstart", onFirstInteraction);
      window.removeEventListener("click", onFirstInteraction);
    };
    window.addEventListener("touchstart", onFirstInteraction, { once: true, passive: true });
    window.addEventListener("click", onFirstInteraction, { once: true });

    return () => {
      v.removeEventListener("loadeddata", tryPlay);
      v.removeEventListener("timeupdate", onTimeUpdate);
      document.removeEventListener("visibilitychange", tryPlay);
      window.removeEventListener("touchstart", onFirstInteraction);
      window.removeEventListener("click", onFirstInteraction);
    };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* 네비게이션 */}
      <nav className="fixed top-[calc(1rem+env(safe-area-inset-top))] z-50 w-full px-4 sm:px-8 [transform:translateZ(0)] [will-change:transform]">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between rounded-full border border-[#e5e5e5] bg-white/90 px-5 py-2.5 backdrop-blur-xl">
            <Link href="/handyworks">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/handyworks-logo.png" alt="HANDYWORKS" className="h-4 w-auto sm:h-5" style={{ filter: "brightness(0)" }} />
            </Link>
            <div className="hidden items-center gap-5 sm:flex">
              <a href="#why" className="text-sm text-[#86868b] transition hover:text-[#1d1d1f]">차별점</a>
              <a href="#features" className="text-sm text-[#86868b] transition hover:text-[#1d1d1f]">주요 기능</a>
              <a href="#screens" className="text-sm text-[#86868b] transition hover:text-[#1d1d1f]">실제 화면</a>
              <a href="#how" className="text-sm text-[#86868b] transition hover:text-[#1d1d1f]">시작하는 방법</a>
            </div>
            <div className="hidden items-center gap-1.5 sm:flex">
              <Link href="/" className="min-w-[126px] text-center rounded-full bg-[#1d1d1f] px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-[#3a3a3a]">
                HANDYHAND ↗
              </Link>
              <Link href={firebaseUser ? "/home" : "/login"} className="min-w-[92px] text-center rounded-full bg-[#1d1d1f] px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-[#3a3a3a]">
                {firebaseUser ? "대시보드" : "로그인"}
              </Link>
            </div>
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="메뉴 열기"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#1d1d1f] transition hover:bg-[#f5f5f7] sm:hidden"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>

          {mobileMenuOpen && (
            <div
              className="mt-2 overflow-hidden rounded-3xl border border-[#e5e5e5] bg-white/95 p-2 backdrop-blur-xl sm:hidden"
              style={{ animation: "menuFadeIn 0.2s ease forwards" }}
            >
              {[
                { label: "차별점", href: "#why" },
                { label: "주요 기능", href: "#features" },
                { label: "실제 화면", href: "#screens" },
                { label: "시작하는 방법", href: "#how" },
              ].map((item, i) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 border-b border-black/[0.04] px-4 py-3.5 text-sm text-[#1d1d1f] transition hover:bg-[#f5f5f7]"
                >
                  <span className="text-xs font-medium text-[#c7c7cc]">{String(i + 1).padStart(2, "0")}</span>
                  {item.label}
                </a>
              ))}
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3.5 text-sm text-[#1d1d1f] transition hover:bg-[#f5f5f7]"
              >
                <span className="text-xs font-medium text-[#c7c7cc]">05</span>
                HANDYHAND ↗
              </Link>
              <div className="mt-1 flex gap-2 border-t border-black/[0.04] pt-2">
                <Link
                  href={firebaseUser ? "/home" : "/login"}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 rounded-2xl bg-[#1d1d1f] py-3 text-center text-sm font-semibold text-white transition hover:bg-black"
                >
                  {firebaseUser ? "대시보드" : "로그인"}
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* 히어로 */}
      <section className="relative flex flex-col items-center justify-center px-6 pt-20 text-center bg-black overflow-hidden sm:pt-24" style={{ minHeight: "100lvh" }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          disablePictureInPicture
          preload="auto"
          poster="/hero-video-handyworks-poster.jpg"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ WebkitPlaysinline: true } as React.CSSProperties}
        >
          <source src="/hero-video-handyworks.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/70" />
        <div className="relative z-10">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-white/30">HANDYHAND × HANDYWORKS</p>
          <h1 className="mb-6 text-4xl font-bold leading-tight text-white sm:text-5xl md:text-6xl">
            제조 파트너와<br />
            <span className="text-white/40">진짜로 연결되는</span> 방법
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-base leading-relaxed text-white/50">
            메신저와 이메일로 흩어지던 소통을 한 곳으로,<br className="sm:hidden" />
            견적부터 납품까지, 모든 과정을 HANDYWORKS에서 확인해보세요.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href={firebaseUser ? "/home" : "/login"} className="rounded-full bg-white px-8 py-3 text-sm font-semibold text-black transition hover:bg-white/90">
              {firebaseUser ? "대시보드로 이동 →" : "HANDYWORKS 시작하기 →"}
            </Link>
          </div>
          <p className="mt-6 text-sm text-white/30">
            제조 방법부터 막막하다면{" "}
            <Link href="/ai-analysis" className="text-white/60 underline underline-offset-4 transition hover:text-white">
              AI 무료 분석 먼저 해보기 →
            </Link>
          </p>
          {/* 핸디핸드 홈 히어로의 하단 통계 블록과 높이를 맞춰, 세로 중앙정렬 시
              타이틀 위쪽 여백이 홈페이지와 동일하게 보이도록 하는 투명 스페이서 */}
          <div aria-hidden className="mt-12 h-11 sm:mt-24 sm:h-14" />
        </div>
      </section>

      {/* 기존 방식 vs HANDYWORKS */}
      <section id="why" className="bg-[#f5f5f7] px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <p className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Why HANDYWORKS
            </p>
            <h2 className="text-3xl font-bold text-[#1d1d1f] sm:text-4xl">무엇이 다른가요?</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-[#86868b] sm:text-base">메신저와 메일로 흩어지던 소통을, 한 화면에서 기록하고 관리하는 방식으로 바꿨습니다.</p>
          </div>

          <div className="mx-auto max-w-5xl">
            <div className="mb-3 hidden grid-cols-2 gap-6 px-1 sm:grid">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#86868b]">일반 개발업체</p>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">HANDYWORKS</p>
            </div>
            <div className="divide-y divide-[#e5e5e5]">
              {OLD_WAY.map((item, i) => (
                <div key={item} className="grid grid-cols-1 gap-2 py-4 sm:grid-cols-2 sm:gap-6">
                  <div className="flex items-center gap-3">
                    <XCircle size={16} className="shrink-0 text-[#d1d1d6]" />
                    <span className="text-sm text-[#86868b] line-through decoration-[#d1d1d6]">{item}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={16} className="shrink-0 text-[#1d1d1f]" />
                    <span className="text-sm font-medium text-[#1d1d1f]">{NEW_WAY[i]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 실적 */}
      <section className="relative overflow-hidden bg-[#1d1d1f] px-6 py-16 sm:py-20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/track-record-bg.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(29,29,31,0.55) 0%, rgba(29,29,31,0.75) 45%, #1d1d1f 100%)" }}
        />
        <div className="relative mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <p className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/40">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Track Record
            </p>
            <h2 className="text-3xl font-bold text-white sm:text-4xl">프로젝트 수로 증명해온 핸디핸드가 만든 플랫폼.</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/50 sm:text-base">
              수백 개 프로젝트를 진행하며 쌓은 노하우를 HANDYWORKS에 그대로 담았습니다.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-y-10 gap-6">
            <AnimatedStat target={300} suffix="+" label="누적 개발 제품" />
            <AnimatedStat target={30} suffix="+" label="국내외 협력 브랜드사" />
            <AnimatedStat target={40} suffix="+" label="년 설계 경력" />
          </div>
        </div>
      </section>

      {/* 주요 기능 */}
      <section id="features" className="bg-white px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <p className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Features
            </p>
            <h2 className="text-3xl font-bold text-[#1d1d1f] sm:text-4xl">주요 기능</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-[#86868b] sm:text-base">일정 관리부터 승인, AI 분석까지 프로젝트 진행에 필요한 기능을 한 곳에 담았습니다.</p>
          </div>

          <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-4 border-t border-[#e5e5e5] pt-6">
                <f.icon size={20} className="mt-0.5 shrink-0 text-[#1d1d1f]" />
                <div>
                  <div className="mb-1.5 flex items-center gap-2">
                    <h3 className="text-base font-bold text-[#1d1d1f]">{f.title}</h3>
                    {f.isNew && (
                      <span className="rounded-full bg-[#1d1d1f] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                        New
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-[#86868b]">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 실제 화면 */}
      <section id="screens" className="bg-[#f5f5f7] px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center sm:mb-16">
            <p className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Real Screens
            </p>
            <h2 className="text-3xl font-bold text-[#1d1d1f] sm:text-4xl">실제 서비스 화면입니다</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-[#86868b] sm:text-base">현재 클라이언트가 실제로 사용하고 있는<br className="sm:hidden" />HANDYWORKS 화면입니다.</p>
          </div>

          <div style={{ filter: "drop-shadow(0 30px 60px rgba(0,0,0,0.35)) drop-shadow(0 8px 20px rgba(0,0,0,0.25))" }}>
            <div className="overflow-hidden rounded-xl sm:rounded-2xl">
              <div className="flex items-center gap-1.5 bg-[#e5e5e5] px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              </div>
              <div className="relative overflow-hidden rounded-b-xl sm:rounded-b-2xl" style={{ paddingTop: "62.5%" }}>
                <video
                  ref={liveShotVideoRef}
                  autoPlay
                  muted
                  loop
                  playsInline
                  disablePictureInPicture
                  preload="auto"
                  className="absolute inset-0 h-full w-full rounded-b-xl object-cover sm:rounded-b-2xl"
                >
                  <source src="/handyworks-live-demo.mp4" type="video/mp4" />
                </video>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 모든 기기에서 사용 가능 */}
      <section
        className="relative overflow-hidden border-y border-white/10 px-6 py-16 sm:py-24"
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, #1c1c1e 0%, #000000 70%)" }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.12) 1.5px, transparent 1.5px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(ellipse 85% 95% at 50% 50%, black 20%, transparent 85%)",
            WebkitMaskImage: "radial-gradient(ellipse 85% 95% at 50% 50%, black 20%, transparent 85%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/40">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Any Device
          </p>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">PC, 태블릿, 모바일에서 모두 사용 가능합니다</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/55 sm:text-base">별도 앱 설치 없이 브라우저로 바로 접속합니다.</p>
        </div>
        <div className="relative mx-auto mt-12 max-w-3xl">
          <HandyworksAnimation />
        </div>
      </section>

      {/* 사용 흐름 */}
      <section id="how" className="bg-white px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <p className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              How it works
            </p>
            <h2 className="text-3xl font-bold text-[#1d1d1f] sm:text-4xl">다음과 같은 순서로 진행됩니다</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-[#86868b] sm:text-base">견적 요청부터 양산까지, 끊김없이 하나의 플랫폼 안에서 이어집니다.</p>
          </div>

          <div className="relative">
            {/* 1행(1~3)과 2행(4~6) 사이를 잇는 연결선 — 전체가 하나의 흐름이라는 걸
                그리드가 두 줄로 꺾이는 지점에서도 눈으로 이어 보이게 한다. */}
            <div className="pointer-events-none absolute left-1/2 top-[8.5rem] hidden h-14 w-px -translate-x-1/2 bg-[#d1d1d6] lg:block" />
            <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-y-14">
              {STEPS.map((s, i) => (
                <div key={s.step} className="relative lg:px-5">
                  {i < STEPS.length - 1 && (i + 1) % 3 !== 0 && (
                    <div className="absolute right-0 top-6 hidden w-8 border-t border-[#d1d1d6] lg:block" />
                  )}
                  <div className="relative z-10 mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#1d1d1f]">
                    <s.icon size={18} className="text-white" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-[#86868b]">STEP {s.step}</span>
                  <h3 className="mb-2 mt-1 font-bold text-[#1d1d1f]">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-[#86868b]">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-[#f5f5f7] px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <p className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              FAQ
            </p>
            <h2 className="text-3xl font-bold text-[#1d1d1f] sm:text-4xl">자주 묻는 질문</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            {FAQS.map((f, i) => (
              <div
                key={f.q}
                className={`overflow-hidden rounded-2xl border bg-white transition-all sm:rounded-3xl ${
                  openFaq === i ? "border-[#1d1d1f]" : "border-[#e5e5e5]"
                }`}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
                >
                  <span className="flex-1 text-sm font-semibold text-[#1d1d1f] sm:text-base">{f.q}</span>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 transition-transform ${openFaq === i ? "rotate-180 text-[#1d1d1f]" : "text-[#86868b]"}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="border-t border-[#f0f0f0] px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
                    <p className="text-sm leading-relaxed text-[#4a4a4c]">{f.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-[#1d1d1f] px-6 py-20 text-center sm:py-24">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.12) 1.5px, transparent 1.5px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(ellipse 85% 95% at 50% 50%, black 20%, transparent 85%)",
            WebkitMaskImage: "radial-gradient(ellipse 85% 95% at 50% 50%, black 20%, transparent 85%)",
          }}
        />
        <div className="relative">
          <p className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/30">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Get Started
          </p>
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">시작할 준비가 됐나요?</h2>
          <p className="mb-10 text-[#86868b]">견적을 요청하시면 핸디핸드가 HANDYWORKS 계정을 함께 안내해드립니다.</p>
          <div className="flex justify-center">
            <div className="inline-flex flex-col gap-3 sm:flex-row">
              <button onClick={() => setContactOpen(true)} className="rounded-full bg-white px-8 py-3 text-center text-sm font-semibold text-black transition hover:bg-white/90">
                문의하기 →
              </button>
              <Link href={firebaseUser ? "/home" : "/login"} className="rounded-full border border-white/20 px-8 py-3 text-center text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5">
                {firebaseUser ? "대시보드로 이동" : "이미 계정이 있으신가요?"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="border-t border-white/10 bg-black px-6 py-12 text-center text-xs text-white/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="HANDYHAND" className="mx-auto mb-4 h-5 w-auto" />
        <p className="mt-1 leading-relaxed">
          주식회사 핸디핸드 · 대표자 최형준 · 사업자등록번호 128-87-00105
        </p>
        <p className="mt-1 leading-relaxed">
          통신판매업 신고번호 2020-고양덕양구-1900
        </p>
        <p className="mt-1 leading-relaxed">
          경기도 고양시 덕양구 삼원로63 고양아크비즈지식산업센터 F804호
        </p>
        <p className="mt-1">Tel. 070-8835-2311 · handyhand91@naver.com</p>
        <div className="mt-4 flex items-center justify-center gap-4">
          <Link href="/privacy" className="underline underline-offset-2 hover:text-white/60 transition">개인정보처리방침</Link>
          <span>·</span>
          <Link href="/terms" className="underline underline-offset-2 hover:text-white/60 transition">이용약관</Link>
        </div>
        <p className="mt-4">© 2026 HANDYHAND. All rights reserved.</p>
      </footer>

      {/* 플로팅 문의 버튼 */}
      <button
        onClick={() => setContactOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-white px-4 py-3 text-xs font-semibold text-black shadow-lg transition hover:bg-white/90 hover:shadow-xl"
      >
        <Mail size={15} />
        문의하기
      </button>

      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}
    </div>
  );
}
