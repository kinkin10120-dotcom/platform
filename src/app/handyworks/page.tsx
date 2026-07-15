"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, X } from "lucide-react";
import { QuoteModal } from "@/components/QuoteModal";
import { ContactModal } from "@/components/ContactModal";
import { useAuth } from "@/lib/auth-context";

const FEATURES = [
  {
    icon: "📊",
    title: "프로젝트 현황 실시간 공유",
    desc: "기획·설계·금형·양산 각 단계별 진행 상태를 언제 어디서든 확인할 수 있습니다. 별도 보고 없이 현황이 자동으로 업데이트됩니다.",
  },
  {
    icon: "✅",
    title: "업무 단위 진행률 관리",
    desc: "큰 프로젝트를 세부 업무로 나누고 각 업무의 담당자·마감일·진행률을 한눈에 파악합니다. 지연 업무는 자동으로 표시됩니다.",
  },
  {
    icon: "📣",
    title: "공지 & 알림",
    desc: "납기 변경, 품질 이슈, 승인 요청 등 중요한 사항을 즉시 공지합니다. 클라이언트는 알림으로 놓치지 않고 확인할 수 있습니다.",
  },
  {
    icon: "💬",
    title: "견적 · 문의 통합 관리",
    desc: "초기 견적 요청부터 계약 이후 추가 문의까지 하나의 플랫폼에서 이력을 관리합니다. 대화가 분산되지 않습니다.",
  },
];

const STEPS = [
  { step: "01", title: "견적 요청", desc: "홈페이지에서 제품 개요와 개발 단계를 입력하고 견적을 요청합니다." },
  { step: "02", title: "HANDYWORKS 계정 발급", desc: "계약 후 담당 PM이 클라이언트 전용 계정을 생성해 안내합니다." },
  { step: "03", title: "프로젝트 시작", desc: "로그인 후 프로젝트 일정·업무·공지를 실시간으로 함께 확인합니다." },
  { step: "04", title: "납품까지 투명하게", desc: "금형 완성, 양산 착수, 선적 일정까지 모든 단계를 플랫폼 안에서 추적합니다." },
];

const OLD_WAY = [
  "카톡·이메일로 파편화된 소통",
  "진행 상황을 매번 물어봐야 함",
  "파일 버전 관리 혼란",
  "구두 보고라 이력 추적 불가",
  "담당자 부재 시 업무 공백",
];

const NEW_WAY = [
  "하나의 플랫폼에서 모든 소통",
  "실시간으로 현황 확인 가능",
  "파일·버전 이력 자동 기록",
  "모든 업무 변경 이력 보존",
  "팀 전체가 현황을 공유",
];

