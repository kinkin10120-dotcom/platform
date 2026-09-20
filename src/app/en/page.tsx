"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { QuoteModal } from "@/components/QuoteModal";
import { CadAnalysisModal } from "@/components/CadAnalysisModal";
import { ContactModal } from "@/components/ContactModal";
import { AiDemoAnimation } from "@/components/AiDemoAnimation";
import { ScaledAiDemo } from "@/components/ScaledAiDemo";
import { HandyworksAnimation } from "@/components/HandyworksAnimation";
import { PortfolioImageSlider } from "@/components/PortfolioImageSlider";
import { Landmark, Rocket, Megaphone, RefreshCw, FlaskConical, Factory, Menu, X, Mail, Languages } from "lucide-react";

// 한국어 홈(src/app/page.tsx)의 영문 버전. next-intl 같은 i18n 라이브러리 없이 별도 페이지로
// 유지하는 "단순 중복" 방식을 택했다 — 마케팅 카피는 자주 안 바뀌는 콘텐츠라 두 버전이
// 어긋날 위험이 낮고, 지금 당장은 인프라 도입 비용이 더 크기 때문. 한국어 쪽 본문을 고치면
// 이 파일도 그에 맞춰 수동으로 반영해야 한다(자동 동기화 없음).
//
// AiDemoAnimation/ScaledAiDemo/CadAnalysisModal은 lang="en"을 받아 영문으로 표시한다
// (CadAnalysisModal은 실제 서버 API를 호출하므로 lang을 FormData로도 함께 넘겨 서버 프롬프트
// 언어까지 바꾼다 — functions/src/../route.ts의 lang 분기와 반드시 짝을 맞춰 유지할 것).
// QuoteModal/ContactModal은 아직 한국어 라벨을 그대로 쓴다 — 이번 범위는 여기까지다.

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
      <p className="text-xl font-bold text-white sm:text-4xl">{display < target ? display : `${target}+ yrs`}</p>
      <p className="mt-1 text-[10px] uppercase tracking-widest text-white/30 sm:text-xs">Product Dev. Experience</p>
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
      <p className="mt-1 text-[10px] uppercase tracking-widest text-white/30 sm:text-xs">Products Developed</p>
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
      <p className="mt-1 text-[10px] uppercase tracking-widest text-white/30 sm:text-xs">Partner Brands, KR &amp; Abroad</p>
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
        Upload a drawing and AI<br />analyzes how to manufacture it
      </h2>
      <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-black/5 bg-[#f5f5f7] px-3 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
        <span className="text-xs font-medium text-[#4a4a4c]">1,200+ files analyzed so far · Free</span>
      </div>
      <p className="mb-8 text-sm leading-relaxed text-[#86868b] sm:text-base">
        Try it free before requesting a quote.<br className="sm:hidden" /> Results are linked to your quote request automatically.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={onCadOpen}
          className="inline-flex items-center gap-2 rounded-full bg-[#1d1d1f] px-7 py-3 text-sm font-semibold text-white transition hover:bg-black"
        >
          Start Free Analysis →
        </button>
        <Link href="/en/ai-analysis" className="text-sm font-medium text-[#1d1d1f]/70 transition hover:text-[#1d1d1f]">
          Learn More →
        </Link>
      </div>

      <div className="mt-10">
        <ScaledAiDemo onCta={onQuoteOpen} lang="en" />
      </div>
    </div>
  );
}

