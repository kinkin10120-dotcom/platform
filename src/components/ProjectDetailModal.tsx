"use client";

import { useEffect } from "react";
import { X, BadgeCheck } from "lucide-react";
import { PortfolioImageSlider } from "@/components/PortfolioImageSlider";

export function ProjectDetailModal({
  item,
  onClose,
  onQuote,
}: {
  item: { title: string; category?: string; tag: string; desc: string; images: string[]; patented?: boolean };
  onClose: () => void;
  onQuote: () => void;
}) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-0 pb-0 backdrop-blur-sm sm:items-center sm:px-4 sm:pb-4">
      <div className="no-scrollbar relative w-full max-w-lg rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-30 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60"
        >
          <X size={16} />
        </button>
        <div className="relative">
          <PortfolioImageSlider images={item.images} alt={item.title} />
          {item.patented && (
            <span className="absolute left-4 top-4 z-20 inline-flex items-center gap-1 rounded-full bg-[#1d1d1f] px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm">
              <BadgeCheck size={12} className="text-[#F1CE00]" />
              특허 등록
            </span>
          )}
        </div>
        <div className="p-6 sm:p-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f5f7] px-2.5 py-0.5 text-xs font-medium text-[#86868b]">
            <span className="h-1 w-1 rounded-full bg-[#F1CE00]" />
            {item.tag}
          </span>
          <h3 className="mt-3 text-xl font-bold text-[#1d1d1f]">{item.title}</h3>
          {item.category && <p className="mt-1 text-sm text-[#86868b]">{item.category}</p>}
          <p className="mt-4 text-sm leading-relaxed text-[#4a4a4c]">{item.desc}</p>
          <button
            onClick={onQuote}
            className="mt-6 w-full rounded-full bg-[#1d1d1f] py-3 text-sm font-semibold text-white transition hover:bg-black"
          >
            비슷한 프로젝트 견적 요청하기 →
          </button>
        </div>
      </div>
    </div>
  );
}
