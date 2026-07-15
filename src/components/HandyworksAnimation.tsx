"use client";

import { useEffect, useRef, useState } from "react";

const STAGES = ["기획", "설계", "금형", "양산"];
const CYCLE = 12000;

interface AnimState {
  activeStage: number;
  progress: number;
  progressLabel: string;
  showDoneNotif: boolean;
  showPmComment: boolean;
}

/* ── 노트북 화면 ── */
function LaptopScreen({ s }: { s: AnimState }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f5f5f7", fontSize: 9 }}>
      {/* 상단 네비 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "white", borderBottom: "1px solid #e5e5e5", padding: "6px 12px", flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/handyworks-logo.png" alt="" style={{ height: 12, filter: "brightness(0)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#30d158" }} />
          <span style={{ fontSize: 8, color: "#86868b" }}>실시간</span>
        </div>
      </div>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* 사이드바 */}
        <div style={{ width: 60, background: "white", borderRight: "1px solid #f0f0f0", padding: "10px 6px", flexShrink: 0 }}>
          {["대시보드", "일정", "파일", "메시지"].map((m, i) => (
            <div key={m} style={{ fontSize: 8, padding: "4px 6px", borderRadius: 5, marginBottom: 2, background: i === 0 ? "#1d1d1f" : "transparent", color: i === 0 ? "white" : "#86868b" }}>{m}</div>
          ))}
        </div>
        {/* 메인 */}
        <div style={{ flex: 1, padding: "10px 12px", overflow: "hidden", display: "flex", flexDirection: "column", gap: 7 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#1d1d1f", margin: 0 }}>스마트폰 거치대 개발</p>
          {/* 단계 트래커 */}
          <div style={{ background: "white", borderRadius: 8, padding: "8px 10px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              {STAGES.map((label, i) => {
                const st = i < s.activeStage ? "done" : i === s.activeStage ? "active" : "pending";
                return (
                  <div key={label} style={{ display: "flex", flex: 1, alignItems: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                      <div style={{ display: "flex", width: "100%", alignItems: "center" }}>
                        <div style={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0, background: st === "done" ? "#1d1d1f" : "white", border: st === "done" ? "none" : st === "active" ? "2px solid #1d1d1f" : "1.5px solid #d1d1d6", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.4s" }}>
                          {st === "done" && <div style={{ width: 5, height: 3, borderLeft: "1.5px solid white", borderBottom: "1.5px solid white", transform: "rotate(-45deg) translate(0.5px, -0.5px)" }} />}
                          {st === "active" && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#1d1d1f" }} />}
                        </div>
                        {i < 3 && <div style={{ flex: 1, height: 1.5, background: i < s.activeStage ? "#1d1d1f" : "#e5e5e5", transition: "background 0.5s" }} />}
                      </div>
                      <p style={{ fontSize: 7, color: st === "pending" ? "#c7c7cc" : "#1d1d1f", marginTop: 3, alignSelf: "flex-start", margin: "3px 0 0 0" }}>{label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* 진행률 */}
          <div style={{ background: "white", borderRadius: 8, padding: "8px 10px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: "#1d1d1f" }}>{STAGES[s.activeStage]} 단계</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#1d1d1f" }}>{s.progress}%</span>
            </div>
            <div style={{ height: 5, background: "#f0f0f0", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "#1d1d1f", borderRadius: 3, width: `${s.progress}%`, transition: "width 0.3s" }} />
            </div>
            <p style={{ fontSize: 7, color: "#86868b", marginTop: 4 }}>{s.progressLabel}</p>
          </div>
          {/* 피드 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {s.showDoneNotif && (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 7, padding: "5px 8px", display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
                <span style={{ fontSize: 8, color: "#15803d", fontWeight: 600 }}>설계 완료 · 도면 최종 승인</span>
              </div>
            )}
            {s.showPmComment && (
              <div style={{ background: "white", borderRadius: 7, padding: "5px 8px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", display: "flex", alignItems: "flex-start", gap: 5 }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#1d1d1f", color: "white", fontSize: 5.5, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>PM</div>
                <span style={{ fontSize: 8, color: "#1d1d1f", lineHeight: 1.4 }}>금형 업체 확정. 납기 3주 예정.</span>
              </div>
            )}
            <div style={{ background: "white", borderRadius: 7, padding: "5px 8px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", display: "flex", alignItems: "flex-start", gap: 5 }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#f0f0f0", fontSize: 5.5, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#86868b" }}>나</div>
              <span style={{ fontSize: 8, color: "#86868b", lineHeight: 1.4 }}>확인했습니다. 감사합니다!</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 아이패드 화면 ── */
function IpadScreen({ s }: { s: AnimState }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f5f5f7" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "white", borderBottom: "1px solid #e5e5e5", padding: "5px 10px", flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/handyworks-logo.png" alt="" style={{ height: 10, filter: "brightness(0)" }} />
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#30d158" }} />
      </div>
      <div style={{ flex: 1, overflow: "hidden", padding: "10px", display: "flex", flexDirection: "column", gap: 7 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "#1d1d1f", margin: 0 }}>스마트폰 거치대 개발</p>
        <div style={{ background: "white", borderRadius: 8, padding: "8px 10px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {STAGES.map((label, i) => {
              const st = i < s.activeStage ? "done" : i === s.activeStage ? "active" : "pending";
              return (
                <div key={label} style={{ display: "flex", flex: 1, alignItems: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                    <div style={{ display: "flex", width: "100%", alignItems: "center" }}>
                      <div style={{ width: 12, height: 12, borderRadius: "50%", flexShrink: 0, background: st === "done" ? "#1d1d1f" : "white", border: st === "done" ? "none" : st === "active" ? "2px solid #1d1d1f" : "1.5px solid #d1d1d6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {st === "done" ? <div style={{ width: 4, height: 2.5, borderLeft: "1.5px solid white", borderBottom: "1.5px solid white", transform: "rotate(-45deg) translate(0.5px, -0.5px)" }} />
                          : st === "active" ? <span className="h-0.5 w-0.5 rounded-full bg-[#1d1d1f] animate-pulse" />
                          : null}
                      </div>
                      {i < 3 && <div className={`h-px flex-1 ${i < s.activeStage ? "bg-[#1d1d1f]" : "bg-[#e5e5e5]"}`} />}
                    </div>
                    <p className={`mt-0.5 self-start leading-none ${st === "pending" ? "text-[#c7c7cc]" : "text-[#1d1d1f]"}`} style={{ fontSize: 5 }}>{label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ background: "white", borderRadius: 8, padding: "8px 10px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: "#1d1d1f" }}>{STAGES[s.activeStage]} 단계</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#1d1d1f" }}>{s.progress}%</span>
          </div>
          <div style={{ height: 5, background: "#f0f0f0", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", background: "#1d1d1f", borderRadius: 3, width: `${s.progress}%`, transition: "width 0.3s" }} />
          </div>
          <p style={{ fontSize: 7.5, color: "#86868b", marginTop: 4 }}>{s.progressLabel}</p>
        </div>
        {s.showDoneNotif && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 7, padding: "5px 8px", display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
            <span style={{ fontSize: 8, color: "#15803d", fontWeight: 600 }}>설계 완료 · 도면 승인</span>
          </div>
        )}
        {s.showPmComment && (
          <div style={{ background: "#1d1d1f", borderRadius: 7, padding: "6px 8px" }}>
            <p style={{ fontSize: 7.5, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>담당 PM</p>
            <p style={{ fontSize: 8, color: "white" }}>금형 업체 확정. 납기 3주.</p>
          </div>
        )}
        <div style={{ background: "white", borderRadius: 7, padding: "5px 8px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#f0f0f0", fontSize: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "#86868b", flexShrink: 0 }}>나</div>
          <p style={{ fontSize: 8, color: "#86868b" }}>확인했습니다!</p>
        </div>
      </div>
    </div>
  );
}

/* ── 아이폰 화면 ── */
function PhoneScreen({ s }: { s: AnimState }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f5f5f7" }}>
      {/* 상태바 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px 4px", flexShrink: 0 }}>
        <span style={{ fontSize: 8, fontWeight: 700, color: "#1d1d1f" }}>9:41</span>
        <span style={{ fontSize: 7, color: "#86868b" }}>●●●</span>
      </div>
      <div style={{ flex: 1, overflow: "hidden", padding: "4px 8px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/handyworks-logo.png" alt="" style={{ height: 9, filter: "brightness(0)", flexShrink: 0 }} />
        {/* 진행 단계 바 */}
        <div style={{ background: "white", borderRadius: 8, padding: "7px 8px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
          <div style={{ display: "flex", gap: 3, marginBottom: 5 }}>
            {STAGES.map((label, i) => {
              const st = i < s.activeStage ? "done" : i === s.activeStage ? "active" : "pending";
              return (
                <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ height: 3, width: "100%", borderRadius: 2, background: st === "done" ? "#1d1d1f" : st === "active" ? "#86868b" : "#e5e5e5", transition: "background 0.4s" }} />
                  <p style={{ fontSize: 5.5, marginTop: 2, color: st === "pending" ? "#c7c7cc" : "#1d1d1f" }}>{label}</p>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 8, fontWeight: 600, color: "#1d1d1f" }}>{STAGES[s.activeStage]} 단계</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#1d1d1f" }}>{s.progress}%</span>
          </div>
          <div style={{ height: 4, background: "#f0f0f0", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", background: "#1d1d1f", borderRadius: 2, width: `${s.progress}%`, transition: "width 0.3s" }} />
          </div>
        </div>
        {s.showDoneNotif && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 7, padding: "5px 7px" }}>
            <p style={{ fontSize: 7.5, color: "#15803d", fontWeight: 600 }}>✓ 설계 완료 · 도면 승인</p>
          </div>
        )}
        {s.showPmComment && (
          <div style={{ background: "#1d1d1f", borderRadius: 7, padding: "5px 7px" }}>
            <p style={{ fontSize: 6.5, color: "rgba(255,255,255,0.5)", marginBottom: 1 }}>담당 PM</p>
            <p style={{ fontSize: 7.5, color: "white" }}>금형 납기 3주 예정.</p>
          </div>
        )}
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

  const [state, setState] = useState<AnimState>({
    activeStage: 1, progress: 72, progressLabel: "도면 검토 중 · PM 최형준",
    showDoneNotif: false, showPmComment: false,
  });

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    function anim(from: number, to: number, dur: number, cb: (v: number) => void) {
      const t0 = Date.now();
      const tick = () => {
        const p = Math.min((Date.now() - t0) / dur, 1);
        cb(Math.round(from + (to - from) * p));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    function run() {
      setState({ activeStage: 1, progress: 72, progressLabel: "도면 검토 중 · PM 최형준", showDoneNotif: false, showPmComment: false });
      timers.push(setTimeout(() => anim(72, 100, 2000, (v) => setState((s) => ({ ...s, progress: v }))), 2000));
      timers.push(setTimeout(() => setState((s) => ({ ...s, showDoneNotif: true, progressLabel: "설계 완료 · 승인됨" })), 4200));
      timers.push(setTimeout(() => {
        setState((s) => ({ ...s, activeStage: 2, showDoneNotif: false, progress: 0, progressLabel: "금형 업체 선정 중" }));
        anim(0, 28, 3000, (v) => setState((s) => ({ ...s, progress: v })));
      }, 5800));
      timers.push(setTimeout(() => setState((s) => ({ ...s, showPmComment: true, progressLabel: "금형 업체 확정 · 제작 착수" })), 7500));
      timers.push(setTimeout(run, CYCLE));
    }

    run();
    return () => timers.forEach(clearTimeout);
  }, []);

  // 굿노트 스타일: iPhone(좌) → iPad(중) → MacBook(우), 하단 정렬
  // MacBook 3944:2564 = 1.538
  const mac = { w: 420, h: 270 };
  const macScreen = {
    left: Math.round(420 * 0.117),
    top:  Math.round(270 * 0.117),
    w:    Math.round(420 * 0.766),
    h:    Math.round(270 * 0.873),
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
    <div ref={wrapRef} className="select-none w-full overflow-hidden" style={{ height: Math.round(290 * scale) }}>
      <div style={{ position: "relative", width: 650, height: 290, transform: `scale(${scale})`, transformOrigin: "top left", left: `calc(50% - ${Math.round(325 * scale)}px)` }}>
        {/* 맥북 — 우측, 뒤 */}
        <div style={{ position: "absolute", bottom: 0, right: 0, zIndex: 10 }}>
          <DeviceFrame
            src="/mockup-macbook.png"
            width={mac.w} height={mac.h}
            screenLeft={macScreen.left} screenTop={macScreen.top}
            screenWidth={macScreen.w} screenHeight={macScreen.h}
            screenRadius={3}
          >
            <LaptopScreen s={state} />
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
            <IpadScreen s={state} />
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
            <PhoneScreen s={state} />
          </DeviceFrame>
        </div>
      </div>
    </div>
  );
}
