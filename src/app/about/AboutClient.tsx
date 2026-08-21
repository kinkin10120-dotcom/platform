"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Mail } from "lucide-react";
import { QuoteModal } from "@/components/QuoteModal";
import { ContactModal } from "@/components/ContactModal";

const NAV_LINKS = [
  { href: "/about", label: "기업소개", isLink: true },
  { href: "/service", label: "서비스", isLink: true },
  { href: "/process", label: "프로세스", isLink: true },
  { href: "/portfolio", label: "개발사례", isLink: true },
  { href: "/ai-analysis", label: "AI 제조분석", isLink: true },
];

const HISTORY = [
  {
    year: "2005",
    items: [
      "맥슨 필리핀 파트너쉽 — DECT 개발, 부품 공급",
    ],
  },
  {
    year: "2006",
    items: [
      "MEI (UK) 파트너십 — DATA RADIO 개발 및 부품 공급",
    ],
  },
  {
    year: "2007",
    items: [
      "PrimaTech 파트너십 — 제품 개발, 부품·완제품 공급",
    ],
  },
  {
    year: "2008",
    items: [
      "미드랜드(THAI RADIO) 파트너십 — 부품개발, 부품 공급",
      "서연전자㈜ 파트너십 — 제품 개발, 부품·완제품 공급",
    ],
  },
  {
    year: "2009",
    items: [
      "신지모루㈜ 파트너십 — 제품 개발, 부품·완제품 공급",
      "Roswin㈜ 파트너십 — 부품 개발, 부품 공급",
      "GreenPheonix 파트너십 — 제품 개발, 부품·완제품 공급",
    ],
  },
  {
    year: "2013",
    items: [
      "태승전자㈜ 파트너십 — 제품 개발, 부품·완제품 공급",
    ],
  },
  { year: "2017", items: ["파운드/파운디드㈜ 파트너십 — 제품 개발, 완제품 공급"] },
  {
    year: "2019",
    items: [
      "퍼플네스트㈜ 파트너십 — 제품 개발, 부품·완제품 공급",
      "서연전자㈜ 파트너십 — 제품 개발, 부품·완제품 공급",
    ],
  },
  { year: "2020", items: ["핸디핸드㈜ 브랜드 론칭"] },
  {
    year: "2021",
    items: [
      "오아시스랩스㈜ 파트너십 — 제품 개발, 부품·완제품 공급",
    ],
  },
  {
    year: "2022",
    items: [
      "핸디핸드 디즈니 IP 제품화 — 미키마우스 차량용 무선충전 거치대 론칭",
      "네이버 웹툰 독립일기 IP 제품화 — 차량용 무선충전 거치대 론칭",
    ],
  },
  {
    year: "2023",
    items: [
      "와디즈 공식 컨설턴트 등록",
      "와디즈 파트너스 등록",
    ],
  },
  {
    year: "2025",
    items: [
      "TPS 코스메틱 패키지 종합 솔루션 런칭",
      "코스메틱 다수 공장과 OEM 파트너십 체결",
    ],
  },
  {
    year: "2026",
    items: [
      "HANDYWORKS 플랫폼 런칭",
    ],
  },
];

