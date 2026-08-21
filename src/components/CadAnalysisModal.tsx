"use client";

import { useState, useRef, useEffect, CSSProperties } from "react";
import { createPortal } from "react-dom";
import { X, Upload, ChevronRight, AlertCircle } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

interface ManufactureMethod {
  method: string;
  confidence: number;
  reason: string;
  initialCostLevel?: number;
  unitCostLevel?: number;
}

interface SinglePartResult {
  isAssembly: false;
  partName: string;
  complexity: string;
  size: string;
  recommendedMethods: ManufactureMethod[];
  material: string;
  surfaceTreatment: string;
  considerations: string[];
  summary: string;
}

interface AssemblyPart {
  partName: string;
  material: string;
  method: string;
  confidence: number;
  reason: string;
  surfaceTreatment: string;
  initialCostLevel?: number;
  unitCostLevel?: number;
}

interface AssemblyResult {
  isAssembly: true;
  assemblyName: string;
  parts: AssemblyPart[];
  summary: string;
}

type AnalysisResult = SinglePartResult | AssemblyResult;

const MATERIAL_CATEGORIES = [
  {
    label: "금속",
    items: [
      { label: "알루미늄", sub: "Al 합금" },
      { label: "스테인리스", sub: "SUS 304/316" },
      { label: "일반 강철", sub: "S45C / SS400" },
      { label: "아연 합금", sub: "다이캐스팅용" },
      { label: "황동", sub: "Cu-Zn 합금" },
    ],
  },
  {
    label: "플라스틱",
    items: [
      { label: "ABS", sub: "범용" },
      { label: "PP", sub: "폴리프로필렌" },
      { label: "PC", sub: "폴리카보네이트" },
      { label: "POM", sub: "엔지니어링" },
      { label: "TPU", sub: "탄성 플라스틱" },
    ],
  },
  {
    label: "기타",
    items: [
      { label: "실리콘", sub: "탄성 소재" },
      { label: "아크릴", sub: "PMMA" },
      { label: "종이 / 필름", sub: "박판 소재" },
    ],
  },
];

const QUANTITY_OPTIONS = [
  { label: "시제품", sub: "1~5개" },
  { label: "소량", sub: "10~100개" },
  { label: "중량", sub: "100~500개" },
  { label: "양산", sub: "1000개+" },
];

const COMPLEXITY_COLOR: Record<string, string> = {
  "단순": "bg-green-100 text-green-700",
  "중간": "bg-yellow-100 text-yellow-700",
  "복잡": "bg-red-100 text-red-700",
};

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

function buildQuotePrefill(result: AnalysisResult, quantity: string, purpose: string): string {
  const lines: string[] = ["[AI 분석 결과]"];
  if (result.isAssembly) {
    lines.push(`조립품명: ${result.assemblyName}`);
    if (quantity) lines.push(`생산 수량: ${quantity}`);
    lines.push("파트 구성:");
    result.parts.forEach((p) => {
      const st = p.surfaceTreatment && p.surfaceTreatment !== "없음" ? ` / 표면처리: ${p.surfaceTreatment}` : "";
      lines.push(`  - ${p.partName}: ${p.material} → ${p.method}${st}`);
    });
  } else {
    lines.push(`부품명: ${result.partName}`);
    lines.push(`재질: ${result.material}`);
    if (quantity) lines.push(`생산 수량: ${quantity}`);
    lines.push(`추천 제조방법: ${result.recommendedMethods[0]?.method ?? ""} (${result.recommendedMethods[0]?.confidence ?? 0}%)`);
    if (result.surfaceTreatment && result.surfaceTreatment !== "없음") {
      lines.push(`표면처리: ${result.surfaceTreatment}`);
    }
  }
  if (purpose) lines.push(`\n제품 용도: ${purpose}`);
  return lines.join("\n");
}

