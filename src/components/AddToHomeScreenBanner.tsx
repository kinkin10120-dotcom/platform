"use client";

import { useEffect, useState } from "react";
import { X, Download, Bell } from "lucide-react";
import { isIosDevice, isStandaloneMode } from "@/lib/pwa";
import { enablePushNotifications } from "@/lib/messaging";
import { useAuth } from "@/lib/auth-context";
import IosAddToHomeScreenGuide from "@/components/IosAddToHomeScreenGuide";
import { zh, usePartnerZh } from "@/lib/i18n";

const INSTALL_DISMISS_KEY = "addToHomeScreenBannerDismissedAt";
const ENABLE_DISMISS_KEY = "enablePushBannerDismissedAt";
const DISMISS_DAYS = 7;

function recentlyDismissed(key: string): boolean {
  const dismissedAt = Number(localStorage.getItem(key) ?? 0);
  if (!dismissedAt) return false;
  const daysSinceDismiss = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return daysSinceDismiss < DISMISS_DAYS;
}

export default function AddToHomeScreenBanner() {
  const { appUser } = useAuth();
  const isZh = usePartnerZh();
  // 아이폰·아이패드는 홈 화면에 추가부터 유도하고, 그 외(안드로이드·데스크탑)는
  // 별도 설치 없이 바로 알림 권한만 켜면 되므로 곧바로 "알림 켜기" 배너를 보여준다.
  const [mode, setMode] = useState<"install" | "enable" | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [enableError, setEnableError] = useState("");

  useEffect(() => {
    const pushEnabled = localStorage.getItem("pushEnabled") === "true";
    if (pushEnabled) return;

    if (isIosDevice() && !isStandaloneMode()) {
      if (!recentlyDismissed(INSTALL_DISMISS_KEY)) setMode("install");
      return;
    }
    if (Notification?.permission === "denied") return;
    if (!recentlyDismissed(ENABLE_DISMISS_KEY)) setMode("enable");
  }, []);

  function handleDismiss() {
    if (mode === "install") localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
    else if (mode === "enable") localStorage.setItem(ENABLE_DISMISS_KEY, String(Date.now()));
    setMode(null);
  }

  async function handleEnable() {
    if (!appUser) return;
    setEnabling(true);
    setEnableError("");
    try {
      const result = await enablePushNotifications(appUser.uid);
      if (result.ok) {
        setMode(null);
      } else {
        setEnableError(result.error ?? zh(isZh, "설정에 실패했습니다."));
      }
    } finally {
      setEnabling(false);
    }
  }

  if (!mode) return null;

  return (
    <>
      <div className="mb-4 rounded-2xl bg-[#1d1d1f] px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
            {mode === "install" ? <Download size={16} /> : <Bell size={16} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {mode === "install" ? zh(isZh, "홈 화면에 추가하면 알림을 놓치지 않아요") : zh(isZh, "알림을 켜면 놓치는 일이 없어요")}
            </p>
            <p className="mt-0.5 text-xs text-white/60">{zh(isZh, "마감일 임박, 승인 요청 같은 알림을 바로 받아볼 수 있어요.")}</p>
          </div>
          {mode === "install" ? (
            <button
              onClick={() => setGuideOpen(true)}
              className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-white/90"
            >
              {zh(isZh, "추가하기")}
            </button>
          ) : (
            <button
              onClick={handleEnable}
              disabled={enabling}
              className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
            >
              {enabling ? zh(isZh, "켜는 중...") : zh(isZh, "알림 켜기")}
            </button>
          )}
          <button onClick={handleDismiss} className="shrink-0 rounded-full p-1 text-white/50 transition hover:bg-white/10 hover:text-white">
            <X size={16} />
          </button>
        </div>
        {enableError && <p className="mt-2 text-xs text-red-300">{enableError}</p>}
      </div>
      <IosAddToHomeScreenGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </>
  );
}
