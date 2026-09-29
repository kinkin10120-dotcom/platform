"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { updateNotificationPrefs } from "@/lib/firestore/users";
import { createNotification } from "@/lib/firestore/notifications";
import { NotificationType, NOTIFICATION_TYPE_LABEL } from "@/lib/types";
import { zh, usePartnerZh } from "@/lib/i18n";

const ALL_TYPES: NotificationType[] = [
  "assigned",
  "status_change",
  "comment",
  "unblocked",
  "due_soon",
  "overdue",
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
  "contract_expiring",
];

const TYPE_DESC: Record<NotificationType, string> = {
  assigned: "업무에 담당자로 지정되었을 때",
  status_change: "담당 업무의 상태가 바뀌었을 때",
  comment: "담당 업무에 새 코멘트가 달렸을 때",
  unblocked: "선행 업무가 끝나 업무를 시작할 수 있게 되었을 때",
  due_soon: "마감일이 임박했을 때",
  overdue: "담당 업무의 마감일이 지났는데 아직 완료되지 않았을 때 (3일 간격 재알림)",
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
  contract_expiring: "서명 완료된 계약의 용역기간 만료가 임박했을 때(재계약·연장 검토용, 14일 전 1회)",
};

export default function NotificationSettingsPage() {
  const { appUser } = useAuth();
  const isZh = usePartnerZh();
  const [prefs, setPrefs] = useState<Partial<Record<NotificationType, boolean>>>({});
  const [saving, setSaving] = useState<NotificationType | null>(null);
  const [testState, setTestState] = useState<"idle" | "sending" | "sent" | "error">("idle");

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

  async function handleSendTest() {
    if (!appUser) return;
    setTestState("sending");
    try {
      await createNotification({
        userId: appUser.uid,
        type: "notice",
        message: `알림 테스트입니다. ${new Date().toLocaleString("ko-KR")}에 보냈습니다.`,
      });
      setTestState("sent");
    } catch {
      setTestState("error");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-[#1d1d1f]">
          <span className="h-2 w-2 rounded-full bg-[#1d1d1f]" />
          {zh(isZh, "알림 설정")}
        </h1>
        <p className="mt-1 pl-4 text-sm text-[#86868b]">
          {zh(isZh, "꺼둔 알림은 푸시·이메일로 보내지 않아요. 알림 목록에는 계속 남습니다.")}
        </p>
      </div>

      {/* 알림이 실제로 오는지 매번 다른 사람에게 물어보거나 일정을 실제로 바꿔볼 필요 없이,
          여기서 바로 본인에게 한 건 보내 확인할 수 있게 한다. 실패하면 화면 맨 위에 빨간
          띠(SystemAlertBanner)가 뜬다. */}
      <div className="rounded-3xl bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[#1d1d1f]">{zh(isZh, "알림 테스트")}</p>
            <p className="mt-0.5 text-xs text-[#86868b]">
              {zh(isZh, "나에게 테스트 알림을 한 건 보냅니다. 알림벨·푸시·이메일이 모두 정상인지 한 번에 확인할 수 있어요.")}
            </p>
          </div>
          <button
            onClick={handleSendTest}
            disabled={testState === "sending"}
            className="shrink-0 rounded-full bg-[#1d1d1f] px-5 py-2 text-xs font-medium text-white transition hover:bg-black disabled:opacity-50"
          >
            {testState === "sending" ? zh(isZh, "보내는 중...") : zh(isZh, "테스트 알림 보내기")}
          </button>
        </div>
        {testState === "sent" && (
          <p className="mt-3 rounded-xl bg-[#f5f5f7] px-3 py-2 text-xs leading-relaxed text-[#86868b]">
            {zh(isZh, "보냈습니다. 알림벨에 바로 뜨고, 푸시·이메일은 1분 안에 도착합니다. 안 오면 이 화면 맨 위에 빨간 안내가 뜹니다.")}
          </p>
        )}
        {testState === "error" && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-600">
            {zh(isZh, "테스트 알림을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.")}
          </p>
        )}
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
                <p className="font-medium text-[#1d1d1f]">{zh(isZh, NOTIFICATION_TYPE_LABEL[type])}</p>
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
