"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenSupplierQuote } from "@/lib/firestore/supplierQuotes";
import { SupplierQuote } from "@/lib/types";
import PdfPageScaler from "@/components/PdfPageScaler";
import SupplierQuoteDocument from "@/components/SupplierQuoteDocument";
import { zh, usePartnerZh } from "@/lib/i18n";

// 협력사 견적서 인쇄 전용 페이지 — /supplier-invoices/[invoiceId]/print와 같은 이유로
// (app) 레이아웃 바깥의 독립 라우트로 둔다(숨길 사이드바·상단바 자체가 없어야 빈 둘째 장이
// 안 생긴다).
export default function SupplierQuotePrintPage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const { firebaseUser, appUser, loading } = useAuth();
  const isZh = usePartnerZh();
  const router = useRouter();
  const [quote, setQuote] = useState<SupplierQuote | null | undefined>(undefined);
  // 관리자는 항상 한국어판만 본다(토글 자체를 안 보여줌) — 중국 협력사 계정만 중문/한글을
  // 오가며 본인이 쓴 원문과 번역본을 둘 다 확인할 수 있다.
  const [docLang, setDocLang] = useState<"zh" | "ko">(isZh ? "zh" : "ko");

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) router.replace(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
  }, [loading, firebaseUser, router]);

  useEffect(() => {
    if (!quoteId) return;
    return listenSupplierQuote(quoteId, setQuote);
  }, [quoteId]);

  useEffect(() => {
    if (!quote) return;
    document.title = `${quote.quoteNumber}-${quote.partnerName}`;
  }, [quote]);

  if (loading || quote === undefined) return null;

  // 본인이 제출한 견적서만 볼 수 있다 — Firestore 규칙(supplierQuotes — partnerId == 본인 uid)이
  // 이미 막지만, 화면에서도 한 번 더 막는다.
  const canView = appUser?.role === "admin" || (appUser?.role === "partner" && !!quote && quote.partnerId === appUser.uid);
  if (!canView) {
    return <p className="p-10 text-center text-sm text-[#86868b]">{zh(isZh, "접근 권한이 없습니다.")}</p>;
  }

  if (!quote) {
    return <p className="p-10 text-center text-sm text-[#86868b]">{zh(isZh, "견적서 정보를 찾을 수 없습니다.")}</p>;
  }

  return (
    <div className="min-h-screen bg-[#e5e5e5] py-10 print:bg-white print:py-0">
      <style>{`
        @page { size: 210mm 297mm; margin: 0; }
        @media print {
          .po-page { box-shadow: none !important; margin: 0 !important; width: 100% !important; }
          .pdf-scale-wrapper { width: auto !important; height: auto !important; }
          .pdf-scale-inner { transform: none !important; width: auto !important; }
        }
      `}</style>

      <div className="mx-auto mb-6 w-full max-w-[210mm] px-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d1d1d6] text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
              title={zh(isZh, "닫기")}
            >
              <X size={16} />
            </button>
            <p className="text-sm text-[#86868b]">{quote.quoteNumber} — {zh(isZh, "인쇄 시 A4 크기로 저장됩니다.")}</p>
          </div>
          <div className="flex items-center gap-2">
            {appUser?.role === "partner" && isZh && (
              <div className="flex overflow-hidden rounded-full border border-[#d1d1d6]">
                <button
                  onClick={() => setDocLang("zh")}
                  className={`px-4 py-1.5 text-xs font-medium ${docLang === "zh" ? "bg-[#1d1d1f] text-white" : "text-[#1d1d1f]"}`}
                >
                  中文版
                </button>
                <button
                  onClick={() => setDocLang("ko")}
                  className={`px-4 py-1.5 text-xs font-medium ${docLang === "ko" ? "bg-[#1d1d1f] text-white" : "text-[#1d1d1f]"}`}
                >
                  한국어판
                </button>
              </div>
            )}
            <button
              onClick={() => window.print()}
              className="rounded-full bg-[#1d1d1f] px-5 py-2 text-sm font-medium text-white transition hover:bg-black"
            >
              {zh(isZh, "인쇄 / PDF 저장")}
            </button>
          </div>
        </div>
      </div>

      <PdfPageScaler>
        <SupplierQuoteDocument data={quote} lang={appUser?.role === "admin" ? "ko" : docLang} />
      </PdfPageScaler>
    </div>
  );
}
