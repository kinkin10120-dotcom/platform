"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Copy, Check, Upload } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getQuoteForViewing, respondToQuote, uploadQuoteBizRegCert, QuoteViewingResult } from "@/lib/functions";
import QuoteDocument from "@/components/QuoteDocument";
import PdfPageScaler from "@/components/PdfPageScaler";
import { isIosDevice, isStandaloneMode, isInAppBrowser } from "@/lib/pwa";
import { ContactModal } from "@/components/ContactModal";

type Step = "email" | "view";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function QuoteViewPage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const { appUser } = useAuth();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<QuoteViewingResult | null>(null);

  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [responding, setResponding] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const [bizRegCertFile, setBizRegCertFile] = useState<File | null>(null);
  const [certUploading, setCertUploading] = useState(false);
  const [certUploaded, setCertUploaded] = useState(false);
  const [certError, setCertError] = useState("");

  useEffect(() => {
    setStandalone(isInAppBrowser() || (isIosDevice() && isStandaloneMode()));
  }, []);

  // 모바일 "인쇄/PDF 저장"에서 제안되는 파일명은 document.title을 따른다.
  useEffect(() => {
    if (!view) return;
    document.title = `견적서-${view.company || view.name}`;
  }, [view]);

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleUnlock() {
    if (!email.trim()) return;
    setLoading(true);
    setEmailError("");
    try {
      const data = await getQuoteForViewing(quoteId, email.trim());
      setView(data);
      setCertUploaded(data.bizRegCertUploaded);
      // 이미 수락/거절한 뒤 다시 들어와도 견적서 내용을 계속 열람할 수 있어야 하므로,
      // 상태와 무관하게 항상 "view" 화면으로 간다 — 수락/거절 버튼은 view 화면 안에서
      // view.quoteStatus에 따라 보이거나 확인 배너로 바뀐다.
      setStep("view");
    } catch (e: any) {
      setEmailError(
        e?.message?.includes("permission-denied") || e?.code === "functions/permission-denied"
          ? "이메일이 견적 요청 정보와 일치하지 않습니다."
          : "견적 정보를 확인할 수 없습니다. 링크와 이메일을 다시 확인해주세요."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept() {
    setResponding(true);
    try {
      await respondToQuote(quoteId, email.trim(), true);
      setView((prev) => (prev ? { ...prev, quoteStatus: "accepted" } : prev));
    } finally {
      setResponding(false);
    }
  }

  async function handleDecline() {
    setResponding(true);
    try {
      await respondToQuote(quoteId, email.trim(), false, declineReason.trim() || undefined);
      setView((prev) => (prev ? { ...prev, quoteStatus: "declined" } : prev));
      setDeclining(false);
    } finally {
      setResponding(false);
    }
  }

  async function handleUploadBizRegCert(file: File) {
    setBizRegCertFile(file);
    setCertUploading(true);
    setCertError("");
    try {
      const dataUrl = await blobToDataUrl(file);
      await uploadQuoteBizRegCert(quoteId, email.trim(), dataUrl);
      setCertUploaded(true);
    } catch (e) {
      setCertError("첨부 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setCertUploading(false);
    }
  }

  // "view" 단계는 견적서 자체가 A4 문서라, 발주서/청구서 페이지와 같은 방식(PdfPageScaler로
  // 뷰포트 폭에 맞춰 전체를 스크롤 없이 한 번에 보여줌)으로 별도 전체 폭 레이아웃을 쓴다 —
  // 좁은 카드 안에 넣으면 문서를 줄여서 넣어야 해서 내용이 잘 안 보인다.
  if (step === "view" && view) {
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
            {appUser?.role === "admin" ? (
              <Link href="/quotes" className="flex items-center gap-1 text-sm text-[#86868b] transition hover:text-[#1d1d1f]">
                <ArrowLeft size={16} /> 견적 관리로
              </Link>
            ) : (
              <span />
            )}
            {standalone ? (
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 rounded-full bg-[#1d1d1f] px-5 py-2 text-sm font-medium text-white transition hover:bg-black"
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? "복사됨" : "링크 복사"}
              </button>
            ) : (
              <button
                onClick={() => window.print()}
                className="rounded-full bg-[#1d1d1f] px-5 py-2 text-sm font-medium text-white transition hover:bg-black"
              >
                인쇄 / PDF 저장
              </button>
            )}
          </div>
          <p className="mt-2 text-sm text-[#86868b]">
            {view.quoteStatus === "sent"
              ? "내용을 확인하시고 수락 또는 거절해주세요."
              : view.quoteStatus === "expired"
                ? "회신 기간이 지나 만료된 견적서입니다."
                : "견적서 내용을 다시 확인하실 수 있습니다."}
          </p>
          {standalone && (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
              이 화면(홈 화면 추가 앱 또는 카카오톡·네이버 등 인앱 브라우저)에서는 인쇄/PDF 저장이 동작하지 않아요. 위 &quot;링크 복사&quot; 버튼으로 링크를 복사해서 사파리 브라우저에 붙여넣어 열어주세요.
            </p>
          )}
        </div>

        <PdfPageScaler>
          <QuoteDocument
            data={{
              quoteId: view.quoteId,
              name: view.name,
              company: view.company,
              items: view.items,
              quoteMemo: view.quoteMemo,
              quoteIssuedAt: view.quoteIssuedAt,
              quoteIssuedBy: view.quoteIssuedBy,
            }}
          />
        </PdfPageScaler>

        <div className="mx-auto mt-6 w-full max-w-[210mm] px-4 print:hidden">
          {(view.quoteStatus === "accepted" || view.quoteStatus === "declined") && (
            <div className="rounded-3xl bg-white p-5 text-center">
              <p className="text-base font-bold text-[#1d1d1f]">
                {view.quoteStatus === "accepted" ? "견적서를 수락하셨습니다" : "견적서를 거절하셨습니다"}
              </p>
              <p className="mt-1.5 text-sm text-[#86868b]">
                {view.quoteStatus === "accepted" ? "담당자가 곧 다음 절차를 안내드리겠습니다." : "다른 문의사항이 있으시면 언제든 연락 부탁드립니다."}
              </p>
              <button
                onClick={() => setContactOpen(true)}
                className="mx-auto mt-4 rounded-full border border-[#d1d1d6] px-5 py-2 text-sm font-medium text-[#1d1d1f] transition hover:border-[#86868b]"
              >
                견적 관련 문의하기
              </button>
            </div>
          )}

          {contactOpen && (
            <ContactModal
              onClose={() => setContactOpen(false)}
              initialMessage={`[견적 문의${view.company ? ` - ${view.company}` : ""}]\n\n`}
            />
          )}

          {view.quoteStatus === "accepted" && (
            <div className="mt-3 rounded-3xl bg-white p-5">
              <label className="mb-1.5 block text-xs text-[#86868b]">사업자등록증 첨부 (선택)</label>
              <label className={`flex h-[72px] w-full items-center justify-center overflow-hidden rounded-xl border border-dashed px-3 text-center ${
                certUploaded ? "border-green-200 bg-green-50 text-green-600" : "cursor-pointer border-[#d1d1d6] bg-[#f5f5f7] text-[#86868b] hover:border-[#86868b]"
              }`}>
                {certUploaded ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    <Check size={14} /> 첨부 완료{bizRegCertFile ? ` · ${bizRegCertFile.name}` : ""}
                  </span>
                ) : certUploading ? (
                  <span className="text-xs">업로드 중...</span>
                ) : (
                  <span className="flex flex-col items-center gap-1 text-xs">
                    <Upload size={15} />
                    지금 첨부해주시면 계약 준비가 더 빨라져요 (나중에 이메일로 보내주셔도 됩니다)
                  </span>
                )}
                {!certUploaded && (
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    disabled={certUploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadBizRegCert(f); }}
                  />
                )}
              </label>
              {certError && <p className="mt-1 text-xs text-red-500">{certError}</p>}
            </div>
          )}

          {view.quoteStatus === "expired" && (
            <div className="rounded-3xl bg-white p-5 text-center">
              <p className="text-base font-bold text-[#1d1d1f]">견적서 회신 기간이 만료되었습니다</p>
              <p className="mt-1.5 text-sm text-[#86868b]">다시 견적이 필요하시면 담당자에게 문의해주세요. 곧 동일한 내용으로 다시 발송해드릴 수도 있습니다.</p>
            </div>
          )}

          {view.quoteStatus === "sent" && !declining && (
            <div>
              <p className="mb-3 rounded-xl bg-[#f5f5f7] px-4 py-2.5 text-center text-sm font-medium text-[#1d1d1f]">
                계약 준비 등 다음 절차를 진행하려면 [수락] 버튼을 반드시 눌러주세요.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeclining(true)}
                  className="flex-1 rounded-full border border-[#d1d1d6] bg-white py-2.5 text-sm font-medium text-[#1d1d1f] transition hover:border-[#86868b]"
                >
                  거절
                </button>
                <button
                  onClick={handleAccept}
                  disabled={responding}
                  className="flex-1 rounded-full bg-[#1d1d1f] py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
                >
                  {responding ? "처리 중..." : "수락"}
                </button>
              </div>
            </div>
          )}

          {view.quoteStatus === "sent" && declining && (
            <div className="space-y-2 rounded-3xl bg-white p-4">
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={2}
                placeholder="거절 사유 (선택)"
                className="w-full resize-none rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setDeclining(false)}
                  className="flex-1 rounded-full border border-[#d1d1d6] py-2.5 text-sm font-medium text-[#1d1d1f] transition hover:border-[#86868b]"
                >
                  취소
                </button>
                <button
                  onClick={handleDecline}
                  disabled={responding}
                  className="flex-1 rounded-full bg-red-500 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
                >
                  {responding ? "처리 중..." : "거절 제출"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] px-4 py-10">
      <div className="mx-auto max-w-xl">
        {appUser?.role === "admin" && (
          <Link href="/quotes" className="mb-4 inline-flex items-center gap-1 text-sm text-[#86868b] transition hover:text-[#1d1d1f]">
            <ArrowLeft size={16} /> 견적 관리로
          </Link>
        )}
        <div className="mb-6 text-center">
          <Image src="/handyworks-logo.png" alt="HandyWorks" width={128} height={38} className="mx-auto" style={{ objectFit: "contain", filter: "brightness(0)" }} />
        </div>

        <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-[0_2px_16px_rgba(0,0,0,0.04),0_24px_48px_rgba(0,0,0,0.06)] sm:p-8">
          {step === "email" && (
            <div className="space-y-4">
              <div>
                <h1 className="text-lg font-bold text-[#1d1d1f]">견적서 확인</h1>
                <p className="mt-1 text-sm text-[#86868b]">본인 확인을 위해 견적 요청 시 입력하신 이메일을 입력해주세요.</p>
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleUnlock(); }}
                placeholder="you@company.com"
                className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2.5 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
              />
              {emailError && <p className="text-xs text-red-500">{emailError}</p>}
              <button
                onClick={handleUnlock}
                disabled={loading || !email.trim()}
                className="w-full rounded-full bg-[#1d1d1f] py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
              >
                {loading ? "확인 중..." : "확인하고 견적서 보기"}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
