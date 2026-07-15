"use client";

import { useState } from "react";
import Link from "next/link";
import { QuoteModal } from "@/components/QuoteModal";
import { ContactModal } from "@/components/ContactModal";

export default function AboutPage() {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* 네비게이션 */}
      <nav className="fixed top-4 z-50 w-full px-4 sm:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between rounded-full border border-white/15 bg-black/70 px-5 py-2.5 backdrop-blur-xl">
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="HANDYHAND" className="h-4 w-auto sm:h-5" />
          </Link>
          <div className="hidden items-center gap-5 sm:flex">
            <Link href="/about" className="text-sm font-medium text-white">기업소개</Link>
            <Link href="/#ai-analysis" className="text-sm text-white/55 transition hover:text-white">AI 제조분석</Link>
            <Link href="/service" className="text-sm text-white/55 transition hover:text-white">서비스</Link>
            <Link href="/process" className="text-sm text-white/55 transition hover:text-white">프로세스</Link>
            <Link href="/#portfolio" className="text-sm text-white/55 transition hover:text-white">개발사례</Link>
            <button onClick={() => setContactOpen(true)} className="text-sm text-white/55 transition hover:text-white">문의하기</button>
          </div>
          <div className="flex items-center gap-1.5">
            <Link href="/handyworks" className="min-w-[126px] text-center rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-black transition hover:bg-white/90">
              HANDYWORKS ↗
            </Link>
            <button
              onClick={() => setQuoteOpen(true)}
              className="hidden rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-black transition hover:bg-white/90 sm:block"
            >
              견적 요청
            </button>
          </div>
        </div>
      </nav>

      {/* 히어로 */}
      <section className="relative overflow-hidden bg-[#1d1d1f] px-6 pb-52 pt-40 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/about-office.jpeg"
          alt=""
          className="absolute left-1/2 top-0 h-full w-full max-w-none -translate-x-1/2 object-cover opacity-90 lg:w-[1440px]"
          style={{ objectPosition: "50% 38%" }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(29,29,31,0.35) 0%, rgba(29,29,31,0.25) 50%, #1d1d1f 100%)" }}
        />
        <div className="relative">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-white/30">Who We Are</p>
          <h1 className="mb-5 text-4xl font-bold leading-tight text-white sm:text-5xl">
            제품화, 처음부터 끝까지
          </h1>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-white/50">
            2013년 설립 이후 수백 개의 제품을 기획부터 납품까지 함께해온<br />
            제조 파트너 핸디핸드입니다.
          </p>
        </div>
      </section>

      {/* 핵심 역량 */}
      <section className="bg-[#f5f5f7] px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-5 sm:rounded-3xl sm:p-8">
              <h3 className="mb-2 text-base font-semibold text-[#1d1d1f] sm:mb-3 sm:text-lg">원스탑 제품개발</h3>
              <p className="text-sm leading-relaxed text-[#86868b]">
                제품기획부터 설계, 금형제작, 생산, 포장, 납품까지 전 과정을 자체적으로 처리합니다. 중국 광둥성 현지 사무소와 공장을 직접 운영합니다.
              </p>
            </div>
            <div className="rounded-2xl bg-white p-5 sm:rounded-3xl sm:p-8">
              <h3 className="mb-2 text-base font-semibold text-[#1d1d1f] sm:mb-3 sm:text-lg">글로벌 네트워크</h3>
              <p className="text-sm leading-relaxed text-[#86868b]">
                2005년 홍콩 설립 이후 한국·미국·중국 등 다수 국가의 업체와 파트너십을 맺고 제품개발 및 부품개발을 완료하여 공급해왔습니다.
              </p>
            </div>
            <div className="rounded-2xl bg-white p-5 sm:rounded-3xl sm:p-8">
              <h3 className="mb-2 text-base font-semibold text-[#1d1d1f] sm:mb-3 sm:text-lg">자체 브랜드 운영</h3>
              <p className="text-sm leading-relaxed text-[#86868b]">
                2020년 '핸디핸드' 브랜드로 국내 런칭, B2B를 넘어 B2C 시장에도 진출하여 차량용 거치대, 액세서리 등 자체 제품을 직접 판매합니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 회사 정보 */}
      <section className="bg-white px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="mb-8 text-xs font-semibold uppercase tracking-widest text-[#86868b]">Company Info</p>
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-12">
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
            </div>
            <div className="overflow-hidden rounded-2xl bg-[#f5f5f7]">
              <iframe
                title="핸디핸드 위치"
                src="https://maps.google.com/maps?q=고양아크비즈지식산업센터&output=embed&hl=ko&z=16"
                width="100%"
                height="100%"
                style={{ border: 0, minHeight: "280px" }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-full min-h-[280px] w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#1d1d1f] px-6 py-20 text-center">
        <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">함께 시작해볼까요?</h2>
        <p className="mb-10 text-[#86868b]">제품 아이디어가 있다면 지금 바로 상담해보세요.</p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => setQuoteOpen(true)}
            className="rounded-full bg-white px-8 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            견적 요청하기
          </button>
          <button
            onClick={() => setContactOpen(true)}
            className="rounded-full border border-white/20 px-8 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
          >
            문의하기
          </button>
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
