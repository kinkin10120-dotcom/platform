"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Menu, X, FileUp, ScanSearch, FileCheck2, PhoneCall, ChevronDown, Mail, Clock, Gift, RefreshCw, Languages } from "lucide-react";
import { ScaledAiDemo } from "@/components/ScaledAiDemo";
import { CadAnalysisModal } from "@/components/CadAnalysisModal";
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
    icon: FileUp,
    num: "01",
    title: "도면 파일 업로드",
    desc: "STP · STEP · DXF · DWG · IPT · IAM · SLDPRT · SLDASM 형식의 도면 파일을 업로드합니다. 별도 프로그램 설치 없이 브라우저에서 바로 진행됩니다.",
  },
  {
    icon: ScanSearch,
    num: "02",
    title: "AI 자동 분석",
    desc: "AI가 도면의 형상, 치수, 재질 정보를 인식하고 가장 적합한 제조 방법(사출금형, CNC가공 등)을 자동으로 판단합니다.",
  },
  {
    icon: FileCheck2,
    num: "03",
    title: "바로 견적 요청",
    desc: "분석 결과가 견적 요청서에 자동으로 입력됩니다. 별도로 스펙을 다시 정리해서 입력할 필요 없이 바로 견적을 요청할 수 있습니다.",
  },
  {
    icon: PhoneCall,
    num: "04",
    title: "담당 PM 연락",
    desc: "견적 요청 내용을 확인한 후 담당 PM이 빠르게 연락드려 세부 사항을 함께 논의하고 다음 단계를 안내해드립니다.",
  },
];

