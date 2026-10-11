"use client";

import { X } from "lucide-react";
import { isIosNonSafariBrowser } from "@/lib/pwa";
import { zh, usePartnerZh } from "@/lib/i18n";

export default function IosAddToHomeScreenGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const isZh = usePartnerZh();
  if (!open) return null;

  const nonSafari = isIosNonSafariBrowser();

  // 원 안에 아이콘을 넣으면 아이콘 도형 자체의 무게중심이 제각각이라(예: 종 모양은
  // 아래쪽이 무겁다) 육안으로 가운데 정렬이 안 맞아 보인다. 숫자는 글자 자체가 항상
  // 정확히 가운데 맞춰지므로 이 문제가 없다.
  const steps = nonSafari
    ? [
        zh(isZh, "우측 상단(또는 하단)의 공유/메뉴 버튼을 눌러 '사파리로 열기'를 선택하세요."),
        zh(isZh, "사파리에서 열리면, 공유 아이콘 → '홈 화면에 추가'를 선택하세요."),
        zh(isZh, "추가된 아이콘으로 다시 접속해서, 알림 벨에서 알림을 켜주세요."),
      ]
    : [
        zh(isZh, "사파리 하단(또는 상단) 공유 아이콘을 탭하세요."),
        zh(isZh, "메뉴를 아래로 내려 '홈 화면에 추가'를 선택하세요."),
        zh(isZh, "추가된 아이콘으로 다시 접속해서, 알림 벨에서 알림을 켜주세요."),
      ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-t-3xl bg-white p-6 sm:rounded-3xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold text-[#1d1d1f]">
            <span className="h-2 w-2 rounded-full bg-[#1d1d1f]" />
            {zh(isZh, "홈 화면에 추가하고 알림 받기")}
          </h3>
          <button onClick={onClose} className="rounded-full p-1 text-[#86868b] hover:bg-[#f5f5f7]">
            <X size={18} />
          </button>
        </div>
        <p className="mb-5 text-sm leading-relaxed text-[#86868b]">
          {nonSafari ? (
            <>{zh(isZh, "아이폰·아이패드에서는 ")}<b className="text-[#1d1d1f]">{zh(isZh, "사파리 브라우저에서만")}</b>{zh(isZh, " 알림을 받을 수 있어요. 지금 사용 중인 브라우저에서는 홈 화면에 추가해도 알림이 오지 않아요.")}</>
          ) : (
            zh(isZh, "아이폰·아이패드는 홈 화면에 추가한 뒤에만 알림을 받을 수 있어요. 아래 순서대로 진행해주세요.")
          )}
        </p>
        <div className="space-y-4">
          {steps.map((text, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1d1d1f]">
                <span className="text-sm font-bold leading-none text-white">{i + 1}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-[#1d1d1f]">{text}</p>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-6 w-full rounded-full bg-[#1d1d1f] py-3 text-center text-sm font-semibold text-white transition hover:bg-black"
        >
          {zh(isZh, "확인했어요")}
        </button>
      </div>
    </div>
  );
}
