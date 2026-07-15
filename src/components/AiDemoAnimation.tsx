"use client";

import { useState, useEffect, useRef } from "react";

const PURPOSE_TEXT = "스마트폰 거치대 브라켓";

const PLASTIC_ITEMS = [
  { label: "ABS", sub: "범용" },
  { label: "PP", sub: "폴리프로필렌" },
  { label: "PC", sub: "폴리카보네이트" },
  { label: "POM", sub: "엔지니어링" },
  { label: "TPU", sub: "탄성 플라스틱" },
];

const QUANTITY_OPTIONS = [
  { label: "시제품", sub: "1~5개" },
  { label: "소량", sub: "10~100개" },
  { label: "중량", sub: "100~500개" },
  { label: "양산", sub: "1000개+" },
];

type Screen = "input" | "loading" | "results";

export function AiDemoAnimation({ onCta }: { onCta?: () => void }) {
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

  const containerRef = useRef<HTMLDivElement>(null);
  const [fixedHeight, setFixedHeight] = useState<number | null>(null);

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
    const t = (fn: () => void, ms: number) => { const id = setTimeout(fn, ms); ids.push(id); };

    function cycle() {
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

      t(() => setShowFile(true), 300);
      t(() => { setSelectedCategory("플라스틱"); setShowSubGrid(true); }, 800);
      t(() => { setSelectedMaterial("ABS"); setShowSubGrid(false); }, 1400);
      t(() => setSelectedQuantity("소량 (10~100개)"), 2000);
      t(() => {
        let i = 0;
        const iv = setInterval(() => {
          i++;
          setTypedText(PURPOSE_TEXT.slice(0, i));
          if (i >= PURPOSE_TEXT.length) clearInterval(iv);
        }, 30);
        ids.push(iv as unknown as ReturnType<typeof setTimeout>);
      }, 2600);
      t(() => setBtnClick(true), 3400);
      t(() => { setScreen("loading"); setLoadStep(1); }, 3800);
      t(() => setLoadStep(2), 4500);
      t(() => setLoadStep(3), 5100);
      t(() => { setScreen("results"); setTimeout(() => setResultsVisible(true), 50); }, 5800);
      t(() => setBar1(92), 6100);
      t(() => setBar2(65), 6500);
      t(cycle, 11000);
    }

    cycle();
    return () => ids.forEach(clearTimeout);
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full flex flex-col overflow-hidden rounded-3xl bg-white"
      style={{
        ...(fixedHeight ? { height: fixedHeight } : {}),
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.5), 0 0 0 1px rgba(255,255,255,0.12), 0 8px 24px rgba(0,0,0,0.45), 0 24px 56px rgba(0,0,0,0.5), 0 56px 100px rgba(0,0,0,0.35)",
      }}
    >
      {/* 헤더 */}
      <div className="shrink-0 border-b border-[#f0f0f0] bg-white px-6 pt-6 pb-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#86868b]">AI Analysis</p>
        <h2 className="text-2xl font-bold text-[#1d1d1f]">AI 제조방법 분석</h2>
      </div>

      {/* ── INPUT ── */}
      {screen === "input" && (
        <>
          {/* 스크롤 가능 콘텐츠 영역 — 내부 확장이 모달 크기에 영향 없음 */}
          <div
            className="flex-1 overflow-y-auto px-6 pt-5 pb-2"
            style={{ scrollbarWidth: "none" }}
          >
            <p className="mb-5 text-sm leading-relaxed text-[#86868b]">
              CAD 파일을 업로드하면 AI가 형상을 분석해 최적 제조방법을 추천합니다. 재질·수량·용도를 입력할수록 분석 정확도가 높아집니다. 조립품 도면은 재질에서 <span className="font-medium text-[#1d1d1f]">조립품</span>을 선택해주세요.
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
                    <p className="text-sm font-medium text-[#1d1d1f]">CAD 파일을 드래그하거나 클릭하여 업로드</p>
                    <p className="mt-1 text-xs text-[#86868b]">.stp · .step · .dxf · .dwg 지원 · 최대 50MB</p>
                  </div>
                </>
              ) : (
                <div style={{ animation: "fadeSlideIn 0.35s ease forwards" }} className="flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black">
                    <span className="text-xs font-bold text-white">STP</span>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-[#1d1d1f]">bracket_v3.stp</p>
                    <p className="text-xs text-[#86868b]">2.4 MB · 클릭하여 변경</p>
                  </div>
                </div>
              )}
            </div>

            {/* 재질 선택 */}
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold text-[#1d1d1f]">
                재질 선택 <span className="ml-1 text-xs font-normal text-[#86868b]">— 입력할수록 정확해집니다</span>
              </p>
              {/* relative wrapper — 서브그리드가 absolute overlay로 떠오름 */}
              <div className="relative">
                <div className="flex gap-2">
                  {["금속", "플라스틱", "기타", "조립품"].map((cat) => (
                    <button key={cat} type="button" className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition ${selectedCategory === cat ? "border-black bg-black text-white" : "border-[#e5e5e5] bg-white text-[#1d1d1f]"}`}>{cat}</button>
                  ))}
                  <button type="button" className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition ${selectedCategory === null ? "border-black bg-black text-white" : "border-[#e5e5e5] bg-white text-[#1d1d1f]"}`}>미정</button>
                </div>

                {/* absolute 드롭다운 — 레이아웃 높이 변화 없음 */}
                {showSubGrid && (
                  <div
                    className="absolute left-0 right-0 top-full z-20 mt-1 rounded-2xl border border-[#e5e5e5] bg-white p-3 shadow-lg"
                    style={{ animation: "fadeSlideIn 0.2s ease forwards" }}
                  >
                    <div className="grid grid-cols-3 gap-2">
                      {PLASTIC_ITEMS.map((mat) => (
                        <button key={mat.label} type="button" className="rounded-xl border border-[#e5e5e5] bg-[#f5f5f7] px-3 py-1.5 text-left">
                          <span className="text-xs font-semibold text-[#1d1d1f]">{mat.label}</span>
                          <span className="ml-1.5 text-[10px] text-[#86868b]">{mat.sub}</span>
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
                  <p className="text-xs text-[#86868b]">소분류를 선택하세요</p>
                ) : null}
              </div>
            </div>

            {/* 생산 수량 */}
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold text-[#1d1d1f]">
                생산 수량 <span className="ml-1 text-xs font-normal text-[#86868b]">— 입력할수록 정확해집니다</span>
              </p>
              <div className="flex gap-2">
                {QUANTITY_OPTIONS.map((q) => {
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
                제품 용도 <span className="ml-1 text-xs font-normal text-[#86868b]">— 입력할수록 정확해집니다</span>
              </p>
              <div className="w-full rounded-xl border border-[#e5e5e5] px-4 py-3">
                {typedText.length === 0 ? (
                  <span className="text-sm text-[#c7c7cc]">예: 스마트폰 거치대, 자동차 내부 브라켓</span>
                ) : (
                  <span className="text-sm text-[#1d1d1f]">
                    {typedText}
                    {typedText.length < PURPOSE_TEXT.length && (
                      <span className="ml-0.5 inline-block h-[14px] w-[2px] translate-y-[2px] animate-pulse bg-[#1d1d1f]" />
                    )}
                  </span>
                )}
              </div>
            </div>

            <p className="mt-4 pb-1 text-xs text-[#86868b]">
              * DWG 파일은 파일명 및 메타데이터 기반으로 분석됩니다. 더 정확한 분석을 원하시면 STP/STEP 파일을 사용하세요.
            </p>
          </div>

          {/* 분석 시작 버튼 — 하단 고정 */}
          <div className="shrink-0 px-6 pb-6 pt-3">
            <button
              className={`flex w-full items-center justify-center rounded-full py-3 text-sm font-semibold text-white transition-all duration-150 ${showFile ? "bg-black" : "bg-black opacity-40"} ${btnClick ? "scale-95" : "scale-100"}`}
            >
              분석 시작
            </button>
          </div>
        </>
      )}

      {/* ── LOADING ── */}
      {screen === "loading" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-6">
          <div className="mb-6 h-10 w-10 animate-spin rounded-full border-2 border-[#e5e5e5] border-t-[#1d1d1f]" />
          <p className="mb-6 text-sm font-semibold text-[#1d1d1f]">AI가 분석하고 있습니다...</p>
          <div className="w-full max-w-[280px] space-y-3">
            <div className="flex items-center gap-2.5 text-sm text-[#86868b] transition-opacity duration-500" style={{ opacity: loadStep >= 1 ? 1 : 0 }}>
              <span className="font-bold text-green-500">✓</span> 형상 및 치수 분석 완료
            </div>
            <div className="flex items-center gap-2.5 text-sm text-[#86868b] transition-opacity duration-500" style={{ opacity: loadStep >= 2 ? 1 : 0 }}>
              <span className="font-bold text-green-500">✓</span> 복잡도 및 재질 적합성 검토 완료
            </div>
            <div className="flex items-center gap-2.5 text-sm text-[#1d1d1f] transition-opacity duration-500" style={{ opacity: loadStep >= 3 ? 1 : 0 }}>
              <span className="inline-block animate-spin">⟳</span> 최적 제조방법 도출 중...
            </div>
          </div>
        </div>
      )}

      {/* ── RESULTS ── */}
      {screen === "results" && (
        <>
          <div
            className="flex-1 overflow-y-auto px-6 pt-6 pb-2"
            style={{
              scrollbarWidth: "none",
              opacity: resultsVisible ? 1 : 0,
              transition: "opacity 0.4s ease",
            }}
          >
            <div className="space-y-4 pb-2">
              <div className="rounded-2xl bg-[#f5f5f7] p-4">
                <div>
                  <p className="text-xs text-[#86868b]">추정 부품명</p>
                  <p className="mt-0.5 text-base font-bold text-[#1d1d1f]">스마트폰 거치대 브라켓</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#86868b]">
                  <span>크기: <span className="font-medium text-[#1d1d1f]">소형 (~100mm)</span></span>
                  <span>재질: <span className="font-medium text-[#1d1d1f]">ABS</span></span>
                  <span>수량: <span className="font-medium text-[#1d1d1f]">소량 (10~100개)</span></span>
                </div>
              </div>

              <p className="text-xs font-semibold uppercase tracking-widest text-[#86868b]">추천 제조방법</p>
              <div className="space-y-2">
                <div className="rounded-2xl border border-black bg-black p-4">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm font-bold text-white"><span className="mr-1.5 text-xs font-normal opacity-50">1순위</span>사출성형</span>
                    <span className="text-xs font-semibold text-white/60">{bar1}%</span>
                  </div>
                  <div className="mb-2 h-0.5 w-full rounded-full bg-white/20">
                    <div className="h-0.5 rounded-full bg-white transition-all duration-1000 ease-out" style={{ width: `${bar1}%` }} />
                  </div>
                  <p className="text-xs text-white/60">소형 ABS 부품, 언더컷 없는 단순 구조</p>
                </div>
                <div className="rounded-2xl border border-[#e5e5e5] p-4">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm font-bold text-[#1d1d1f]">3D프린팅</span>
                    <span className="text-xs font-semibold text-[#86868b]">{bar2}%</span>
                  </div>
                  <div className="mb-2 h-0.5 w-full rounded-full bg-[#f0f0f0]">
                    <div className="h-0.5 rounded-full bg-black transition-all duration-1000 ease-out" style={{ width: `${bar2}%` }} />
                  </div>
                  <p className="text-xs text-[#86868b]">시제품 제작에 적합, 소량 생산 가능</p>
                </div>
              </div>

              <div className="rounded-2xl bg-[#f5f5f7] px-4 py-3">
                <p className="mb-1 text-xs font-semibold text-[#86868b]">AI 요약</p>
                <p className="text-sm leading-relaxed text-[#1d1d1f]">소형 ABS 브라켓으로 사출성형이 가장 적합합니다. 언더컷 없는 단순 구조로 금형 비용이 낮고 대량 생산에 유리합니다.</p>
              </div>

              <p className="text-[11px] leading-relaxed text-[#b0b0b5]">
                * 본 분석은 AI 추정 결과로, 실제 제조 조건에 따라 달라질 수 있습니다. 정확한 견적은 전문가 검토를 통해 확인하세요.
              </p>
            </div>
          </div>

          <div className="shrink-0 flex gap-2 px-6 pb-6 pt-4">
            <div className="flex-1 rounded-full border border-[#e5e5e5] py-3 text-center text-sm font-medium text-[#1d1d1f]">다시 분석</div>
            <button onClick={onCta} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-black py-3 text-sm font-semibold text-white transition hover:bg-[#1d1d1f]">
              견적 요청하기 ›
            </button>
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
