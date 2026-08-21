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
} from "lucide-react";
import { QuoteModal } from "@/components/QuoteModal";
import { ContactModal } from "@/components/ContactModal";

const NAV_LINKS = [
  { href: "/about", label: "기업소개" },
  { href: "/service", label: "서비스" },
  { href: "/process", label: "프로세스" },
  { href: "/portfolio", label: "개발사례" },
  { href: "/ai-analysis", label: "AI 제조분석" },
];

const STEPS = [
  {
    step: "01",
    title: "제품개발 기획",
    summary: "미팅과 계약 체결 후, 아이디어를 구체적인 제품 사양으로 정의합니다.",
    detail: "최초 미팅(대면·화상)으로 방향을 논의하고 계약을 체결한 뒤, 제품 컨셉을 수립합니다. 기능 정의, 타깃 가격대, 생산 수량 등 제품화에 필요한 전반적인 방향을 설정합니다.",
    tags: ["계약 체결", "컨셉 기획", "시장조사", "기능 정의", "사양 정의"],
    icon: Lightbulb,
    category: "development",
  },
  {
    step: "02",
    title: "제품디자인",
    summary: "제품의 외형과 사용자 경험을 디자인합니다.",
    detail: "제품 디자이너가 스케치와 렌더링을 통해 제품 외형을 완성합니다. 브랜드 아이덴티티와 사용성을 고려한 디자인으로 시장에서 차별화될 수 있는 디자인을 만들어냅니다.",
    tags: ["산업 디자인", "렌더링", "CMF 설계", "UX 고려"],
    icon: PenTool,
    category: "development",
  },
  {
    step: "03",
    title: "제품설계 (기구·하드웨어)",
    summary: "디자인을 실제 제조 가능한 3D 도면으로 구현합니다.",
    detail: "기구설계 엔지니어가 전문 툴로 기구설계를 진행합니다. 조립성, 금형 가능 여부, 내구성, 재질을 고려한 설계를 통해 양산까지 이어질 수 있는 도면을 완성합니다. 필요 시 하드웨어(PCBA) 설계와 소프트웨어도 병행합니다.",
    tags: ["3D 모델링", "기구설계", "PCB 설계", "DFM 검토"],
    icon: Ruler,
    category: "development",
  },
  {
    step: "04",
    title: "시제품 제작",
    summary: "양산 전 실물 샘플로 형상과 기능을 검증합니다.",
    detail: "3D프린팅, CNC 가공, 진공주형을 통해 프로토타입 시제품을 제작하고 디자인·기능·조립성을 검증합니다. 문제점을 조기에 발견하여 설계를 수정함으로써 금형 제작 후 발생할 수 있는 비용과 시간 낭비를 최소화합니다.",
    tags: ["3D프린팅", "CNC 목업", "기능 검증", "설계 수정"],
    icon: FlaskConical,
    category: "development",
  },
  {
    step: "05",
    title: "금형 제작",
    summary: "제품 양산을 위한 핵심 설비, 금형을 설계하고 제작합니다.",
    detail: "중국 광둥성 현지 파트너 공장과 협력하여 사출금형, 다이캐스팅금형 등을 제작합니다. 금형 시사출 후 치수 검사와 외관 검사를 거쳐 양산 기준을 충족하는지 확인하는 T1·T2 검증 과정을 진행합니다.",
    tags: ["사출금형", "다이캐스팅", "T1/T2 검증", "치수 검사"],
    icon: Factory,
    category: "production",
  },
  {
    step: "06",
    title: "제품 양산",
    summary: "제작된 금형으로 본격적인 대량 생산을 진행합니다.",
    detail: "제작된 금형으로 양산을 진행합니다. 생산 전 과정에서 품질관리를 직접 관리하며, 불량률을 최소화합니다. 생산 현황은 HANDYWORKS 플랫폼을 통해 고객과 실시간으로 공유됩니다.",
    tags: ["대량생산", "품질관리", "공정 모니터링", "불량 검수"],
    icon: PackageCheck,
    category: "production",
  },
  {
    step: "07",
    title: "패키징",
    summary: "제품 가치를 높이는 패키지 디자인과 제작을 진행합니다.",
    detail: "제품 컨셉에 맞는 패키지 디자인을 기획하고 박스, 내포장, 라벨까지 제작합니다. 친환경 소재 적용, 언박싱 경험 설계 등 소비자 접점까지 고려한 패키징 솔루션을 제공합니다.",
    tags: ["패키지 디자인", "박스 제작", "라벨 디자인", "친환경 소재"],
    icon: Package,
    category: "branding",
  },
  {
    step: "08",
    title: "상세페이지 제작",
    summary: "제품을 가장 잘 설명하는 온라인 상세페이지를 제작합니다.",
    detail: "스마트스토어, 쿠팡, 와디즈, 자사몰 등 온라인 판매 채널에 최적화된 상세페이지를 기획·디자인합니다. 제품 특장점을 효과적으로 전달하는 카피라이팅과 이미지 구성으로 전환율을 높입니다.",
    tags: ["상세페이지 기획", "디자인", "카피라이팅", "채널 최적화"],
    icon: FileText,
    category: "branding",
  },
  {
    step: "09",
    title: "선적 및 납품",
    summary: "선적과 통관을 대행하며, 최종 납품까지 지원합니다.",
    detail: "중국 현지에서 또는 국내에서 고객사까지의 선적과 통관을 대행합니다. 해외 수출 시 필요한 인증 및 서류 지원도 제공합니다.",
    tags: ["선적·통관", "해외 수출", "인증 지원"],
    icon: Truck,
    category: "production",
  },
];

