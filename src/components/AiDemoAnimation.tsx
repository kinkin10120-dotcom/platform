"use client";

import { useState, useEffect, useRef } from "react";

// 이 컴포넌트는 실제 API를 호출하지 않는 "재생되는 애니메이션"(스크립트대로 자동 재생되는
// 목업)이라 데이터 자체를 한국어/영문 두 벌로 들고 있다가 lang prop으로 고른다 — CadAnalysisModal
// 처럼 서버(Claude) 프롬프트 언어를 바꾸는 문제가 아니라 순수 프론트엔드 텍스트 문제라 더 간단하다.
type Lang = "ko" | "en";

const CONTENT = {
  ko: {
    categories: ["금속", "플라스틱", "기타", "조립품"],
    undetermined: "미정",
    plasticItems: [
      { label: "ABS", sub: "범용" },
      { label: "PP", sub: "폴리프로필렌" },
      { label: "PC", sub: "폴리카보네이트" },
      { label: "POM", sub: "엔지니어링" },
      { label: "TPU", sub: "탄성 플라스틱" },
    ],
    quantityOptions: [
      { label: "시제품", sub: "1~5개" },
      { label: "소량", sub: "10~100개" },
      { label: "중량", sub: "100~500개" },
      { label: "양산", sub: "1000개+" },
    ],
    scenarios: [
      {
        category: "플라스틱",
        hasSubgrid: true,
        material: "ABS",
        purpose: "스마트폰 거치대 브라켓",
        quantityLabel: "소량",
        quantitySub: "10~100개",
        size: "소형 (~100mm)",
        method1: "사출금형",
        pct1: 92,
        method1Desc: "소형 ABS 부품, 언더컷 없는 단순 구조",
        method1Initial: 3,
        method1Unit: 1,
        method2: "3D프린팅",
        pct2: 65,
        method2Desc: "시제품 제작에 적합, 소량 생산 가능",
        method2Initial: 1,
        method2Unit: 3,
        summary: "소형 ABS 브라켓으로 사출금형이 가장 적합합니다. 언더컷 없는 단순 구조로 금형 비용이 낮고 대량 생산에 유리합니다.",
      },
    ],
    costLabel: { 1: "낮음", 2: "보통", 3: "높음" } as Record<number, string>,
    initialCostLabel: "초기 설비투자",
    unitCostLabel: "개당 단가",
    title: "AI 제조방법 분석",
    uploadPrompt: "CAD 파일을 드래그하거나 클릭하여 업로드",
    uploadFormats: ".stp · .step · .dxf · .dwg · .ipt · .iam · .sldprt · .sldasm 지원 · 최대 50MB",
    uploadNoDrawing: "도면이 없다면 아래 용도만 입력해도 분석할 수 있습니다",
    uploadedFileName: "bracket_v3.stp",
    uploadedFileSize: "2.4 MB · 클릭하여 변경",
    materialLabel: "재질 선택",
    materialHint: "— 입력할수록 정확해집니다",
    chooseSubcategory: "소분류를 선택하세요",
    quantityLabel: "생산 수량",
    purposeLabel: "제품 용도",
    purposePlaceholder: "예: 스마트폰 거치대, 자동차 내부 브라켓",
    disclaimerInput: "* DWG · IPT · IAM · SLDPRT · SLDASM 파일과 도면 없이 진행하는 분석은 파일명·메타데이터·텍스트 설명 기반으로 추정되어 정확도가 낮을 수 있습니다. 더 정확한 분석을 원하시면 STP/STEP 파일을 사용하세요.",
    startButton: "분석 시작",
    loadingTitle: "AI가 분석하고 있습니다...",
    loadingStep1: "형상 및 치수 분석 완료",
    loadingStep2: "복잡도 및 재질 적합성 검토 완료",
    loadingStep3: "최적 제조방법 도출 중...",
    estimatedPart: "추정 부품명",
    sizeLabel: "크기",
    materialResultLabel: "재질",
    quantityResultLabel: "수량",
    recommendedMethods: "추천 제조방법",
    rank1: "1순위",
    rank2: "2순위",
    aiSummary: "AI 요약",
    resultDisclaimer: "* 본 분석은 AI 추정 결과로, 실제 제조 조건에 따라 달라질 수 있습니다.",
    reanalyze: "다시 분석",
    requestQuote: "견적 요청하기 ›",
  },
  en: {
    categories: ["Metal", "Plastic", "Other", "Assembly"],
    undetermined: "Unspecified",
    plasticItems: [
      { label: "ABS", sub: "General-Purpose" },
      { label: "PP", sub: "Polypropylene" },
      { label: "PC", sub: "Polycarbonate" },
      { label: "POM", sub: "Engineering" },
      { label: "TPU", sub: "Elastic Plastic" },
    ],
    quantityOptions: [
      { label: "Prototype", sub: "1–5 units" },
      { label: "Low", sub: "10–100 units" },
      { label: "Mid", sub: "100–500 units" },
      { label: "Mass", sub: "1000+ units" },
    ],
    scenarios: [
      {
        category: "Plastic",
        hasSubgrid: true,
        material: "ABS",
        purpose: "Smartphone Stand Bracket",
        quantityLabel: "Low",
        quantitySub: "10–100 units",
        size: "Small (~100mm)",
        method1: "Injection Molding",
        pct1: 92,
        method1Desc: "Small ABS part with a simple structure and no undercuts",
        method1Initial: 3,
        method1Unit: 1,
        method2: "3D Printing",
        pct2: 65,
        method2Desc: "Good for prototyping, low-volume production possible",
        method2Initial: 1,
        method2Unit: 3,
        summary: "For this small ABS bracket, injection molding is the best fit. The simple, undercut-free structure keeps tooling costs low and favors high-volume production.",
      },
    ],
    costLabel: { 1: "Low", 2: "Medium", 3: "High" } as Record<number, string>,
    initialCostLabel: "Initial tooling cost",
    unitCostLabel: "Unit cost",
    title: "AI Manufacturing Method Analysis",
    uploadPrompt: "Drag and drop or click to upload a CAD file",
    uploadFormats: "Supports .stp · .step · .dxf · .dwg · .ipt · .iam · .sldprt · .sldasm · Max 50MB",
    uploadNoDrawing: "No drawing? Just enter the intended use below to get an analysis",
    uploadedFileName: "bracket_v3.stp",
    uploadedFileSize: "2.4 MB · Click to change",
    materialLabel: "Select Material",
    materialHint: "— more input improves accuracy",
    chooseSubcategory: "Choose a subcategory",
    quantityLabel: "Production Quantity",
    purposeLabel: "Product Use",
    purposePlaceholder: "e.g. Smartphone stand, automotive interior bracket",
    disclaimerInput: "* Analysis without a drawing, or from DWG, IPT, IAM, SLDPRT, or SLDASM files, is estimated from the filename, metadata, and text description, and may be less accurate. For a more accurate analysis, use an STP/STEP file.",
    startButton: "Start Analysis",
    loadingTitle: "AI is analyzing...",
    loadingStep1: "Shape and dimension analysis complete",
    loadingStep2: "Complexity and material fit review complete",
    loadingStep3: "Determining the best manufacturing method...",
    estimatedPart: "Estimated Part",
    sizeLabel: "Size",
    materialResultLabel: "Material",
    quantityResultLabel: "Quantity",
    recommendedMethods: "Recommended Methods",
    rank1: "1st",
    rank2: "2nd",
    aiSummary: "AI Summary",
    resultDisclaimer: "* This analysis is an AI estimate and actual results may vary depending on manufacturing conditions.",
    reanalyze: "Re-analyze",
    requestQuote: "Request a Quote ›",
  },
};