export function CadAnalysisModal({
  onClose,
  onRequestQuote,
}: {
  onClose: () => void;
  onRequestQuote?: (prefill: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<string>("미정");
  const [assemblyMaterial, setAssemblyMaterial] = useState<string>("미정");
  const [quantity, setQuantity] = useState<string>("");
  const [purpose, setPurpose] = useState<string>("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const [loadStep, setLoadStep] = useState(0);
  const [formHeight, setFormHeight] = useState<number | null>(null);
  const [autoDetectedAssembly, setAutoDetectedAssembly] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const categoryRowRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // 폼이 표시될 때 모달 전체 높이 측정 → 로딩/결과 화면에 고정
  useEffect(() => {
    if (!loading && !result && modalRef.current) {
      const timer = setTimeout(() => {
        if (modalRef.current) setFormHeight(modalRef.current.offsetHeight);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [loading, result]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    trackEvent("form_start", { form: "cad_analysis", page: window.location.pathname });
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    if (!loading) { setLoadStep(0); return; }
    const ids = [
      setTimeout(() => setLoadStep(1), 800),
      setTimeout(() => setLoadStep(2), 2400),
      setTimeout(() => setLoadStep(3), 4200),
    ];
    return () => ids.forEach(clearTimeout);
  }, [loading]);

  useEffect(() => {
    if (!popoverOpen) return;
    function handle(e: MouseEvent) {
      const t = e.target as Node;
      if (categoryRowRef.current?.contains(t) || popoverRef.current?.contains(t)) return;
      setPopoverOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [popoverOpen]);

  function handleFile(f: File) {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["stp", "step", "dxf", "dwg", "ipt", "iam", "sldprt", "sldasm"].includes(ext ?? "")) {
      setError("STP, STEP, DXF, DWG, IPT, IAM, SLDPRT, SLDASM 파일만 업로드할 수 있습니다.");
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
  }

  function selectCategory(cat: string) {
    if (selectedCategory === cat) {
      setSelectedCategory(null);
      setSelectedMaterial("미정");
      setAssemblyMaterial("미정");
      setPopoverOpen(false);
      return;
    }
    setSelectedCategory(cat);
    setSelectedMaterial(cat === "조립품" ? "조립품" : "미정");
    if (cat !== "조립품") setAssemblyMaterial("미정");
    if (categoryRowRef.current) {
      const rect = categoryRowRef.current.getBoundingClientRect();
      setPopoverStyle({
        position: "fixed",
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
        zIndex: 200,
      });
      setPopoverOpen(true);
    }
  }

  async function handleAnalyze() {
    if (!file && !purpose.trim()) return;
    setLoading(true);
    setError(null);
    setAutoDetectedAssembly(false);
    try {
      const materialToSend =
        selectedCategory === "조립품" && assemblyMaterial !== "미정"
          ? `조립품 (주요 재질: ${assemblyMaterial})`
          : selectedMaterial;

      const fd = new FormData();
      if (file) fd.append("file", file);
      fd.append("material", materialToSend);
      if (quantity) fd.append("quantity", quantity);
      if (purpose.trim()) fd.append("purpose", purpose.trim());
      const res = await fetch("/api/analyze-cad", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "분석 실패");

      // 조립품 파일인데 조립품을 선택 안 했으면 조립품으로 자동 재분석
      if (file && data.isAssembly && selectedCategory !== "조립품") {
        const fd2 = new FormData();
        fd2.append("file", file);
        fd2.append("material", "조립품");
        if (quantity) fd2.append("quantity", quantity);
        if (purpose.trim()) fd2.append("purpose", purpose.trim());
        const res2 = await fetch("/api/analyze-cad", { method: "POST", body: fd2 });
        const data2 = await res2.json();
        if (!res2.ok) throw new Error(data2.error ?? "분석 실패");
        setAutoDetectedAssembly(true);
        setSelectedCategory("조립품");
        setSelectedMaterial("조립품");
        setResult(data2);
        trackEvent("cad_analysis_complete", { has_file: !!file });
      } else {
        setResult(data);
        trackEvent("cad_analysis_complete", { has_file: !!file });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const allCategories = [...MATERIAL_CATEGORIES.map((c) => c.label), "조립품"];

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-0 pb-0 backdrop-blur-sm sm:items-center sm:px-4 sm:pb-4">
      <div
        ref={modalRef}
        className="relative flex max-h-[100dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-3xl"
        style={(loading || !!result) && formHeight ? { height: formHeight } : {}}
      >
        {/* 헤더 */}
        <div className="shrink-0 relative border-b border-[#f0f0f0] bg-white px-6 pt-6 pb-4">
          <button onClick={onClose} className="absolute right-5 top-5 rounded-full p-1.5 text-[#86868b] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]">
            <X size={18} />
          </button>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#86868b]">AI Analysis</p>
          <h2 className="text-2xl font-bold text-[#1d1d1f]">AI 제조방법 분석</h2>
        </div>

        <div
          ref={contentRef}
          className={loading ? "flex-1 flex flex-col items-center justify-center px-6 py-6" : !!result ? "no-scrollbar flex-1 overflow-y-auto px-6 pt-6 pb-0" : "no-scrollbar flex-1 overflow-y-auto p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"}
        >
          {!result ? (
            loading ? (
              /* 로딩 화면 */
              <div className="flex flex-col items-center">
                <div className="mb-6 h-10 w-10 animate-spin rounded-full border-2 border-[#e5e5e5] border-t-[#1d1d1f]" />
                <p className="mb-6 text-sm font-semibold text-[#1d1d1f]">AI가 분석하고 있습니다...</p>
                <div className="w-full max-w-[280px] space-y-3">
                  <div className="flex items-center gap-2.5 text-sm text-[#86868b] transition-opacity duration-500" style={{ opacity: loadStep >= 1 ? 1 : 0 }}>
                    <span className="text-green-500 font-bold">✓</span> 형상 및 치수 분석 완료
                  </div>
                  <div className="flex items-center gap-2.5 text-sm text-[#86868b] transition-opacity duration-500" style={{ opacity: loadStep >= 2 ? 1 : 0 }}>
                    <span className="text-green-500 font-bold">✓</span> 복잡도 및 재질 적합성 검토 완료
                  </div>
                  <div className="flex items-center gap-2.5 text-sm text-[#1d1d1f] transition-opacity duration-500" style={{ opacity: loadStep >= 3 ? 1 : 0 }}>
                    <span className="inline-block animate-spin">⟳</span> 최적 제조방법 도출 중...
                  </div>
                </div>
              </div>
            ) : (
            <>
              <p className="mb-5 text-sm leading-relaxed text-[#86868b]">
                CAD 파일을 업로드하면 AI가 형상을 분석해 최적 제조방법을 추천합니다. 도면이 없다면 제품 용도만 입력해도 대략적인 분석이 가능합니다. 재질·수량·용도를 입력할수록 분석 정확도가 높아집니다. 조립품 도면은 재질에서 <span className="font-medium text-[#1d1d1f]">조립품</span>을 선택해주세요.
              </p>

              {/* 파일 업로드 */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                onClick={() => inputRef.current?.click()}
                className={`flex h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed transition ${
                  dragging ? "border-black bg-black/5" : file ? "border-black bg-black/[0.02]" : "border-[#d1d1d6] hover:border-[#86868b]"
                }`}
              >
                <input ref={inputRef} type="file" accept=".stp,.step,.dxf,.dwg,.ipt,.iam,.sldprt,.sldasm" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                {file ? (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white">
                      <span className="text-xs font-bold">{file.name.split(".").pop()?.toUpperCase()}</span>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-[#1d1d1f]">{file.name}</p>
                      <p className="text-xs text-[#86868b]">{(file.size / 1024).toFixed(1)} KB · 클릭하여 변경</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f5f5f7]">
                      <Upload size={22} className="text-[#86868b]" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-[#1d1d1f]">CAD 파일을 드래그하거나 클릭하여 업로드</p>
                      <p className="mt-1 text-xs text-[#86868b]">.stp · .step · .dxf · .dwg · .ipt · .iam · .sldprt · .sldasm 지원 · 최대 50MB</p>
                      <p className="mt-1 text-xs text-[#c7c7cc]">도면이 없다면 아래 용도만 입력해도 분석할 수 있습니다</p>
                    </div>
                  </>
                )}
              </div>

              {error && (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              {/* 재질 선택 */}
              <div className="mt-4">
                <p className="mb-2 text-sm font-semibold text-[#1d1d1f]">
                  재질 선택 <span className="ml-1 text-xs font-normal text-[#86868b]">— 입력할수록 정확해집니다</span>
                </p>
                <div ref={categoryRowRef} className="flex gap-2">
                  {allCategories.map((cat) => (
                    <button key={cat} type="button" onClick={() => selectCategory(cat)}
                      className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition ${
                        selectedCategory === cat
                          ? "border-black bg-black text-white"
                          : "border-[#e5e5e5] bg-white text-[#1d1d1f] hover:border-[#86868b]"
                      }`}>
                      {cat}
                    </button>
                  ))}
                  <button type="button" onClick={() => { setSelectedCategory(null); setSelectedMaterial("미정"); setPopoverOpen(false); }}
                    className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition ${
                      selectedCategory === null
                        ? "border-black bg-black text-white"
                        : "border-[#e5e5e5] bg-white text-[#1d1d1f] hover:border-[#86868b]"
                    }`}>
                    미정
                  </button>
                </div>
                {/* 선택 상태 인디케이터 — 항상 고정 높이 유지 */}
                <div className="mt-3 flex h-6 items-center">
                  {selectedCategory === "조립품" ? (
                    assemblyMaterial !== "미정" ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[#86868b]">조립품 · 주요 재질 ›</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#1d1d1f] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                          {assemblyMaterial}
                          <button type="button" onClick={() => setAssemblyMaterial("미정")} className="leading-none text-white/50 hover:text-white">×</button>
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-[#86868b]">AI가 각 파트의 재질과 제조방법을 자동으로 분석합니다 (주요 재질 선택 가능)</p>
                    )
                  ) : selectedMaterial !== "미정" ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-[#86868b]">{selectedCategory} ›</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#1d1d1f] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                        {selectedMaterial}
                        <button type="button" onClick={() => { setSelectedMaterial("미정"); }} className="leading-none text-white/50 hover:text-white">×</button>
                      </span>
                    </div>
                  ) : selectedCategory ? (
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
                  {QUANTITY_OPTIONS.map((q) => (
                    <button key={q.label} type="button"
                      onClick={() => setQuantity(quantity === `${q.label} (${q.sub})` ? "" : `${q.label} (${q.sub})`)}
                      className={`flex flex-1 flex-col items-center rounded-xl border py-2 transition ${
                        quantity === `${q.label} (${q.sub})`
                          ? "border-black bg-black text-white"
                          : "border-[#e5e5e5] bg-white text-[#1d1d1f] hover:border-[#86868b]"
                      }`}>
                      <span className="text-xs font-semibold">{q.label}</span>
                      <span className={`text-[10px] ${quantity === `${q.label} (${q.sub})` ? "text-white/60" : "text-[#86868b]"}`}>
                        {q.sub}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 제품 용도 */}
              <div className="mt-4">
                <p className="mb-2 text-sm font-semibold text-[#1d1d1f]">
                  제품 용도 <span className="ml-1 text-xs font-normal text-[#86868b]">— 입력할수록 정확해집니다</span>
                </p>
                <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)}
                  placeholder="예: 스마트폰 거치대, 자동차 내부 브라켓"
                  rows={1}
                  className="w-full resize-none overflow-hidden rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 text-sm text-[#1d1d1f] placeholder-[#c7c7cc] outline-none transition focus:border-black" />
              </div>

              <p className="mt-4 text-xs text-[#86868b]">
                * DWG · IPT · IAM · SLDPRT · SLDASM 파일과 도면 없이 진행하는 분석은 파일명·메타데이터·텍스트 설명 기반으로 추정되어 정확도가 낮을 수 있습니다. 더 정확한 분석을 원하시면 STP/STEP 파일을 사용하세요.
              </p>

              <button onClick={handleAnalyze} disabled={(!file && !purpose.trim()) || loading}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-black py-3 text-sm font-semibold text-white transition hover:bg-[#1d1d1f] disabled:opacity-40">
                분석 시작
              </button>
            </>
            )
          ) : result.isAssembly ? (
            /* 조립품 결과 */
            <div className="space-y-4 pb-2">
              {autoDetectedAssembly && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                  조립품 파일이 감지되어 자동으로 조립품 분석을 진행했습니다. 다음번에는 재질에서 <span className="font-semibold">조립품</span>을 선택하면 바로 분석됩니다.
                </div>
              )}
              <div className="rounded-2xl bg-[#f5f5f7] px-5 py-4">
                <p className="text-xs text-[#86868b]">조립품명</p>
                <p className="mt-0.5 text-base font-bold text-[#1d1d1f]">{result.assemblyName}</p>
                <p className="mt-1 text-xs text-[#86868b]">{(result.parts ?? []).length}개 파트 감지됨{quantity ? ` · ${quantity}` : ""}</p>
              </div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#86868b]">파트별 분석</p>
              <div className="space-y-2">
                {(result.parts ?? []).map((part, i) => (
                  <div key={i} className="rounded-2xl border border-[#e5e5e5] p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#1d1d1f]">{part.partName}</span>
                        <span className="rounded-full bg-[#f5f5f7] px-2 py-0.5 text-[10px] font-medium text-[#86868b]">{part.material}</span>
                      </div>
                      <span className="text-xs font-semibold text-[#86868b]">{part.confidence}%</span>
                    </div>
                    <div className="mb-2 h-0.5 w-full rounded-full bg-[#f0f0f0]">
                      <div className="h-0.5 rounded-full bg-black" style={{ width: `${part.confidence}%` }} />
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-[#1d1d1f]">{part.method}</span>
                      <span className="text-right text-xs text-[#86868b]">{part.reason}</span>
                    </div>
                    <CostBadges initial={part.initialCostLevel} unit={part.unitCostLevel} />
                    {part.surfaceTreatment && part.surfaceTreatment !== "없음" && (
                      <p className="mt-1.5 text-xs text-[#86868b]">표면처리: <span className="font-medium text-[#1d1d1f]">{part.surfaceTreatment}</span></p>
                    )}
                  </div>
                ))}
              </div>
              <div className="rounded-2xl bg-[#f5f5f7] px-4 py-3">
                <p className="mb-1 text-xs font-semibold text-[#86868b]">AI 요약</p>
                <p className="text-sm leading-relaxed text-[#1d1d1f]">{result.summary}</p>
              </div>
              <p className="text-[11px] leading-relaxed text-[#b0b0b5]">
                * 본 분석은 AI 추정 결과로, 실제 제조 조건에 따라 달라질 수 있습니다. 정확한 견적은 전문가 검토를 통해 확인하세요.
              </p>
            </div>
          ) : (
            /* 단일 부품 결과 */
            <div className="space-y-4 pb-2">
              <div className="rounded-2xl bg-[#f5f5f7] p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-[#86868b]">추정 부품명</p>
                    <p className="mt-0.5 text-base font-bold text-[#1d1d1f]">{result.partName}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#86868b]">
                  <span>크기: <span className="font-medium text-[#1d1d1f]">{result.size}</span></span>
                  <span>재질: <span className="font-medium text-[#1d1d1f]">{result.material}</span></span>
                  {result.surfaceTreatment && result.surfaceTreatment !== "없음" && (
                    <span>표면처리: <span className="font-medium text-[#1d1d1f]">{result.surfaceTreatment}</span></span>
                  )}
                  {quantity && <span>수량: <span className="font-medium text-[#1d1d1f]">{quantity}</span></span>}
                </div>
              </div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#86868b]">추천 제조방법</p>
              <div className="space-y-2">
                {(result.recommendedMethods ?? []).slice(0, 2).map((m, i) => (
                  <div key={m.method} className={`rounded-2xl border p-4 ${i === 0 ? "border-black bg-black" : "border-[#e5e5e5] bg-white"}`}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className={`text-sm font-bold ${i === 0 ? "text-white" : "text-[#1d1d1f]"}`}>
                        <span className="mr-1.5 text-xs font-normal opacity-50">{i === 0 ? "1순위" : "2순위"}</span>
                        {m.method}
                      </span>
                      <span className={`text-xs font-semibold ${i === 0 ? "text-white/60" : "text-[#86868b]"}`}>{m.confidence}%</span>
                    </div>
                    <div className={`mb-2 h-0.5 w-full rounded-full ${i === 0 ? "bg-white/20" : "bg-[#f0f0f0]"}`}>
                      <div className={`h-0.5 rounded-full ${i === 0 ? "bg-white" : "bg-black"}`} style={{ width: `${m.confidence}%` }} />
                    </div>
                    <p className={`text-xs ${i === 0 ? "text-white/60" : "text-[#86868b]"}`}>{m.reason}</p>
                    <CostBadges initial={m.initialCostLevel} unit={m.unitCostLevel} dark={i === 0} />
                  </div>
                ))}
              </div>
              <div className="rounded-2xl bg-[#f5f5f7] px-4 py-3">
                <p className="mb-1 text-xs font-semibold text-[#86868b]">AI 요약</p>
                <p className="text-sm leading-relaxed text-[#1d1d1f]">{result.summary}</p>
              </div>
              <p className="text-[11px] leading-relaxed text-[#b0b0b5]">
                * 본 분석은 AI 추정 결과로, 실제 제조 조건에 따라 달라질 수 있습니다. 정확한 견적은 전문가 검토를 통해 확인하세요.
              </p>
            </div>
          )}
        </div>

        {/* 결과 페이지 하단 고정 버튼 */}
        {!!result && (
          <div className="shrink-0 flex gap-2 px-6 pb-6 pt-4">
            <button onClick={() => { setResult(null); setError(null); setAutoDetectedAssembly(false); }}
              className="flex-1 rounded-full border border-[#e5e5e5] py-3 text-sm font-medium text-[#1d1d1f] transition hover:bg-[#f5f5f7]">
              다시 분석
            </button>
            {onRequestQuote && (
              <button onClick={() => { onClose(); onRequestQuote(buildQuotePrefill(result, quantity, purpose)); }}
                className="flex flex-1 items-center justify-center gap-1 rounded-full bg-black py-3 text-sm font-semibold text-white transition hover:bg-[#1d1d1f]">
                견적 요청하기 <ChevronRight size={15} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>

    {/* 소분류 팝오버 — position:fixed 로 모달 레이아웃에 영향 없음 */}
    {mounted && popoverOpen && selectedCategory === "조립품" && createPortal(
      <div
        ref={popoverRef}
        style={popoverStyle}
        className="rounded-2xl border border-[#e5e5e5] bg-white p-3 shadow-2xl"
      >
        <p className="mb-2 px-1 text-[11px] text-[#86868b]">주요 재질 (선택) — 지정하면 분석 정확도가 높아집니다</p>
        <div className="grid grid-cols-2 gap-2">
          {["금속", "플라스틱", "기타", "미정"].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setAssemblyMaterial(m);
                setPopoverOpen(false);
              }}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                assemblyMaterial === m
                  ? "border-black bg-black text-white"
                  : "border-[#e5e5e5] bg-[#f5f5f7] text-[#1d1d1f] hover:border-[#86868b]"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>,
      document.body
    )}
    {mounted && popoverOpen && selectedCategory && selectedCategory !== "조립품" && createPortal(
      <div
        ref={popoverRef}
        style={popoverStyle}
        className="rounded-2xl border border-[#e5e5e5] bg-white p-3 shadow-2xl"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {MATERIAL_CATEGORIES.find((c) => c.label === selectedCategory)?.items.map((mat) => (
            <button
              key={mat.label}
              type="button"
              onClick={() => {
                setSelectedMaterial(selectedMaterial === mat.label ? "미정" : mat.label);
                setPopoverOpen(false);
              }}
              className={`rounded-xl border px-3 py-1.5 text-left transition ${
                selectedMaterial === mat.label
                  ? "border-black bg-black text-white"
                  : "border-[#e5e5e5] bg-[#f5f5f7] text-[#1d1d1f] hover:border-[#86868b]"
              }`}
            >
              <span className="block whitespace-nowrap text-xs font-semibold">{mat.label}</span>
              <span className={`block whitespace-nowrap text-[10px] ${selectedMaterial === mat.label ? "text-white/60" : "text-[#86868b]"}`}>
                {mat.sub}
              </span>
            </button>
          ))}
        </div>
      </div>,
      document.body
    )}
    </>
  );
}