const RESULT_EXAMPLES = [
  {
    part: "스마트폰 거치대 브라켓",
    spec: "ABS · 소량",
    method: "사출금형",
    pct: 92,
    methodDesc: "소형 ABS 부품, 언더컷 없는 단순 구조",
    methodInitial: 3,
    methodUnit: 1,
    method2: "3D프린팅",
    pct2: 65,
    method2Desc: "시제품 제작에 적합, 소량 생산 가능",
    method2Initial: 1,
    method2Unit: 3,
    summary: "소형 ABS 브라켓으로 사출금형이 가장 적합합니다. 언더컷 없는 단순 구조로 금형 비용이 낮고 대량 생산에 유리합니다.",
  },
  {
    part: "전자기기 하우징",
    spec: "PC · 중량",
    method: "사출금형",
    pct: 88,
    methodDesc: "PC 소재, 중량 생산에 적합한 금형 설계",
    methodInitial: 3,
    methodUnit: 1,
    method2: "CNC가공",
    pct2: 58,
    method2Desc: "시제품·검증 단계에 적합, 소량 생산용",
    method2Initial: 1,
    method2Unit: 3,
    summary: "PC 소재 하우징은 사출금형이 가장 적합합니다. 중량 생산 기준으로 금형비 대비 단가 절감 효과가 큽니다.",
  },
  {
    part: "시제품 커넥터 부품",
    spec: "알루미늄 · 시제품",
    method: "CNC가공",
    pct: 90,
    methodDesc: "정밀 치수 요구, 소량 시제품에 적합",
    methodInitial: 1,
    methodUnit: 3,
    method2: "3D프린팅",
    pct2: 55,
    method2Desc: "형상 검증용, 강도 요구 시 부적합",
    method2Initial: 1,
    method2Unit: 2,
    summary: "알루미늄 시제품 부품은 CNC가공이 가장 적합합니다. 정밀한 치수와 강도가 필요한 커넥터 구조에 유리합니다.",
  },
  {
    part: "자동차 내장재 브라켓",
    spec: "PP · 양산",
    method: "사출금형",
    pct: 90,
    methodDesc: "PP 소재, 대량 생산에 적합한 내구성 있는 금형",
    methodInitial: 3,
    methodUnit: 1,
    method2: "CNC가공",
    pct2: 45,
    method2Desc: "금형 제작 전 형상 검증용",
    method2Initial: 1,
    method2Unit: 3,
    summary: "PP 소재의 대량 생산에는 사출금형이 최적입니다. 내구성 높은 금형으로 장기 양산에 적합합니다.",
  },
  {
    part: "웨어러블 기기 케이스",
    spec: "실리콘 · 양산",
    method: "실리콘금형",
    pct: 91,
    methodDesc: "유연한 실리콘 소재, 반복 착용에도 견디는 내구성",
    methodInitial: 2,
    methodUnit: 2,
    method2: "3D프린팅",
    pct2: 50,
    method2Desc: "형상 검증용 소량 샘플 제작 시",
    method2Initial: 1,
    method2Unit: 3,
    summary: "실리콘 소재의 웨어러블 케이스는 실리콘금형이 가장 적합합니다. 유연성과 내구성을 동시에 확보할 수 있어 반복 착용 제품에 유리합니다.",
  },
  {
    part: "정밀 기어 부품",
    spec: "SUS304 · 중량",
    method: "CNC가공",
    pct: 95,
    methodDesc: "높은 정밀도와 강도가 필요한 스틸 소재",
    methodInitial: 1,
    methodUnit: 3,
    method2: "다이캐스팅",
    pct2: 40,
    method2Desc: "형상 복잡도가 낮을 경우 검토 가능",
    method2Initial: 3,
    method2Unit: 1,
    summary: "SUS304 스틸 기어는 정밀한 치수 관리가 중요해 CNC가공이 가장 적합합니다. 표면 마감과 공차 관리에도 유리합니다.",
  },
  {
    part: "메탈 커넥터 하우징",
    spec: "아연합금 · 양산",
    method: "다이캐스팅",
    pct: 89,
    methodDesc: "복잡한 형상도 정밀 구현 가능, 대량 생산 시 단가 유리",
    methodInitial: 3,
    methodUnit: 1,
    method2: "CNC가공",
    pct2: 50,
    method2Desc: "소량 시제품 검증 시 적합",
    method2Initial: 1,
    method2Unit: 3,
    summary: "아연합금 소재의 소형 금속 부품은 다이캐스팅이 가장 적합합니다. 복잡한 형상도 정밀하게 구현할 수 있고 대량 생산 시 단가 경쟁력이 높습니다.",
  },
  {
    part: "LED 조명 하우징",
    spec: "알루미늄 압출재 · 양산",
    method: "압출 프로파일",
    pct: 87,
    methodDesc: "일정 단면의 장척 부품, 방열 구조를 한 번에 성형",
    methodInitial: 2,
    methodUnit: 1,
    method2: "CNC가공",
    pct2: 45,
    method2Desc: "압출 후 추가 가공이 필요할 경우",
    method2Initial: 1,
    method2Unit: 3,
    summary: "일정한 단면의 알루미늄 하우징은 압출 프로파일이 가장 적합합니다. 방열 핀 구조를 압출로 한 번에 성형해 단가 효율이 높습니다.",
  },
  {
    part: "디자인 목업 샘플",
    spec: "레진 · 시제품",
    method: "진공주형",
    pct: 82,
    methodDesc: "실리콘 마스터 몰드로 소량 복제, 사출과 유사한 외관",
    methodInitial: 2,
    methodUnit: 2,
    method2: "3D프린팅",
    pct2: 60,
    method2Desc: "형상 검증 단계, 표면 품질은 진공주형이 우수",
    method2Initial: 1,
    method2Unit: 2,
    summary: "소량의 디자인 목업은 진공주형이 적합합니다. 실리콘 마스터 몰드로 사출 품질과 유사한 샘플을 빠르게 복제할 수 있습니다.",
  },
  {
    part: "정밀 금속 브라켓",
    spec: "SUS304 박판 · 소량",
    method: "레이저 커팅, 판금가공",
    pct: 88,
    methodDesc: "정밀한 절단면과 복잡한 외곽 형상 구현에 적합",
    methodInitial: 1,
    methodUnit: 2,
    method2: "CNC가공",
    pct2: 50,
    method2Desc: "두꺼운 판재나 3차원 가공이 필요할 경우",
    method2Initial: 1,
    method2Unit: 3,
    summary: "박판 금속 브라켓은 레이저 커팅, 판금가공이 가장 적합합니다. 정밀한 절단면으로 후가공 없이 바로 조립할 수 있습니다.",
  },
  {
    part: "전자기기 섀시",
    spec: "알루미늄 판재 · 중량",
    method: "판금가공",
    pct: 90,
    methodDesc: "절곡·펀칭 공정으로 견고한 금속 구조물 제작에 적합",
    methodInitial: 2,
    methodUnit: 2,
    method2: "다이캐스팅",
    pct2: 40,
    method2Desc: "더 복잡한 형상이 필요할 경우 검토",
    method2Initial: 3,
    method2Unit: 1,
    summary: "알루미늄 판재 섀시는 판금가공이 가장 적합합니다. 절곡과 펀칭으로 견고하면서도 가벼운 구조를 효율적으로 제작할 수 있습니다.",
  },
];

