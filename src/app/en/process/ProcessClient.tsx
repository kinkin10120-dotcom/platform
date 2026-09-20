"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Menu,
  X,
  Lightbulb,
  PenTool,
  Ruler,
  FlaskConical,
  Factory,
  PackageCheck,
  Package,
  FileText,
  Truck,
  Mail,
  ChevronDown,
  Languages,
} from "lucide-react";
import { QuoteModal } from "@/components/QuoteModal";
import { ContactModal } from "@/components/ContactModal";

// src/app/process/ProcessClient.tsx의 영문 버전. src/app/en/page.tsx 상단 주석과 같은 이유로
// 별도 파일로 관리한다(자동 동기화 없음).
const NAV_LINKS = [
  { href: "/en/about", label: "About" },
  { href: "/en/service", label: "Services" },
  { href: "/en/process", label: "Process" },
  { href: "/en/portfolio", label: "Portfolio" },
  { href: "/en/ai-analysis", label: "AI Analysis" },
];

const STEPS = [
  {
    step: "01",
    title: "Product Development Planning",
    summary: "After an initial meeting and contract, we define your idea into concrete product specifications.",
    detail: "We discuss direction in an initial meeting (in-person or video), sign a contract, and establish the product concept — defining features, target price, production volume, and other key decisions needed to bring the product to life.",
    tags: ["Contract", "Concept Planning", "Market Research", "Feature Definition", "Spec Definition"],
    icon: Lightbulb,
    category: "development",
  },
  {
    step: "02",
    title: "Product Design",
    summary: "We design the product's exterior and user experience.",
    detail: "Our product designers finalize the exterior through sketches and renderings — creating a design that stands out in the market while reflecting your brand identity and usability.",
    tags: ["Industrial Design", "Rendering", "CMF Design", "UX Consideration"],
    icon: PenTool,
    category: "development",
  },
  {
    step: "03",
    title: "Product Engineering (Mechanical & Hardware)",
    summary: "We turn the design into production-ready 3D drawings.",
    detail: "Our mechanical engineers use professional tools to complete the engineering, considering assembly, moldability, durability, and material — finishing drawings that carry straight through to mass production. Hardware (PCBA) design and software development run in parallel when needed.",
    tags: ["3D Modeling", "Mechanical Engineering", "PCB Design", "DFM Review"],
    icon: Ruler,
    category: "development",
  },
  {
    step: "04",
    title: "Prototyping",
    summary: "We validate shape and function with a physical sample before mass production.",
    detail: "We build prototypes using 3D printing, CNC machining, and vacuum casting to verify design, function, and assembly. Catching issues early lets us revise the design before tooling, minimizing costly rework later.",
    tags: ["3D Printing", "CNC Mockup", "Function Testing", "Design Revision"],
    icon: FlaskConical,
    category: "development",
  },
  {
    step: "05",
    title: "Tooling",
    summary: "We design and build the molds that make mass production possible.",
    detail: "Working with our partner factories in Guangdong, China, we build injection molds, die-casting tools, and more. After trial shots, we run T1/T2 verification — dimensional and visual inspection — to confirm the tooling meets production standards.",
    tags: ["Injection Molding", "Die Casting", "T1/T2 Verification", "Dimensional Inspection"],
    icon: Factory,
    category: "production",
  },
  {
    step: "06",
    title: "Mass Production",
    summary: "We run full-scale production using the completed tooling.",
    detail: "We run production with the completed tooling, managing quality control directly throughout to minimize defects. Production status is shared with you in real time through the HANDYWORKS platform.",
    tags: ["Mass Production", "Quality Control", "Process Monitoring", "Defect Inspection"],
    icon: PackageCheck,
    category: "production",
  },
  {
    step: "07",
    title: "Packaging",
    summary: "We design and produce packaging that adds value to your product.",
    detail: "We plan packaging design to match your product concept and produce everything from boxes to inner packaging and labels — including eco-friendly materials and unboxing experience design, considering every consumer touchpoint.",
    tags: ["Packaging Design", "Box Production", "Label Design", "Eco-Friendly Materials"],
    icon: Package,
    category: "branding",
  },
  {
    step: "08",
    title: "Landing Page Design",
    summary: "We create the online landing page that best showcases your product.",
    detail: "We plan and design landing pages optimized for online sales channels like Smartstore, Coupang, Wadiz, and your own store — boosting conversion with copywriting and imagery that effectively communicate your product's strengths.",
    tags: ["Landing Page Planning", "Design", "Copywriting", "Channel Optimization"],
    icon: FileText,
    category: "branding",
  },
  {
    step: "09",
    title: "Shipping & Delivery",
    summary: "We handle shipping and customs clearance, supporting you all the way to final delivery.",
    detail: "We handle shipping and customs clearance from China or within Korea to your door, and support the certifications and paperwork needed for overseas export.",
    tags: ["Shipping & Customs", "Export", "Certification Support"],
    icon: Truck,
    category: "production",
  },
];

const CATEGORY_COLOR: Record<string, { bg: string; icon: string; label: string; badge: string }> = {
  development: { bg: "bg-[#1d1d1f]", icon: "text-[#F1CE00]", label: "Development", badge: "bg-[#F1CE00]/15 text-[#8a6d00]" },
  production: { bg: "bg-[#F1CE00]", icon: "text-[#1d1d1f]", label: "Production", badge: "bg-[#dbeafe] text-[#1d4ed8]" },
  branding: { bg: "bg-[#e2e2e5]", icon: "text-[#1d1d1f]", label: "Branding", badge: "bg-[#f3e8ff] text-[#7c3aed]" },
};