export default function HandyPMPage() {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const { firebaseUser } = useAuth();
  return (
    <div className="min-h-screen bg-white">
      {/* 네비게이션 */}
      <nav className="fixed top-4 z-50 w-full px-4 sm:px-8">
        <Link
          href={firebaseUser ? "/home" : "/login"}
          className="absolute inset-y-0 right-4 sm:right-8 hidden sm:flex items-center rounded-full border border-[#d1d1d6] bg-white/80 px-3.5 text-xs font-medium text-[#1d1d1f] backdrop-blur-sm transition hover:bg-white"
        >
          {firebaseUser ? "대시보드" : "로그인"}
        </Link>
        <div className="mx-auto flex max-w-4xl items-center justify-between rounded-full border border-[#e5e5e5] bg-white/90 px-5 py-2.5 backdrop-blur-xl">
          <Link href="/handyworks">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/handyworks-logo.png" alt="HANDYWORKS" className="h-4 w-auto sm:h-5" style={{ filter: "brightness(0)" }} />
          </Link>
          <div className="hidden items-center gap-5 sm:flex">
            <a href="#why" className="text-sm text-[#86868b] transition hover:text-[#1d1d1f]">서비스 소개</a>
            <a href="#features" className="text-sm text-[#86868b] transition hover:text-[#1d1d1f]">주요 기능</a>
            <a href="#how" className="text-sm text-[#86868b] transition hover:text-[#1d1d1f]">도입 절차</a>
            <button onClick={() => setContactOpen(true)} className="text-sm text-[#86868b] transition hover:text-[#1d1d1f]">문의하기</button>
          </div>
          <div className="flex items-center gap-1.5">
            <Link href={firebaseUser ? "/home" : "/login"} className="sm:hidden rounded-full border border-[#d1d1d6] px-3.5 py-1.5 text-xs font-medium text-[#1d1d1f] transition hover:border-[#86868b]">
              {firebaseUser ? "대시보드" : "로그인"}
            </Link>
            <Link href="/" className="min-w-[126px] text-center rounded-full bg-[#1d1d1f] px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-[#3a3a3a]">
              HANDYHAND ↗
            </Link>
            <button onClick={() => setQuoteOpen(true)} className="rounded-full bg-[#1d1d1f] px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-[#3a3a3a]">
              견적 요청
            </button>
          </div>
        </div>
      </nav>

      {/* 히어로 */}
      <section className="relative px-6 pt-36 pb-28 text-center bg-black overflow-hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src="https://videos.pexels.com/video-files/852341/852341-hd_1920_1080_30fps.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/70" />
        <div className="relative z-10">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-white/30">HANDYHAND × HANDYWORKS</p>
          <h1 className="mb-6 text-4xl font-bold leading-tight text-white sm:text-5xl md:text-6xl">
            제조 파트너와<br />
            <span className="text-white/40">진짜로 연결되는</span> 방법
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-base leading-relaxed text-white/50">
            카톡과 이메일로 파편화된 소통은 이제 그만.<br />
            HANDYWORKS는 기획부터 납품까지 모든 과정을 한 곳에서 투명하게 공유합니다.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href={firebaseUser ? "/home" : "/login"} className="rounded-full bg-white px-8 py-3 text-sm font-semibold text-black transition hover:bg-white/90">
              {firebaseUser ? "대시보드로 이동 →" : "HANDYWORKS 시작하기 →"}
            </Link>
            <Link href="/contact" className="rounded-full border border-white/20 px-8 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5">
              계정 문의하기
            </Link>
          </div>
          <p className="mt-6 text-sm text-white/30">
            제조 방법부터 막막하다면{" "}
            <Link href="/#ai-analysis" className="text-white/60 underline underline-offset-4 transition hover:text-white">
              AI 무료 분석 먼저 해보기 →
            </Link>
          </p>
        </div>
      </section>

      {/* 기존 방식 vs HANDYWORKS */}
      <section id="why" className="bg-[#f5f5f7] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#86868b]">Why HANDYWORKS</p>
            <h2 className="text-3xl font-bold text-[#1d1d1f] sm:text-4xl">기존 방식과 무엇이 다른가요?</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* 기존 방식 */}
            <div className="rounded-3xl border border-[#e5e5e5] bg-white p-8">
              <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-[#86868b]">기존 방식</p>
              <ul className="space-y-3.5">
                {OLD_WAY.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <X size={16} className="mt-0.5 shrink-0 text-[#d1d1d6]" />
                    <span className="text-sm text-[#86868b]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* HANDYWORKS */}
            <div className="rounded-3xl bg-[#1d1d1f] p-8">
              <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-white/30">HANDYWORKS</p>
              <ul className="space-y-3.5">
                {NEW_WAY.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-white/70" />
                    <span className="text-sm text-white/80">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 주요 기능 */}
      <section id="features" className="bg-white px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#86868b]">Features</p>
            <h2 className="text-3xl font-bold text-[#1d1d1f] sm:text-4xl">주요 기능</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-3xl bg-[#f5f5f7] p-8">
                <span className="mb-4 block text-3xl">{f.icon}</span>
                <h3 className="mb-2 text-lg font-bold text-[#1d1d1f]">{f.title}</h3>
                <p className="text-sm leading-relaxed text-[#86868b]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 사용 흐름 */}
      <section id="how" className="bg-[#f5f5f7] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#86868b]">How it works</p>
            <h2 className="text-3xl font-bold text-[#1d1d1f] sm:text-4xl">시작하는 방법</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.step} className="rounded-3xl bg-white p-6">
                <p className="mb-3 text-3xl font-bold text-[#e5e5e5]">{s.step}</p>
                <h3 className="mb-2 font-bold text-[#1d1d1f]">{s.title}</h3>
                <p className="text-sm leading-relaxed text-[#86868b]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#1d1d1f] px-6 py-24 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/30">Get Started</p>
        <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">지금 시작할 준비가 됐나요?</h2>
        <p className="mb-10 text-[#86868b]">견적을 요청하시면 담당 PM이 HANDYWORKS 계정을 함께 안내해드립니다.</p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/contact" className="rounded-full bg-white px-8 py-3 text-sm font-semibold text-black transition hover:bg-white/90">
            문의하기 →
          </Link>
          <Link href={firebaseUser ? "/home" : "/login"} className="rounded-full border border-white/20 px-8 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5">
            {firebaseUser ? "대시보드로 이동" : "이미 계정이 있으신가요?"}
          </Link>
        </div>
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
        <p className="mt-1">Tel. 070-8835-2311 · handyhand91@naver.com</p>
        <div className="mt-4 flex items-center justify-center gap-4">
          <Link href="/privacy" className="underline underline-offset-2 hover:text-white/60 transition">개인정보처리방침</Link>
          <span>·</span>
          <Link href="/terms" className="underline underline-offset-2 hover:text-white/60 transition">이용약관</Link>
        </div>
        <p className="mt-4">© 2026 HANDYHAND. All rights reserved.</p>
      </footer>

      {/* 플로팅 문의 버튼 */}
      <button
        onClick={() => setContactOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-[#1d1d1f] px-4 py-3 text-xs font-semibold text-white shadow-lg transition hover:bg-[#3a3a3a] hover:shadow-xl"
      >
        <span className="text-base">✉</span>
        문의하기
      </button>

      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}
      {quoteOpen && <QuoteModal onClose={() => setQuoteOpen(false)} />}
    </div>
  );
}
