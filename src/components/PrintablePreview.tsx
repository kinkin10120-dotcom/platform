"use client";

import { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import PdfPageScaler from "@/components/PdfPageScaler";

// 아직 저장(제출)되지 않은 문서를 화면에서 확인하는 용도 — 발주서 작성(SupplierOrdersTab),
// 청구서/견적서 작성 등 "제출 전 미리보기" 화면이 전부 이 컴포넌트를 공유한다.
//
// 여기서는 실제 인쇄를 하지 않는다 — 사이드바·상단바가 있는 (app) 레이아웃 안에서 인쇄하면
// 숨긴 요소들이 자리를 차지해 빈 두 번째 장이 생긴다. 저장(제출)한 뒤 전용 인쇄 페이지에서
// 뽑아야 한다 — right 자리에 그 안내문을 넣는다.
export default function PrintablePreview({
  children,
  onClose,
  label,
  right,
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
  right?: ReactNode;
}) {
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  // 바 높이는 화면 폭에 따라 줄바꿈되며 달라지므로 고정값 대신 실제로 잰다.
  useLayoutEffect(() => {
    function measure() {
      if (headerRef.current) setHeaderHeight(headerRef.current.offsetHeight);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div
      className="-mx-4 -mb-4 -mt-[calc(4.5rem+env(safe-area-inset-top))] min-h-screen bg-[#e5e5e5] md:-mx-6 md:-mb-6 md:-mt-[calc(5.5rem+env(safe-area-inset-top))]"
    >
      {/* 앱 상단바(h-14, fixed) 바로 아래에 이어붙인다 — 덮지 않고 그 밑에 붙어야 한다. */}
      <div
        ref={headerRef}
        className="fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-10 border-b border-[#e5e5e5] bg-white/90 px-4 py-3 backdrop-blur-xl print:hidden md:left-56"
      >
        <div className="mx-auto flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d1d1d6] text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
              title="닫기"
            >
              <X size={16} />
            </button>
            <p className="text-sm text-[#86868b]">{label}</p>
          </div>
          {right}
        </div>
      </div>

      <div className="px-4 pb-10" style={{ paddingTop: 56 + headerHeight }}>
        <PdfPageScaler>{children}</PdfPageScaler>
      </div>
    </div>
  );
}
