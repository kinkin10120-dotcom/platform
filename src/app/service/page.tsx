"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { QuoteModal } from "@/components/QuoteModal";
import { ContactModal } from "@/components/ContactModal";

const SERVICES = [
  {
    tag: "Platform",
    title: "HANDYWORKS",
    subtitle: "제조 프로젝트 관리 플랫폼",
    desc: "핸디핸드가 직접 운영하는 클라이언트 전용 PM 플랫폼. 기획부터 납품까지 모든 진행 상황을 실시간으로 공유하고, 카톡·이메일로 파편화된 소통 방식을 하나의 플랫폼으로 통합합니다.",
    points: [
      "단계별 진행 현황 실시간 공유",
      "업무·일정·공지 한 곳에서 관리",
      "파일·버전 이력 자동 기록",
      "클라이언트 전용 계정 발급",
    ],
    cta: { label: "HANDYWORKS 바로가기 ↗", href: "/handyworks", external: false },
    accent: "bg-[#1d1d1f] text-white",
    tagColor: "bg-white/10 text-white/60",
    pointColor: "text-white/70",
    descColor: "text-white/50",
  },
  {
    tag: "Consulting",
    title: "제조 컨설팅",
    subtitle: "전문가와 함께 정하는 제조 방향",
    desc: "제품 구조 분석부터 소재 선정, 제조 공법 결정까지. 수백 개의 제품을 개발한 경험을 바탕으로 클라이언트의 아이디어가 시장에서 통할 수 있는 최적의 제조 전략을 제시합니다.",
    points: [
      "제품 구조 및 소재 선정 컨설팅",
      "제조 공법 비교 분석 (사출·다이캐스팅·CNC 등)",
      "원가 절감 전략 수립",
      "시제품 → 양산 전환 로드맵",
    ],
    cta: { label: "컨설팅 문의하기", href: "contact", external: false },
    accent: "bg-[#f5f5f7] text-[#1d1d1f]",
    tagColor: "bg-[#1d1d1f]/10 text-[#86868b]",
    pointColor: "text-[#1d1d1f]",
    descColor: "text-[#86868b]",
  },
  {
    tag: "Development",
    title: "원스탑 제품 개발",
    subtitle: "기획부터 납품까지 9단계 일괄 진행",
    desc: "제품기획, 디자인, 기구 설계, 시제품 제작, 금형, 양산, 패키징, 상세페이지, 납품까지. 아이디어 단계부터 판매 준비 완료 상태까지 모든 과정을 핸디핸드 하나로 해결합니다.",
    points: [
      "전담 PM 배정 및 단계별 관리",
      "설계·디자인·제조 내부 협업",
      "시제품 검증 후 양산 전환",
      "패키징·상세페이지 포함 풀패키지",
    ],
    cta: { label: "견적 요청하기", href: "quote", external: false },
    accent: "bg-white text-[#1d1d1f]",
    tagColor: "bg-[#1d1d1f]/10 text-[#86868b]",
    pointColor: "text-[#1d1d1f]",
    descColor: "text-[#86868b]",
    border: true,
  },
  {
    tag: "Partnership",
    title: "제조 소싱 & 관리 대행",
    subtitle: "공장 소싱부터 개발·생산 관리까지 직접 전담",
    desc: "단순 공장 연결이 아닙니다. 핸디핸드가 소싱 중개인으로서 최적의 협력 공장을 발굴하고, 개발 관리와 생산 관리를 직접 수행합니다. 클라이언트는 공장과 직접 소통할 필요 없이 결과물만 확인하면 됩니다.",
    points: [
      "국내·해외(중국·베트남) 공장 직접 소싱",
      "개발 관리 · 생산 관리 전담 대행",
      "품질 검수 및 납기 조율 일괄 처리",
      "OEM 라벨링·인증 절차 지원",
    ],
    cta: { label: "소싱 & 관리 문의하기", href: "contact", external: false },
    accent: "bg-[#f5f5f7] text-[#1d1d1f]",
    tagColor: "bg-[#1d1d1f]/10 text-[#86868b]",
    pointColor: "text-[#1d1d1f]",
    descColor: "text-[#86868b]",
  },
  {
    tag: "Crowdfunding",
    title: "크라우드펀딩 런칭",
    subtitle: "와디즈 파트너스·펀딩플래너 출신의 제품 개발 + 캠페인 원큐 지원",
    desc: "아이디어를 제품으로 만들고 와디즈 캠페인까지 한 번에. 와디즈 파트너스·펀딩플래너 출신으로, 제품 개발, 캠페인 페이지 기획, 리워드 구성, 론칭 전략까지 함께 설계합니다.",
    points: [
      "와디즈 파트너스·펀딩플래너 출신 경험 기반 진행",
      "제품 개발 → 캠페인 기획 → 론칭 일괄 지원",
      "리워드 구성 및 목표 금액 설정 전략",
      "캠페인 페이지 제작 및 홍보 콘텐츠 지원",
    ],
    cta: { label: "크라우드펀딩 상담하기", href: "contact", external: false },
    accent: "bg-[#1d1d1f] text-white",
    tagColor: "bg-white/10 text-white/60",
    pointColor: "text-white/70",
    descColor: "text-white/50",
    badge: "와디즈 파트너스·펀딩플래너 출신",
  },
  {
    tag: "Branding",
    title: "브랜딩 패키지",
    subtitle: "네이밍부터 상세페이지까지, 판매 준비 완성",
    desc: "제품 네이밍, BI 디자인, 패키징, 그리고 스마트스토어·쿠팡 상세페이지까지. 제조와 브랜딩을 분리하지 않고 하나의 흐름으로 완성해 판매 시작까지 원큐에 마칩니다.",
    points: [
      "제품 네이밍 및 브랜드 아이덴티티(BI) 설계",
      "패키지 디자인 · 박스 · 라벨 제작",
      "스마트스토어·쿠팡·자사몰 최적화 상세페이지 제작",
      "카피라이팅 및 제품 촬영 콘텐츠 구성",
    ],
    cta: { label: "브랜딩 상담하기", href: "contact", external: false },
    accent: "bg-[#f5f5f7] text-[#1d1d1f]",
    tagColor: "bg-[#1d1d1f]/10 text-[#86868b]",
    pointColor: "text-[#1d1d1f]",
    descColor: "text-[#86868b]",
  },
];

