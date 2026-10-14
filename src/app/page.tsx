"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { QuoteModal } from "@/components/QuoteModal";
import { CadAnalysisModal } from "@/components/CadAnalysisModal";
import { ContactModal } from "@/components/ContactModal";
import { AiDemoAnimation } from "@/components/AiDemoAnimation";
import { ScaledAiDemo } from "@/components/ScaledAiDemo";
import { HandyworksAnimation } from "@/components/HandyworksAnimation";
import { PortfolioImageSlider } from "@/components/PortfolioImageSlider";
import { Landmark, Rocket, Megaphone, RefreshCw, FlaskConical, Factory, Menu, X, Mail, Languages } from "lucide-react";

// TODO: 실제 고객사명·제품명·문제/해결/결과 내용을 채운 뒤 true로 변경
const SHOW_CLIENT_STORIES = false;

const CLIENT_STORIES = [
  {
    tag: "크라우드펀딩 · 캠핑용품",
    company: "OOO사",
    product: "OOO 캠핑용품",
    problem: "디자인 시안은 있었지만 양산 가능한 구조 설계와 생산처가 없어 와디즈 런칭 일정이 계속 밀리고 있었습니다.",
    solution: "핸디핸드가 구조 설계부터 금형 제작, 양산, 상세페이지 제작까지 전 과정을 맡아 진행했습니다.",
    result: "개발 착수 0개월 만에 양산 착수, 와디즈 펀딩 000% 달성",
  },
  {
    tag: "R&D 부서 없음 · 스마트 조명",
    company: "OOO사",
    product: "OOO 스마트 조명",
    problem: "자체 R&D 인력 없이 아이디어만 있는 상태로, 제품화를 어디서부터 시작해야 할지 막막했습니다.",
    solution: "핸디핸드가 R&D 부서를 대신해 기획·설계·전자(PCBA) 개발부터 해외 제조처 소싱까지 전 과정을 리드했습니다.",
    result: "OEM 파트너십으로 원가 00% 절감, 개발 0개월 만에 첫 양산",
  },
  {
    tag: "리뉴얼 · 반려동물 용품",
    company: "OOO사",
    product: "OOO 반려동물 용품",
    problem: "기존 제품의 원가와 품질 문제로 매출이 정체돼 있었지만, 어느 부분을 개선해야 할지 진단이 안 된 상태였습니다.",
    solution: "핸디핸드가 품질·원가·디자인을 분석해 개선 설계안을 제시하고 양산까지 함께 진행했습니다.",
    result: "리뉴얼 후 매출 00% 증가, 해외 00개국 추가 수출",
  },
];

function AnimatedExperienceStat() {
  const target = 40;
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const duration = 1100;
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
      <p className="text-xl font-bold text-white sm:text-4xl">{display < target ? display : `${target}년+`}</p>
      <p className="mt-1 text-[10px] uppercase tracking-widest text-white/30 sm:text-xs">제품개발 경력</p>
    </div>
  );
}

function AnimatedProductStat() {
  const target = 300;
  const steps = 50;
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const duration = 1100;
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
  }, []);

  return (
    <div ref={ref}>
      <p className="text-xl font-bold text-white sm:text-4xl">{display < target ? display : `${target}+`}</p>
      <p className="mt-1 text-[10px] uppercase tracking-widest text-white/30 sm:text-xs">누적 개발 제품</p>
    </div>
  );
}

function AnimatedPartnerStat() {
  const target = 30;
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const duration = 1100;
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
      <p className="mt-1 text-[10px] uppercase tracking-widest text-white/30 sm:text-xs">국내외 협력 브랜드사</p>
    </div>
  );
}