export default function AboutPage() {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* 네비게이션 */}
      <nav className="fixed top-[calc(1rem+env(safe-area-inset-top))] z-50 w-full px-4 sm:px-8 [transform:translateZ(0)] [will-change:transform]">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between rounded-full border border-white/15 bg-black/70 px-5 py-2.5 backdrop-blur-xl">
            <Link href="/">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="HANDYHAND" className="h-4 w-auto sm:h-5" />
            </Link>
            <div className="hidden items-center gap-5 lg:flex">
              {NAV_LINKS.map((item) =>
                item.href === "/about" ? (
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
              {[...NAV_LINKS, { href: "/handyworks", label: "HANDYWORKS ↗" }].map((item, i, arr) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3.5 text-sm transition hover:bg-white/10 hover:text-white ${
                    i < arr.length - 1 ? "border-b border-white/[0.06]" : ""
                  } ${item.href === "/about" ? "text-white" : "text-white/70"}`}
                >
                  <span className="text-xs font-medium text-white/25">{String(i + 1).padStart(2, "0")}</span>
                  <span>{item.label}</span>
                  {item.href === "/about" && <span className="ml-auto h-1 w-1 rounded-full bg-[#F1CE00]" />}
                </Link>
              ))}
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

      {/* 히어로 */}
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
            제품화, 처음부터 끝까지
          </h1>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-white/50">
            수백 개의 제품을 함께 만들어온<br className="sm:hidden" />
            제조 파트너, 핸디핸드입니다.
          </p>
        </div>
      </section>

      {/* 핵심 역량 */}
      <section className="bg-[#f5f5f7] px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-5 sm:rounded-3xl sm:p-8">
              <span className="mb-3 block h-1 w-8 rounded-full bg-[#F1CE00]" />
              <div className="mb-4 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-[#1d1d1f] sm:text-3xl">300+</span>
                <span className="text-xs text-[#86868b]">누적 개발 제품</span>
              </div>
              <h3 className="mb-2 text-base font-semibold text-[#1d1d1f] sm:mb-3 sm:text-lg">올인원 제품화</h3>
              <p className="text-sm leading-relaxed text-[#86868b]">
                제품 기획부터 설계, 금형, 생산, 상세페이지 제작, 크라우드 펀딩 런칭 지원까지 전 과정을 진행합니다.
              </p>
            </div>
            <div className="rounded-2xl bg-white p-5 sm:rounded-3xl sm:p-8">
              <span className="mb-3 block h-1 w-8 rounded-full bg-[#F1CE00]" />
              <div className="mb-4 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-[#1d1d1f] sm:text-3xl">30+</span>
                <span className="text-xs text-[#86868b]">국내외 협력 브랜드사</span>
              </div>
              <h3 className="mb-2 text-base font-semibold text-[#1d1d1f] sm:mb-3 sm:text-lg">글로벌 네트워크</h3>
              <p className="text-sm leading-relaxed text-[#86868b]">
                2005년 홍콩 설립 이후 국내외 다수 국가의 업체와 파트너십을 맺고 제품 개발 및 부품 개발을 완료하여 공급해왔습니다.
              </p>
            </div>
            <div className="rounded-2xl bg-white p-5 sm:rounded-3xl sm:p-8">
              <span className="mb-3 block h-1 w-8 rounded-full bg-[#F1CE00]" />
              <div className="mb-4 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-[#1d1d1f] sm:text-3xl">40+</span>
                <span className="text-xs text-[#86868b]">년 설계 경력</span>
              </div>
              <h3 className="mb-2 text-base font-semibold text-[#1d1d1f] sm:mb-3 sm:text-lg">축적된 설계 노하우</h3>
              <p className="text-sm leading-relaxed text-[#86868b]">
                핸디핸드의 핵심 개발 인력은 40년 이상의 기구설계와 제품개발 경력을 보유하고 있습니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 연혁 */}
      <section className="bg-white px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
            History
          </p>
          <h2 className="mb-6 text-3xl font-bold text-[#1d1d1f] sm:mb-8 sm:text-4xl">연혁</h2>
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

      {/* 회사 정보 */}
      <section className="bg-[#f5f5f7] px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
            Company Info
          </p>
          <h2 className="mb-6 text-3xl font-bold text-[#1d1d1f] sm:mb-8 sm:text-4xl">회사 정보</h2>
          <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex h-full flex-col rounded-2xl border border-transparent bg-white p-5 sm:rounded-3xl sm:p-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className="mb-5 flex h-10 items-center self-start sm:h-11">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-handyhand.png" alt="핸디핸드" className="h-6 w-auto sm:h-7" />
            </div>
            <p className="mb-5 text-sm leading-relaxed text-[#86868b]">
              <span className="font-medium text-[#1d1d1f]">주식회사 핸디핸드</span>는 2013년 설립된 국내 법인으로, 경기도 고양시를 거점으로 제품기획부터 설계·금형·양산까지 원스톱 제조를 담당하고 있습니다.
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 text-sm sm:gap-x-8 sm:gap-y-7">
              {[
                { label: "상호", value: "주식회사 핸디핸드" },
                { label: "대표자", value: "최형준" },
                { label: "설립연월", value: "2013년 10월" },
                { label: "사업자등록번호", value: "128-87-00105" },
                { label: "통신판매업 신고번호", value: "2020-고양덕양구-1900" },
                { label: "연락처", value: "070-8835-2311" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="mb-1 text-xs text-[#86868b]">{label}</p>
                  <p className="font-medium text-[#1d1d1f]">{value}</p>
                </div>
              ))}
              <div className="col-span-2">
                <p className="mb-1 text-xs text-[#86868b]">이메일</p>
                <p className="font-medium text-[#1d1d1f]">handyhand91@naver.com</p>
              </div>
              <div className="col-span-2">
                <p className="mb-1 text-xs text-[#86868b]">주소</p>
                <p className="font-medium text-[#1d1d1f]">경기도 고양시 덕양구 삼원로63 고양아크비즈지식산업센터 F804호</p>
              </div>
              <div className="col-span-2 flex flex-wrap gap-x-6 gap-y-2">
                <a
                  href="https://m.smartstore.naver.com/handyhand"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1d1d1f] underline underline-offset-4 transition hover:text-[#8a6d00]"
                >
                  네이버 스토어 바로가기 →
                </a>
                <a
                  href="http://pf.kakao.com/_Xxjfkxb/chat"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1d1d1f] underline underline-offset-4 transition hover:text-[#8a6d00]"
                >
                  카카오톡 채널 문의 →
                </a>
              </div>
              <div className="col-span-2 mt-2 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/kakao-qr.png" alt="핸디핸드 카카오톡 채널 QR코드" className="h-16 w-16 rounded-lg border border-black/5" />
                <p className="text-xs text-[#86868b]">QR코드를 스캔하면<br className="sm:hidden" />카카오톡 채널로 바로 연결됩니다.</p>
              </div>
            </div>
            <div className="mt-5 overflow-hidden rounded-2xl sm:rounded-3xl">
              <iframe
                title="핸디핸드 위치"
                src="https://maps.google.com/maps?q=37.6400267,126.8754131&output=embed&hl=ko&z=17"
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
              <span className="font-medium text-[#1d1d1f]">AIM Technology (HK) Co., Ltd</span>를 모기업으로 두고, 2013년 국내 법인 주식회사 핸디핸드를 설립해 한국·중국 양국에서 제품개발과 생산을 함께 운영하고 있습니다.
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-5 text-sm">
              {[
                { label: "법인명", value: "AIM Technology (HK) Co., Ltd" },
                { label: "설립년월", value: "2005년 12월" },
                { label: "법인 소재지", value: "홍콩, 중국" },
                { label: "대표이사", value: "Philip Choi (최진찬)" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="mb-1 text-xs text-[#86868b]">{label}</p>
                  <p className="font-medium text-[#1d1d1f]">{value}</p>
                </div>
              ))}
              <div className="col-span-2">
                <p className="mb-1 text-xs text-[#86868b]">주소</p>
                <p className="font-medium text-[#1d1d1f]">11/F, CNT House, 120 Johnston Road, Wanchai, Hong Kong</p>
              </div>
            </div>
            <div className="flex-1" />
            <div className="mt-5 overflow-hidden rounded-2xl sm:rounded-3xl">
              <iframe
                title="AIM Technology (HK) 위치"
                src="https://maps.google.com/maps?q=11%2FF%2C%20CNT%20House%2C%20120%20Johnston%20Road%2C%20Wanchai%2C%20Hong%20Kong&output=embed&hl=ko&z=16"
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
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">함께 시작해볼까요?</h2>
          <p className="mb-10 text-[#86868b]">제품 아이디어가 있다면 지금 바로 상담해보세요.</p>
          <div className="flex justify-center">
            <div className="inline-flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => setQuoteOpen(true)}
                className="rounded-full bg-white px-8 py-3 text-center text-sm font-semibold text-black transition hover:bg-white/90"
              >
                견적 요청하기
              </button>
              <button
                onClick={() => setContactOpen(true)}
                className="rounded-full border border-white/20 px-8 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/5"
              >
                문의하기
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="border-t border-white/10 bg-black px-6 py-12 text-center text-xs text-white/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="HANDYHAND" className="mx-auto mb-4 h-5 w-auto" />
        <p className="mt-1 leading-relaxed">주식회사 핸디핸드 · 대표자 최형준 · 사업자등록번호 128-87-00105</p>
        <p className="mt-1 leading-relaxed">통신판매업 신고번호 2020-고양덕양구-1900</p>
        <p className="mt-1 leading-relaxed">경기도 고양시 덕양구 삼원로63 고양아크비즈지식산업센터 F804호</p>
        <p className="mt-1">Tel. 070-8835-2311 · handyhand91@naver.com</p>
        <div className="mt-4 flex items-center justify-center gap-4">
          <Link href="/privacy" className="underline underline-offset-2 hover:text-white/60 transition">개인정보처리방침</Link>
          <span>·</span>
          <Link href="/terms" className="underline underline-offset-2 hover:text-white/60 transition">이용약관</Link>
        </div>
        <p className="mt-4">© 2026 HANDYHAND. All rights reserved.</p>
      </footer>

      {quoteOpen && <QuoteModal onClose={() => setQuoteOpen(false)} />}
      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}
    </div>
  );
}