function CostBadges({
  initial, unit, dark = false, initialLabel, unitLabel, costLabel,
}: {
  initial?: number; unit?: number; dark?: boolean; initialLabel: string; unitLabel: string; costLabel: Record<number, string>;
}) {
  if (!initial && !unit) return null;
  const textClass = dark ? "text-white/50" : "text-[#86868b]";
  const strongClass = dark ? "text-white/80" : "text-[#1d1d1f]";
  return (
    <div className={`mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] ${textClass}`}>
      {!!initial && costLabel[initial] && (
        <span>{initialLabel} <span className={`font-semibold ${strongClass}`}>{costLabel[initial]}</span></span>
      )}
      {!!unit && costLabel[unit] && (
        <span>{unitLabel} <span className={`font-semibold ${strongClass}`}>{costLabel[unit]}</span></span>
      )}
    </div>
  );
}

type Screen = "input" | "loading" | "results";

export function AiDemoAnimation({ onCta, lang = "ko" }: { onCta?: () => void; lang?: Lang }) {
  const t = CONTENT[lang];
  const [screen, setScreen] = useState<Screen>("input");
  const [showFile, setShowFile] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showSubGrid, setShowSubGrid] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState<string | null>(null);
  const [typedText, setTypedText] = useState("");
  const [btnClick, setBtnClick] = useState(false);
  const [loadStep, setLoadStep] = useState(0);
  const [bar1, setBar1] = useState(0);
  const [bar2, setBar2] = useState(0);
  const [resultsVisible, setResultsVisible] = useState(false);
  const [scenario, setScenario] = useState(t.scenarios[0]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [fixedHeight, setFixedHeight] = useState<number | null>(null);
  const scenarioIndexRef = useRef(0);

  // 초기 렌더링 후 높이 측정 → 이후 모든 화면에 고정
  useEffect(() => {
    const timer = setTimeout(() => {
      if (containerRef.current) {
        setFixedHeight(containerRef.current.offsetHeight);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const ids: ReturnType<typeof setTimeout>[] = [];
    const tt = (fn: () => void, ms: number) => { const id = setTimeout(fn, ms); ids.push(id); };

    function cycle() {
      const current = t.scenarios[scenarioIndexRef.current % t.scenarios.length];
      scenarioIndexRef.current += 1;
      setScenario(current);

      setScreen("input");
      setShowFile(false);
      setSelectedCategory(null);
      setShowSubGrid(false);
      setSelectedMaterial(null);
      setSelectedQuantity(null);
      setTypedText("");
      setBtnClick(false);
      setLoadStep(0);
      setBar1(0);
      setBar2(0);
      setResultsVisible(false);

      tt(() => setShowFile(true), 300);
      tt(() => { setSelectedCategory(current.category); setShowSubGrid(current.hasSubgrid); }, 800);
      tt(() => { setSelectedMaterial(current.material); setShowSubGrid(false); }, 1400);
      tt(() => setSelectedQuantity(`${current.quantityLabel} (${current.quantitySub})`), 2000);
      tt(() => {
        let i = 0;
        const iv = setInterval(() => {
          i++;
          setTypedText(current.purpose.slice(0, i));
          if (i >= current.purpose.length) clearInterval(iv);
        }, 30);
        ids.push(iv as unknown as ReturnType<typeof setTimeout>);
      }, 2600);
      tt(() => setBtnClick(true), 3400);
      tt(() => { setScreen("loading"); setLoadStep(1); }, 3800);
      tt(() => setLoadStep(2), 4500);
      tt(() => setLoadStep(3), 5100);
      tt(() => { setScreen("results"); setTimeout(() => setResultsVisible(true), 50); }, 5800);
      tt(() => setBar1(current.pct1), 6100);
      tt(() => setBar2(current.pct2), 6500);
      tt(cycle, 11000);
    }

    cycle();
    return () => ids.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  return (
    <div
      ref={containerRef}
      className="w-full flex flex-col overflow-hidden rounded-3xl bg-white"
      style={{
        ...(fixedHeight ? { height: fixedHeight } : {}),
        boxShadow:
          "0 0 0 1px rgba(0,0,0,0.06), 0 8px 20px rgba(0,0,0,0.06), 0 24px 48px rgba(0,0,0,0.07)",
      }}
    >
      {/* 헤더 */}
      <div className="shrink-0 border-b border-[#f0f0f0] bg-white px-6 pt-6 pb-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#86868b]">AI Analysis</p>
        <h2 className="text-2xl font-bold text-[#1d1d1f]">{t.title}</h2>
      </div>

      {/* ── INPUT ── */}
      {screen === "input" && (
        <>
          {/* 스크롤 가능 콘텐츠 영역 — 내부 확장이 모달 크기에 영향 없음 */}
          <div
            className="no-scrollbar flex-1 overflow-y-auto px-6 pt-5 pb-2"
            style={{ scrollbarWidth: "none" }}
          >
            <p className="mb-5 text-sm leading-relaxed text-[#86868b]">
              {lang === "ko" ? (
                <>CAD 파일을 업로드하면 AI가 형상을 분석해 최적 제조방법을 추천합니다. 도면이 없다면 제품 용도만 입력해도 대략적인 분석이 가능합니다. 재질·수량·용도를 입력할수록 분석 정확도가 높아집니다. 조립품 도면은 재질에서 <span className="font-medium text-[#1d1d1f]">조립품</span>을 선택해주세요.</>
              ) : (
                <>Upload a CAD file and AI will analyze the shape to recommend the best manufacturing method. No drawing? Just enter the product&apos;s use for a rough analysis. The more material, quantity, and use info you provide, the more accurate the analysis. For assembly drawings, select <span className="font-medium text-[#1d1d1f]">Assembly</span> as the material.</>
              )}
            </p>

            {/* 파일 업로드 */}
            <div className={`flex h-44 shrink-0 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed transition-all duration-500 ${showFile ? "border-black bg-black/[0.02]" : "border-[#d1d1d6]"}`}>
              {!showFile ? (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f5f5f7]">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#86868b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-[#1d1d1f]">{t.uploadPrompt}</p>
                    <p className="mt-1 text-xs text-[#86868b]">{t.uploadFormats}</p>
                    <p className="mt-1 text-xs text-[#c7c7cc]">{t.uploadNoDrawing}</p>
                  </div>
                </>
              ) : (
                <div style={{ animation: "fadeSlideIn 0.35s ease forwards" }} className="flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black">
                    <span className="text-xs font-bold text-white">STP</span>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-[#1d1d1f]">{t.uploadedFileName}</p>
                    <p className="text-xs text-[#86868b]">{t.uploadedFileSize}</p>
                  </div>
                </div>
              )}
            </div>

            {/* 재질 선택 */}
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold text-[#1d1d1f]">
                {t.materialLabel} <span className="ml-1 text-xs font-normal text-[#86868b]">{t.materialHint}</span>
              </p>
              {/* relative wrapper — 서브그리드가 absolute overlay로 떠오름 */}
              <div className="relative">
                <div className="flex gap-2">
                  {t.categories.map((cat) => (
                    <button key={cat} type="button" className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition ${selectedCategory === cat ? "border-black bg-black text-white" : "border-[#e5e5e5] bg-white text-[#1d1d1f]"}`}>{cat}</button>
                  ))}
                  <button type="button" className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition ${selectedCategory === null ? "border-black bg-black text-white" : "border-[#e5e5e5] bg-white text-[#1d1d1f]"}`}>{t.undetermined}</button>
                </div>

                {/* absolute 드롭다운 — 레이아웃 높이 변화 없음 */}
                {showSubGrid && (
                  <div
                    className="absolute left-0 right-0 top-full z-20 mt-1 rounded-2xl border border-[#e5e5e5] bg-white p-3 shadow-lg"
                    style={{ animation: "fadeSlideIn 0.2s ease forwards" }}
                  >
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {t.plasticItems.map((mat) => (
                        <button key={mat.label} type="button" className="rounded-xl border border-[#e5e5e5] bg-[#f5f5f7] px-3 py-1.5 text-left">
                          <span className="block whitespace-nowrap text-xs font-semibold text-[#1d1d1f]">{mat.label}</span>
                          <span className="block whitespace-nowrap text-[10px] text-[#86868b]">{mat.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 flex h-6 items-center">
                {!showSubGrid && selectedMaterial ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[#86868b]">{selectedCategory} ›</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#1d1d1f] px-2.5 py-0.5 text-[11px] font-semibold text-white">{selectedMaterial}</span>
                  </div>
                ) : showSubGrid ? (
                  <p className="text-xs text-[#86868b]">{t.chooseSubcategory}</p>
                ) : null}
              </div>
            </div>

            {/* 생산 수량 */}
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold text-[#1d1d1f]">
                {t.quantityLabel} <span className="ml-1 text-xs font-normal text-[#86868b]">{t.materialHint}</span>
              </p>
              <div className="flex gap-2">
                {t.quantityOptions.map((q) => {
                  const val = `${q.label} (${q.sub})`;
                  return (
                    <button key={q.label} type="button" className={`flex flex-1 flex-col items-center rounded-xl border py-2 transition ${selectedQuantity === val ? "border-black bg-black text-white" : "border-[#e5e5e5] bg-white text-[#1d1d1f]"}`}>
                      <span className="text-xs font-semibold">{q.label}</span>
                      <span className={`text-[10px] ${selectedQuantity === val ? "text-white/60" : "text-[#86868b]"}`}>{q.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 제품 용도 */}
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold text-[#1d1d1f]">
                {t.purposeLabel} <span className="ml-1 text-xs font-normal text-[#86868b]">{t.materialHint}</span>
              </p>
              <div className="w-full rounded-xl border border-[#e5e5e5] px-4 py-3">
                {typedText.length === 0 ? (
                  <span className="text-sm text-[#c7c7cc]">{t.purposePlaceholder}</span>
                ) : (
                  <span className="text-sm text-[#1d1d1f]">
                    {typedText}
                    {typedText.length < scenario.purpose.length && (
                      <span className="ml-0.5 inline-block h-[14px] w-[2px] translate-y-[2px] animate-pulse bg-[#1d1d1f]" />
                    )}
                  </span>
                )}
              </div>
            </div>

            <p className="mt-4 pb-1 text-xs text-[#86868b]">
              {t.disclaimerInput}
            </p>
          </div>

          {/* 분석 시작 버튼 — 하단 고정 */}
          <div className="shrink-0 px-6 pb-6 pt-3">
            <button
              className={`flex w-full items-center justify-center rounded-full py-3 text-sm font-semibold text-white transition-all duration-150 ${showFile ? "bg-black" : "bg-black opacity-40"} ${btnClick ? "scale-95" : "scale-100"}`}
            >
              {t.startButton}
            </button>
          </div>
        </>
      )}

      {/* ── LOADING ── */}
      {screen === "loading" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-6">
          <div className="mb-6 h-10 w-10 animate-spin rounded-full border-2 border-[#e5e5e5] border-t-[#1d1d1f]" />
          <p className="mb-6 text-sm font-semibold text-[#1d1d1f]">{t.loadingTitle}</p>
          <div className="w-full max-w-[280px] space-y-3">
            <div className="flex items-center gap-2.5 text-sm text-[#86868b] transition-opacity duration-500" style={{ opacity: loadStep >= 1 ? 1 : 0 }}>
              <span className="font-bold text-green-500">✓</span> {t.loadingStep1}
            </div>
            <div className="flex items-center gap-2.5 text-sm text-[#86868b] transition-opacity duration-500" style={{ opacity: loadStep >= 2 ? 1 : 0 }}>
              <span className="font-bold text-green-500">✓</span> {t.loadingStep2}
            </div>
            <div className="flex items-center gap-2.5 text-sm text-[#1d1d1f] transition-opacity duration-500" style={{ opacity: loadStep >= 3 ? 1 : 0 }}>
              <span className="inline-block animate-spin">⟳</span> {t.loadingStep3}
            </div>
          </div>
        </div>
      )}

      {/* ── RESULTS ── */}
      {screen === "results" && (
        <>
          <div
            className="no-scrollbar flex-1 overflow-y-auto px-6 pt-6 pb-2"
            style={{
              scrollbarWidth: "none",
              opacity: resultsVisible ? 1 : 0,
              transition: "opacity 0.4s ease",
            }}
          >
            <div className="space-y-4 pb-2">
              <div className="rounded-2xl bg-[#f5f5f7] p-4">
                <div>
                  <p className="text-xs text-[#86868b]">{t.estimatedPart}</p>
                  <p className="mt-0.5 text-base font-bold text-[#1d1d1f]">{scenario.purpose}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#86868b]">
                  <span>{t.sizeLabel}: <span className="font-medium text-[#1d1d1f]">{scenario.size}</span></span>
                  <span>{t.materialResultLabel}: <span className="font-medium text-[#1d1d1f]">{scenario.material}</span></span>
                  <span>{t.quantityResultLabel}: <span className="font-medium text-[#1d1d1f]">{scenario.quantityLabel} ({scenario.quantitySub})</span></span>
                </div>
              </div>

              <p className="text-xs font-semibold uppercase tracking-widest text-[#86868b]">{t.recommendedMethods}</p>
              <div className="space-y-2">
                <div className="rounded-2xl border border-black bg-black p-4">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm font-bold text-white"><span className="mr-1.5 text-xs font-normal opacity-50">{t.rank1}</span>{scenario.method1}</span>
                    <span className="text-xs font-semibold text-white/60">{bar1}%</span>
                  </div>
                  <div className="mb-2 h-0.5 w-full rounded-full bg-white/20">
                    <div className="h-0.5 rounded-full bg-white transition-all duration-1000 ease-out" style={{ width: `${bar1}%` }} />
                  </div>
                  <p className="text-xs text-white/60">{scenario.method1Desc}</p>
                  <CostBadges initial={scenario.method1Initial} unit={scenario.method1Unit} dark initialLabel={t.initialCostLabel} unitLabel={t.unitCostLabel} costLabel={t.costLabel} />
                </div>
                <div className="rounded-2xl border border-[#e5e5e5] p-4">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm font-bold text-[#1d1d1f]"><span className="mr-1.5 text-xs font-normal opacity-50">{t.rank2}</span>{scenario.method2}</span>
                    <span className="text-xs font-semibold text-[#86868b]">{bar2}%</span>
                  </div>
                  <div className="mb-2 h-0.5 w-full rounded-full bg-[#f0f0f0]">
                    <div className="h-0.5 rounded-full bg-black transition-all duration-1000 ease-out" style={{ width: `${bar2}%` }} />
                  </div>
                  <p className="text-xs text-[#86868b]">{scenario.method2Desc}</p>
                  <CostBadges initial={scenario.method2Initial} unit={scenario.method2Unit} initialLabel={t.initialCostLabel} unitLabel={t.unitCostLabel} costLabel={t.costLabel} />
                </div>
              </div>

              <div className="rounded-2xl bg-[#f5f5f7] px-4 py-3">
                <p className="mb-1 text-xs font-semibold text-[#86868b]">{t.aiSummary}</p>
                <p className="text-sm leading-relaxed text-[#1d1d1f]">{scenario.summary}</p>
              </div>

              <p className="text-[11px] leading-relaxed text-[#b0b0b5]">
                {t.resultDisclaimer}
              </p>
            </div>
          </div>

          <div className="shrink-0 flex gap-2 px-6 pb-6 pt-4">
            <div className="flex-1 rounded-full border border-[#e5e5e5] py-3 text-center text-sm font-medium text-[#1d1d1f]">{t.reanalyze}</div>
            <div className="flex flex-1 items-center justify-center gap-1 rounded-full bg-black py-3 text-sm font-semibold text-white">
              {t.requestQuote}
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