export default function EnglishRootPage() {
  const { loading } = useAuth();
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

      {/* Navigation */}
      <nav className="fixed top-[calc(1rem+env(safe-area-inset-top))] z-50 w-full px-4 sm:px-8 [transform:translateZ(0)] [will-change:transform]">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between rounded-full border border-white/15 bg-black/70 px-5 py-2.5 backdrop-blur-xl">
            <Link href="/en">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="HANDYHAND" className="h-4 w-auto sm:h-5" />
            </Link>
            <div className="hidden items-center gap-5 lg:flex">
              <Link href="/en/about" className="whitespace-nowrap text-sm text-white/55 transition hover:text-white">About</Link>
              <Link href="/en/service" className="whitespace-nowrap text-sm text-white/55 transition hover:text-white">Services</Link>
              <Link href="/en/process" className="whitespace-nowrap text-sm text-white/55 transition hover:text-white">Process</Link>
              <Link href="/en/portfolio" className="whitespace-nowrap text-sm text-white/55 transition hover:text-white">Portfolio</Link>
              <Link href="/en/ai-analysis" className="whitespace-nowrap text-sm text-white/55 transition hover:text-white">AI Analysis</Link>
            </div>
            <div className="flex items-center gap-1.5">
              <Link href="/handyworks" className="min-w-[126px] text-center rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-black transition hover:bg-white/90 hidden lg:block">
                HANDYWORKS ↗
              </Link>
              <button
                onClick={() => setQuoteOpen(true)}
                className="hidden min-w-[92px] rounded-full bg-white px-3.5 py-1.5 text-center text-xs font-medium text-black transition hover:bg-white/90 lg:block"
              >
                Get a Quote
              </button>
              <button
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label="Open menu"
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
                { href: "/en/about", label: "About", isLink: true },
                { href: "/en/service", label: "Services", isLink: true },
                { href: "/en/process", label: "Process", isLink: true },
                { href: "/en/portfolio", label: "Portfolio", isLink: true },
                { href: "/en/ai-analysis", label: "AI Analysis", isLink: true },
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
                  Get a Quote
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Floating contact button */}
      <button
        onClick={() => setContactOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-white px-4 py-3 text-xs font-semibold text-black shadow-lg transition hover:bg-white/90 hover:shadow-xl"
      >
        <Mail size={15} />
        Contact Us
      </button>

      {/* Floating language toggle button */}
      <Link
        href="/"
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 rounded-full bg-white px-4 py-3 text-xs font-semibold text-black shadow-lg transition hover:bg-white/90 hover:shadow-xl"
      >
        <Languages size={15} />
        KOR
      </Link>

      {/* Hero */}
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
            Turning ideas into products,<br />
            <span className="text-white/50">you don&apos;t have to do it<br className="sm:hidden" /> alone anymore.</span>
          </h1>
          <p className="mb-5 max-w-lg text-sm leading-relaxed text-white/50 sm:mb-6 sm:text-lg">
            The most reliable way to turn an idea into a real product.
          </p>
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 sm:mb-10">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#F1CE00]" />
            <span className="text-xs font-medium text-white/70">From product planning to development and mass production</span>
          </div>
          <button
            onClick={() => setQuoteOpen(true)}
            className="rounded-full bg-white px-8 py-3 text-center text-sm font-semibold text-black transition hover:bg-white/90"
          >
            Get a Free Quote →
          </button>
          <p className="mt-5 text-sm text-white/30">
            Not sure where to start with manufacturing?{" "}
            <a href="#ai-analysis" className="text-white/60 underline underline-offset-4 transition hover:text-white">
              Try our free AI analysis first →
            </a>
          </p>

          <div className="mt-12 grid grid-cols-3 gap-4 border-t border-white/10 pt-8 text-center sm:mt-24 sm:gap-16 sm:pt-12">
            <AnimatedExperienceStat />
            <AnimatedPartnerStat />
            <AnimatedProductStat />
          </div>
        </div>
      </section>

      {/* Who we work with */}
      <section className="bg-[#f5f5f7] px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-6 sm:mb-8">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
              Who We Work With
            </p>
            <h2 className="text-3xl font-bold text-[#1d1d1f] sm:text-4xl">Who we work with.</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#86868b] sm:text-base">Wherever you are in the process, we tailor our approach<br className="sm:hidden" /> to bring your product to life.</p>
          </Reveal>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {[
              { tag: "Gov't Programs", title: "Companies preparing product development through government programs", desc: "We support product development tied to business plans for programs like the Startup Growth Package and TIPS.", icon: Landmark },
              { tag: "Startups · Early-Stage", title: "Founders with no manufacturing experience", desc: "From product design and engineering to hardware, software, prototyping, and the tooling needed for mass production — we handle it all.", icon: Rocket },
              { tag: "Crowdfunding", title: "Companies preparing to launch on Wadiz or Kickstarter", desc: "An all-in-one solution — from product development to landing page design and mass production — built for crowdfunding success.", icon: Megaphone },
              { tag: "Renewal · Improvement", title: "Companies needing to renew an existing product", desc: "We analyze quality, cost, and design, then handle the redesign and mass production.", icon: RefreshCw },
              { tag: "No In-House R&D", title: "Companies without an in-house R&D team", desc: "No planning, design, or development staff? HANDYHAND acts as your R&D department from start to finish.", icon: FlaskConical },
              { tag: "No Manufacturer Yet", title: "Companies with a finished design but no manufacturer", desc: "If you already have finished drawings or a prototype, HANDYHAND picks up right where you left off.", icon: Factory },
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

      {/* Marquee */}
      <div className="overflow-hidden border-y border-white/10 bg-black py-5">
        <div className="animate-marquee flex items-center">
          {[...Array(5)].map((_, i) =>
            ["Product Planning", "Engineering", "Tooling", "Manufacturing", "Branding", "Crowdfunding", "OEM · ODM", "Landing Page Design", "AI Analysis", "All-in-One Solution", "Wadiz Launch Support", "Gov't Program Support"].map((item, idx) => (
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

      {/* Services */}
      <section
        id="services"
        className="relative scroll-mt-24 overflow-hidden px-5 sm:px-6"
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, #1c1c1e 0%, #000000 70%)" }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 45% at 50% 0%, rgba(255,255,255,0.1) 0%, transparent 65%), radial-gradient(ellipse 90% 45% at 50% 100%, rgba(255,255,255,0.08) 0%, transparent 65%)",
          }}
        />
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
              <h2 className="text-3xl font-bold text-white sm:text-4xl">Start to finish.</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/50 sm:text-base">Everything you need, from planning<br className="sm:hidden" /> to a finished product — all with HANDYHAND.</p>
            </div>
            <Link
              href="/en/service"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/40 hover:text-white sm:border-0 sm:px-0 sm:py-0 sm:text-white/70"
            >
              View All Services →
            </Link>
          </Reveal>
          <div className="divide-y divide-white/10 border-t border-white/10">
            {[
              { num: "01", title: "All-in-One Product Solution", tag: "All in One", desc: "From product design and engineering to PCBA hardware, software, tooling, production, landing page design, and crowdfunding launch support — we cover the entire process." },
              { num: "02", title: "Product Design", tag: "Design", desc: "We finalize the product's exterior design and CMF (color, material, finish) with brand identity and usability in mind." },
              { num: "03", title: "Mechanical Engineering", tag: "Engineering", desc: "We complete production-ready 3D drawings, engineered for structure, assembly, and manufacturability." },
              { num: "04", title: "Manufacturing Consulting", tag: "Consulting", desc: "We work with you on everything from product structure and manufacturing methods to cost-saving strategies." },
              { num: "05", title: "Electronics · PCBA Development", tag: "Electronics", desc: "From development to mass production of small appliances and electronics, powered by HANDYHAND's partner network at home and abroad." },
              { num: "06", title: "Manufacturing Sourcing & Management", tag: "OEM & ODM", desc: "We find the right overseas manufacturer for your product and manage the entire production process directly." },
              { num: "07", title: "Packaging", tag: "Product Detail", desc: "We design packaging and product landing pages that bring your product and brand together." },
              { num: "08", title: "Crowdfunding Consulting", tag: "Crowdfunding", desc: "By former Wadiz Partners and funding planners — an all-in-one service from product development to launch." },
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

      {/* Marquee (reverse) */}
      <div className="overflow-hidden border-y border-white/10 bg-black py-5">
        <div className="animate-marquee-reverse flex items-center">
          {[...Array(5)].map((_, i) =>
            ["Product Planning", "Engineering", "Tooling", "Manufacturing", "Branding", "Crowdfunding", "OEM · ODM", "Landing Page Design", "AI Analysis", "All-in-One Solution", "Wadiz Launch Support", "Gov't Program Support"].map((item, idx) => (
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

      {/* AI Manufacturing Analysis */}
      <section id="ai-analysis" className="relative scroll-mt-24 overflow-hidden bg-white px-5 py-16 sm:px-6 sm:py-24">
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
                Upload a drawing and AI<br />analyzes how to manufacture it
              </h2>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/5 bg-[#f5f5f7] px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                <span className="text-xs font-medium text-[#4a4a4c]">1,200+ files analyzed so far · Free</span>
              </div>
              <p className="mb-8 text-sm leading-relaxed text-[#86868b] sm:text-base">
                Try it free before requesting a quote.<br className="sm:hidden" /> Results are linked to your quote request automatically.
              </p>

              <div className="mb-8 space-y-0">
                {[
                  { num: "01", title: "Upload Your Drawing", sub: "Supports STP · STEP · DXF · DWG, and more" },
                  { num: "02", title: "Automatic AI Analysis", sub: "Assesses shape, dimensions, material, and manufacturing method" },
                  { num: "03", title: "Request a Quote Instantly", sub: "Analysis results are auto-filled into your quote" },
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
                  Start Free Analysis →
                </button>
                <Link href="/en/ai-analysis" className="text-sm font-medium text-[#1d1d1f]/70 transition hover:text-[#1d1d1f]">
                  Learn More →
                </Link>
              </div>
            </Reveal>
            <Reveal className="relative hidden lg:block" delay={150}>
              <div className="scale-[0.85]">
                <AiDemoAnimation onCta={() => { setQuotePrefill(""); setQuoteOpen(true); }} lang="en" />
              </div>
            </Reveal>

            {/* Mobile: animation, then intro */}
            <div className="lg:hidden">
              <AiAnalysisMobileIntro
                onCadOpen={() => setCadOpen(true)}
                onQuoteOpen={() => { setQuotePrefill(""); setQuoteOpen(true); }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Portfolio */}
      <section id="portfolio" className="scroll-mt-24 bg-[#f5f5f7] px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-8 flex items-end justify-between">
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
                Past Development Works
              </p>
              <h2 className="mb-3 text-3xl font-bold text-[#1d1d1f] sm:text-4xl">Featured Projects</h2>
              <p className="text-sm leading-relaxed text-[#86868b] sm:text-base">From client projects to our own in-house brands —<br className="sm:hidden" /> all delivered and mass-produced.</p>
            </div>
            <Link href="/en/portfolio" className="hidden shrink-0 text-sm font-medium text-[#1d1d1f]/70 transition hover:text-[#1d1d1f] sm:block">
              View All →
            </Link>
          </Reveal>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {[
              { title: "MIDLAND (THAI RADIO)", subtitle: "Two-way Radio Manufacturer", tag: "B2B · Engineering · Mass Production", images: ["/portfolio-midland.png"] },
              { title: "Shinjimoru", subtitle: "Smartphone Accessories", tag: "B2B · Development · Mass Production", images: ["/portfolio-shinjimoru-2.png","/portfolio-shinjimoru-3.png","/portfolio-shinjimoru-4.png"] },
              { title: "PurpleNest", subtitle: "Pet Products", tag: "B2B · Development · Mass Production", images: ["/portfolio-purplenest-1.png", "/portfolio-purplenest-2.png", "/portfolio-purplenest-3.png"] },
              { title: "HandyGrab", subtitle: "In-house Brand", tag: "Development · Mass Production · Patent", images: ["/portfolio-handygrip-2.png"] },
              { title: "HandyPocket", subtitle: "In-house Brand", tag: "Development · Mass Production · Patent", images: ["/portfolio-handarocket-1.png", "/portfolio-handarocket-2.png"] },
              { title: "HandyWatch", subtitle: "In-house Brand", tag: "Development · Mass Production · Patent", images: ["/portfolio-handywatch-1.png", "/portfolio-handywatch-2.png"] },
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
          <Link href="/en/portfolio" className="mt-6 flex items-center justify-center text-sm font-medium text-[#1d1d1f]/70 transition hover:text-[#1d1d1f] sm:hidden">
            View All →
          </Link>
        </div>
      </section>

      {/* HANDYWORKS banner */}
      <section
        className="relative overflow-hidden border-y border-white/10 px-5 py-16 sm:px-6 sm:py-24"
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, #1c1c1e 0%, #000000 70%)" }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 45% at 50% 0%, rgba(255,255,255,0.1) 0%, transparent 65%), radial-gradient(ellipse 90% 45% at 50% 100%, rgba(255,255,255,0.08) 0%, transparent 65%)",
          }}
        />
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
            <p className="text-3xl font-bold leading-snug text-white sm:text-4xl">Quotes, signatures, development, mass production.<br />One connected platform for it all.</p>
            <p className="mt-3 text-sm leading-relaxed text-white/55 sm:text-base">From accepting a quote to e-signing, development, tooling, and mass production<br className="sm:hidden" /> — seamlessly, in one platform.</p>
            <Link
              href="/handyworks"
              className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Learn More →
            </Link>
          </div>
          <div className="min-w-0">
            <HandyworksAnimation />
          </div>
        </Reveal>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-white px-5 py-24 text-center sm:px-6 sm:py-32">
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
            Ready to get started?
          </h2>
          <p className="mb-10 text-sm text-[#86868b] sm:text-base">
            We&apos;re happy to talk, even at the idea stage.<br className="sm:hidden" /> Feel free to reach out first.
          </p>
          <div className="flex justify-center">
            <div className="inline-flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => setQuoteOpen(true)}
                className="rounded-full bg-[#1d1d1f] px-8 py-3 text-center text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-black hover:shadow-xl"
              >
                Request a Free Quote
              </button>
              <button
                onClick={() => setContactOpen(true)}
                className="rounded-full border border-[#e5e5e5] bg-white px-8 py-3 text-center text-sm font-semibold text-[#1d1d1f] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#1d1d1f] hover:shadow-lg"
              >
                Contact Us
              </button>
            </div>
          </div>
          <Link
            href="/en/service#faq"
            className="mt-8 inline-block text-sm font-medium text-[#86868b] underline underline-offset-4 transition hover:text-[#1d1d1f]"
          >
            See Frequently Asked Questions →
          </Link>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black px-6 py-12 text-center text-xs text-white/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="HANDYHAND" className="mx-auto mb-4 h-5 w-auto" />
        <p className="mt-1 leading-relaxed">
          HANDYHAND Co., Ltd. · CEO Hyungjun Choi · Business Registration No. 128-87-00105
        </p>
        <p className="mt-1 leading-relaxed">
          Mail-Order Business License No. 2020-Goyangdeogyanggu-1900
        </p>
        <p className="mt-1 leading-relaxed">
          F804, Goyang ARC Biz Knowledge Industry Center, 63 Samwon-ro, Deogyang-gu, Goyang-si, Gyeonggi-do, Korea
        </p>
        <p className="mt-1">
          Tel. +82-70-8835-2311 · handyhand91@naver.com
        </p>
        <div className="mt-4 flex items-center justify-center gap-4">
          <Link href="/privacy" className="underline underline-offset-2 hover:text-white/60 transition">Privacy Policy</Link>
          <span>·</span>
          <Link href="/terms" className="underline underline-offset-2 hover:text-white/60 transition">Terms of Service</Link>
        </div>
        <p className="mt-4">© 2026 HANDYHAND. All rights reserved.</p>
      </footer>

      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}
      {quoteOpen && <QuoteModal onClose={() => { setQuoteOpen(false); setQuotePrefill(""); }} prefillDescription={quotePrefill} />}
      {cadOpen && (
        <CadAnalysisModal
          onClose={() => setCadOpen(false)}
          onRequestQuote={(prefill) => { setQuotePrefill(prefill); setQuoteOpen(true); }}
          lang="en"
        />
      )}
    </div>
  );
}