export default function ProcessPage() {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openStep, setOpenStep] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
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
                item.href === "/en/process" ? (
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
                  } ${item.href === "/en/process" ? "text-white" : "text-white/70"}`}
                >
                  <span className="text-xs font-medium text-white/25">{String(i + 1).padStart(2, "0")}</span>
                  <span>{item.label}</span>
                  {item.href === "/en/process" && <span className="ml-auto h-1 w-1 rounded-full bg-[#F1CE00]" />}
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
        href="/process"
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
          src="/hero-process.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-90"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(29,29,31,0.35) 0%, rgba(29,29,31,0.3) 45%, #1d1d1f 100%)" }}
        />
        <div className="relative">
          <p className="mb-4 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#F1CE00]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
            Manufacturing Process
          </p>
          <h1 className="mb-5 text-4xl font-bold leading-tight text-white sm:text-5xl">
            From Development to Delivery
          </h1>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-white/50">
            From a single idea to a finished product —<br className="sm:hidden" /> here&apos;s the 9-step process HANDYHAND takes you through.
          </p>
        </div>
      </section>

      {/* One-stop flow diagram */}
      <section className="bg-[#f5f5f7] px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
            Process
          </p>
          <h2 className="mb-3 text-3xl font-bold leading-snug text-[#1d1d1f] sm:text-4xl">
            The entire process, unified
          </h2>
          <p className="mb-8 text-sm leading-relaxed text-[#86868b] sm:text-base">
            Steps may be simplified or adjusted<br className="sm:hidden" /> depending on the client and project.
          </p>
          <div className="grid grid-cols-3 gap-x-4 gap-y-8 sm:gap-y-10 lg:grid-cols-9 lg:gap-x-2">
            {STEPS.map((s, i) => {
              const c = CATEGORY_COLOR[s.category];
              return (
                <div key={s.step} className="flex flex-col items-center gap-3">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full sm:h-14 sm:w-14 ${c.bg}`}>
                    <s.icon size={18} className={`sm:hidden ${c.icon}`} />
                    <s.icon size={20} className={`hidden sm:block ${c.icon}`} />
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-center text-[9px] font-bold uppercase tracking-wider text-[#1d1d1f] sm:text-[10px]">
                      Step {i + 1}
                    </span>
                    <span className="text-center text-[11px] font-medium leading-tight text-[#1d1d1f] sm:text-xs">
                      {s.title.replace(/\s*\(.*\)/, "")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-x-5 gap-y-2 sm:mt-14 sm:justify-start">
            {Object.entries(CATEGORY_COLOR).map(([key, c]) => (
              <span key={key} className="flex items-center gap-1.5 text-xs text-[#86868b]">
                <span className={`h-2.5 w-2.5 rounded-full ${c.bg}`} />
                {c.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
          Steps
        </p>
        <h2 className="mb-3 text-3xl font-bold text-[#1d1d1f] sm:text-4xl">
          A {STEPS.length}-Step Process
        </h2>
        <p className="mb-6 text-sm leading-relaxed text-[#86868b] sm:mb-8 sm:text-base">
          From product planning to shipping, see exactly<br className="sm:hidden" /> what happens at each step.
        </p>

        {/* Step card grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s) => {
            const c = CATEGORY_COLOR[s.category];
            const open = openStep === s.step;
            return (
              <div
                key={s.step}
                className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03),0_10px_24px_-8px_rgba(0,0,0,0.06)] sm:rounded-3xl"
              >
                <div className={`h-1.5 w-full ${c.bg}`} />
                <button onClick={() => setOpenStep(open ? null : s.step)} className="w-full p-6 text-left sm:p-7">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest text-[#1d1d1f]">STEP {s.step}</span>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${c.bg}`}>
                      <s.icon size={17} className={c.icon} />
                    </div>
                  </div>
                  <span className={`mb-3 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${c.badge}`}>
                    {c.label}
                  </span>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="mb-1 mt-2 text-base font-bold text-[#1d1d1f] sm:text-lg">{s.title}</h3>
                      <p className="text-xs text-[#86868b] sm:text-sm">{s.summary}</p>
                    </div>
                    <ChevronDown size={16} className={`mt-3 shrink-0 transition-transform ${open ? "rotate-180 text-[#1d1d1f]" : "text-[#86868b]"}`} />
                  </div>
                </button>
                {open && (
                  <div className="border-t border-[#f0f0f0] px-6 pb-6 pt-4 sm:px-7 sm:pb-7">
                    <p className="text-sm leading-relaxed text-[#86868b]">{s.detail}</p>
                  </div>
                )}
              </div>
            );
          })}
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
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">Get in touch today</h2>
          <p className="mb-10 text-[#86868b]">Wherever you are in development, we welcome you.<br className="sm:hidden" />Even just an idea is enough to start.</p>
          <div className="flex justify-center">
            <div className="inline-flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => setQuoteOpen(true)}
                className="rounded-full bg-white px-8 py-3 text-center text-sm font-semibold text-black transition hover:bg-white/90"
              >
                Request a Quote
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

      {quoteOpen && <QuoteModal onClose={() => setQuoteOpen(false)} />}
      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} lang="en" />}
    </div>
  );
}
