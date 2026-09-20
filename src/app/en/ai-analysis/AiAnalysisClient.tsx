"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Menu, X, FileUp, ScanSearch, FileCheck2, PhoneCall, ChevronDown, Mail, Clock, Gift, RefreshCw, Languages } from "lucide-react";
import { ScaledAiDemo } from "@/components/ScaledAiDemo";
import { CadAnalysisModal } from "@/components/CadAnalysisModal";
import { QuoteModal } from "@/components/QuoteModal";
import { ContactModal } from "@/components/ContactModal";

// src/app/ai-analysis/AiAnalysisClient.tsx의 영문 버전. src/app/en/page.tsx 상단 주석과 같은
// 이유로 별도 파일로 관리한다(자동 동기화 없음).
const NAV_LINKS = [
  { href: "/en/about", label: "About" },
  { href: "/en/service", label: "Services" },
  { href: "/en/process", label: "Process" },
  { href: "/en/portfolio", label: "Portfolio" },
  { href: "/en/ai-analysis", label: "AI Analysis" },
];

const STEPS = [
  {
    icon: FileUp,
    num: "01",
    title: "Upload Your Drawing",
    desc: "Upload a drawing file in STP, STEP, DXF, DWG, IPT, IAM, SLDPRT, or SLDASM format. Everything happens right in your browser — no software to install.",
  },
  {
    icon: ScanSearch,
    num: "02",
    title: "Automatic AI Analysis",
    desc: "AI recognizes the shape, dimensions, and material from your drawing and automatically determines the best manufacturing method (injection molding, CNC machining, etc.).",
  },
  {
    icon: FileCheck2,
    num: "03",
    title: "Request a Quote Instantly",
    desc: "The analysis results are automatically filled into your quote request — no need to re-enter specs, just request a quote right away.",
  },
  {
    icon: PhoneCall,
    num: "04",
    title: "Your PM Reaches Out",
    desc: "After reviewing your quote request, your dedicated PM will reach out quickly to discuss the details and guide you through next steps.",
  },
];

