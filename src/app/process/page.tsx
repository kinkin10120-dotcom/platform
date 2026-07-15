"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { QuoteModal } from "@/components/QuoteModal";
import { ContactModal } from "@/components/ContactModal";

const STEPS = [
  {
    step: "01",
    title: "제품기획",
    summary: "아이디어를 구체적인 제품 사양으로 정의합니다.",
    detail: "시장조사와 고객 니즈 분석을 바탕으로 제품 컨셉을 수립합니다. 기능 정의, 타깃 가격대, 생산 수량 등 제품화에 필요한 전반적인 방향을 설정합니다.",
    tags: ["컨셉 기획", "시장조사", "기능 정의", "사양 정의"],
  },
  {
    step: "02",
    title: "제품디자인",
    summary: "제품의 외형과 사용자 경험을 디자인합니다.",
    detail: "산업 디자이너가 스케치와 렌더링을 통해 제품 외형을 완성합니다. 브랜드 아이덴티티와 사용성을 고려한 디자인으로 시장에서 차별화될 수 있는 외관을 만들어냅니다.",
    tags: ["산업 디자인", "렌더링", "CMF 설계", "UX 고려"],
  },
  {
    step: "04",
    title: "제품설계 (기구·하드웨어)",
    summary: "디자인을 실제 제조 가능한 3D 도면으로 구현합니다.",
    detail: "기구설계 엔지니어가 SolidWorks, CATIA 등 전문 툴로 3D 모델링을 진행합니다. 조립성, 금형 가능 여부, 내구성을 고려한 설계를 통해 양산까지 이어질 수 있는 도면을 완성합니다. 필요 시 하드웨어(PCB) 설계도 병행합니다.",
    tags: ["3D 모델링", "기구설계", "PCB 설계", "DFM 검토"],
  },
  {
    step: "05",
    title: "시제품 제작",
    summary: "양산 전 실물 샘플로 형상과 기능을 검증합니다.",
    detail: "3D프린팅, CNC 가공 등을 통해 시제품을 제작하고 디자인·기능·조립성을 검증합니다. 문제점을 조기에 발견하여 설계를 수정함으로써 금형 제작 후 발생할 수 있는 비용과 시간 낭비를 최소화합니다.",
    tags: ["3D프린팅", "CNC 목업", "기능 검증", "설계 수정"],
  },
  {
    step: "06",
    title: "금형 제작",
    summary: "양산을 위한 핵심 공정, 금형을 설계하고 제작합니다.",
    detail: "중국 광둥성 현지 파트너 공장과 협력하여 사출금형, 다이캐스팅금형 등을 제작합니다. 금형 시사출 후 치수 검사와 외관 검사를 거쳐 양산 기준을 충족하는지 확인하는 T1·T2 검증 과정을 진행합니다.",
    tags: ["사출금형", "다이캐스팅", "T1/T2 검증", "치수 검사"],
  },
  {
    step: "07",
    title: "제품 양산",
    summary: "검증된 금형으로 본격적인 대량 생산을 진행합니다.",
    detail: "확정된 금형과 공정으로 양산을 진행합니다. 생산 전 과정에서 품질관리(QC) 담당자가 공장을 직접 관리하며, 불량률을 최소화합니다. 생산 현황은 HANDYWORKS 플랫폼을 통해 고객과 실시간으로 공유됩니다.",
    tags: ["대량생산", "품질관리", "공정 모니터링", "불량 검수"],
  },
  {
    step: "08",
    title: "패키징",
    summary: "제품 가치를 높이는 패키지 디자인과 제작을 담당합니다.",
    detail: "제품 컨셉에 맞는 패키지 디자인을 기획하고 박스, 내포장, 라벨까지 제작합니다. 친환경 소재 적용, 언박싱 경험 설계 등 소비자 접점까지 고려한 패키징 솔루션을 제공합니다.",
    tags: ["패키지 디자인", "박스 제작", "라벨 디자인", "친환경 소재"],
  },
  {
    step: "09",
    title: "상세페이지 제작",
    summary: "제품을 가장 잘 설명하는 온라인 상세페이지를 제작합니다.",
    detail: "스마트스토어, 쿠팡, 자사몰 등 온라인 판매 채널에 최적화된 상세페이지를 기획·디자인합니다. 제품 특장점을 효과적으로 전달하는 카피라이팅과 이미지 구성으로 전환율을 높입니다.",
    tags: ["상세페이지 기획", "디자인", "카피라이팅", "채널 최적화"],
  },
  {
    step: "10",
    title: "선적 및 납품",
    summary: "국내외 물류를 통해 최종 납품까지 책임집니다.",
    detail: "중국 현지에서 국내 창고 또는 고객사까지의 선적과 통관을 대행합니다. 국내 3PL 물류사와 연계하여 입고·보관·출고까지 원스톱으로 처리하며, 해외 수출 시 필요한 인증 및 서류 지원도 제공합니다.",
    tags: ["선적·통관", "국내 물류", "해외 수출", "인증 지원"],
  },
];

