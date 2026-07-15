"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { QuoteModal } from "@/components/QuoteModal";
import { CadAnalysisModal } from "@/components/CadAnalysisModal";
import { ContactModal } from "@/components/ContactModal";
import { AiDemoAnimation } from "@/components/AiDemoAnimation";
import { HandyworksAnimation } from "@/components/HandyworksAnimation";
import { Landmark, Rocket, Megaphone, RefreshCw, Menu, X } from "lucide-react";

function AnimatedYearStat() {
  const startYear = new Date().getFullYear();
  const endYear = 2013;
  const [display, setDisplay] = useState(startYear);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const steps = startYear - endYear;
    const duration = 2600;
    const intervalMs = duration / steps;
    let current = startYear;
    let timer: ReturnType<typeof setInterval>;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          timer = setInterval(() => {
            current -= 1;
            setDisplay(current);
            if (current <= endYear) clearInterval(timer);
          }, intervalMs);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => { observer.disconnect(); clearInterval(timer); };
  }, [startYear]);

  return (
    <div ref={ref}>
      <p className="text-xl font-bold text-white sm:text-4xl">{display}</p>
      <p className="mt-1 text-[10px] uppercase tracking-widest text-white/30 sm:text-xs">설립연도</p>
    </div>
  );
}

function AnimatedProductStat() {
  const target = 400;
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const duration = 2400;
    const intervalMs = duration / target;
    let current = 0;
    let timer: ReturnType<typeof setInterval>;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          timer = setInterval(() => {
            current += 1;
            setDisplay(current);
            if (current >= target) clearInterval(timer);
          }, intervalMs);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => { observer.disconnect(); clearInterval(timer); };
  }, []);

  return (
    <div ref={ref}>
      <p className="text-xl font-bold text-white sm:text-4xl">{display < target ? display : `${target}+`}</p>
      <p className="mt-1 text-[10px] uppercase tracking-widest text-white/30 sm:text-xs">누적 개발 제품</p>
    </div>
  );
}

function AnimatedPartnerStat() {
  const target = 50;
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const duration = 2200;
    const intervalMs = duration / target;
    let current = 0;
    let timer: ReturnType<typeof setInterval>;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          timer = setInterval(() => {
            current += 1;
            setDisplay(current);
            if (current >= target) clearInterval(timer);
          }, intervalMs);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => { observer.disconnect(); clearInterval(timer); };
  }, []);

  return (
    <div ref={ref}>
      <p className="text-xl font-bold text-white sm:text-4xl">{display < target ? display : `${target}+`}</p>
      <p className="mt-1 text-[10px] uppercase tracking-widest text-white/30 sm:text-xs">국내외 파트너사</p>
    </div>
  );
}

function Reveal({
  children,
  className = "",
  delay = 0,
  y = 24,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : `translateY(${y}px)`,
        transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function PortfolioImageSlider({ images, height = "h-36 sm:h-48" }: { images: string[], height?: string }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(() => setCurrent((c) => (c + 1) % images.length), 2500);
    return () => clearInterval(timer);
  }, [images.length]);

  return (
    <div className={`relative w-full bg-[#f5f5f7] overflow-hidden ${height}`}>
      {images.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} src={src} alt="" className={`absolute inset-0 z-10 h-full w-full object-cover transition-opacity duration-700 ${i === current ? "opacity-100" : "opacity-0"}`}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
      ))}
      {images.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 z-20 flex justify-center gap-1">
          {images.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`h-1 rounded-full transition-all ${i === current ? "w-4 bg-white" : "w-1 bg-white/50"}`} />
          ))}
        </div>
      )}
    </div>
  );
}


