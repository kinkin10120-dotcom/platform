"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, BadgeCheck, Mail } from "lucide-react";
import { PortfolioImageSlider } from "@/components/PortfolioImageSlider";
import { ProjectDetailModal } from "@/components/ProjectDetailModal";
import { QuoteModal } from "@/components/QuoteModal";
import { ContactModal } from "@/components/ContactModal";

const NAV_LINKS = [
  { href: "/about", label: "기업소개" },
  { href: "/service", label: "서비스" },
  { href: "/process", label: "프로세스" },
  { href: "/portfolio", label: "개발사례" },
  { href: "/ai-analysis", label: "AI 제조분석" },
];

const CASES = [
  { client: "MIDLAND", category: "미국 무전기 업체", desc: "2008년부터 파트너십을 이어와 부품공급을 하는 미국 무전기 전문업체입니다. 차량용 RF 마이크 카버티블을 개발부터 양산까지 전담해 공급하였으며 누적 공급량은 약 50만개 이상입니다.", tag: "B2B · 설계 · 양산", images: ["/portfolio-midland.png"] },
  { client: "신지모루", category: "스마트폰 액세서리", desc: "2009년부터 함께해온 국내 상위 스마트폰 액세서리 브랜드로, 제품 개발 업무를 전담하였습니다. 쿠팡 스마트폰 액세서리 카테고리 1위를 달성했고, 액세서리를 넘어 전자제품 공급까지 협업 범위를 넓혀가고 있습니다.", tag: "B2B · 개발 · 양산", images: ["/portfolio-shinjimoru-2.png","/portfolio-shinjimoru-3.png","/portfolio-shinjimoru-4.png","/portfolio-shinjimoru-5.png","/portfolio-shinjimoru-6.png","/portfolio-shinjimoru-7.png","/portfolio-shinjimoru-8.png","/portfolio-shinjimoru-9.png","/portfolio-shinjimoru-10.png","/portfolio-shinjimoru-11.png","/portfolio-shinjimoru-12.png","/portfolio-shinjimoru-13.png"] },
  { client: "오아시스랩스", category: "KAIST 출신 스타트업", desc: "KAIST 출신 스타트업으로, 제품 개발과 제품 양산을 진행했습니다. 핸디핸드가 직접 금형을 제작하고 양산·납품까지 전 과정을 책임졌습니다.", tag: "B2B · 스타트업", images: ["/portfolio-oasis.png"] },
  { client: "퍼플네스트", category: "반려동물 용품", desc: "반려동물 용품 브랜드로 2019년부터 파트너십을 맺고 있습니다. 제품 개발 업무를 전담하며 금형 제작부터 양산까지 함께 진행하고 있습니다.", tag: "B2B · 개발 · 양산", images: ["/portfolio-purplenest-1.png", "/portfolio-purplenest-2.png", "/portfolio-purplenest-3.png"] },
  { client: "파운드/파운디드", category: "디자인 오브제 브랜드", desc: "2017년부터 이어온 디자인 오브제 브랜드와의 파트너십입니다. 다이캐스팅, 기계가공 등 여러 제조 기법을 조합해 정교한 디자인 오브제를 양산까지 완성하여 공급하였습니다.", tag: "B2B · 개발 · 양산", images: ["/portfolio-foundfoundied-1.png", "/portfolio-foundfoundied-2.png", "/portfolio-foundfoundied-3.png", "/portfolio-foundfoundied-4.png", "/portfolio-foundfoundied-5.png"] },
];

const BRAND_PRODUCTS = [
  { name: "핸디그랩", tag: "개발 · 양산 · 특허", desc: "차량용 스마트폰 전동 무선 충전 거치대로, 제품 기획부터 디자인, 제품설계, PCBA 하드웨어, 소프트웨어 개발 그리고 금형 및 양산까지 전 과정을 자체적으로 진행했습니다. 국내 특허 등록까지 완료한 핸디핸드의 대표 자체 브랜드 제품입니다.", images: ["/portfolio-handygrip-2.png"], patented: true },
  { name: "핸디슬랩", tag: "개발 · 양산 · 특허", desc: "핸디그랩과의 후속제품으로 자체 개발한 차량용 스마트폰 무선 충전 거치대로 라인업입니다. 맥세이프 자석 거치대 타입으로 개발 및 출시 되었으며 동일하게 자체 개발·디자인으로 국내 특허를 등록했습니다.", images: ["/portfolio-handygrip-1.png"], patented: true },
  { name: "핸디포켓", tag: "개발 · 양산 · 특허", desc: "맥세이프와 나노패드 부착방식 카드 케이스로, 아이폰 후면에는 자석으로 자석이 없는 스마트폰엔 나노패드로 간편하게 탈 부착할 수 있도록 자체 개발했습니다. 국내 특허 등록까지 마친 핸디핸드의 자체 제품입니다.", images: ["/portfolio-handarocket-1.png", "/portfolio-handarocket-2.png", "/portfolio-handarocket-3.png", "/portfolio-handarocket-4.png"], patented: true },
  { name: "미키마우스 거치대", tag: "자체 개발 · 캐릭터", desc: "디즈니 IP를 활용한 캐릭터 라이선스 제품으로 선보인 차량용 스마트폰 무선충전 거치대입니다. 자체 금형 제작부터 양산까지 전 과정을 핸디핸드가 직접 진행했습니다.", images: ["/portfolio-mickey-1.png"], patented: false },
  { name: "네이버 독립일기 차량용 충전기", tag: "자체 개발 · 캐릭터", desc: "네이버 웹툰 독립일기 캐릭터 라이선스를 활용한 차량용 무선 충전 거치대입니다. 캐릭터 IP 기반 제품으로 자체 금형 제작부터 양산까지 완료했습니다.", images: ["/portfolio-dokrip-1.png"], patented: false },
  { name: "핸디워치", tag: "개발 · 양산 · 특허", desc: "CNC 가공 방식으로 제작한 애플워치 스테인리스 케이스입니다. 기획부터 디자인, 설계, 생산까지 자체적으로 진행한 DIY 제품으로, 국내 특허 등록까지 완료했습니다.", images: ["/portfolio-handywatch-1.png", "/portfolio-handywatch-2.png", "/portfolio-handywatch-3.png"], patented: true },
];