function Reveal({
  children,
  className = "",
  delay = 0,
  y = 12,
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
        transition: `opacity 0.45s cubic-bezier(0.25,0.1,0.25,1) ${delay}ms, transform 0.45s cubic-bezier(0.25,0.1,0.25,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function AiAnalysisMobileIntro({ onCadOpen, onQuoteOpen }: { onCadOpen: () => void; onQuoteOpen: () => void }) {
  return (
    <div>
      <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
        AI Analysis · Free
      </p>
      <h2 className="mb-6 text-3xl font-bold leading-tight text-[#1d1d1f]">
        도면을 올리면 AI가<br />제조 방법을 분석합니다
      </h2>
      <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-black/5 bg-[#f5f5f7] px-3 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
        <span className="text-xs font-medium text-[#4a4a4c]">누적 1,200+ 파일 분석 완료 · 무료</span>
      </div>
      <p className="mb-8 text-sm leading-relaxed text-[#86868b] sm:text-base">
        견적 요청 전에 무료로 사용해보세요.<br className="sm:hidden" />분석 결과는 자동으로 견적 요청서에 연결됩니다.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={onCadOpen}
          className="inline-flex items-center gap-2 rounded-full bg-[#1d1d1f] px-7 py-3 text-sm font-semibold text-white transition hover:bg-black"
        >
          무료로 분석 시작하기 →
        </button>
        <Link href="/ai-analysis" className="text-sm font-medium text-[#1d1d1f]/70 transition hover:text-[#1d1d1f]">
          자세히 보기 →
        </Link>
      </div>

      <div className="mt-10">
        <ScaledAiDemo onCta={onQuoteOpen} />
      </div>
    </div>
  );
}

export default function RootPage() {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quotePrefill, setQuotePrefill] = useState<string>("");
  const [cadOpen, setCadOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const tryPlay = () => v.play().catch(() => {});

    tryPlay();
    v.addEventListener("loadeddata", tryPlay);
    document.addEventListener("visibilitychange", tryPlay);

    // iOS는 저전력 모드에서 autoplay를 막지만, 사용자 제스처 안에서의
    // play() 호출은 허용하므로 최초 터치/클릭 시 한 번 더 재생을 시도한다.
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

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f]">

      {/* 네비게이션 */}
      <nav className="fixed top-[calc(1rem+env(safe-area-inset-top))] z-50 w-full px-4 sm:px-8 [transform:translateZ(0)] [will-change:transform]">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between rounded-full border border-white/15 bg-black/70 px-5 py-2.5 backdrop-blur-xl">
            <Link href="/">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="HANDYHAND" className="h-4 w-auto sm:h-5" />
            </Link>
            <div className="hidden items-center gap-5 lg:flex">
              <Link href="/about" className="whitespace-nowrap text-sm text-white/55 transition hover:text-white">기업소개</Link>
              <Link href="/service" className="whitespace-nowrap text-sm text-white/55 transition hover:text-white">서비스</Link>
              <Link href="/process" className="whitespace-nowrap text-sm text-white/55 transition hover:text-white">프로세스</Link>
              <Link href="/portfolio" className="whitespace-nowrap text-sm text-white/55 transition hover:text-white">개발사례</Link>
              <Link href="/ai-analysis" className="whitespace-nowrap text-sm text-white/55 transition hover:text-white">AI 제조분석</Link>
            </div>
            <div className="flex items-center gap-1.5">
              <Link href="/handyworks" className="min-w-[126px] text-center rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-black transition hover:bg-white/90 hidden lg:block">
                HANDYWORKS ↗
              </Link>
              <button
                onClick={() => setQuoteOpen(true)}
                className="hidden min-w-[92px] rounded-full bg-white px-3.5 py-1.5 text-center text-xs font-medium text-black transition hover:bg-white/90 lg:block"
              >
                견적 요청
              </button>
              <button
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label="메뉴 열기"
                className="flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-white/10 lg:hidden"
              >
                {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div
              className="mt-2 overflow-hidden rounded-3xl border border-white/15 bg-black/90 p-2 backdrop-blur-xl lg:hidden"
              style={{ animation: "menuFadeIn 0.2s ease forwards" }}
            >
              {[
                { href: "/about", label: "기업소개", isLink: true },
                { href: "/service", label: "서비스", isLink: true },
                { href: "/process", label: "프로세스", isLink: true },
                { href: "/portfolio", label: "개발사례", isLink: true },
                { href: "/ai-analysis", label: "AI 제조분석", isLink: true },
                { href: "/handyworks", label: "HANDYWORKS ↗", isLink: true },
              ].map((item, i, arr) => {
                const num = String(i + 1).padStart(2, "0");
                const className = `flex items-center gap-3 px-4 py-3.5 text-sm text-white/70 transition hover:bg-white/10 hover:text-white ${i < arr.length - 1 ? "border-b border-white/[0.06]" : ""}`;
                const content = (
                  <>
                    <span className="text-xs font-medium text-white/25">{num}</span>
                    <span>{item.label}</span>
                  </>
                );
                return item.isLink ? (
                  <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className={className}>{content}</Link>
                ) : (
                  <a key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className={className}>{content}</a>
                );
              })}
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

      {/* 플로팅 문의 버튼 */}
      <button
        onClick={() => setContactOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-white px-4 py-3 text-xs font-semibold text-black shadow-lg transition hover:bg-white/90 hover:shadow-xl"
      >
        <Mail size={15} />
        문의하기
      </button>

      {/* 플로팅 언어 전환 버튼 */}
      <Link
        href="/en"
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 rounded-full bg-white px-4 py-3 text-xs font-semibold text-black shadow-lg transition hover:bg-white/90 hover:shadow-xl"
      >
        <Languages size={15} />
        ENG
      </Link>

      {/* 히어로 */}
      <section className="relative flex flex-col items-center justify-center bg-black px-5 pt-20 text-center overflow-hidden sm:px-6 sm:pt-24" style={{ minHeight: "100lvh" }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          disablePictureInPicture
          preload="auto"
          poster="/hero-video-home-poster.jpg"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ WebkitPlaysinline: true } as React.CSSProperties}
        >
          <source src="/hero-video-home.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/65" />

        <div className="relative z-10 flex flex-col items-center text-center">
          <p className="mb-4 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#F1CE00] sm:mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
            Total Product Solution
          </p>
          <h1 className="mb-5 text-4xl font-bold leading-snug tracking-tight text-white sm:mb-6 sm:text-5xl sm:leading-tight md:text-6xl">
            제품화, 더 이상<br />
            <span className="text-white/50">혼자 해결하지<br className="sm:hidden" /> 않아도 됩니다.</span>
          </h1>
          <p className="mb-5 max-w-lg text-sm leading-relaxed text-white/50 sm:mb-6 sm:text-lg">
            아이디어가 제품이 되는 가장 확실한 방법.
          </p>
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 sm:mb-10">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#F1CE00]" />
            <span className="text-xs font-medium text-white/70">제품 기획부터 제품개발, 양산까지, 핸디핸드가 함께합니다</span>
          </div>
          <button
            onClick={() => setQuoteOpen(true)}
            className="rounded-full bg-white px-8 py-3 text-center text-sm font-semibold text-black transition hover:bg-white/90"
          >
            무료 견적 요청 →
          </button>
          <p className="mt-5 text-sm text-white/30">
            제조 방법부터 막막하다면{" "}
            <a href="#ai-analysis" className="text-white/60 underline underline-offset-4 transition hover:text-white">
              무료 AI 제조분석 먼저 해보기 →
            </a>
          </p>

          <div className="mt-12 grid grid-cols-3 gap-4 border-t border-white/10 pt-8 text-center sm:mt-24 sm:gap-16 sm:pt-12">
            <AnimatedExperienceStat />
            <AnimatedPartnerStat />
            <AnimatedProductStat />
          </div>
        </div>
      </section>

      {/* 이런 분들과 함께합니다 */}
      <section className="bg-[#f5f5f7] px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-6 sm:mb-8">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
              Who We Work With
            </p>
            <h2 className="text-3xl font-bold text-[#1d1d1f] sm:text-4xl">이런 분들과 함께합니다.</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#86868b] sm:text-base">어떤 단계에 계시든, 고객의 상황에 맞는 방식으로<br className="sm:hidden" />제품화를 실현해드립니다.</p>
          </Reveal>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {[
              { tag: "지원사업", title: "지원사업으로 제품화를 준비하는 기업", desc: "창업도약패키지·TIPS 등 사업계획서 연계 제품화를 함께합니다.", icon: Landmark },
              { tag: "스타트업 · 초기창업", title: "제조 경험 없는 창업자", desc: "제품 디자인·설계부터 하드웨어, 소프트웨어, 프로토타입 제작, 양산에 필요한 금형 제작까지 제품화를 진행합니다.", icon: Rocket },
              { tag: "크라우드펀딩", title: "와디즈·킥스타터 런칭 준비 중인 기업", desc: "크라우드 펀딩 성공을 위한 제품 개발부터 상세페이지 제작, 양산까지 올인원 솔루션을 제공합니다.", icon: Megaphone },
              { tag: "리뉴얼·개선", title: "기존 제품 리뉴얼이 필요한 기업", desc: "제품 품질·원가·디자인 분석부터 개선 설계, 양산까지 함께합니다.", icon: RefreshCw },
              { tag: "R&D 부서 없음", title: "자체 R&D 부서가 없는 기업", desc: "제품 기획·설계·개발 인력 없이도 핸디핸드가 R&D 부서를 대신해 제품화를 처음부터 끝까지 진행합니다.", icon: FlaskConical },
              { tag: "생산처 미확보", title: "제품 개발은 끝났는데 생산처가 없는 기업", desc: "이미 완성된 도면이나 시제품이 있다면, 바로 다음 단계부터 핸디핸드가 제품화를 이어 진행해드립니다.", icon: Factory },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 50}>
                <div className="relative h-full overflow-hidden rounded-2xl bg-white p-6 sm:rounded-3xl sm:p-7">
                  <span className="pointer-events-none absolute -right-2 -top-4 select-none text-7xl font-black leading-none text-[#F1CE00]/25 sm:text-8xl">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1d1d1f]">
                    <item.icon size={20} strokeWidth={1.75} className="text-white" />
                  </div>
                  <span className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#f5f5f7] px-2.5 py-0.5 text-xs font-medium text-[#86868b]">
                    <span className="h-1 w-1 rounded-full bg-[#F1CE00]" />
                    {item.tag}
                  </span>
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
            ["제품기획", "설계", "금형 제작", "제품생산", "브랜딩", "크라우드펀딩", "OEM · ODM", "상세페이지 제작", "AI 제조분석", "올인원 솔루션", "와디즈 런칭지원", "지원사업 연계"].map((item, idx) => (
              <span key={`${i}-${item}`} className="flex items-center">
                <span className={idx % 3 === 0 ? "mx-4 text-base font-semibold text-[#F1CE00] sm:mx-5" : "mx-4 text-sm font-normal text-white/35 sm:mx-5"}>
                  {item}
                </span>
                <span className="text-xs text-[#F1CE00]/40">·</span>
              </span>
            ))
          )}
        </div>
      </div>

      {/* 서비스 */}
      <section
        id="services"
        className="relative scroll-mt-24 overflow-hidden px-5 sm:px-6"
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, #1c1c1e 0%, #000000 70%)" }}
      >
        {/* 은은한 radial glow (상/하) */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 45% at 50% 0%, rgba(255,255,255,0.1) 0%, transparent 65%), radial-gradient(ellipse 90% 45% at 50% 100%, rgba(255,255,255,0.08) 0%, transparent 65%)",
          }}
        />
        {/* 은은한 도트 그리드 텍스처 */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.12) 1.5px, transparent 1.5px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(ellipse 85% 95% at 50% 50%, black 20%, transparent 85%)",
            WebkitMaskImage: "radial-gradient(ellipse 85% 95% at 50% 50%, black 20%, transparent 85%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl py-16 sm:py-24">
          <Reveal className="mb-6 flex flex-col items-start gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#F1CE00]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
                Services
              </p>
              <h2 className="text-3xl font-bold text-white sm:text-4xl">처음부터 끝까지.</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/50 sm:text-base">제품 기획부터 제품화에 필요한 모든 과정을<br className="sm:hidden" />핸디핸드로 한번에.</p>
            </div>
            <Link
              href="/service"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/40 hover:text-white sm:border-0 sm:px-0 sm:py-0 sm:text-white/70"
            >
              전체 서비스 보기 →
            </Link>
          </Reveal>
          <div className="divide-y divide-white/10 border-t border-white/10">
            {[
              { num: "01", title: "올인원 제품화 솔루션", tag: "All in One", desc: "제품 디자인부터 설계, PCBA하드웨어, 소프트웨어, 금형, 생산, 상세페이지 제작, 크라우드 펀딩 런칭 지원까지 전 과정을 진행합니다." },
              { num: "02", title: "제품 디자인", tag: "Design", desc: "브랜드 정체성과 사용성을 고려해 제품 외관 디자인과 CMF(색상·소재·마감)를 완성합니다." },
              { num: "03", title: "기구설계", tag: "Engineering", desc: "제품 구조·조립성·양산성을 고려해 실제 양산 가능한 3D 도면을 완성합니다." },
              { num: "04", title: "제조 컨설팅", tag: "Consulting", desc: "제품 구조와 제조 방식부터 원가 절감 전략까지 함께 설계합니다." },
              { num: "05", title: "전자제품·PCBA 개발", tag: "Electronics", desc: "국내외 핸디핸드 파트너쉽 네트워크로 소형가전·전자제품 개발부터 양산까지." },
              { num: "06", title: "제조 소싱 & 관리 대행", tag: "OEM & ODM", desc: "제품개발과 생산의 최적의 해외 제조처를 찾고, 핸디핸드가 생산 전 과정을 직접 관리합니다." },
              { num: "07", title: "패키지", tag: "Product Detail", desc: "제품이 브랜드에 패키지 디자인과 상세페이지 디자인을 함께 만듭니다." },
              { num: "08", title: "크라우드펀딩 컨설팅", tag: "Crowdfunding", desc: "와디즈 파트너스·펀딩플래너 출신 · 제품 개발부터 런칭까지 올인원." },
            ].map((s, i) => (
              <Reveal key={s.num} delay={i * 45}>
                <div className="flex items-center gap-5 py-7 -mx-5 px-5 sm:-mx-6 sm:px-6 sm:py-9">
                  <span className="w-7 shrink-0 text-xs font-medium tabular-nums text-white/45">{s.num}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-semibold text-white sm:text-2xl">{s.title}</p>
                    <p className="mt-1 text-sm text-white/50">{s.desc}</p>
                  </div>
                  <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 text-xs font-medium text-white/50 sm:inline-flex">
                    <span className="h-1 w-1 rounded-full bg-[#F1CE00]" />
                    {s.tag}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 마르키 (역방향) */}
      <div className="overflow-hidden border-y border-white/10 bg-black py-5">
        <div className="animate-marquee-reverse flex items-center">
          {[...Array(5)].map((_, i) =>
            ["제품기획", "설계", "금형 제작", "제품생산", "브랜딩", "크라우드펀딩", "OEM · ODM", "상세페이지 제작", "AI 제조분석", "올인원 솔루션", "와디즈 런칭지원", "지원사업 연계"].map((item, idx) => (
              <span key={`${i}-${item}`} className="flex items-center">
                <span className={idx % 3 === 0 ? "mx-4 text-base font-semibold text-[#F1CE00] sm:mx-5" : "mx-4 text-sm font-normal text-white/35 sm:mx-5"}>
                  {item}
                </span>
                <span className="text-xs text-[#F1CE00]/40">·</span>
              </span>
            ))
          )}
        </div>
      </div>

      {/* AI 제조 분석 */}
      <section id="ai-analysis" className="relative scroll-mt-24 overflow-hidden bg-white px-5 py-16 sm:px-6 sm:py-24">
        {/* 은은한 도트 그리드 텍스처 */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.18) 1.5px, transparent 1.5px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(ellipse 85% 95% at 50% 45%, black 30%, transparent 90%)",
            WebkitMaskImage: "radial-gradient(ellipse 85% 95% at 50% 45%, black 30%, transparent 90%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl">
          <div className="grid gap-8 sm:gap-12 lg:grid-cols-2 lg:gap-0 lg:items-center">
            <Reveal className="hidden lg:block lg:pr-20">
              <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
                AI Analysis · Free
              </p>
              <h2 className="mb-4 text-3xl font-bold leading-tight text-[#1d1d1f] sm:text-4xl">
                도면을 올리면 AI가<br />제조 방법을 분석합니다
              </h2>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/5 bg-[#f5f5f7] px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                <span className="text-xs font-medium text-[#4a4a4c]">누적 1,200+ 파일 분석 완료 · 무료</span>
              </div>
              <p className="mb-8 text-sm leading-relaxed text-[#86868b] sm:text-base">
                견적 요청 전에 무료로 사용해보세요.<br className="sm:hidden" />분석 결과는 자동으로 견적 요청서에 연결됩니다.
              </p>

              <div className="mb-8 space-y-0">
                {[
                  { num: "01", title: "도면 파일 업로드", sub: "STP · STEP · DXF · DWG 등 지원" },
                  { num: "02", title: "AI 자동 분석", sub: "형상 · 치수 · 재질 · 제조방법 판단" },
                  { num: "03", title: "바로 견적 요청", sub: "분석 결과가 견적서에 자동 입력" },
                ].map((step, i) => (
                  <div key={step.num} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1d1d1f] text-[10px] font-bold text-[#F1CE00]">
                        {step.num}
                      </div>
                      {i < 2 && <div className="mt-1 w-px flex-1 bg-black/[0.08]" style={{ minHeight: "28px" }} />}
                    </div>
                    <div className="pb-6">
                      <p className="text-sm font-semibold text-[#1d1d1f]">{step.title}</p>
                      <p className="mt-0.5 text-xs text-[#86868b]">{step.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={() => setCadOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-[#1d1d1f] px-7 py-3 text-sm font-semibold text-white transition hover:bg-black"
                >
                  무료로 분석 시작하기 →
                </button>
                <Link href="/ai-analysis" className="text-sm font-medium text-[#1d1d1f]/70 transition hover:text-[#1d1d1f]">
                  자세히 보기 →
                </Link>
              </div>
            </Reveal>
            <Reveal className="relative hidden lg:block" delay={150}>
              <div className="scale-[0.85]">
                <AiDemoAnimation onCta={() => { setQuotePrefill(""); setQuoteOpen(true); }} />
              </div>
            </Reveal>

            {/* 모바일: 애니메이션 재생 후 설명으로 전환 */}
            <div className="lg:hidden">
              <AiAnalysisMobileIntro
                onCadOpen={() => setCadOpen(true)}
                onQuoteOpen={() => { setQuotePrefill(""); setQuoteOpen(true); }}
              />
            </div>
          </div>
        </div>
      </section>

{/* 개발 사례 */}
      <section id="portfolio" className="scroll-mt-24 bg-[#f5f5f7] px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-8 flex items-end justify-between">
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
                Past Development Works
              </p>
              <h2 className="mb-3 text-3xl font-bold text-[#1d1d1f] sm:text-4xl">주요 개발 사례</h2>
              <p className="text-sm leading-relaxed text-[#86868b] sm:text-base">고객사 프로젝트부터 자체 브랜드까지,<br className="sm:hidden" />실제 납품·양산까지 완료한 프로젝트들입니다.</p>
            </div>
            <Link href="/portfolio" className="hidden shrink-0 text-sm font-medium text-[#1d1d1f]/70 transition hover:text-[#1d1d1f] sm:block">
              전체 보기 →
            </Link>
          </Reveal>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {[
              { title: "MIDLAND (THAI RADIO)", subtitle: "무전기 업체", tag: "B2B · 설계 · 양산", images: ["/portfolio-midland.png"] },
              { title: "신지모루", subtitle: "스마트폰 액세서리", tag: "B2B · 개발 · 양산", images: ["/portfolio-shinjimoru-2.png","/portfolio-shinjimoru-3.png","/portfolio-shinjimoru-4.png"] },
              { title: "퍼플네스트", subtitle: "반려동물 용품", tag: "B2B · 개발 · 양산", images: ["/portfolio-purplenest-1.png", "/portfolio-purplenest-2.png", "/portfolio-purplenest-3.png"] },
              { title: "핸디그랩", subtitle: "자체 브랜드", tag: "개발 · 양산 · 특허", images: ["/portfolio-handygrip-2.png"] },
              { title: "핸디포켓", subtitle: "자체 브랜드", tag: "개발 · 양산 · 특허", images: ["/portfolio-handarocket-1.png", "/portfolio-handarocket-2.png"] },
              { title: "핸디워치", subtitle: "자체 브랜드", tag: "개발 · 양산 · 특허", images: ["/portfolio-handywatch-1.png", "/portfolio-handywatch-2.png"] },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 50}>
                <div className="h-full overflow-hidden rounded-2xl bg-white sm:rounded-3xl">
                  <PortfolioImageSlider images={item.images} alt={`${item.title} ${item.subtitle}`.trim()} />
                  <div className="p-4 sm:p-5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f5f7] px-2.5 py-0.5 text-xs font-medium text-[#86868b]">
                      <span className="h-1 w-1 rounded-full bg-[#F1CE00]" />
                      {item.tag}
                    </span>
                    <h3 className="mt-3 text-sm font-bold text-[#1d1d1f] sm:mt-3 sm:text-base">{item.title}</h3>
                    <p className="text-xs text-[#86868b]">{item.subtitle}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Link href="/portfolio" className="mt-6 flex items-center justify-center text-sm font-medium text-[#1d1d1f]/70 transition hover:text-[#1d1d1f] sm:hidden">
            전체 보기 →
          </Link>
        </div>
      </section>

      {/* HANDYWORKS 배너 */}
      <section
        className="relative overflow-hidden border-y border-white/10 px-5 py-16 sm:px-6 sm:py-24"
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, #1c1c1e 0%, #000000 70%)" }}
      >
        {/* 은은한 radial glow (상/하) */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 45% at 50% 0%, rgba(255,255,255,0.1) 0%, transparent 65%), radial-gradient(ellipse 90% 45% at 50% 100%, rgba(255,255,255,0.08) 0%, transparent 65%)",
          }}
        />
        {/* 은은한 도트 그리드 텍스처 */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.12) 1.5px, transparent 1.5px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(ellipse 85% 95% at 50% 50%, black 20%, transparent 85%)",
            WebkitMaskImage: "radial-gradient(ellipse 85% 95% at 50% 50%, black 20%, transparent 85%)",
          }}
        />
        <Reveal className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-0">
          <div className="lg:pr-16">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#F1CE00]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
              HANDYWORKS · Platform
            </p>
            <p className="text-3xl font-bold leading-snug text-white sm:text-4xl">견적, 서명, 개발, 양산.<br />모든 과정이 하나로 이어집니다.</p>
            <p className="mt-3 text-sm leading-relaxed text-white/55 sm:text-base">견적서 수락부터 전자서명, 개발·금형 제작, 양산까지<br className="sm:hidden" />— 끊김없이 하나의 플랫폼 안에서.</p>
            <Link
              href="/handyworks"
              className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              알아보기 →
            </Link>
          </div>
          <div className="min-w-0">
            <HandyworksAnimation />
          </div>
        </Reveal>
      </section>

      {/* 고객사 성과 — 실제 고객사명·제품명·문제/해결/결과를 채운 뒤 SHOW_CLIENT_STORIES를 true로 바꿔 노출할 것 */}
      {SHOW_CLIENT_STORIES && (
        <section className="bg-[#f5f5f7] px-5 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mb-10 sm:mb-14">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
                Client Stories
              </p>
              <h2 className="text-3xl font-bold text-[#1d1d1f] sm:text-4xl">함께 만든 성과입니다.</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#86868b] sm:text-base">고객사가 겪던 문제부터 핸디핸드가 함께 만든 결과까지.</p>
            </Reveal>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {CLIENT_STORIES.map((s, i) => (
                <Reveal key={s.company + i} delay={i * 60}>
                  <div className="flex h-full flex-col rounded-2xl bg-white p-6 sm:rounded-3xl sm:p-7">
                    <span className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-[#f5f5f7] px-2.5 py-0.5 text-xs font-medium text-[#86868b]">
                      <span className="h-1 w-1 rounded-full bg-[#F1CE00]" />
                      {s.tag}
                    </span>
                    <h3 className="mb-5 text-base font-bold text-[#1d1d1f] sm:text-lg">{s.company} · {s.product}</h3>
                    <div className="space-y-4 text-sm leading-relaxed">
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#c7c7cc]">문제</p>
                        <p className="text-[#4a4a4c]">{s.problem}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#c7c7cc]">해결</p>
                        <p className="text-[#4a4a4c]">{s.solution}</p>
                      </div>
                    </div>
                    <div className="mt-5 border-t border-[#f0f0f0] pt-4">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">결과</p>
                      <p className="text-sm font-semibold text-[#1d1d1f]">{s.result}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 마무리 CTA */}
      <section className="relative overflow-hidden bg-white px-5 py-24 text-center sm:px-6 sm:py-32">
        {/* 은은한 도트 그리드 텍스처 */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.18) 1.5px, transparent 1.5px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(ellipse 85% 95% at 50% 45%, black 30%, transparent 90%)",
            WebkitMaskImage: "radial-gradient(ellipse 85% 95% at 50% 45%, black 30%, transparent 90%)",
          }}
        />
        <Reveal className="relative">
          <p className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
            Get Started
          </p>
          <h2 className="mb-6 text-3xl font-bold text-[#1d1d1f] sm:text-4xl">
            시작할 준비가 됐나요?
          </h2>
          <p className="mb-10 text-sm text-[#86868b] sm:text-base">
            아이디어 단계부터 상담 가능합니다.<br className="sm:hidden" />먼저 편하게 문의해보세요.
          </p>
          <div className="flex justify-center">
            <div className="inline-flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => setQuoteOpen(true)}
                className="rounded-full bg-[#1d1d1f] px-8 py-3 text-center text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-black hover:shadow-xl"
              >
                무료 견적 요청
              </button>
              <button
                onClick={() => setContactOpen(true)}
                className="rounded-full border border-[#e5e5e5] bg-white px-8 py-3 text-center text-sm font-semibold text-[#1d1d1f] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#1d1d1f] hover:shadow-lg"
              >
                문의하기
              </button>
            </div>
          </div>
          <Link
            href="/service#faq"
            className="mt-8 inline-block text-sm font-medium text-[#86868b] underline underline-offset-4 transition hover:text-[#1d1d1f]"
          >
            자주 묻는 질문 보기 →
          </Link>
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