export default function RootPage() {
  const { firebaseUser, loading } = useAuth();
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quotePrefill, setQuotePrefill] = useState<string>("");
  const [cadOpen, setCadOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="relative flex h-screen items-center justify-center overflow-hidden bg-black">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(241,206,0,0.12) 0%, transparent 70%)", filter: "blur(40px)" }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="HANDYHAND" className="relative h-7 w-auto animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f]">

      {/* 네비게이션 */}
      <nav className="fixed top-4 z-50 w-full px-4 sm:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between rounded-full border border-white/15 bg-black/70 px-5 py-2.5 backdrop-blur-xl">
            <Link href="/">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="HANDYHAND" className="h-4 w-auto sm:h-5" />
            </Link>
            <div className="hidden items-center gap-5 sm:flex">
              <Link href="/about" className="text-sm text-white/55 transition hover:text-white">기업소개</Link>
              <a href="#services" className="text-sm text-white/55 transition hover:text-white">서비스</a>
              <a href="#portfolio" className="text-sm text-white/55 transition hover:text-white">개발사례</a>
              <a href="#ai-analysis" className="text-sm text-white/55 transition hover:text-white">AI 제조분석</a>
              <Link href="/process" className="text-sm text-white/55 transition hover:text-white">프로세스</Link>
              <button onClick={() => setContactOpen(true)} className="text-sm text-white/55 transition hover:text-white">문의하기</button>
            </div>
            <div className="flex items-center gap-1.5">
              <Link href="/handyworks" className="min-w-[126px] text-center rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-black transition hover:bg-white/90 hidden sm:block">
                HANDYWORKS ↗
              </Link>
              <button
                onClick={() => setQuoteOpen(true)}
                className="hidden rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-black transition hover:bg-white/90 sm:block"
              >
                견적 요청
              </button>
              <button
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label="메뉴 열기"
                className="flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-white/10 sm:hidden"
              >
                {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div
              className="mt-2 overflow-hidden rounded-3xl border border-white/15 bg-black/90 p-2 backdrop-blur-xl sm:hidden"
              style={{ animation: "menuFadeIn 0.2s ease forwards" }}
            >
              <Link href="/about" onClick={() => setMobileMenuOpen(false)} className="block rounded-2xl px-4 py-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white">기업소개</Link>
              <a href="#services" onClick={() => setMobileMenuOpen(false)} className="block rounded-2xl px-4 py-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white">서비스</a>
              <a href="#portfolio" onClick={() => setMobileMenuOpen(false)} className="block rounded-2xl px-4 py-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white">개발사례</a>
              <a href="#ai-analysis" onClick={() => setMobileMenuOpen(false)} className="block rounded-2xl px-4 py-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white">AI 제조분석</a>
              <Link href="/process" onClick={() => setMobileMenuOpen(false)} className="block rounded-2xl px-4 py-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white">프로세스</Link>
              <button onClick={() => { setMobileMenuOpen(false); setContactOpen(true); }} className="block w-full rounded-2xl px-4 py-3 text-left text-sm text-white/70 transition hover:bg-white/10 hover:text-white">문의하기</button>
              <Link href="/handyworks" onClick={() => setMobileMenuOpen(false)} className="block rounded-2xl px-4 py-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white">HANDYWORKS ↗</Link>
              <div className="mt-1 border-t border-white/10 pt-2">
                <button
                  onClick={() => { setMobileMenuOpen(false); setQuoteOpen(true); }}
                  className="block w-full rounded-2xl bg-white px-4 py-3 text-center text-sm font-semibold text-black transition hover:bg-white/90"
                >
                  견적 요청
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* 히어로 */}
      <section className="relative flex flex-col items-center justify-center bg-black px-5 pt-20 text-center overflow-hidden sm:px-6 sm:pt-24" style={{ minHeight: "100lvh" }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          disablePictureInPicture
          className="absolute inset-0 h-full w-full object-cover"
          style={{ WebkitPlaysinline: true } as React.CSSProperties}
        >
          <source src="https://videos.pexels.com/video-files/4941465/4941465-hd_1920_1080_25fps.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/65" />

        <div className="relative z-10 flex flex-col items-center text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-white/40 sm:mb-5">
            Total Product Solution
          </p>
          <h1 className="mb-5 text-3xl font-bold leading-tight tracking-tight text-white sm:mb-6 sm:text-5xl md:text-6xl lg:text-7xl">
            제조, 더 이상<br />
            <span className="text-white/50">혼자 해결하지 않아도 됩니다.</span>
          </h1>
          <p className="mb-8 max-w-lg text-sm leading-relaxed text-white/50 sm:mb-10 sm:text-lg">
            아이디어가 제품이 되는 가장 확실한 방법.
          </p>
          <div className="flex w-full max-w-xs flex-col gap-2.5 sm:w-auto sm:max-w-none sm:flex-row sm:gap-3">
            <button
              onClick={() => setQuoteOpen(true)}
              className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              무료 견적 요청
            </button>
            <a
              href="#ai-analysis"
              className="rounded-full border border-white/20 px-7 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5"
            >
              무료 AI 제조분석 해보기
            </a>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-4 border-t border-white/10 pt-8 text-center sm:mt-24 sm:gap-16 sm:pt-12">
            <AnimatedYearStat />
            <AnimatedPartnerStat />
            <AnimatedProductStat />
          </div>
        </div>
      </section>

      {/* 이런 분들과 함께합니다 */}
      <section className="bg-[#f5f5f7] px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-8 sm:mb-10">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#86868b]">Who We Work With</p>
            <h2 className="text-3xl font-bold text-[#1d1d1f] sm:text-4xl">이런 분들과 함께합니다.</h2>
          </Reveal>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {[
              { tag: "정부지원사업", title: "창업도약패키지·TIPS·R&D 수혜 기업", desc: "정부 지원 예산으로 제품 개발이 필요한 기업. 사업계획서 연계 개발 경험이 풍부합니다.", icon: Landmark },
              { tag: "스타트업 · 초기창업", title: "제조 경험 없는 창업자", desc: "아이디어·기획은 있지만 공장·금형·양산을 처음 접하는 팀. 처음부터 끝까지 같이 갑니다.", icon: Rocket },
              { tag: "크라우드펀딩", title: "와디즈·킥스타터 런칭 준비 중인 팀", desc: "펀딩 성공을 위한 제품 개발부터 페이지 제작, 양산까지 원스탑으로 진행합니다.", icon: Megaphone },
              { tag: "리뉴얼·개선", title: "기존 제품 리뉴얼이 필요한 브랜드", desc: "이미 판매 중인 제품의 품질·원가·디자인을 개선하고 싶은 브랜드. 기존 제품 분석부터 개선안까지 함께합니다.", icon: RefreshCw },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 90}>
                <div className="group relative h-full overflow-hidden rounded-2xl bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(0,0,0,0.08)] sm:rounded-3xl sm:p-7">
                  <span className="pointer-events-none absolute -right-2 -top-4 select-none text-7xl font-black leading-none text-black/[0.04] transition-colors duration-300 group-hover:text-black/[0.06] sm:text-8xl">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f5f5f7] transition-colors duration-300 group-hover:bg-[#1d1d1f]">
                    <item.icon size={20} strokeWidth={1.75} className="text-[#1d1d1f] transition-colors duration-300 group-hover:text-white" />
                  </div>
                  <span className="relative mt-4 inline-block rounded-full bg-[#f5f5f7] px-2.5 py-0.5 text-xs font-medium text-[#86868b]">{item.tag}</span>
                  <h3 className="relative mt-3 text-sm font-bold text-[#1d1d1f] sm:text-base">{item.title}</h3>
                  <p className="relative mt-1.5 text-xs leading-relaxed text-[#86868b]">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 마르키 */}
      <div className="overflow-hidden border-y border-white/10 bg-black py-5">
        <div className="animate-marquee flex items-center">
          {[...Array(5)].map((_, i) =>
            ["기획", "설계", "금형 제작", "양산", "브랜딩", "크라우드펀딩", "OEM · ODM", "상세페이지 제작", "제조 소싱", "원스탑 개발", "와디즈 런칭", "정부지원사업 연계"].map((item, idx) => (
              <span key={`${i}-${item}`} className="flex items-center">
                <span className={idx % 3 === 0 ? "mx-4 text-base font-semibold text-white sm:mx-5" : "mx-4 text-sm font-normal text-white/35 sm:mx-5"}>
                  {item}
                </span>
                <span className="text-xs text-white/15">·</span>
              </span>
            ))
          )}
        </div>
      </div>

      {/* 서비스 */}
      <section
        id="services"
        className="relative scroll-mt-24 overflow-hidden bg-black px-5 sm:px-6"
      >
        {/* 은은한 radial glow (상/하) */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 45% at 50% 0%, rgba(255,255,255,0.07) 0%, transparent 65%), radial-gradient(ellipse 90% 45% at 50% 100%, rgba(255,255,255,0.07) 0%, transparent 65%)",
          }}
        />
        {/* 은은한 도트 그리드 텍스처 */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.32) 1.5px, transparent 1.5px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(ellipse 85% 95% at 50% 50%, black 20%, transparent 85%)",
            WebkitMaskImage: "radial-gradient(ellipse 85% 95% at 50% 50%, black 20%, transparent 85%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl py-16 sm:py-24">
          <Reveal className="mb-10 flex items-end justify-between sm:mb-14">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/40">Services</p>
              <h2 className="text-3xl font-bold text-white sm:text-4xl">처음부터 끝까지.</h2>
            </div>
            <Link href="/service" className="hidden text-sm text-white/40 transition hover:text-white sm:block">
              전체 서비스 보기 →
            </Link>
          </Reveal>
          <div className="divide-y divide-white/10 border-t border-white/10">
            {[
              { num: "01", title: "원스탑 제품 개발", tag: "Development", desc: "기획부터 납품까지 전 과정을 핸디핸드 하나로.", href: "/process" },
              { num: "02", title: "제조 소싱 & 관리 대행", tag: "Partnership", desc: "최적의 공장을 찾고, 전담 PM이 생산 전 과정을 직접 관리합니다.", href: "/service" },
              { num: "03", title: "브랜딩 패키지", tag: "Branding", desc: "제품이 팔리는 브랜드를 처음부터 함께 만듭니다.", href: "/service" },
              { num: "04", title: "크라우드펀딩 런칭", tag: "Crowdfunding", desc: "와디즈 파트너스·펀딩플래너 출신 · 개발부터 런칭까지 원스탑.", href: "/service" },
            ].map((s, i) => (
              <Reveal key={s.num} delay={i * 80}>
                <Link
                  href={s.href}
                  className="group flex items-center gap-5 py-7 -mx-5 px-5 sm:-mx-6 sm:px-6 transition-colors duration-200 hover:bg-white/8 sm:py-9"
                >
                  <span className="w-7 shrink-0 text-xs font-medium tabular-nums text-white/30 transition-colors duration-200 group-hover:text-white">{s.num}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-semibold text-white sm:text-2xl">{s.title}</p>
                    <p className="mt-1 text-sm text-white/50">{s.desc}</p>
                  </div>
                  <span className="hidden shrink-0 rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-medium text-white/30 transition-colors duration-200 group-hover:border-white/30 group-hover:text-white/60 sm:inline-block">{s.tag}</span>
                  <span className="shrink-0 text-base text-white/30 transition-all duration-200 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5">↗</span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 마르키 (역방향) */}
      <div className="overflow-hidden border-y border-white/10 bg-black py-5">
        <div className="animate-marquee-reverse flex items-center">
          {[...Array(5)].map((_, i) =>
            ["기획", "설계", "금형 제작", "양산", "브랜딩", "크라우드펀딩", "OEM · ODM", "상세페이지 제작", "제조 소싱", "원스탑 개발", "와디즈 런칭", "정부지원사업 연계"].map((item, idx) => (
              <span key={`${i}-${item}`} className="flex items-center">
                <span className={idx % 3 === 0 ? "mx-4 text-base font-semibold text-white sm:mx-5" : "mx-4 text-sm font-normal text-white/35 sm:mx-5"}>
                  {item}
                </span>
                <span className="text-xs text-white/15">·</span>
              </span>
            ))
          )}
        </div>
      </div>

{/* 주요 개발 사례 */}
      <section id="portfolio" className="scroll-mt-24 bg-[#f5f5f7] px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-8 sm:mb-14">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#86868b]">Past Development Works</p>
            <h2 className="mb-2 text-3xl font-bold text-[#1d1d1f] sm:text-4xl">주요 개발 사례</h2>
            <p className="text-sm text-[#86868b]">실제 납품까지 완료한 프로젝트들입니다.</p>
          </Reveal>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {[
              { client: "MIDLAND", category: "미국 무전기 업체", desc: "차량용 RF 마이크 카버티블 공급. 누적 공급량 약 50만개.", tag: "B2B · OEM", images: ["/portfolio-midland.png"] },
              { client: "신지모루", category: "스마트폰 액세서리", desc: "제품 개발업무 전담으로 진행. 쿠팡 1위 달성 및 전자제품 공급.", tag: "B2B · 개발", images: ["/portfolio-shinjimoru-2.png","/portfolio-shinjimoru-3.png","/portfolio-shinjimoru-4.png","/portfolio-shinjimoru-5.png","/portfolio-shinjimoru-6.png","/portfolio-shinjimoru-7.png","/portfolio-shinjimoru-8.png","/portfolio-shinjimoru-9.png","/portfolio-shinjimoru-10.png","/portfolio-shinjimoru-11.png","/portfolio-shinjimoru-12.png","/portfolio-shinjimoru-13.png"] },
              { client: "오아시스캠프스", category: "KAIST 출신 스타트업", desc: "제품 기획 및 금형 디자인으로 차사가 직접 금형제작 후 노품 양산 진행.", tag: "B2B · 스타트업", images: ["/portfolio-oasis.png"] },
              { client: "퍼플네스트", category: "반려동물 용품", desc: "제품 개발업무를 전담하여 금형 제작 및 제품 양산 진행.", tag: "B2B · 양산", images: ["/portfolio-purplenest-1.png", "/portfolio-purplenest-2.png", "/portfolio-purplenest-3.png"] },
            ].map((item, i) => (
              <Reveal key={item.client} delay={i * 90}>
                <div className="h-full overflow-hidden rounded-2xl bg-white sm:rounded-3xl">
                  <PortfolioImageSlider images={item.images} />
                  <div className="p-4 sm:p-5">
                    <span className="inline-block rounded-full bg-[#f5f5f7] px-2.5 py-0.5 text-xs font-medium text-[#86868b]">{item.tag}</span>
                    <h3 className="mt-3 text-sm font-bold text-[#1d1d1f] sm:mt-3 sm:text-base">{item.client}</h3>
                    <p className="text-xs text-[#86868b]">{item.category}</p>
                    <p className="mt-2 text-xs leading-relaxed text-[#86868b]">{item.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 자체 브랜드 */}
      <section id="brand" className="bg-white px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-8 sm:mb-14">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#86868b]">Private Brand</p>
            <h2 className="mb-2 text-3xl font-bold text-[#1d1d1f] sm:text-4xl">핸디핸드 자체 브랜드</h2>
            <p className="text-sm text-[#86868b]">클라이언트 제품뿐 아니라, 직접 기획하고 양산까지 완료한 자체 제품들입니다.</p>
          </Reveal>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {[
              { name: "핸디그립", tag: "자체 개발 · 특허", desc: "차량용 스마트폰 전동 무선 충전 거치대. 자체 개발·디자인으로 국내 특허 등록 완료.", images: ["/portfolio-handygrip-1.png", "/portfolio-handygrip-2.png"] },
              { name: "핸다로켓", tag: "자체 개발 · 맥세이프", desc: "맥세이프 호환 카드 케이스. 자체 개발하여 아이폰 후면에 자석으로 탈부착 가능.", images: ["/portfolio-handarocket-1.png", "/portfolio-handarocket-2.png", "/portfolio-handarocket-3.png", "/portfolio-handarocket-4.png"] },
              { name: "미키마우스 거치대", tag: "자체 개발 · 캐릭터", desc: "캐릭터 라이선스 디자인으로 자체 금형 제작·양산한 스마트폰 거치대.", images: ["/portfolio-mickey-1.png"] },
              { name: "핸디워치", tag: "자체 개발 · CNC", desc: "애플워치 스테인리스 케이스. CNC 가공 방식으로 자체 설계·제작한 DIY 제품.", images: ["/portfolio-handywatch-1.png", "/portfolio-handywatch-2.png", "/portfolio-handywatch-3.png"] },
            ].map((item, i) => (
              <Reveal key={item.name} delay={i * 90}>
                <div className="h-full overflow-hidden rounded-2xl bg-[#f5f5f7] sm:rounded-3xl">
                  <PortfolioImageSlider images={item.images} height="h-40 sm:h-52" />
                  <div className="p-4 sm:p-5">
                    <span className="inline-block rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-[#86868b]">{item.tag}</span>
                    <h3 className="mt-2 text-sm font-bold text-[#1d1d1f] sm:text-base">{item.name}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-[#86868b]">{item.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* AI 제조 분석 */}
      <section id="ai-analysis" className="relative scroll-mt-24 overflow-hidden bg-[#0d1117] px-5 py-16 sm:px-6 sm:py-24">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 80% 60% at 68% 20%, rgba(255,255,255,0.22) 0%, transparent 72%)", filter: "blur(50px)" }}
        />
        <div className="relative mx-auto max-w-6xl">
          <div className="grid gap-8 sm:gap-12 lg:grid-cols-2 lg:gap-0 lg:items-start">
            <Reveal className="order-2 lg:order-1 lg:pr-20 lg:pt-8">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/40">AI Analysis · Free</p>
              <h2 className="mb-6 text-3xl font-bold leading-tight text-white sm:mb-4 sm:text-5xl">
                도면을 올리면<br />AI가 제조 방법을<br />분석합니다
              </h2>
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 sm:mb-6">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400"></span>
                <span className="text-xs font-medium text-white/60">누적 1,200+ 파일 분석 완료 · 무료</span>
              </div>
              <p className="mb-8 text-sm leading-relaxed text-white/40">
                견적 요청 전에 무료로 사용해보세요.<br />분석 결과는 자동으로 견적 요청서에 연결됩니다.
              </p>
              <div className="mb-8 space-y-0">
                {[
                  { num: "01", title: "도면 파일 업로드", sub: "STP · STEP · DXF · DWG 지원" },
                  { num: "02", title: "AI 자동 분석", sub: "형상 · 치수 · 재질 · 제조방법 판단" },
                  { num: "03", title: "바로 견적 요청", sub: "분석 결과가 견적서에 자동 입력" },
                ].map((step, i) => (
                  <div key={step.num} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[10px] font-bold text-white/40">
                        {step.num}
                      </div>
                      {i < 2 && <div className="mt-1 w-px flex-1 bg-white/[0.08]" style={{ minHeight: "28px" }} />}
                    </div>
                    <div className="pb-6">
                      <p className="text-sm font-semibold text-white">{step.title}</p>
                      <p className="mt-0.5 text-xs text-white/35">{step.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setCadOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                무료로 분석 시작하기 →
              </button>
            </Reveal>
            <Reveal className="order-1 relative lg:order-2" delay={150}>
              <div className="demo-card">
                <AiDemoAnimation onCta={() => { setQuotePrefill(""); setQuoteOpen(true); }} />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* HANDYWORKS 배너 */}
      <section className="border-y border-white/10 bg-black px-5 py-16 sm:px-6 sm:py-24">
        <Reveal className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">HANDYWORKS · Platform</p>
            <p className="text-2xl font-bold leading-snug text-white sm:text-3xl">계약 후, 모든 진행 상황을<br />플랫폼으로 직접 확인하세요.</p>
            <p className="mt-3 text-sm leading-relaxed text-white/55">일정·이슈·파일을 언제 어디서든 실시간으로 파악합니다.</p>
            <Link
              href="/handyworks"
              className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              알아보기 →
            </Link>
          </div>
          <div className="lg:pl-6">
            <HandyworksAnimation />
          </div>
        </Reveal>
      </section>

      {/* 마무리 CTA */}
      <section className="relative overflow-hidden bg-white px-5 py-24 text-center sm:px-6 sm:py-32">
        {/* 은은한 도트 그리드 텍스처 */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.07) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(ellipse 70% 85% at 50% 45%, black 15%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse 70% 85% at 50% 45%, black 15%, transparent 75%)",
          }}
        />
        <Reveal className="relative">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#86868b]">Get Started</p>
          <h2 className="mb-6 text-4xl font-bold text-[#1d1d1f] sm:text-6xl">
            지금 시작할 준비가 됐나요?
          </h2>
          <p className="mb-10 text-sm text-[#86868b]">
            아이디어 단계부터 상담 가능합니다. 먼저 편하게 문의해보세요.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() => setQuoteOpen(true)}
              className="rounded-full bg-[#1d1d1f] px-8 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-black hover:shadow-xl"
            >
              무료 견적 요청
            </button>
            <button
              onClick={() => setContactOpen(true)}
              className="rounded-full border border-[#e5e5e5] bg-white px-8 py-3 text-sm font-semibold text-[#1d1d1f] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#1d1d1f] hover:shadow-lg"
            >
              문의하기
            </button>
          </div>
        </Reveal>
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
        <p className="mt-1">
          Tel. 070-8835-2311 · handyhand91@naver.com
        </p>
        <div className="mt-4 flex items-center justify-center gap-4">
          <Link href="/privacy" className="underline underline-offset-2 hover:text-white/60 transition">개인정보처리방침</Link>
          <span>·</span>
          <Link href="/terms" className="underline underline-offset-2 hover:text-white/60 transition">이용약관</Link>
        </div>
        <p className="mt-4">© 2026 HANDYHAND. All rights reserved.</p>
      </footer>

{contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}
      {quoteOpen && <QuoteModal onClose={() => { setQuoteOpen(false); setQuotePrefill(""); }} prefillDescription={quotePrefill} />}
      {cadOpen && (
        <CadAnalysisModal
          onClose={() => setCadOpen(false)}
          onRequestQuote={(prefill) => { setQuotePrefill(prefill); setQuoteOpen(true); }}
        />
      )}
    </div>
  );
}
