"use client";

import { useEffect, useRef, useState } from "react";
import { Signal, Wifi, BatteryFull } from "lucide-react";

/* ── macOS 타이틀바 ── */
function MacTitlebar() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3.5, height: 11, padding: "0 6px", background: "#e5e5e5", flexShrink: 0 }}>
      <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#ff5f57" }} />
      <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#febc2e" }} />
      <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#28c840" }} />
    </div>
  );
}

/* ── iOS 상태 바 ── */
function IosStatusBar() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 13, padding: "0 8px", background: "#f5f5f7", flexShrink: 0 }}>
      <span style={{ fontSize: 6, fontWeight: 600, color: "#1d1d1f", letterSpacing: 0.2 }}>9:41</span>
      <div style={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Signal size={5} strokeWidth={2.5} color="#1d1d1f" />
        <Wifi size={5} strokeWidth={2.5} color="#1d1d1f" />
        <BatteryFull size={7} strokeWidth={2} color="#1d1d1f" />
      </div>
    </div>
  );
}

/* ── 디바이스 래퍼 ── */
function DeviceFrame({
  src, width, height,
  screenLeft, screenTop, screenWidth, screenHeight,
  screenRadius,
  children,
}: {
  src: string; width: number; height: number;
  screenLeft: number; screenTop: number; screenWidth: number; screenHeight: number;
  screenRadius: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{ position: "relative", width, height, flexShrink: 0, filter: "drop-shadow(0 12px 32px rgba(0,0,0,0.55)) drop-shadow(0 3px 8px rgba(0,0,0,0.3))" }}>
      {/* UI 콘텐츠 — 스크린 영역에 정확히 위치 */}
      <div style={{
        position: "absolute",
        left: screenLeft, top: screenTop,
        width: screenWidth, height: screenHeight,
        overflow: "hidden",
        borderRadius: screenRadius,
        zIndex: 5,
        display: "flex",
        flexDirection: "column",
      }}>
        {children}
      </div>
      {/* 디바이스 이미지 — 위에 겹쳐서 프레임 역할 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src} alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 10, pointerEvents: "none" }}
      />
    </div>
  );
}

function ScreenShot({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="handyworks 홈 화면"
      style={{ flex: 1, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
    />
  );
}

export function HandyworksAnimation() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(() =>
    typeof window !== "undefined" ? Math.min(1, window.innerWidth / 650) : 1
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / 650));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // 굿노트 스타일: iPhone(좌) → iPad(중) → MacBook(우), 하단 정렬
  // MacBook 3944:2564 = 1.538
  const mac = { w: 420, h: 270 };
  const macScreen = {
    left: Math.round(420 * 0.1075),
    top:  Math.round(270 * 0.103) + 2,
    w:    Math.round(420 * 0.7845),
    h:    Math.round(270 * 0.7929) - 2,
  };

  // iPad 1868:2620 = 0.713
  const ipad = { w: 200, h: 280 };
  const ipadScreen = {
    left: Math.round(200 * 0.053),
    top:  Math.round(280 * 0.038),
    w:    Math.round(200 * 0.893),
    h:    Math.round(280 * 0.923),
  };

  // iPhone 1406:2822 = 0.498
  const iphone = { w: 115, h: 232 };
  const iphoneScreen = {
    left: Math.round(115 * 0.071),
    top:  Math.round(232 * 0.035),
    w:    Math.round(115 * 0.858),
    h:    Math.round(232 * 0.929),
  };

  // 컨테이너 650×290
  // iPhone: left=0,   top=29  (수직 중앙), z30
  // iPad:   left=85,  bottom=0 (iPhone과 30px 겹침), z20
  // MacBook: right=0, bottom=0 (iPad와 55px 겹침), z10
  return (
    <div ref={wrapRef} className="select-none flex w-full justify-center" style={{ height: Math.round(290 * scale) }}>
      <div style={{ position: "relative", width: 650, height: 290, flexShrink: 0, transform: `scale(${scale})`, transformOrigin: "top center" }}>
        {/* 맥북 — 우측, 뒤 */}
        <div style={{ position: "absolute", bottom: 0, right: 0, zIndex: 10 }}>
          <DeviceFrame
            src="/mockup-macbook.png"
            width={mac.w} height={mac.h}
            screenLeft={macScreen.left} screenTop={macScreen.top}
            screenWidth={macScreen.w} screenHeight={macScreen.h}
            screenRadius={3}
          >
            <MacTitlebar />
            <ScreenShot src="/handyworks-home-mac.png" />
          </DeviceFrame>
        </div>

        {/* 아이패드 — 중앙, 맥북 앞에 겹침 */}
        <div style={{ position: "absolute", bottom: 0, left: 85, zIndex: 20 }}>
          <DeviceFrame
            src="/mockup-ipad.png"
            width={ipad.w} height={ipad.h}
            screenLeft={ipadScreen.left} screenTop={ipadScreen.top}
            screenWidth={ipadScreen.w} screenHeight={ipadScreen.h}
            screenRadius={8}
          >
            <ScreenShot src="/handyworks-home-ipad.png" />
          </DeviceFrame>
        </div>

        {/* 아이폰 — 좌측, 최전방 */}
        <div style={{ position: "absolute", bottom: 0, left: 0, zIndex: 30 }}>
          <DeviceFrame
            src="/mockup-iphone.png"
            width={iphone.w} height={iphone.h}
            screenLeft={iphoneScreen.left} screenTop={iphoneScreen.top}
            screenWidth={iphoneScreen.w} screenHeight={iphoneScreen.h}
            screenRadius={18}
          >
            <IosStatusBar />
            <ScreenShot src="/handyworks-home-iphone.png" />
          </DeviceFrame>
        </div>
      </div>
    </div>
  );
}