export default function PortfolioPage() {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<(typeof CASES)[number] | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<(typeof BRAND_PRODUCTS)[number] | null>(null);

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
                item.href === "/portfolio" ? (
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
                  } ${item.href === "/portfolio" ? "text-white" : "text-white/70"}`}
                >
                  <span className="text-xs font-medium text-white/25">{String(i + 1).padStart(2, "0")}</span>
                  <span>{item.label}</span>
                  {item.href === "/portfolio" && <span className="ml-auto h-1 w-1 rounded-full bg-[#F1CE00]" />}
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
            우리가 함께 만든 것들
          </h1>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-white/50">
            고객사 프로젝트부터 자체 브랜드까지,<br className="sm:hidden" />
            제품개발부터 제품생산완료 후 납품까지 완료한 프로젝트들입니다.
          </p>
        </div>
      </section>

      {/* 고객사 개발사례 */}
      <section id="cases" className="scroll-mt-24 bg-[#f5f5f7] px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
            Client Projects
          </p>
          <h2 className="mb-3 text-3xl font-bold text-[#1d1d1f] sm:text-4xl">고객사 개발사례</h2>
          <p className="mb-8 max-w-lg text-sm leading-relaxed text-[#86868b] sm:text-base">
            다양한 산업군의 브랜드와 함께 기획부터 양산까지<br className="sm:hidden" />진행한 실제 프로젝트입니다.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CASES.map((item) => (
              <button
                key={item.client}
                onClick={() => setSelectedCase(item)}
                className="h-full overflow-hidden rounded-2xl bg-white text-left transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-10px_rgba(0,0,0,0.15)] sm:rounded-3xl"
              >
                <PortfolioImageSlider images={item.images} alt={`${item.client} ${item.category}`.trim()} />
                <div className="p-5 sm:p-6">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f5f7] px-2.5 py-0.5 text-xs font-medium text-[#86868b]">
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

      {/* 자체 브랜드 */}
      <section id="brand" className="scroll-mt-24 bg-white px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
            Private Brand
          </p>
          <h2 className="mb-3 text-3xl font-bold text-[#1d1d1f] sm:text-4xl">자체 브랜드</h2>
          <p className="mb-8 max-w-lg text-sm leading-relaxed text-[#86868b] sm:text-base">
            직접 기획부터 설계, 금형, 양산까지 핸디핸드가<br className="sm:hidden" />자체적으로 기획하고 만든 특허 등록 제품입니다.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BRAND_PRODUCTS.map((item) => (
              <button
                key={item.name}
                onClick={() => setSelectedBrand(item)}
                className="h-full overflow-hidden rounded-2xl bg-[#f5f5f7] text-left transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-10px_rgba(0,0,0,0.15)] sm:rounded-3xl"
              >
                <div className="relative">
                  <PortfolioImageSlider images={item.images} alt={`핸디핸드 자체 브랜드 ${item.name}`} />
                  {item.patented && (
                    <span className="absolute left-3 top-3 z-20 inline-flex items-center gap-1 rounded-full bg-[#1d1d1f] px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm">
                      <BadgeCheck size={12} className="text-[#F1CE00]" />
                      특허 등록
                    </span>
                  )}
                </div>
                <div className="p-5 sm:p-6">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-[#86868b]">
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
                네이버 스토어에서 구매하기 →
              </a>
              <a
                href="https://app.wadiz.kr/links/zsvF0zX26t"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-72 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#3DBDF5] px-6 py-3 text-center text-sm font-semibold text-white transition hover:brightness-95"
              >
                와디즈 핸디핸드 메이커페이지 →
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
      {quoteOpen && <QuoteModal onClose={() => setQuoteOpen(false)} />}
      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}
    </div>
  );
}
