"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing, BellOff, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko, zhCN } from "date-fns/locale";
import { useAuth } from "@/lib/auth-context";
import { listenNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification, deleteAllNotifications } from "@/lib/firestore/notifications";
import { enablePushNotifications, disablePushNotifications, syncPushToken } from "@/lib/messaging";
import { isIosDevice, isStandaloneMode } from "@/lib/pwa";
import { AppNotification } from "@/lib/types";
import IosAddToHomeScreenGuide from "@/components/IosAddToHomeScreenGuide";
import { zh, usePartnerZh } from "@/lib/i18n";

export default function NotificationBell() {
  const router = useRouter();
  const { appUser } = useAuth();
  const isZh = usePartnerZh();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState("");
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    if (!appUser) return;
    return listenNotifications(appUser.uid, setItems);
  }, [appUser]);

  // 토글 상태를 localStorage만 보고 정하면 실제 브라우저 권한·서버 토큰과 어긋난다.
  // 서버가 만료 토큰을 정리하면 "켜짐"으로 보이지만 실제로는 푸시가 끊긴 상태가 되고,
  // 그 상태에서 토글을 누르면 켜기가 아니라 끄기가 실행돼 사용자가 원인을 알 수 없다.
  // 권한이 없으면 무조건 꺼짐으로 맞추고, 권한이 살아 있는데 끈 적이 없다면 토큰을
  // 조용히 다시 등록해 스스로 복구한다.
  useEffect(() => {
    if (!appUser) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted" || localStorage.getItem("pushEnabled") === "false") {
      setPushEnabled(false);
      return;
    }
    setPushEnabled(true);
    syncPushToken(appUser.uid);
  }, [appUser]);

  const unreadCount = items.filter((i) => !i.read).length;

  function handleMarkAllRead() {
    markAllNotificationsRead(items.filter((i) => !i.read).map((i) => i.id));
  }

  function handleNotificationClick(n: AppNotification) {
    markNotificationRead(n.id);
    if (n.projectId && n.taskId) {
      setOpen(false);
      router.push(`/projects/${n.projectId}?task=${n.taskId}`);
    } else if (n.projectId) {
      setOpen(false);
      router.push(`/projects/${n.projectId}`);
    } else if (n.type === "inquiry") {
      setOpen(false);
      router.push("/inquiries");
    } else if (n.type === "quote_request" || n.type === "quote_response") {
      setOpen(false);
      router.push("/quotes");
    } else if (n.type === "purchase_order" || n.type === "order_cancel_request") {
      setOpen(false);
      router.push("/orders");
    } else if (n.type === "order_status_change") {
      setOpen(false);
      router.push("/my-orders");
    } else if (n.type === "contract_signed" || n.type === "contract_revision_requested") {
      setOpen(false);
      router.push("/contracts");
    }
  }

  function handleDeleteAll() {
    if (items.length === 0) return;
    if (!confirm(zh(isZh, "모든 알림을 삭제하시겠습니까?"))) return;
    deleteAllNotifications(items.map((i) => i.id));
  }

  async function handleTogglePush() {
    if (!appUser) return;
    setPushBusy(true);
    setPushError("");
    try {
      if (pushEnabled) {
        await disablePushNotifications(appUser.uid);
        setPushEnabled(false);
      } else if (isIosDevice() && !isStandaloneMode()) {
        setShowIosGuide(true);
      } else {
        const result = await enablePushNotifications(appUser.uid);
        if (result.ok) {
          setPushEnabled(true);
          // 이미 권한이 허용된 기기(특히 홈 화면에 추가한 iOS 앱)에서는 권한 팝업이 뜨지
          // 않아 아무 일도 안 일어난 것처럼 보인다 — 등록됐다는 걸 명시적으로 알려준다.
          setPushError(zh(isZh, "푸시 알림이 켜졌습니다. 이제 이 기기로 알림이 옵니다."));
        } else {
          setPushError(result.error ?? zh(isZh, "설정에 실패했습니다."));
        }
      }
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2 text-[#86868b] hover:bg-[#f5f5f7]"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-2xl border border-black/5 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between border-b border-[#f0f0f0] px-4 py-3">
            <span className="text-sm font-semibold text-[#1d1d1f]">{zh(isZh, "알림")}</span>
            <div className="flex items-center gap-3">
              <button
                onClick={handleTogglePush}
                disabled={pushBusy}
                title={pushEnabled ? zh(isZh, "브라우저 알림 끄기") : zh(isZh, "브라우저 알림 켜기")}
                className="flex items-center gap-1 text-xs font-medium text-[#86868b] hover:text-[#1d1d1f] disabled:opacity-40"
              >
                {pushEnabled ? <BellRing size={13} /> : <BellOff size={13} />}
              </button>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="text-xs font-medium text-[#86868b] hover:text-[#1d1d1f]">
                  {zh(isZh, "모두 읽음")}
                </button>
              )}
              {items.length > 0 && (
                <button onClick={handleDeleteAll} className="text-xs font-medium text-[#86868b] hover:text-red-500">
                  {zh(isZh, "전체 삭제")}
                </button>
              )}
            </div>
          </div>
          {pushError && (
            <p className={`border-b border-[#f0f0f0] px-4 py-2 text-xs ${pushEnabled ? "text-green-600" : "text-red-500"}`}>
              {pushError}
            </p>
          )}
          <div className="scrollbar-thin max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-[#86868b]">{zh(isZh, "알림이 없습니다.")}</p>
            )}
            {items.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-2 border-b border-[#f5f5f7] px-4 py-3 text-sm last:border-0 hover:bg-[#f5f5f7] ${
                  n.read ? "text-[#86868b]" : "text-[#1d1d1f]"
                }`}
              >
                <button onClick={() => handleNotificationClick(n)} className="min-w-0 flex-1 text-left">
                  <p>{n.message}</p>
                  <p className="mt-1 text-xs text-[#d1d1d6]">
                    {formatDistanceToNow(n.createdAt, { addSuffix: true, locale: isZh ? zhCN : ko })}
                  </p>
                </button>
                <button
                  onClick={() => deleteNotification(n.id)}
                  className="shrink-0 rounded-full p-1 text-[#d1d1d6] hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <IosAddToHomeScreenGuide open={showIosGuide} onClose={() => setShowIosGuide(false)} />
    </div>
  );
}
