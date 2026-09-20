"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Mail, Languages } from "lucide-react";
import { QuoteModal } from "@/components/QuoteModal";
import { ContactModal } from "@/components/ContactModal";

// src/app/about/AboutClient.tsx의 영문 버전. src/app/en/page.tsx 상단 주석과 같은 이유로
// 별도 파일로 관리한다(자동 동기화 없음, 한국어 쪽을 고치면 여기도 수동으로 반영).
//
// 연혁(HISTORY)의 파트너사 상호(서연전자·태승전자·오아시스랩스·파운드/파운디드 등)는 공식
// 영문 표기를 확인하지 못해 발음을 그대로 로마자 표기했다 — 실제 대외 공식 영문명이 있으면
// 교체할 것.
const NAV_LINKS = [
  { href: "/en/about", label: "About", isLink: true },
  { href: "/en/service", label: "Services", isLink: true },
  { href: "/en/process", label: "Process", isLink: true },
  { href: "/en/portfolio", label: "Portfolio", isLink: true },
  { href: "/en/ai-analysis", label: "AI Analysis", isLink: true },
];

const HISTORY = [
  {
    year: "2005",
    items: [
      "Maxon Philippines partnership — DECT development and parts supply",
    ],
  },
  {
    year: "2006",
    items: [
      "MEI (UK) partnership — Data radio development and parts supply",
    ],
  },
  {
    year: "2007",
    items: [
      "PrimaTech partnership — Product development, parts and finished goods supply",
    ],
  },
  {
    year: "2008",
    items: [
      "Midland (Thai Radio) partnership — Parts development and supply",
      "Seoyeon Electronics Co., Ltd. partnership — Product development, parts and finished goods supply",
    ],
  },
  {
    year: "2009",
    items: [
      "Shinjimoru Co., Ltd. partnership — Product development, parts and finished goods supply",
      "Roswin Co., Ltd. partnership — Parts development and supply",
      "GreenPheonix partnership — Product development, parts and finished goods supply",
    ],
  },
  {
    year: "2013",
    items: [
      "Taesung Electronics Co., Ltd. partnership — Product development, parts and finished goods supply",
    ],
  },
  { year: "2017", items: ["Found/Founded Co., Ltd. partnership — Product development and finished goods supply"] },
  {
    year: "2019",
    items: [
      "PurpleNest Co., Ltd. partnership — Product development, parts and finished goods supply",
      "Seoyeon Electronics Co., Ltd. partnership — Product development, parts and finished goods supply",
    ],
  },
  { year: "2020", items: ["HANDYHAND Co., Ltd. brand launch"] },
  {
    year: "2021",
    items: [
      "Oasis Labs Co., Ltd. partnership — Product development, parts and finished goods supply",
    ],
  },
  {
    year: "2022",
    items: [
      "HANDYHAND × Disney IP product — Launched Mickey Mouse car wireless charging mount",
      "Naver Webtoon 'Doknip Diary' IP product — Launched car wireless charging mount",
    ],
  },
  {
    year: "2023",
    items: [
      "Registered as an official Wadiz consultant",
      "Registered as a Wadiz Partner",
    ],
  },
  {
    year: "2025",
    items: [
      "Launched TPS cosmetic packaging total solution",
      "Signed OEM partnerships with multiple cosmetics factories",
    ],
  },
  {
    year: "2026",
    items: [
      "Launched the HANDYWORKS platform",
    ],
  },
];

