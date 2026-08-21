"use client";

import { useEffect, useRef, useState } from "react";

// A4 문서(px 고정폭)를 화면에서만 뷰포트 너비에 맞게 축소해서 보여준다 — 모바일에서 확대/축소나
// 가로 스크롤 없이 전체 내용이 한 번에 보이도록 하기 위함. 인쇄 시에는 페이지의 @media print
// !important 규칙이 transform/width를 원래대로 되돌린다. (한때 beforeprint/afterprint에서
// React state로 직접 되돌리는 방식도 시도했지만, iOS Safari에서 인쇄 시트가 뜨기 전에
// 리렌더를 기다리면서 눈에 띄게 느려지는 부작용이 있어 순수 CSS 방식으로 되돌렸다.)
export default function PdfPageScaler({ pageWidthPx = 794, children }: { pageWidthPx?: number; children: React.ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    function update() {
      const margin = 32;
      const available = window.innerWidth - margin;
      setScale(available < pageWidthPx ? available / pageWidthPx : 1);
      if (innerRef.current) setContentHeight(innerRef.current.offsetHeight);
    }
    update();
    window.addEventListener("resize", update);
    const ro = new ResizeObserver(update);
    if (innerRef.current) ro.observe(innerRef.current);
    return () => {
      window.removeEventListener("resize", update);
      ro.disconnect();
    };
  }, [pageWidthPx]);

  return (
    <div className="pdf-scale-wrapper mx-auto" style={{ width: pageWidthPx * scale, height: contentHeight * scale || undefined }}>
      <div ref={innerRef} className="pdf-scale-inner" style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: pageWidthPx }}>
        {children}
      </div>
    </div>
  );
}
