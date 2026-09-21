"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, BadgeCheck, Mail, Languages } from "lucide-react";
import { PortfolioImageSlider } from "@/components/PortfolioImageSlider";
import { ProjectDetailModal } from "@/components/ProjectDetailModal";
import { QuoteModal } from "@/components/QuoteModal";
import { ContactModal } from "@/components/ContactModal";

// src/app/portfolio/PortfolioClient.tsx의 영문 버전. src/app/en/page.tsx 상단 주석과 같은
// 이유로 별도 파일로 관리한다(자동 동기화 없음).
const NAV_LINKS = [
  { href: "/en/about", label: "About" },
  { href: "/en/service", label: "Services" },
  { href: "/en/process", label: "Process" },
  { href: "/en/portfolio", label: "Portfolio" },
  { href: "/en/ai-analysis", label: "AI Analysis" },
];

const CASES = [
  { client: "MIDLAND", category: "US Two-Way Radio Manufacturer", desc: "A US two-way radio specialist we've partnered with since 2008, supplying components. We handled development through mass production of a convertible vehicle RF microphone, with cumulative supply of over 500,000 units.", tag: "B2B · Engineering · Mass Production", images: ["/portfolio-midland.png"] },
  { client: "Shinjimoru", category: "Smartphone Accessories", desc: "A leading Korean smartphone accessory brand we've partnered with since 2009, handling their product development. Their products reached #1 in Coupang's smartphone accessories category, and our collaboration has since expanded beyond accessories into electronics supply.", tag: "B2B · Development · Mass Production", images: ["/portfolio-shinjimoru-2.png","/portfolio-shinjimoru-3.png","/portfolio-shinjimoru-4.png","/portfolio-shinjimoru-5.png","/portfolio-shinjimoru-6.png","/portfolio-shinjimoru-7.png","/portfolio-shinjimoru-8.png","/portfolio-shinjimoru-9.png","/portfolio-shinjimoru-10.png","/portfolio-shinjimoru-11.png","/portfolio-shinjimoru-12.png","/portfolio-shinjimoru-13.png"] },
  { client: "Oasis Labs", category: "KAIST-Founded Startup", desc: "A startup founded by KAIST alumni. We handled product development and mass production, building the tooling ourselves and taking responsibility for the entire process through production and delivery.", tag: "B2B · Startup", images: ["/portfolio-oasis.png"] },
  { client: "PurpleNest", category: "Pet Products", desc: "A pet products brand we've partnered with since 2019. We handle their product development, working together from tooling through mass production.", tag: "B2B · Development · Mass Production", images: ["/portfolio-purplenest-1.png", "/portfolio-purplenest-2.png", "/portfolio-purplenest-3.png"] },
  { client: "Found/Founded", category: "Design Object Brand", desc: "A partnership with a design object brand dating back to 2017. We combined die casting, machining, and other manufacturing methods to bring intricate design objects to mass production and supply.", tag: "B2B · Development · Mass Production", images: ["/portfolio-foundfoundied-1.png", "/portfolio-foundfoundied-2.png", "/portfolio-foundfoundied-3.png", "/portfolio-foundfoundied-4.png", "/portfolio-foundfoundied-5.png"] },
];

const BRAND_PRODUCTS = [
  { name: "HandyGrab", tag: "Development · Mass Production · Patent", desc: "A motorized wireless car charging mount for smartphones. We handled every step ourselves — planning, design, mechanical engineering, PCBA hardware, software development, tooling, and mass production. HANDYHAND's flagship in-house product, with a registered Korean patent.", images: ["/portfolio-handygrip-2.png"], patented: true },
  { name: "HandySlap", tag: "Development · Mass Production · Patent", desc: "A follow-up to HandyGrab in our in-house wireless car charging mount lineup. Developed and released as a MagSafe magnetic mount, also independently developed, designed, and patented in Korea.", images: ["/portfolio-handygrip-1.png"], patented: true },
  { name: "HandyPocket", tag: "Development · Mass Production · Patent", desc: "A card case that attaches via MagSafe or a nano-adhesive pad — magnetically to iPhones, or with the nano pad for phones without magnets — developed in-house for easy attach and detach. A HANDYHAND in-house product with a registered Korean patent.", images: ["/portfolio-handarocket-1.png", "/portfolio-handarocket-2.png", "/portfolio-handarocket-3.png", "/portfolio-handarocket-4.png"], patented: true },
  { name: "Mickey Mouse Charging Mount", tag: "In-house Development · Character IP", desc: "A car wireless charging mount released as a licensed character product using Disney IP. HANDYHAND handled everything directly, from tooling to mass production.", images: ["/portfolio-mickey-1.png"], patented: false },
  { name: "Naver 'Doknip Diary' Car Charger", tag: "In-house Development · Character IP", desc: "A car wireless charging mount using a character license from the Naver Webtoon 'Doknip Diary.' We completed tooling and mass production in-house for this character IP-based product.", images: ["/portfolio-dokrip-1.png"], patented: false },
  { name: "HandyWatch", tag: "Development · Mass Production · Patent", desc: "A stainless steel Apple Watch case made with CNC machining. A DIY product we handled ourselves from planning to design, engineering, and production, with a registered Korean patent.", images: ["/portfolio-handywatch-1.png", "/portfolio-handywatch-2.png", "/portfolio-handywatch-3.png"], patented: true },
];