export default function AboutPage() {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
                item.href === "/en/about" ? (
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
                  } ${item.href === "/en/about" ? "text-white" : "text-white/70"}`}
                >
                  <span className="text-xs font-medium text-white/25">{String(i + 1).padStart(2, "0")}</span>
                  <span>{item.label}</span>
                  {item.href === "/en/about" && <span className="ml-auto h-1 w-1 rounded-full bg-[#F1CE00]" />}
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
        href="/about"
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
          src="/about-hero-products.jpg"
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
            Who We Are
          </p>
          <h1 className="mb-5 text-4xl font-bold leading-tight text-white sm:text-5xl">
            Product development, start to finish
          </h1>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-white/50">
            A manufacturing partner that has<br className="sm:hidden" /> built hundreds of products together — HANDYHAND.
          </p>
        </div>
      </section>

      {/* Core capabilities */}
      <section className="bg-[#f5f5f7] px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-5 sm:rounded-3xl sm:p-8">
              <span className="mb-3 block h-1 w-8 rounded-full bg-[#F1CE00]" />
              <div className="mb-4 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-[#1d1d1f] sm:text-3xl">300+</span>
                <span className="text-xs text-[#86868b]">Products Developed</span>
              </div>
              <h3 className="mb-2 text-base font-semibold text-[#1d1d1f] sm:mb-3 sm:text-lg">All-in-One Product Development</h3>
              <p className="text-sm leading-relaxed text-[#86868b]">
                We handle everything from product planning to design, tooling, production, landing page design, and crowdfunding launch support.
              </p>
            </div>
            <div className="rounded-2xl bg-white p-5 sm:rounded-3xl sm:p-8">
              <span className="mb-3 block h-1 w-8 rounded-full bg-[#F1CE00]" />
              <div className="mb-4 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-[#1d1d1f] sm:text-3xl">30+</span>
                <span className="text-xs text-[#86868b]">Partner Brands, KR &amp; Abroad</span>
              </div>
              <h3 className="mb-2 text-base font-semibold text-[#1d1d1f] sm:mb-3 sm:text-lg">Global Network</h3>
              <p className="text-sm leading-relaxed text-[#86868b]">
                Since our founding in Hong Kong in 2005, we&apos;ve partnered with companies across many countries to develop and supply products and components.
              </p>
            </div>
            <div className="rounded-2xl bg-white p-5 sm:rounded-3xl sm:p-8">
              <span className="mb-3 block h-1 w-8 rounded-full bg-[#F1CE00]" />
              <div className="mb-4 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-[#1d1d1f] sm:text-3xl">40+</span>
                <span className="text-xs text-[#86868b]">Years of Engineering Experience</span>
              </div>
              <h3 className="mb-2 text-base font-semibold text-[#1d1d1f] sm:mb-3 sm:text-lg">Decades of Engineering Know-how</h3>
              <p className="text-sm leading-relaxed text-[#86868b]">
                HANDYHAND&apos;s core development team brings over 40 years of combined experience in mechanical engineering and product development.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* History */}
      <section className="bg-white px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
            History
          </p>
          <h2 className="mb-6 text-3xl font-bold text-[#1d1d1f] sm:mb-8 sm:text-4xl">History</h2>
          <div className="relative border-l border-black/10 pl-8 sm:pl-12">
            {HISTORY.map(({ year, items }, i) => (
              <div key={year} className={i < HISTORY.length - 1 ? "pb-10 sm:pb-14" : ""}>
                <div className="relative">
                  <span className="absolute -left-[37px] top-1 h-2.5 w-2.5 rounded-full bg-[#F1CE00] ring-4 ring-white sm:-left-[53px]" />
                  <p className="mb-2 text-2xl font-bold text-[#1d1d1f] sm:text-3xl">{year}</p>
                </div>
                <ul className="space-y-1.5">
                  {items.map((item) => (
                    <li key={item} className="text-sm leading-relaxed text-[#86868b] sm:text-base">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Company info */}
      <section className="bg-[#f5f5f7] px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
            Company Info
          </p>
          <h2 className="mb-6 text-3xl font-bold text-[#1d1d1f] sm:mb-8 sm:text-4xl">Company Information</h2>
          <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex h-full flex-col rounded-2xl border border-transparent bg-white p-5 sm:rounded-3xl sm:p-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className="mb-5 flex h-10 items-center self-start sm:h-11">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-handyhand.png" alt="HANDYHAND" className="h-6 w-auto sm:h-7" />
            </div>
            <p className="mb-5 text-sm leading-relaxed text-[#86868b]">
              <span className="font-medium text-[#1d1d1f]">HANDYHAND Co., Ltd.</span> is a Korean corporation founded in 2013, based in Goyang, Gyeonggi-do, providing one-stop manufacturing from product planning to design, tooling, and mass production.
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 text-sm sm:gap-x-8 sm:gap-y-7">
              {[
                { label: "Company Name", value: "HANDYHAND Co., Ltd." },
                { label: "CEO", value: "Hyungjun Choi" },
                { label: "Founded", value: "October 2013" },
                { label: "Business Registration No.", value: "128-87-00105" },
                { label: "Mail-Order Business License No.", value: "2020-Goyangdeogyanggu-1900" },
                { label: "Phone", value: "+82-70-8835-2311" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="mb-1 text-xs text-[#86868b]">{label}</p>
                  <p className="font-medium text-[#1d1d1f]">{value}</p>
                </div>
              ))}
              <div className="col-span-2">
                <p className="mb-1 text-xs text-[#86868b]">Email</p>
                <p className="font-medium text-[#1d1d1f]">handyhand91@naver.com</p>
              </div>
              <div className="col-span-2">
                <p className="mb-1 text-xs text-[#86868b]">Address</p>
                <p className="font-medium text-[#1d1d1f]">F804, Goyang ARC Biz Knowledge Industry Center, 63 Samwon-ro, Deogyang-gu, Goyang-si, Gyeonggi-do, Korea</p>
              </div>
              <div className="col-span-2 flex flex-wrap gap-x-6 gap-y-2">
                <a
                  href="https://m.smartstore.naver.com/handyhand"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1d1d1f] underline underline-offset-4 transition hover:text-[#8a6d00]"
                >
                  Visit Our Naver Store →
                </a>
                <a
                  href="http://pf.kakao.com/_Xxjfkxb/chat"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1d1d1f] underline underline-offset-4 transition hover:text-[#8a6d00]"
                >
                  Chat on KakaoTalk →
                </a>
              </div>
              <div className="col-span-2 mt-2 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/kakao-qr.png" alt="HANDYHAND KakaoTalk channel QR code" className="h-16 w-16 rounded-lg border border-black/5" />
                <p className="text-xs text-[#86868b]">Scan the QR code to<br className="sm:hidden" /> connect directly to our KakaoTalk channel.</p>
              </div>
            </div>
            <div className="mt-5 overflow-hidden rounded-2xl sm:rounded-3xl">
              <iframe
                title="HANDYHAND Location"
                src="https://maps.google.com/maps?q=37.6400267,126.8754131&output=embed&hl=en&z=17"
                width="100%"
                height="100%"
                style={{ border: 0, minHeight: "240px" }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-full min-h-[240px] w-full"
              />
            </div>
          </div>

          <div className="flex h-full flex-col rounded-2xl border border-transparent bg-white p-5 sm:rounded-3xl sm:p-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className="mb-5 flex h-10 items-center self-start sm:h-11">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-aim-technology.png" alt="AIM Technology" className="h-10 w-auto sm:h-11" />
            </div>
            <p className="mb-5 text-sm leading-relaxed text-[#86868b]">
              <span className="font-medium text-[#1d1d1f]">AIM Technology (HK) Co., Ltd</span> is our parent company. We established the Korean entity HANDYHAND Co., Ltd. in 2013, operating product development and production across both Korea and China.
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-5 text-sm">
              {[
                { label: "Company Name", value: "AIM Technology (HK) Co., Ltd" },
                { label: "Founded", value: "December 2005" },
                { label: "Headquarters", value: "Hong Kong, China" },
                { label: "CEO", value: "Philip Choi" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="mb-1 text-xs text-[#86868b]">{label}</p>
                  <p className="font-medium text-[#1d1d1f]">{value}</p>
                </div>
              ))}
              <div className="col-span-2">
                <p className="mb-1 text-xs text-[#86868b]">Address</p>
                <p className="font-medium text-[#1d1d1f]">11/F, CNT House, 120 Johnston Road, Wanchai, Hong Kong</p>
              </div>
            </div>
            <div className="flex-1" />
            <div className="mt-5 overflow-hidden rounded-2xl sm:rounded-3xl">
              <iframe
                title="AIM Technology (HK) Location"
                src="https://maps.google.com/maps?q=11%2FF%2C%20CNT%20House%2C%20120%20Johnston%20Road%2C%20Wanchai%2C%20Hong%20Kong&output=embed&hl=en&z=16"
                width="100%"
                height="100%"
                style={{ border: 0, minHeight: "240px" }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-full min-h-[240px] w-full"
              />
            </div>
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

      {quoteOpen && <QuoteModal onClose={() => setQuoteOpen(false)} />}
      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} lang="en" />}
    </div>
  );
}