const COST_LABEL: Record<number, string> = { 1: "낮음", 2: "보통", 3: "높음" };

function CostBadges({ initial, unit, dark = false }: { initial?: number; unit?: number; dark?: boolean }) {
  if (!initial && !unit) return null;
  const textClass = dark ? "text-white/50" : "text-[#86868b]";
  const strongClass = dark ? "text-white/80" : "text-[#1d1d1f]";
  return (
    <div className={`mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] ${textClass}`}>
      {!!initial && COST_LABEL[initial] && (
        <span>초기 설비투자 <span className={`font-semibold ${strongClass}`}>{COST_LABEL[initial]}</span></span>
      )}
      {!!unit && COST_LABEL[unit] && (
        <span>개당 단가 <span className={`font-semibold ${strongClass}`}>{COST_LABEL[unit]}</span></span>
      )}
    </div>
  );
}

function ResultExamplesMarquee({ items }: { items: typeof RESULT_EXAMPLES }) {
  // iOS Safari에서 overflow-x-auto 요소의 scrollLeft를 rAF로 직접 조작하면
  // 브라우저가 프로그래밍적 스크롤을 씹거나 지연시키는 경우가 있어,
  // 네이티브 스크롤 대신 transform: translateX로 직접 애니메이션한다.
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const offsetRef = useRef(0);
  const halfWidthRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    const updateHalfWidth = () => { halfWidthRef.current = track.scrollWidth / 2; };
    updateHalfWidth();
    const ro = new ResizeObserver(updateHalfWidth);
    ro.observe(track);

    let rafId: number;
    let pausedSince = 0;
    const speed = 0.6;
    const step = () => {
      // 안전장치: 터치/포인터 이벤트가 씹혀서 멈춤 상태로 고착되는 경우를 대비한 강제 재개
      if (pausedRef.current && pausedSince > 0 && performance.now() - pausedSince > 1000) {
        pausedRef.current = false;
      }
      if (!pausedRef.current && halfWidthRef.current > 0) {
        offsetRef.current -= speed;
        if (offsetRef.current <= -halfWidthRef.current) offsetRef.current += halfWidthRef.current;
        track.style.transform = `translateX(${offsetRef.current}px)`;
      }
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);

    let dragging = false;
    let startX = 0;
    let startOffset = 0;

    const pause = () => {
      pausedRef.current = true;
      pausedSince = performance.now();
    };
    const resume = () => {
      pausedRef.current = false;
      pausedSince = 0;
    };

    const wrap = (v: number) => {
      const hw = halfWidthRef.current;
      if (hw <= 0) return v;
      while (v > 0) v -= hw;
      while (v <= -hw) v += hw;
      return v;
    };

    const onPointerDown = (e: PointerEvent) => {
      pause();
      dragging = true;
      startX = e.clientX;
      startOffset = offsetRef.current;
      container.style.cursor = "grabbing";
      container.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      offsetRef.current = wrap(startOffset + (e.clientX - startX));
      track.style.transform = `translateX(${offsetRef.current}px)`;
    };
    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      resume();
      container.style.cursor = "";
      if (container.hasPointerCapture(e.pointerId)) container.releasePointerCapture(e.pointerId);
    };

    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointercancel", onPointerUp);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="cursor-grab overflow-hidden"
      style={{
        touchAction: "pan-y",
        maskImage: "linear-gradient(to right, transparent, black 48px, black calc(100% - 48px), transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 48px, black calc(100% - 48px), transparent)",
      }}
    >
      <div ref={trackRef} className="flex gap-4 pl-5 sm:pl-6" style={{ willChange: "transform" }}>
      {[...items, ...items].map((ex, i) => (
        <div
          key={`${ex.part}-${i}`}
          className="w-[calc(100vw-64px)] shrink-0 rounded-2xl bg-white p-5 sm:w-[420px] sm:rounded-3xl sm:p-6"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.03), 0 12px 32px rgba(0,0,0,0.05)" }}
        >
          <div className="rounded-2xl bg-[#f5f5f7] p-4">
            <p className="text-xs text-[#86868b]">추정 부품명</p>
            <p className="mt-0.5 text-base font-bold text-[#1d1d1f]">{ex.part}</p>
            <p className="mt-1 text-xs text-[#86868b]">{ex.spec}</p>
          </div>

          <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-widest text-[#86868b]">추천 제조방법</p>
          <div className="space-y-2">
            <div className="rounded-2xl border border-black bg-black p-4">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-bold text-white">
                  <span className="mr-1.5 text-xs font-normal opacity-50">1순위</span>{ex.method}
                </span>
                <span className="text-xs font-semibold text-white/60">{ex.pct}%</span>
              </div>
              <div className="mb-2 h-0.5 w-full rounded-full bg-white/20">
                <div className="h-0.5 rounded-full bg-white" style={{ width: `${ex.pct}%` }} />
              </div>
              <p className="text-xs text-white/60">{ex.methodDesc}</p>
              <CostBadges initial={ex.methodInitial} unit={ex.methodUnit} dark />
            </div>
            <div className="rounded-2xl border border-[#e5e5e5] p-4">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-bold text-[#1d1d1f]"><span className="mr-1.5 text-xs font-normal opacity-50">2순위</span>{ex.method2}</span>
                <span className="text-xs font-semibold text-[#86868b]">{ex.pct2}%</span>
              </div>
              <div className="mb-2 h-0.5 w-full rounded-full bg-[#f0f0f0]">
                <div className="h-0.5 rounded-full bg-black" style={{ width: `${ex.pct2}%` }} />
              </div>
              <p className="text-xs text-[#86868b]">{ex.method2Desc}</p>
              <CostBadges initial={ex.method2Initial} unit={ex.method2Unit} />
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-[#f5f5f7] px-4 py-3">
            <p className="mb-1 text-xs font-semibold text-[#86868b]">AI 요약</p>
            <p className="text-xs leading-relaxed text-[#1d1d1f]">{ex.summary}</p>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-[#b0b0b5]">
            * 본 분석은 AI 추정 결과로, 실제 제조 조건에 따라 달라질 수 있습니다.
          </p>
        </div>
      ))}
      </div>
    </div>
  );
}

const FAQS = [
  { q: "어떤 파일 형식을 지원하나요?", a: "STP, STEP, DXF, DWG, IPT, IAM, SLDPRT, SLDASM 형식의 도면 파일을 지원합니다." },
  { q: "비용이 드나요?", a: "무료로 이용하실 수 있습니다. 견적 요청 전에 부담 없이 사용해보세요." },
  { q: "AI가 정확히 어떤 항목을 분석하나요?", a: "도면의 형상, 치수, 재질 정보를 바탕으로 가장 적합한 제조 방법을 분석합니다." },
  { q: "분석 결과는 어떻게 활용되나요?", a: "분석 결과가 자동으로 견적 요청서에 연결되어, 별도 입력 없이 바로 견적을 요청할 수 있습니다." },
  { q: "도면이 없어도 이용할 수 있나요?", a: "네, 가능합니다. 아직 도면이 없다면 아이디어나 참고 이미지만으로도 견적 상담을 시작하실 수 있습니다." },
  { q: "업로드한 도면은 안전하게 관리되나요?", a: "업로드하신 파일은 AI 분석 목적으로만 사용되며 서버에 저장되지 않습니다. 도면 유출 걱정 없이 이용하실 수 있습니다." },
  { q: "제품 사진으로도 분석할 수 있나요?", a: "현재는 CAD 도면 파일(STP·STEP·DXF·DWG·IPT·IAM·SLDPRT·SLDASM)만 분석 가능하며, 사진 인식은 지원하지 않습니다. 도면이 없다면 제품 용도만 입력해도 대략적인 분석을 받아보실 수 있습니다." },
  { q: "여러 파일을 한 번에 업로드할 수 있나요?", a: "한 번에 하나의 파일만 분석 가능합니다. 여러 부품으로 구성된 제품은 조립품 파일로 업로드하시면 AI가 파트별로 나누어 분석해드립니다." },
];

export default function AiAnalysisPage() {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quotePrefill, setQuotePrefill] = useState<string>("");
  const [cadOpen, setCadOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
                item.href === "/ai-analysis" ? (
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
                  } ${item.href === "/ai-analysis" ? "text-white" : "text-white/70"}`}
                >
                  <span className="text-xs font-medium text-white/25">{String(i + 1).padStart(2, "0")}</span>
                  <span>{item.label}</span>
                  {item.href === "/ai-analysis" && <span className="ml-auto h-1 w-1 rounded-full bg-[#F1CE00]" />}
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

      {/* 플로팅 언어 전환 버튼 */}
      <Link
        href="/en/ai-analysis"
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 rounded-full bg-white px-4 py-3 text-xs font-semibold text-black shadow-lg transition hover:bg-white/90 hover:shadow-xl"
      >
        <Languages size={15} />
        ENG
      </Link>

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
          src="/hero-ai-analysis.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-90"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(29,29,31,0.55) 0%, rgba(29,29,31,0.5) 45%, #1d1d1f 100%)" }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(241,206,0,0.10) 0%, transparent 70%)" }}
        />
        <div className="relative">
          <p className="mb-4 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#F1CE00]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
            AI Analysis · Free
          </p>
          <h1 className="mb-5 text-4xl font-bold leading-tight text-white sm:text-5xl">
            제조과정을<br />AI에게 먼저 물어보세요
          </h1>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-white/50">
            도면만 있다면 무료로 형상을 분석해드립니다.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => setCadOpen(true)}
              className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              무료로 분석 시작하기 →
            </button>
            <Link
              href="/service#material-process"
              className="text-sm font-medium text-white/60 transition hover:text-white"
            >
              도면이 없으신가요? 재질·공정 가이드로 알아보기 →
            </Link>
          </div>
        </div>
      </section>

      {/* 데모 미리보기 */}
      <section className="bg-[#f5f5f7] px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div className="text-center lg:text-left">
              <p className="mb-4 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f] lg:justify-start">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
                Live Preview
              </p>
              <h2 className="mb-4 text-3xl font-bold leading-tight text-[#1d1d1f] sm:text-4xl">
                도면 없이도<br />AI가 분석해드려요
              </h2>
              <p className="mx-auto mb-8 max-w-md text-sm leading-relaxed text-[#86868b] lg:mx-0 sm:text-base">
                실제 화면 그대로예요. 도면이 있으면 더 정확하고,<br className="sm:hidden" />없어도 용도만 입력하면 분석할 수 있어요.
              </p>
              <ul className="mx-auto max-w-md space-y-3 text-left lg:mx-0">
                <li className="flex items-start gap-2.5 text-sm text-[#1d1d1f]">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#F1CE00]" />
                  형상·치수·재질을 자동으로 인식합니다
                </li>
                <li className="flex items-start gap-2.5 text-sm text-[#1d1d1f]">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#F1CE00]" />
                  1·2순위 제조방법을 적합도(%)와 함께 추천합니다
                </li>
                <li className="flex items-start gap-2.5 text-sm text-[#1d1d1f]">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#F1CE00]" />
                  분석 결과가 견적 요청서에 자동으로 연결됩니다
                </li>
                <li className="flex items-start gap-2.5 text-sm text-[#1d1d1f]">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#F1CE00]" />
                  도면 업로드부터 결과 확인까지 1분이면 충분합니다
                </li>
                <li className="flex items-start gap-2.5 text-sm text-[#1d1d1f]">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#F1CE00]" />
                  무료이며, 도면을 바꿔가며 몇 번이든 다시 분석할 수 있습니다
                </li>
              </ul>

              <div className="mx-auto mt-12 flex max-w-md items-stretch justify-center divide-x divide-black/10 lg:mx-0 lg:justify-start">
                {[
                  { icon: Clock, label: "분석 소요", value: "1분", desc: "업로드하면 바로 결과 확인" },
                  { icon: Gift, label: "비용", value: "무료", desc: "견적 요청 없이 이용 가능" },
                  { icon: RefreshCw, label: "재분석", value: "무제한", desc: "도면 바꿔가며 몇 번이든" },
                ].map((stat) => (
                  <div key={stat.label} className="flex flex-1 flex-col items-center gap-1.5 px-4 text-center first:pl-0 last:pr-0">
                    <stat.icon size={16} className="text-[#1d1d1f]" />
                    <p className="text-lg font-bold text-[#1d1d1f] sm:text-xl">{stat.value}</p>
                    <p className="text-xs font-medium text-[#86868b]">{stat.label}</p>
                    <p className="hidden text-[11px] leading-tight text-[#a8a8ad] sm:block">{stat.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="w-full max-w-md justify-self-center">
              <ScaledAiDemo onCta={() => setCadOpen(true)} />
            </div>
          </div>
        </div>
      </section>

      {/* 진행 과정 */}
      <section className="bg-white px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col items-center sm:mb-8 sm:items-start">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
              How It Works
            </p>
            <h2 className="text-3xl font-bold text-[#1d1d1f] sm:text-4xl">이렇게 진행됩니다</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#86868b] sm:text-base">복잡한 절차 없이, 도면 업로드만으로 바로 시작할 수 있습니다.</p>
          </div>
          <div className="max-w-2xl pl-7 sm:pl-4">
            <div className="border-l border-black/10 pl-9 sm:pl-14">
              {STEPS.map((step, i) => (
                <div key={step.num} className={`relative ${i < STEPS.length - 1 ? "pb-12 sm:pb-16" : ""}`}>
                  <span className="absolute -left-[58px] flex h-11 w-11 items-center justify-center rounded-full bg-[#1d1d1f] ring-4 ring-white sm:-left-[80px] sm:h-12 sm:w-12">
                    <step.icon size={18} className="text-white" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1d1d1f]">Step {step.num}</span>
                  <h3 className="mb-2 mt-1 text-lg font-bold text-[#1d1d1f] sm:text-xl">{step.title}</h3>
                  <p className="max-w-md text-sm leading-relaxed text-[#86868b] sm:text-base">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 분석 결과 예시 */}
      <section className="bg-[#f5f5f7] py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <div className="mb-6 flex flex-col items-center sm:mb-8 sm:items-start">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
              Result Examples
            </p>
            <h2 className="text-3xl font-bold text-[#1d1d1f] sm:text-4xl">다양한 제품 사례</h2>
            <p className="mt-3 max-w-lg text-center text-sm leading-relaxed text-[#86868b] sm:text-left sm:text-base">
              형상과 재질이 서로 다른 제품들을<br className="sm:hidden" />AI가 실제로 분석한 결과입니다.
            </p>
          </div>
        </div>
        <div className="overflow-hidden pb-14">
          <ResultExamplesMarquee items={RESULT_EXAMPLES} />
        </div>
      </section>

      {/* 도면이 없어도 괜찮아요 */}
      <section className="relative overflow-hidden bg-white px-5 py-16 sm:px-6 sm:py-24">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.18) 1.5px, transparent 1.5px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(ellipse 85% 95% at 50% 45%, black 30%, transparent 90%)",
            WebkitMaskImage: "radial-gradient(ellipse 85% 95% at 50% 45%, black 30%, transparent 90%)",
          }}
        />
        <div className="relative mx-auto max-w-2xl text-center">
          <p className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
            No Drawing Yet?
          </p>
          <h2 className="mb-3 text-3xl font-bold text-[#1d1d1f] sm:text-4xl">도면이 없어도 괜찮습니다</h2>
          <p className="mx-auto mb-8 max-w-md text-sm leading-relaxed text-[#86868b] sm:text-base">
            아이디어 단계여도 상관없습니다. 원하는 제품을 간단히 설명해주시면 핸디핸드가 검토 후 방향을 함께 잡아드립니다.
          </p>
          <button
            onClick={() => setQuoteOpen(true)}
            className="rounded-full bg-[#1d1d1f] px-7 py-3 text-sm font-semibold text-white transition hover:bg-black"
          >
            아이디어로 견적 상담하기 →
          </button>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-[#f5f5f7] px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col items-center sm:mb-8 sm:items-start">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#1d1d1f]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F1CE00]" />
              FAQ
            </p>
            <h2 className="text-3xl font-bold text-[#1d1d1f] sm:text-4xl">자주 묻는 질문</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            {FAQS.map((item, i) => (
              <div
                key={item.q}
                className={`overflow-hidden rounded-2xl border transition-all sm:rounded-3xl ${
                  openFaq === i ? "border-[#F1CE00] bg-white" : "border-black/5 bg-white"
                }`}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
                >
                  <span className="flex-1 text-sm font-semibold text-[#1d1d1f] sm:text-base">{item.q}</span>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 transition-transform ${openFaq === i ? "rotate-180 text-[#F1CE00]" : "text-[#86868b]"}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="border-t border-[#f0f0f0] px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
                    <p className="text-sm leading-relaxed text-[#86868b]">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
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
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">지금 바로 분석해보세요</h2>
          <p className="mb-10 text-[#86868b]">도면만 있다면 1분 안에 무료로<br className="sm:hidden" />제조 방법을 확인할 수 있습니다.</p>
          <div className="flex justify-center">
            <div className="inline-flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => setCadOpen(true)}
                className="rounded-full bg-white px-8 py-3 text-center text-sm font-semibold text-black transition hover:bg-white/90"
              >
                무료로 분석 시작하기
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

      {quoteOpen && <QuoteModal onClose={() => { setQuoteOpen(false); setQuotePrefill(""); }} prefillDescription={quotePrefill} />}
      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}
      {cadOpen && (
        <CadAnalysisModal
          onClose={() => setCadOpen(false)}
          onRequestQuote={(prefill) => { setQuotePrefill(prefill); setQuoteOpen(true); }}
        />
      )}
    </div>
  );
}