const RESULT_EXAMPLES = [
  {
    part: "Smartphone Stand Bracket",
    spec: "ABS · Low Volume",
    method: "Injection Molding",
    pct: 92,
    methodDesc: "Small ABS part with a simple structure and no undercuts",
    methodInitial: 3,
    methodUnit: 1,
    method2: "3D Printing",
    pct2: 65,
    method2Desc: "Good for prototyping, low-volume production possible",
    method2Initial: 1,
    method2Unit: 3,
    summary: "For this small ABS bracket, injection molding is the best fit. The simple, undercut-free structure keeps tooling costs low and favors high-volume production.",
  },
  {
    part: "Electronics Housing",
    spec: "PC · Mid Volume",
    method: "Injection Molding",
    pct: 88,
    methodDesc: "PC material, tooling designed for mid-volume production",
    methodInitial: 3,
    methodUnit: 1,
    method2: "CNC Machining",
    pct2: 58,
    method2Desc: "Good for prototyping and validation, low-volume production",
    method2Initial: 1,
    method2Unit: 3,
    summary: "For this PC housing, injection molding is the best fit. At mid-volume production, per-unit cost savings relative to tooling cost are significant.",
  },
  {
    part: "Prototype Connector Part",
    spec: "Aluminum · Prototype",
    method: "CNC Machining",
    pct: 90,
    methodDesc: "Requires precise dimensions, suited for low-volume prototypes",
    methodInitial: 1,
    methodUnit: 3,
    method2: "3D Printing",
    pct2: 55,
    method2Desc: "Good for shape validation, not suited when strength is required",
    method2Initial: 1,
    method2Unit: 2,
    summary: "For this aluminum prototype part, CNC machining is the best fit — well suited to a connector structure that needs precise dimensions and strength.",
  },
  {
    part: "Automotive Interior Bracket",
    spec: "PP · Mass Production",
    method: "Injection Molding",
    pct: 90,
    methodDesc: "PP material, durable tooling suited for high-volume production",
    methodInitial: 3,
    methodUnit: 1,
    method2: "CNC Machining",
    pct2: 45,
    method2Desc: "For shape validation before tooling",
    method2Initial: 1,
    method2Unit: 3,
    summary: "For high-volume production in PP, injection molding is optimal — a durable tool suited for long-term mass production.",
  },
  {
    part: "Wearable Device Case",
    spec: "Silicone · Mass Production",
    method: "Silicone Molding",
    pct: 91,
    methodDesc: "Flexible silicone material, durable enough for repeated wear",
    methodInitial: 2,
    methodUnit: 2,
    method2: "3D Printing",
    pct2: 50,
    method2Desc: "For producing a small batch of samples to validate shape",
    method2Initial: 1,
    method2Unit: 3,
    summary: "For this silicone wearable case, silicone molding is the best fit — it delivers both flexibility and durability, ideal for a product worn repeatedly.",
  },
  {
    part: "Precision Gear Part",
    spec: "SUS304 · Mid Volume",
    method: "CNC Machining",
    pct: 95,
    methodDesc: "Steel material requiring high precision and strength",
    methodInitial: 1,
    methodUnit: 3,
    method2: "Die Casting",
    pct2: 40,
    method2Desc: "Worth considering if shape complexity is low",
    method2Initial: 3,
    method2Unit: 1,
    summary: "For this SUS304 steel gear, precise dimensional control matters most, making CNC machining the best fit — it also offers an advantage in surface finish and tolerance control.",
  },
  {
    part: "Metal Connector Housing",
    spec: "Zinc Alloy · Mass Production",
    method: "Die Casting",
    pct: 89,
    methodDesc: "Achieves complex geometries precisely, cost-effective at high volume",
    methodInitial: 3,
    methodUnit: 1,
    method2: "CNC Machining",
    pct2: 50,
    method2Desc: "Suited for validating a low-volume prototype",
    method2Initial: 1,
    method2Unit: 3,
    summary: "For this small zinc-alloy metal part, die casting is the best fit — it renders complex shapes precisely and is highly cost-competitive at high volume.",
  },
  {
    part: "LED Lighting Housing",
    spec: "Extruded Aluminum · Mass Production",
    method: "Extruded Profile",
    pct: 87,
    methodDesc: "A long part with a constant cross-section, forming the heat-sink structure in one pass",
    methodInitial: 2,
    methodUnit: 1,
    method2: "CNC Machining",
    pct2: 45,
    method2Desc: "If additional machining is needed after extrusion",
    method2Initial: 1,
    method2Unit: 3,
    summary: "For this aluminum housing with a constant cross-section, an extruded profile is the best fit — forming the heat-sink fins in a single extrusion pass keeps per-unit cost efficient.",
  },
  {
    part: "Design Mockup Sample",
    spec: "Resin · Prototype",
    method: "Vacuum Casting",
    pct: 82,
    methodDesc: "Reproduces a small batch from a silicone master mold, with an appearance close to injection molding",
    methodInitial: 2,
    methodUnit: 2,
    method2: "3D Printing",
    pct2: 60,
    method2Desc: "For the shape-validation stage — vacuum casting gives better surface quality",
    method2Initial: 1,
    method2Unit: 2,
    summary: "For a small batch of design mockups, vacuum casting is a good fit — a silicone master mold lets you quickly reproduce samples with quality close to injection molding.",
  },
  {
    part: "Precision Metal Bracket",
    spec: "SUS304 Sheet · Low Volume",
    method: "Laser Cutting & Sheet Metal Fabrication",
    pct: 88,
    methodDesc: "Suited for precise cut edges and complex outer contours",
    methodInitial: 1,
    methodUnit: 2,
    method2: "CNC Machining",
    pct2: 50,
    method2Desc: "If thicker sheet or 3D machining is needed",
    method2Initial: 1,
    method2Unit: 3,
    summary: "For this thin sheet-metal bracket, laser cutting and sheet metal fabrication are the best fit — the precise cut edges allow direct assembly with no post-processing.",
  },
  {
    part: "Electronics Chassis",
    spec: "Aluminum Sheet · Mid Volume",
    method: "Sheet Metal Fabrication",
    pct: 90,
    methodDesc: "Bending and punching processes suited for a sturdy metal structure",
    methodInitial: 2,
    methodUnit: 2,
    method2: "Die Casting",
    pct2: 40,
    method2Desc: "Worth considering if a more complex shape is needed",
    method2Initial: 3,
    method2Unit: 1,
    summary: "For this aluminum sheet chassis, sheet metal fabrication is the best fit — bending and punching efficiently produce a structure that's both sturdy and lightweight.",
  },
];

