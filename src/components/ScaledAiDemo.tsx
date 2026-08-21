"use client";

import { useState, useEffect, useRef } from "react";
import { AiDemoAnimation } from "@/components/AiDemoAnimation";

const AI_DEMO_DESIGN_WIDTH = 576;

export function ScaledAiDemo({ onCta }: { onCta: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      const w = wrapRef.current?.offsetWidth ?? AI_DEMO_DESIGN_WIDTH;
      const s = w / AI_DEMO_DESIGN_WIDTH;
      setScale(s);
      if (innerRef.current) setHeight(innerRef.current.offsetHeight * s);
    };
    update();
    const ro = new ResizeObserver(update);
    if (wrapRef.current) ro.observe(wrapRef.current);
    if (innerRef.current) ro.observe(innerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="relative w-full min-w-0" style={{ height: height ?? undefined }}>
      <div
        ref={innerRef}
        className="absolute left-0 top-0"
        style={{ width: AI_DEMO_DESIGN_WIDTH, transform: `scale(${scale})`, transformOrigin: "top left" }}
      >
        <AiDemoAnimation onCta={onCta} />
      </div>
    </div>
  );
}