const CATEGORY_COLOR: Record<string, { bg: string; icon: string; label: string; badge: string }> = {
  development: { bg: "bg-[#1d1d1f]", icon: "text-[#F1CE00]", label: "제품개발", badge: "bg-[#F1CE00]/15 text-[#8a6d00]" },
  production: { bg: "bg-[#F1CE00]", icon: "text-[#1d1d1f]", label: "제품생산", badge: "bg-[#dbeafe] text-[#1d4ed8]" },
  branding: { bg: "bg-[#e2e2e5]", icon: "text-[#1d1d1f]", label: "브랜딩", badge: "bg-[#f3e8ff] text-[#7c3aed]" },
};

export default function ProcessPage() {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openStep, setOpenStep] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
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
                item.href === "/process" ? (
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
                  } ${item.href === "/process" ? "text-white" : "text-white/70"}`}
                >
                  <span className="text-xs font-medium text-white/25">{String(i + 1).padStart(2, "0")}</span>
                  <span>{item.label}</span>
                  {item.href === "/process" && <span className="ml-auto h-1 w-1 rounded-full bg-[#F1CE00]" />}
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
            개발부터 납품까지
          </h1>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-white/50">
            아이디어 하나가 완제품이 되기까지,<br className="sm:hidden" />
            핸디핸드가 함께하는 9단계 공정을 소개합니다.
          </p>
        </div>
      </section>

      {/* 원스탑 흐름도 */}
      <section className="bg-[#f5f5f7] px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
            Process
          </p>
          <h2 className="mb-3 text-3xl font-bold leading-snug text-[#1d1d1f] sm:text-4xl">
            이 모든 과정을 하나로
          </h2>
          <p className="mb-8 text-sm leading-relaxed text-[#86868b] sm:text-base">
            고객사 및 프로젝트 특성에 따라 진행 단계가<br className="sm:hidden" />간소화되거나 조정될 수 있습니다.
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
          {STEPS.length}단계로 진행됩니다
        </h2>
        <p className="mb-6 text-sm leading-relaxed text-[#86868b] sm:mb-8 sm:text-base">
          제품기획부터 선적까지, 각 단계별로 무엇을<br className="sm:hidden" />진행하는지 자세히 확인하세요.
        </p>

        {/* 스텝 카드 그리드 */}
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
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">지금 바로 문의해보세요</h2>
          <p className="mb-10 text-[#86868b]">어느 개발단계에 있든 환영합니다.<br className="sm:hidden" />아이디어만 있어도 괜찮습니다.</p>
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