export default function PortfolioPage() {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<(typeof CASES)[number] | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<(typeof BRAND_PRODUCTS)[number] | null>(null);

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
                item.href === "/en/portfolio" ? (
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
                  } ${item.href === "/en/portfolio" ? "text-white" : "text-white/70"}`}
                >
                  <span className="text-xs font-medium text-white/25">{String(i + 1).padStart(2, "0")}</span>
                  <span>{item.label}</span>
                  {item.href === "/en/portfolio" && <span className="ml-auto h-1 w-1 rounded-full bg-[#F1CE00]" />}
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
        href="/portfolio"
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
          src="/portfolio-foundfoundied-1.png"
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
            Past Development Works
          </p>
          <h1 className="mb-5 text-4xl font-bold leading-tight text-white sm:text-5xl">
            What We&apos;ve Built Together
          </h1>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-white/50">
            From client projects to our own in-house brands —<br className="sm:hidden" /> projects completed from development through production and delivery.
          </p>
        </div>
      </section>

      {/* Client projects */}
      <section id="cases" className="scroll-mt-24 bg-[#f5f5f7] px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
            Client Projects
          </p>
          <h2 className="mb-3 text-3xl font-bold text-[#1d1d1f] sm:text-4xl">Client Projects</h2>
          <p className="mb-8 max-w-lg text-sm leading-relaxed text-[#86868b] sm:text-base">
            Real projects carried out with brands across various industries<br className="sm:hidden" /> — from planning to mass production.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CASES.map((item) => (
              <button
                key={item.client}
                onClick={() => setSelectedCase(item)}
                className="flex h-full flex-col overflow-hidden rounded-2xl bg-white text-left transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-10px_rgba(0,0,0,0.15)] sm:rounded-3xl"
              >
                <PortfolioImageSlider images={item.images} alt={`${item.client} ${item.category}`.trim()} />
                {/* Card height is already matched per grid row, but shorter descriptions left
                    all the slack as blank space below the text — centering distributes it evenly. */}
                <div className="flex flex-1 flex-col justify-center p-5 sm:p-6">
                  <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-[#f5f5f7] px-2.5 py-0.5 text-xs font-medium text-[#86868b]">
                    <span className="h-1 w-1 rounded-full bg-[#F1CE00]" />
                    {item.tag}
                  </span>
                  <h3 className="mt-3 text-base font-bold text-[#1d1d1f]">{item.client}</h3>
                  <p className="text-xs text-[#86868b]">{item.category}</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#86868b]">{item.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* In-house brands */}
      <section id="brand" className="scroll-mt-24 bg-white px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
            Private Brand
          </p>
          <h2 className="mb-3 text-3xl font-bold text-[#1d1d1f] sm:text-4xl">In-House Brands</h2>
          <p className="mb-8 max-w-lg text-sm leading-relaxed text-[#86868b] sm:text-base">
            Patented products HANDYHAND planned and built entirely in-house —<br className="sm:hidden" /> from planning to design, tooling, and mass production.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BRAND_PRODUCTS.map((item) => (
              <button
                key={item.name}
                onClick={() => setSelectedBrand(item)}
                className="flex h-full flex-col overflow-hidden rounded-2xl bg-[#f5f5f7] text-left transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-10px_rgba(0,0,0,0.15)] sm:rounded-3xl"
              >
                <div className="relative">
                  <PortfolioImageSlider images={item.images} alt={`HANDYHAND in-house brand ${item.name}`} />
                  {item.patented && (
                    <span className="absolute left-3 top-3 z-20 inline-flex items-center gap-1 rounded-full bg-[#1d1d1f] px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm">
                      <BadgeCheck size={12} className="text-[#F1CE00]" />
                      Patented
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-center p-5 sm:p-6">
                  <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-[#86868b]">
                    <span className="h-1 w-1 rounded-full bg-[#F1CE00]" />
                    {item.tag}
                  </span>
                  <h3 className="mt-3 text-base font-bold text-[#1d1d1f]">{item.name}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#86868b]">{item.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-8 flex justify-center sm:justify-start">
            <div className="inline-flex flex-col gap-3 sm:flex-row">
              <a
                href="https://m.smartstore.naver.com/handyhand"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-72 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#03C75A] px-6 py-3 text-center text-sm font-semibold text-white transition hover:brightness-95"
              >
                Buy on Naver Store →
              </a>
              <a
                href="https://app.wadiz.kr/links/zsvF0zX26t"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-72 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#3DBDF5] px-6 py-3 text-center text-sm font-semibold text-white transition hover:brightness-95"
              >
                HANDYHAND on Wadiz →
              </a>
            </div>
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
        <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">Ready to get started together?</h2>
        <p className="mb-10 text-[#86868b]">If you have a product idea, let&apos;s talk today.</p>
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

      {selectedCase && (
        <ProjectDetailModal
          item={{ title: selectedCase.client, category: selectedCase.category, tag: selectedCase.tag, desc: selectedCase.desc, images: selectedCase.images }}
          onClose={() => setSelectedCase(null)}
          onQuote={() => { setSelectedCase(null); setQuoteOpen(true); }}
        />
      )}
      {selectedBrand && (
        <ProjectDetailModal
          item={{ title: selectedBrand.name, tag: selectedBrand.tag, desc: selectedBrand.desc, images: selectedBrand.images, patented: selectedBrand.patented }}
          onClose={() => setSelectedBrand(null)}
          onQuote={() => { setSelectedBrand(null); setQuoteOpen(true); }}
        />
      )}
      {quoteOpen && <QuoteModal onClose={() => setQuoteOpen(false)} lang="en" />}
      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} lang="en" />}
    </div>
  );
}
