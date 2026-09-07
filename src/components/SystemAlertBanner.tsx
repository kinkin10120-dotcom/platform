"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenUnresolvedSystemAlerts, resolveSystemAlert, SystemAlert } from "@/lib/firestore/systemAlerts";

// 알림(푸시·이메일) 발송이 실패하면 관리자 화면 맨 위에 띄운다.
//
// 여태는 발송이 실패해도 Cloud Functions 로그에만 남아서, "알림이 오는지"를 사람이 직접
// 테스트해봐야 알 수 있었다. 고장을 찾아다니는 대신 고장이 먼저 알려주게 하려는 것이다.
export default function SystemAlertBanner() {
  const { appUser } = useAuth();
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);

  useEffect(() => {
    if (appUser?.role !== "admin") return;
    return listenUnresolvedSystemAlerts(setAlerts);
  }, [appUser?.role]);

  if (appUser?.role !== "admin" || alerts.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {alerts.map((a) => (
        <div
          key={a.id}
          className="flex items-start gap-2.5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-600"
        >
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">알림이 정상적으로 발송되지 않았습니다</p>
            <p className="mt-0.5">
              {a.message}
              {a.count > 1 && ` (${a.count}회)`}
            </p>
            <p className="mt-0.5 text-red-400">{new Date(a.lastAt).toLocaleString("ko-KR")}</p>
          </div>
          <button
            onClick={() => resolveSystemAlert(a.id)}
            className="shrink-0 rounded-full p-1 text-red-300 transition hover:bg-red-100 hover:text-red-600"
            title="확인함"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
