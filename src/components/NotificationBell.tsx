"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { useAuth } from "@/lib/auth-context";
import { listenNotifications, markNotificationRead } from "@/lib/firestore/notifications";
import { AppNotification } from "@/lib/types";

export default function NotificationBell() {
  const { appUser } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!appUser) return;
    return listenNotifications(appUser.uid, setItems);
  }, [appUser]);

  const unreadCount = items.filter((i) => !i.read).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700">알림</div>
          <div className="scrollbar-thin max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-gray-400">알림이 없습니다.</p>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => markNotificationRead(n.id)}
                className={`block w-full border-b border-gray-50 px-4 py-3 text-left text-sm last:border-0 hover:bg-gray-50 ${
                  n.read ? "text-gray-400" : "text-gray-700"
                }`}
              >
                <p>{n.message}</p>
                <p className="mt-1 text-xs text-gray-300">
                  {formatDistanceToNow(n.createdAt, { addSuffix: true, locale: ko })}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