const COST_LABEL: Record<number, string> = { 1: "Low", 2: "Medium", 3: "High" };

function CostBadges({ initial, unit, dark = false }: { initial?: number; unit?: number; dark?: boolean }) {
  if (!initial && !unit) return null;
  const textClass = dark ? "text-white/50" : "text-[#86868b]";
  const strongClass = dark ? "text-white/80" : "text-[#1d1d1f]";
  return (
    <div className={`mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] ${textClass}`}>
      {!!initial && COST_LABEL[initial] && (
        <span>Initial tooling cost <span className={`font-semibold ${strongClass}`}>{COST_LABEL[initial]}</span></span>
      )}
      {!!unit && COST_LABEL[unit] && (
        <span>Unit cost <span className={`font-semibold ${strongClass}`}>{COST_LABEL[unit]}</span></span>
      )}
    </div>
  );
}

function ResultExamplesMarquee({ items }: { items: typeof RESULT_EXAMPLES }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const offsetRef = useRef(0);
  const halfWidthRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    const updateHalfWidth = () => { halfWidthRef.current = track.scrollWidth / 2; };
    updateHalfWidth();
    const ro = new ResizeObserver(updateHalfWidth);
    ro.observe(track);

    let rafId: number;
    let pausedSince = 0;
    const speed = 0.6;
    const step = () => {
      if (pausedRef.current && pausedSince > 0 && performance.now() - pausedSince > 1000) {
        pausedRef.current = false;
      }
      if (!pausedRef.current && halfWidthRef.current > 0) {
        offsetRef.current -= speed;
        if (offsetRef.current <= -halfWidthRef.current) offsetRef.current += halfWidthRef.current;
        track.style.transform = `translateX(${offsetRef.current}px)`;
      }
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);

    let dragging = false;
    let startX = 0;
    let startOffset = 0;

    const pause = () => {
      pausedRef.current = true;
      pausedSince = performance.now();
    };
    const resume = () => {
      pausedRef.current = false;
      pausedSince = 0;
    };

    const wrap = (v: number) => {
      const hw = halfWidthRef.current;
      if (hw <= 0) return v;
      while (v > 0) v -= hw;
      while (v <= -hw) v += hw;
      return v;
    };

    const onPointerDown = (e: PointerEvent) => {
      pause();
      dragging = true;
      startX = e.clientX;
      startOffset = offsetRef.current;
      container.style.cursor = "grabbing";
      container.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      offsetRef.current = wrap(startOffset + (e.clientX - startX));
      track.style.transform = `translateX(${offsetRef.current}px)`;
    };
    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      resume();
      container.style.cursor = "";
      if (container.hasPointerCapture(e.pointerId)) container.releasePointerCapture(e.pointerId);
    };

    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointercancel", onPointerUp);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="cursor-grab overflow-hidden"
      style={{
        touchAction: "pan-y",
        maskImage: "linear-gradient(to right, transparent, black 48px, black calc(100% - 48px), transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 48px, black calc(100% - 48px), transparent)",
      }}
    >
      <div ref={trackRef} className="flex gap-4 pl-5 sm:pl-6" style={{ willChange: "transform" }}>
      {[...items, ...items].map((ex, i) => (
        <div
          key={`${ex.part}-${i}`}
          className="w-[calc(100vw-64px)] shrink-0 rounded-2xl bg-white p-5 sm:w-[420px] sm:rounded-3xl sm:p-6"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.03), 0 12px 32px rgba(0,0,0,0.05)" }}
        >
          <div className="rounded-2xl bg-[#f5f5f7] p-4">
            <p className="text-xs text-[#86868b]">Estimated Part</p>
            <p className="mt-0.5 text-base font-bold text-[#1d1d1f]">{ex.part}</p>
            <p className="mt-1 text-xs text-[#86868b]">{ex.spec}</p>
          </div>

          <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-widest text-[#86868b]">Recommended Methods</p>
          <div className="space-y-2">
            <div className="rounded-2xl border border-black bg-black p-4">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-bold text-white">
                  <span className="mr-1.5 text-xs font-normal opacity-50">1st</span>{ex.method}
                </span>
                <span className="text-xs font-semibold text-white/60">{ex.pct}%</span>
              </div>
              <div className="mb-2 h-0.5 w-full rounded-full bg-white/20">
                <div className="h-0.5 rounded-full bg-white" style={{ width: `${ex.pct}%` }} />
              </div>
              <p className="text-xs text-white/60">{ex.methodDesc}</p>
              <CostBadges initial={ex.methodInitial} unit={ex.methodUnit} dark />
            </div>
            <div className="rounded-2xl border border-[#e5e5e5] p-4">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-bold text-[#1d1d1f]"><span className="mr-1.5 text-xs font-normal opacity-50">2nd</span>{ex.method2}</span>
                <span className="text-xs font-semibold text-[#86868b]">{ex.pct2}%</span>
              </div>
              <div className="mb-2 h-0.5 w-full rounded-full bg-[#f0f0f0]">
                <div className="h-0.5 rounded-full bg-black" style={{ width: `${ex.pct2}%` }} />
              </div>
              <p className="text-xs text-[#86868b]">{ex.method2Desc}</p>
              <CostBadges initial={ex.method2Initial} unit={ex.method2Unit} />
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-[#f5f5f7] px-4 py-3">
            <p className="mb-1 text-xs font-semibold text-[#86868b]">AI Summary</p>
            <p className="text-xs leading-relaxed text-[#1d1d1f]">{ex.summary}</p>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-[#b0b0b5]">
            * This analysis is an AI estimate and actual results may vary depending on manufacturing conditions.
          </p>
        </div>
      ))}
      </div>
    </div>
  );
}

const FAQS = [
  { q: "What file formats are supported?", a: "We support drawing files in STP, STEP, DXF, DWG, IPT, IAM, SLDPRT, and SLDASM formats." },
  { q: "Is there a cost?", a: "It's free to use. Feel free to try it before requesting a quote." },
  { q: "What exactly does the AI analyze?", a: "Based on the drawing's shape, dimensions, and material, it analyzes the best manufacturing method." },
  { q: "How are the results used?", a: "The results are automatically linked to your quote request, so you can request a quote right away without re-entering anything." },
  { q: "Can I use this without a drawing?", a: "Yes. If you don't have a drawing yet, you can start a quote consultation with just an idea or a reference image." },
  { q: "Is my uploaded drawing kept secure?", a: "Uploaded files are used only for AI analysis and are not stored on our servers — you can use it without worrying about your drawing leaking." },
  { q: "Can I analyze a product photo instead?", a: "Currently only CAD drawing files (STP, STEP, DXF, DWG, IPT, IAM, SLDPRT, SLDASM) can be analyzed — photo recognition isn't supported. If you don't have a drawing, entering just the product's intended use will still get you a rough analysis." },
  { q: "Can I upload multiple files at once?", a: "Only one file can be analyzed at a time. For products made of multiple parts, upload it as an assembly file and the AI will break it down and analyze each part." },
];

export default function AiAnalysisPage() {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quotePrefill, setQuotePrefill] = useState<string>("");
  const [cadOpen, setCadOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-[calc(1rem+env(safe-area-inset-top))] z-50 w-full px-4 sm:px-8 [transform:translateZ(0)] [will-change:transform]">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between rounded-full border border-white/15 bg-black/70 px-5 py-2.5 backdrop-blur-xl">
            <Link href="/en">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="HANDYHAND" className="h-4 w-auto sm:h-5" />
            </Link>
            <div className="hidden items-center gap-5 lg:flex">
              {NAV_LINKS.map((item) =>
                item.href === "/en/ai-analysis" ? (
                  <Link key={item.href} href={item.href} className="flex items-center gap-1.5 text-sm font-medium text-white">
                    <span className="h-1 w-1 rounded-full bg-[#F1CE00]" />
                    {item.label}
                  </Link>
                ) : (
                  <Link key={item.href} href={item.href} className="whitespace-nowrap text-sm text-white/55 transition hover:text-white">
                    {item.label}
                  </Link>
                )
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Link href="/handyworks" className="hidden min-w-[126px] text-center rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-black transition hover:bg-white/90 lg:block">
                HANDYWORKS ↗
              </Link>
              <button
                onClick={() => setQuoteOpen(true)}
                className="hidden rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-black transition hover:bg-white/90 lg:block"
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
              {[...NAV_LINKS, { href: "/handyworks", label: "HANDYWORKS ↗" }].map((item, i, arr) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3.5 text-sm transition hover:bg-white/10 hover:text-white ${
                    i < arr.length - 1 ? "border-b border-white/[0.06]" : ""
                  } ${item.href === "/en/ai-analysis" ? "text-white" : "text-white/70"}`}
                >
                  <span className="text-xs font-medium text-white/25">{String(i + 1).padStart(2, "0")}</span>
                  <span>{item.label}</span>
                  {item.href === "/en/ai-analysis" && <span className="ml-auto h-1 w-1 rounded-full bg-[#F1CE00]" />}
                </Link>
              ))}
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

      {/* Floating language toggle button */}
      <Link
        href="/ai-analysis"
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 rounded-full bg-white px-4 py-3 text-xs font-semibold text-black shadow-lg transition hover:bg-white/90 hover:shadow-xl"
      >
        <Languages size={15} />
        KOR
      </Link>

      {/* Floating contact button */}
      <button
        onClick={() => setContactOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-white px-4 py-3 text-xs font-semibold text-black shadow-lg transition hover:bg-white/90 hover:shadow-xl"
      >
        <Mail size={15} />
        Contact Us
      </button>

      {/* Hero */}
      <section className="relative flex min-h-[60vh] flex-col items-center justify-center overflow-hidden bg-[#1d1d1f] px-6 pb-24 pt-40 text-center sm:min-h-[62vh] sm:pb-32">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero-ai-analysis.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-90"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(29,29,31,0.55) 0%, rgba(29,29,31,0.5) 45%, #1d1d1f 100%)" }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(241,206,0,0.10) 0%, transparent 70%)" }}
        />
        <div className="relative">
          <p className="mb-4 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#F1CE00]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
            AI Analysis · Free
          </p>
          <h1 className="mb-5 text-4xl font-bold leading-tight text-white sm:text-5xl">
            Ask AI About<br />Manufacturing First
          </h1>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-white/50">
            If you have a drawing, we&apos;ll analyze its shape for free.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => setCadOpen(true)}
              className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Start Free Analysis →
            </button>
            <Link
              href="/service#material-process"
              className="text-sm font-medium text-white/60 transition hover:text-white"
            >
              No drawing yet? Explore our materials &amp; process guide →
            </Link>
          </div>
        </div>
      </section>

      {/* Demo preview */}
      <section className="bg-[#f5f5f7] px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div className="text-center lg:text-left">
              <p className="mb-4 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f] lg:justify-start">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
                Live Preview
              </p>
              <h2 className="mb-4 text-3xl font-bold leading-tight text-[#1d1d1f] sm:text-4xl">
                No Drawing?<br />AI Can Still Help
              </h2>
              <p className="mx-auto mb-8 max-w-md text-sm leading-relaxed text-[#86868b] lg:mx-0 sm:text-base">
                This is the real thing — more accurate with a drawing,<br className="sm:hidden" /> but you can still get an analysis just by entering the product&apos;s use.
              </p>
              <ul className="mx-auto max-w-md space-y-3 text-left lg:mx-0">
                <li className="flex items-start gap-2.5 text-sm text-[#1d1d1f]">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#F1CE00]" />
                  Automatically recognizes shape, dimensions, and material
                </li>
                <li className="flex items-start gap-2.5 text-sm text-[#1d1d1f]">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#F1CE00]" />
                  Recommends the top 2 manufacturing methods with a fit score (%)
                </li>
                <li className="flex items-start gap-2.5 text-sm text-[#1d1d1f]">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#F1CE00]" />
                  Results are automatically linked to your quote request
                </li>
                <li className="flex items-start gap-2.5 text-sm text-[#1d1d1f]">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#F1CE00]" />
                  From upload to results in as little as 1 minute
                </li>
                <li className="flex items-start gap-2.5 text-sm text-[#1d1d1f]">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#F1CE00]" />
                  Free, and you can re-analyze as many times as you like with different drawings
                </li>
              </ul>

              <div className="mx-auto mt-12 flex max-w-md items-stretch justify-center divide-x divide-black/10 lg:mx-0 lg:justify-start">
                {[
                  { icon: Clock, label: "Analysis Time", value: "1 min", desc: "See results right after upload" },
                  { icon: Gift, label: "Cost", value: "Free", desc: "No quote request needed" },
                  { icon: RefreshCw, label: "Re-analysis", value: "Unlimited", desc: "As many times as you like" },
                ].map((stat) => (
                  <div key={stat.label} className="flex flex-1 flex-col items-center gap-1.5 px-4 text-center first:pl-0 last:pr-0">
                    <stat.icon size={16} className="text-[#1d1d1f]" />
                    <p className="text-lg font-bold text-[#1d1d1f] sm:text-xl">{stat.value}</p>
                    <p className="text-xs font-medium text-[#86868b]">{stat.label}</p>
                    <p className="hidden text-[11px] leading-tight text-[#a8a8ad] sm:block">{stat.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="w-full max-w-md justify-self-center">
              <ScaledAiDemo onCta={() => setCadOpen(true)} lang="en" />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col items-center sm:mb-8 sm:items-start">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
              How It Works
            </p>
            <h2 className="text-3xl font-bold text-[#1d1d1f] sm:text-4xl">Here&apos;s How It Works</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#86868b] sm:text-base">No complicated process — just upload your drawing to get started.</p>
          </div>
          <div className="max-w-2xl pl-7 sm:pl-4">
            <div className="border-l border-black/10 pl-9 sm:pl-14">
              {STEPS.map((step, i) => (
                <div key={step.num} className={`relative ${i < STEPS.length - 1 ? "pb-12 sm:pb-16" : ""}`}>
                  <span className="absolute -left-[58px] flex h-11 w-11 items-center justify-center rounded-full bg-[#1d1d1f] ring-4 ring-white sm:-left-[80px] sm:h-12 sm:w-12">
                    <step.icon size={18} className="text-white" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1d1d1f]">Step {step.num}</span>
                  <h3 className="mb-2 mt-1 text-lg font-bold text-[#1d1d1f] sm:text-xl">{step.title}</h3>
                  <p className="max-w-md text-sm leading-relaxed text-[#86868b] sm:text-base">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Result examples */}
      <section className="bg-[#f5f5f7] py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <div className="mb-6 flex flex-col items-center sm:mb-8 sm:items-start">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
              Result Examples
            </p>
            <h2 className="text-3xl font-bold text-[#1d1d1f] sm:text-4xl">Real Product Examples</h2>
            <p className="mt-3 max-w-lg text-center text-sm leading-relaxed text-[#86868b] sm:text-left sm:text-base">
              Real AI analysis results for products<br className="sm:hidden" /> with a variety of shapes and materials.
            </p>
          </div>
        </div>
        <div className="overflow-hidden pb-14">
          <ResultExamplesMarquee items={RESULT_EXAMPLES} />
        </div>
      </section>

      {/* No drawing, no problem */}
      <section className="relative overflow-hidden bg-white px-5 py-16 sm:px-6 sm:py-24">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.18) 1.5px, transparent 1.5px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(ellipse 85% 95% at 50% 45%, black 30%, transparent 90%)",
            WebkitMaskImage: "radial-gradient(ellipse 85% 95% at 50% 45%, black 30%, transparent 90%)",
          }}
        />
        <div className="relative mx-auto max-w-2xl text-center">
          <p className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
            No Drawing Yet?
          </p>
          <h2 className="mb-3 text-3xl font-bold text-[#1d1d1f] sm:text-4xl">No Drawing? No Problem</h2>
          <p className="mx-auto mb-8 max-w-md text-sm leading-relaxed text-[#86868b] sm:text-base">
            Even at the idea stage, that&apos;s fine. Just describe the product you have in mind, and HANDYHAND will review it and help you figure out the direction.
          </p>
          <button
            onClick={() => setQuoteOpen(true)}
            className="rounded-full bg-[#1d1d1f] px-7 py-3 text-sm font-semibold text-white transition hover:bg-black"
          >
            Get a Quote From Your Idea →
          </button>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-[#f5f5f7] px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col items-center sm:mb-8 sm:items-start">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
              FAQ
            </p>
            <h2 className="text-3xl font-bold text-[#1d1d1f] sm:text-4xl">Frequently Asked Questions</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            {FAQS.map((item, i) => (
              <div
                key={item.q}
                className={`overflow-hidden rounded-2xl border transition-all sm:rounded-3xl ${
                  openFaq === i ? "border-[#F1CE00] bg-white" : "border-black/5 bg-white"
                }`}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
                >
                  <span className="flex-1 text-sm font-semibold text-[#1d1d1f] sm:text-base">{item.q}</span>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 transition-transform ${openFaq === i ? "rotate-180 text-[#F1CE00]" : "text-[#86868b]"}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="border-t border-[#f0f0f0] px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
                    <p className="text-sm leading-relaxed text-[#86868b]">{item.a}</p>
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
          <p className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#F1CE00]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
            Get Started
          </p>
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">Try It Now</h2>
          <p className="mb-10 text-[#86868b]">If you have a drawing, find out the manufacturing method<br className="sm:hidden" /> in under a minute, for free.</p>
          <div className="flex justify-center">
            <div className="inline-flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => setCadOpen(true)}
                className="rounded-full bg-white px-8 py-3 text-center text-sm font-semibold text-black transition hover:bg-white/90"
              >
                Start Free Analysis
              </button>
              <button
                onClick={() => setContactOpen(true)}
                className="rounded-full border border-white/20 px-8 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/5"
              >
                Contact Us
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black px-6 py-12 text-center text-xs text-white/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="HANDYHAND" className="mx-auto mb-4 h-5 w-auto" />
        <p className="mt-1 leading-relaxed">HANDYHAND Co., Ltd. · CEO Hyungjun Choi · Business Registration No. 128-87-00105</p>
        <p className="mt-1 leading-relaxed">Mail-Order Business License No. 2020-Goyangdeogyanggu-1900</p>
        <p className="mt-1 leading-relaxed">F804, Goyang ARC Biz Knowledge Industry Center, 63 Samwon-ro, Deogyang-gu, Goyang-si, Gyeonggi-do, Korea</p>
        <p className="mt-1">Tel. +82-70-8835-2311 · handyhand91@naver.com</p>
        <div className="mt-4 flex items-center justify-center gap-4">
          <Link href="/privacy" className="underline underline-offset-2 hover:text-white/60 transition">Privacy Policy</Link>
          <span>·</span>
          <Link href="/terms" className="underline underline-offset-2 hover:text-white/60 transition">Terms of Service</Link>
        </div>
        <p className="mt-4">© 2026 HANDYHAND. All rights reserved.</p>
      </footer>

      {quoteOpen && <QuoteModal onClose={() => { setQuoteOpen(false); setQuotePrefill(""); }} prefillDescription={quotePrefill} />}
      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} lang="en" />}
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