export default function ProcessPage() {
  const [openStep, setOpenStep] = useState<number | null>(0);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
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
            <Link href="/service" className="text-sm text-white/55 transition hover:text-white">서비스</Link>
            <Link href="/process" className="text-sm text-white font-medium">프로세스</Link>
            <Link href="/#portfolio" className="text-sm text-white/55 transition hover:text-white">개발사례</Link>
            <button onClick={() => setContactOpen(true)} className="text-sm text-white/55 transition hover:text-white">문의하기</button>
          </div>
          <div className="flex items-center gap-1.5">
            <Link href="/handyworks" className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-white/90 sm:px-3.5">
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

      <div className="mx-auto max-w-3xl px-5 pt-28 pb-20">
        {/* 헤더 */}
        <div className="mb-12">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#86868b]">Manufacturing Process</p>
          <h1 className="text-3xl font-bold text-[#1d1d1f] sm:text-4xl">개발부터 납품까지</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#86868b]">
            아이디어 하나가 완제품이 되기까지, 핸디핸드가 함께하는 8단계 공정을 소개합니다.
          </p>
        </div>

        {/* 스텝 리스트 */}
        <div className="space-y-3">
          {STEPS.map((s, i) => (
            <div
              key={s.step}
              className={`overflow-hidden rounded-2xl border transition-all ${
                openStep === i ? "border-[#1d1d1f] bg-white" : "border-[#e5e5e5] bg-white"
              }`}
            >
              <button
                onClick={() => setOpenStep(openStep === i ? null : i)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
              >
                <span className="shrink-0 text-xs font-bold text-[#86868b]">STEP {s.step}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#1d1d1f] sm:text-base">{s.title}</p>
                  <p className="mt-0.5 text-xs text-[#86868b]">{s.summary}</p>
                </div>
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-[#86868b] transition-transform ${openStep === i ? "rotate-180" : ""}`}
                />
              </button>

              {openStep === i && (
                <div className="border-t border-[#f0f0f0] px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
                  <p className="text-sm leading-relaxed text-[#1d1d1f]">{s.detail}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {s.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-[#f5f5f7] px-3 py-1 text-xs text-[#86868b]">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 rounded-2xl bg-[#1d1d1f] p-8 text-center">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/30">시작하기</p>
          <h2 className="mb-2 text-xl font-bold text-white">지금 바로 문의해보세요</h2>
          <p className="mb-6 text-sm text-white/50">어느 단계에 있든 환영합니다. 아이디어만 있어도 괜찮습니다.</p>
          <Link
            href="/contact"
            className="inline-block rounded-full bg-white px-8 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            문의하기 →
          </Link>
        </div>
      </div>
      {quoteOpen && <QuoteModal onClose={() => setQuoteOpen(false)} />}
      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}
    </div>
  );
}
