"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { updateNotificationPrefs } from "@/lib/firestore/users";
import { NotificationType, NOTIFICATION_TYPE_LABEL } from "@/lib/types";

const ALL_TYPES: NotificationType[] = [
  "assigned",
  "status_change",
  "comment",
  "unblocked",
  "due_soon",
  "rescheduled",
  "weekly_summary",
  "decision_needed",
  "notice",
  "inquiry",
  "inquiry_answered",
  "quote_request",
  "quote_response",
  "purchase_order",
  "order_status_change",
  "order_cancel_request",
  "contract_signed",
  "contract_revision_requested",
];

const TYPE_DESC: Record<NotificationType, string> = {
  assigned: "업무에 담당자로 지정되었을 때",
  status_change: "담당 업무의 상태가 바뀌었을 때",
  comment: "담당 업무에 새 코멘트가 달렸을 때",
  unblocked: "선행 업무가 끝나 업무를 시작할 수 있게 되었을 때",
  due_soon: "마감일이 임박했을 때",
  rescheduled: "선행 업무 일정 변경으로 내 업무 일정도 자동 조정되었을 때",
  weekly_summary: "매주 월요일, 마감 예정·지연 중인 업무를 요약해서 받고 싶을 때",
  decision_needed: "확인/승인 요청이 오거나 처리되었을 때",
  notice: "새 공지사항이 등록되었을 때",
  inquiry: "클라이언트가 새 문의를 남겼을 때",
  inquiry_answered: "내가 남긴 문의에 답변이 등록되었을 때",
  quote_request: "사이트에서 새 견적 요청이 들어왔을 때",
  quote_response: "고객이 발행한 견적서에 수락/거절로 응답했을 때",
  purchase_order: "클라이언트가 새 발주를 넣었을 때",
  order_status_change: "내 발주 상태가 바뀌었을 때",
  order_cancel_request: "클라이언트가 발주 취소를 요청했을 때",
  contract_signed: "보낸 계약서에 상대방이 서명을 완료했을 때",
  contract_revision_requested: "보낸 계약서에 상대방이 수정을 요청했을 때",
};

export default function NotificationSettingsPage() {
  const { appUser } = useAuth();
  const [prefs, setPrefs] = useState<Partial<Record<NotificationType, boolean>>>({});
  const [saving, setSaving] = useState<NotificationType | null>(null);

  useEffect(() => {
    setPrefs(appUser?.notificationPrefs ?? {});
  }, [appUser?.notificationPrefs]);

  async function toggle(type: NotificationType) {
    if (!appUser) return;
    const current = prefs[type] !== false;
    const next = { ...prefs, [type]: !current };
    setPrefs(next);
    setSaving(type);
    try {
      await updateNotificationPrefs(appUser.uid, next);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-[#1d1d1f]">
          <span className="h-2 w-2 rounded-full bg-[#1d1d1f]" />
          알림 설정
        </h1>
        <p className="mt-1 pl-4 text-sm text-[#86868b]">
          꺼둔 알림은 푸시·이메일로 보내지 않아요. 알림 목록에는 계속 남습니다.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white">
        {ALL_TYPES.map((type, i) => {
          const on = prefs[type] !== false;
          return (
            <div
              key={type}
              className={`flex items-center justify-between gap-4 px-5 py-4 ${i > 0 ? "border-t border-[#f0f0f0]" : ""}`}
            >
              <div className="min-w-0">
                <p className="font-medium text-[#1d1d1f]">{NOTIFICATION_TYPE_LABEL[type]}</p>
                <p className="mt-0.5 text-xs text-[#86868b]">{TYPE_DESC[type]}</p>
              </div>
              <button
                onClick={() => toggle(type)}
                disabled={saving === type}
                className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${on ? "bg-[#1d1d1f]" : "bg-[#d1d1d6]"}`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-[20px]" : "translate-x-0"}`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