export default function ServicePage() {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const handleCta = (href: string) => {
    if (href === "quote") setQuoteOpen(true);
    else if (href === "contact") setContactOpen(true);
  };

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
            <Link href="/about" className="text-sm text-white/55 transition hover:text-white">기업소개</Link>
            <Link href="/#ai-analysis" className="text-sm text-white/55 transition hover:text-white">AI 제조분석</Link>
            <Link href="/service" className="text-sm font-medium text-white">서비스</Link>
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
      <section
        className="relative overflow-hidden bg-[#1d1d1f] px-6 pb-24 pt-40 text-center"
        style={{
          backgroundImage: "url('https://images.pexels.com/photos/7166998/pexels-photo-7166998.jpeg?auto=compress&cs=tinysrgb&w=1920')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
        <div className="relative z-10 mx-auto max-w-3xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-white/30">Services</p>
          <h1 className="mb-5 text-4xl font-bold leading-tight text-white sm:text-5xl md:text-6xl">
            핸디핸드의 서비스
          </h1>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-white/50">
            제품 개발의 모든 단계를 핸디핸드 하나로.<br />
            플랫폼, 컨설팅, 제조, 파트너십까지 필요한 것만 골라 이용하세요.
          </p>
        </div>
      </section>

      {/* 서비스 카드 */}
      <section className="bg-white px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl space-y-4">
          {SERVICES.map((s) => (
            <div
              key={s.title}
              className={`rounded-3xl p-8 sm:p-10 ${s.accent} ${s.border ? "border border-[#e5e5e5]" : ""}`}
            >
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-12">
                {/* 왼쪽: 제목 */}
                <div className="shrink-0 sm:w-56">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className={`inline-block rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-widest ${s.tagColor}`}>
                      {s.tag}
                    </span>
                    {s.badge && (
                      <span className="inline-block rounded-full bg-[#ff4c4c]/20 px-2.5 py-1 text-[10px] font-semibold text-[#ff4c4c]">
                        {s.badge}
                      </span>
                    )}
                  </div>
                  <h2 className="mb-1 text-2xl font-bold">{s.title}</h2>
                  <p className={`text-sm ${s.descColor}`}>{s.subtitle}</p>
                </div>

                {/* 오른쪽: 설명 + 포인트 */}
                <div className="flex-1">
                  <p className={`mb-5 text-sm leading-relaxed ${s.descColor}`}>{s.desc}</p>
                  <ul className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {s.points.map((p) => (
                      <li key={p} className={`flex items-start gap-2 text-sm ${s.pointColor}`}>
                        <span className="mt-1 shrink-0 text-[10px] opacity-40">●</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                  {s.cta.external ? (
                    <a
                      href={s.cta.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-2 rounded-full border px-5 py-2 text-xs font-semibold transition ${
                        s.accent.includes("1d1d1f")
                          ? "border-white/20 text-white hover:bg-white/10"
                          : "border-[#1d1d1f]/20 text-[#1d1d1f] hover:bg-[#1d1d1f]/5"
                      }`}
                    >
                      {s.cta.label} <ArrowRight size={13} />
                    </a>
                  ) : s.cta.href === "quote" || s.cta.href === "contact" ? (
                    <button
                      onClick={() => handleCta(s.cta.href)}
                      className={`inline-flex items-center gap-2 rounded-full border px-5 py-2 text-xs font-semibold transition ${
                        s.accent.includes("1d1d1f")
                          ? "border-white/20 text-white hover:bg-white/10"
                          : "border-[#1d1d1f]/20 text-[#1d1d1f] hover:bg-[#1d1d1f]/5"
                      }`}
                    >
                      {s.cta.label} <ArrowRight size={13} />
                    </button>
                  ) : (
                    <Link
                      href={s.cta.href}
                      className={`inline-flex items-center gap-2 rounded-full border px-5 py-2 text-xs font-semibold transition ${
                        s.accent.includes("1d1d1f")
                          ? "border-white/20 text-white hover:bg-white/10"
                          : "border-[#1d1d1f]/20 text-[#1d1d1f] hover:bg-[#1d1d1f]/5"
                      }`}
                    >
                      {s.cta.label} <ArrowRight size={13} />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#1d1d1f] px-6 py-24 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/30">Get Started</p>
        <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">어떤 서비스가 필요한가요?</h2>
        <p className="mb-10 text-[#86868b]">
          제품과 개발 단계를 간단히 알려주시면 맞는 서비스를 안내해 드립니다.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => setQuoteOpen(true)}
            className="flex items-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            견적 요청하기 <ArrowRight size={15} />
          </button>
          <button
            onClick={() => setContactOpen(true)}
            className="rounded-full border border-white/20 px-8 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5"
          >
            상담 문의하기
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
