"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";

type Mode = "draw" | "upload";

export default function SignaturePad({ onChange }: { onChange: (blob: Blob | null) => void }) {
  const [mode, setMode] = useState<Mode>("draw");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);

  // 캔버스의 실제 픽셀 버퍼를 화면 배율(devicePixelRatio)에 맞춰 키워두지 않으면, 레티나/고밀도
  // 모바일 화면에서는 낮은 해상도 버퍼가 CSS 크기로 확대되면서 서명 선이 흐리고 계단져 보인다.
  // 여기서 버퍼 해상도를 배율만큼 올리고 컨텍스트를 같은 비율로 스케일해서, 이후 좌표 계산은
  // 항상 CSS 픽셀 기준으로 그대로 쓸 수 있게 한다.
  useLayoutEffect(() => {
    if (mode !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
  }, [mode]);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.strokeStyle = "#1d1d1f";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  }

  function handlePointerUp() {
    drawing.current = false;
    canvasRef.current?.toBlob((blob) => onChange(blob), "image/png");
  }

  function handleClear() {
    const canvas = canvasRef.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasDrawn(false);
    onChange(null);
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setHasDrawn(false);
    setUploadPreview(null);
    onChange(null);
  }

  function handleUpload(file: File | null) {
    if (!file) {
      setUploadPreview(null);
      onChange(null);
      return;
    }
    setUploadPreview(URL.createObjectURL(file));
    onChange(file);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs text-[#86868b]">서명 / 직인 (필수)</label>
        <div className="flex items-center gap-3">
          {mode === "draw" && hasDrawn && (
            <button type="button" onClick={handleClear} className="text-xs font-medium text-[#86868b] underline underline-offset-2 hover:text-[#1d1d1f]">
              지우기
            </button>
          )}
          <div className="flex rounded-full bg-[#f5f5f7] p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => switchMode("draw")}
              className={`rounded-full px-2.5 py-1 font-medium transition ${mode === "draw" ? "bg-white text-[#1d1d1f] shadow-sm" : "text-[#86868b]"}`}
            >
              서명
            </button>
            <button
              type="button"
              onClick={() => switchMode("upload")}
              className={`rounded-full px-2.5 py-1 font-medium transition ${mode === "upload" ? "bg-white text-[#1d1d1f] shadow-sm" : "text-[#86868b]"}`}
            >
              직인 업로드
            </button>
          </div>
        </div>
      </div>

      {mode === "draw" ? (
        <div className="relative">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="h-[120px] w-full touch-none rounded-xl border border-[#d1d1d6] bg-white"
          />
          {!hasDrawn && (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-[#d1d1d6]">
              서명을 해주세요
            </p>
          )}
        </div>
      ) : (
        <label className="flex h-[120px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#d1d1d6] bg-[#f5f5f7] text-[#86868b] hover:border-[#86868b]">
          {uploadPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={uploadPreview} alt="직인" className="h-full object-contain" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-xs">
              <Upload size={16} />
              법인 직인 이미지 선택
            </span>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0] ?? null)} />
        </label>
      )}
    </div>
  );
}
