"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Upload, Maximize2, Check, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { formatMoney } from "@/lib/orderCalc";
import {
  getContractForSigning,
  submitContractSignature,
  requestContractRevision,
  uploadContractBizRegCert,
  ContractSigningView,
} from "@/lib/functions";
import SignaturePad from "@/components/SignaturePad";
import ContractPreviewModal from "@/components/ContractPreviewModal";
import ContractBodyEditor from "@/components/ContractBodyEditor";
import { ContactModal } from "@/components/ContactModal";
import { sanitizeContractHtml } from "@/lib/contractSanitize";
import { plainTextToHtml } from "@/lib/contractTemplate";

type Step = "email" | "view" | "revision" | "revision_sent" | "signing" | "done";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function ContractSignPage() {
  const { contractId } = useParams<{ contractId: string }>();
  const { appUser } = useAuth();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<ContractSigningView | null>(null);

  const [revisionBodyText, setRevisionBodyText] = useState("");
  const [revisionSubmitting, setRevisionSubmitting] = useState(false);

  const [consent, setConsent] = useState(false);
  const [authorityConfirmed, setAuthorityConfirmed] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [signatureBlob, setSignatureBlob] = useState<Blob | File | null>(null);
  const [signSubmitting, setSignSubmitting] = useState(false);
  const [signError, setSignError] = useState("");
  const [contactOpen, setContactOpen] = useState(false);
  const [signingPreviewOpen, setSigningPreviewOpen] = useState(false);

  async function handleUnlock() {
    if (!email.trim()) return;
    setLoading(true);
    setEmailError("");
    try {
      const data = await getContractForSigning(contractId, email.trim());
      setView(data);
      setSignerName((prev) => prev || "");
      setStep("view");
    } catch (e: any) {
      setEmailError(e?.message?.includes("permission-denied") || e?.code === "functions/permission-denied"
        ? "이메일이 계약서 담당자 정보와 일치하지 않습니다."
        : "계약 정보를 확인할 수 없습니다. 링크와 이메일을 다시 확인해주세요.");
    } finally {
      setLoading(false);
    }
  }

  // "계약" 메뉴(자기 회사에 연결된 목록)를 통해 로그인한 상태로 들어온 경우, 이미 계정
  // 자체가 본인확인이나 마찬가지라 이메일을 또 입력하게 하지 않는다 — 로그인 계정의 이메일이
  // 실제 계약 담당자 이메일과 일치할 때만(다른 담당자로 등록된 계약이면) 자동으로 열리고,
  // 안 맞으면 조용히 원래대로 이메일 입력 화면에 남는다.
  useEffect(() => {
    if (!appUser?.email || step !== "email") return;
    setEmail(appUser.email);
    getContractForSigning(contractId, appUser.email)
      .then((data) => {
        setView(data);
        setSignerName((prev) => prev || "");
        setStep("view");
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUser?.email, contractId]);

  async function handleSubmitRevision() {
    if (!revisionBodyText.trim()) return;
    setRevisionSubmitting(true);
    try {
      await requestContractRevision(contractId, email.trim(), revisionBodyText);
      setStep("revision_sent");
    } finally {
      setRevisionSubmitting(false);
    }
  }

  async function handleSubmitSignature() {
    if (!consent || !authorityConfirmed || !signerName.trim() || !signatureBlob) return;
    setSignSubmitting(true);
    setSignError("");
    try {
      const signatureDataUrl = await blobToDataUrl(signatureBlob);
      await submitContractSignature({
        contractId,
        email: email.trim(),
        signerName: signerName.trim(),
        signerTitle: signerTitle.trim() || undefined,
        authorityConfirmed: true,
        signatureDataUrl,
        consentAcknowledged: true,
      });
      setStep("done");
    } catch (e) {
      setSignError("서명 제출 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSignSubmitting(false);
    }
  }

  // "크게 편집"(관리자 편집 화면)과 동일한 A4 페이지 편집기를 그대로 써서, 고객이 계약서를
  // 직접 고쳐 수정 요청을 보낼 수 있게 한다 — 좁은 카드 레이아웃 밖으로 전체화면으로 띄운다.
  if (step === "revision" && view) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-[#e5e5e5]">
        <div className="border-b border-[#d1d1d6] bg-white px-4 py-3">
          <h1 className="text-sm font-semibold text-[#1d1d1f]">수정 요청 — 계약서 직접 수정</h1>
          <p className="mt-0.5 text-xs text-[#86868b]">
            바꾸고 싶은 부분을 아래에서 직접 고쳐주세요. 새로 쓴 내용은 <span className="font-medium text-red-500">빨간 글자</span>로 표시되어
            담당자가 바로 알아볼 수 있어요.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ContractBodyEditor
            pageStyle
            contractId={contractId}
            value={revisionBodyText}
            onChange={setRevisionBodyText}
            hideImageButton
            markInsertions
          />
        </div>
        <div className="flex gap-2 border-t border-[#d1d1d6] bg-white p-3">
          <button
            onClick={() => setStep("view")}
            className="flex-1 rounded-full border border-[#d1d1d6] py-2.5 text-sm font-medium text-[#1d1d1f] transition hover:border-[#86868b]"
          >
            뒤로
          </button>
          <button
            onClick={handleSubmitRevision}
            disabled={revisionSubmitting || !revisionBodyText.trim()}
            className="flex-1 rounded-full bg-[#1d1d1f] py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
          >
            {revisionSubmitting ? "전송 중..." : "요청 보내기"}
          </button>
        </div>
      </div>
    );
  }

  // previewOpen이면 모달로 겹쳐 보여주는 대신 이 화면 내용 자체를 미리보기로 완전히
  // 대체한다 — position:fixed 모달을 쓰지 않아야 인쇄가 실제 화면 그대로 정확하게 나뉜다.
  if (signingPreviewOpen && view) {
    return (
      <ContractPreviewModal
        noAppChrome
        onClose={() => setSigningPreviewOpen(false)}
        data={{
          title: view.title,
          companyName: view.companyName,
          productName: view.productName,
          contactName: view.contactName,
          amount: view.amount,
          currency: view.currency,
          vatApplicable: view.vatApplicable,
          periodStart: view.periodStart,
          periodEnd: view.periodEnd,
          paymentTerms: view.paymentTerms,
          handyhandIsGap: view.handyhandIsGap,
          bodyText: view.bodyText,
          attachments: view.attachments,
          contentHash: view.contentHash,
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] px-4 py-10">
      <div className="mx-auto max-w-xl">
        {appUser && (
          <Link
            href={appUser.role === "admin" ? "/contracts" : "/my-contracts"}
            className="mb-4 inline-flex items-center gap-1 text-sm text-[#86868b] transition hover:text-[#1d1d1f]"
          >
            <ArrowLeft size={16} /> {appUser.role === "admin" ? "계약 관리로" : "내 계약으로"}
          </Link>
        )}
        <div className="mb-6 text-center">
          <Image src="/handyworks-logo.png" alt="HandyWorks" width={128} height={38} className="mx-auto" style={{ objectFit: "contain", filter: "brightness(0)" }} />
        </div>

        <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-[0_2px_16px_rgba(0,0,0,0.04),0_24px_48px_rgba(0,0,0,0.06)] sm:p-8">
          {step === "email" && (
            <div className="space-y-4">
              <div>
                <h1 className="text-lg font-bold text-[#1d1d1f]">계약서 확인</h1>
                <p className="mt-1 text-sm text-[#86868b]">본인 확인을 위해 계약 담당자 이메일을 입력해주세요.</p>
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
                {loading ? "확인 중..." : "확인하고 계약서 보기"}
              </button>
            </div>
          )}

          {step === "view" && view && (
            <ContractView
              view={view}
              contractId={contractId}
              email={email.trim()}
              onRequestRevision={() => { setRevisionBodyText(view.bodyText); setStep("revision"); }}
              onProceedToSign={() => setStep("signing")}
              onOpenPreview={() => setSigningPreviewOpen(true)}
            />
          )}

          {step === "revision_sent" && (
            <div className="py-6 text-center">
              <p className="text-lg font-bold text-[#1d1d1f]">요청을 전달했습니다</p>
              <p className="mt-2 text-sm text-[#86868b]">담당자 확인 후 수정된 계약서 링크를 다시 안내드리겠습니다.</p>
              <button
                onClick={() => setContactOpen(true)}
                className="mx-auto mt-4 rounded-full border border-[#d1d1d6] px-5 py-2 text-sm font-medium text-[#1d1d1f] transition hover:border-[#86868b]"
              >
                계약 관련 문의하기
              </button>
            </div>
          )}

          {step === "signing" && view && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-lg font-bold text-[#1d1d1f]">전자서명</h1>
                  <p className="mt-1 text-sm text-[#86868b]">아래 내용에 동의하시면 서명 후 계약이 체결됩니다.</p>
                </div>
                <button
                  onClick={() => setSigningPreviewOpen(true)}
                  className="mt-1 flex shrink-0 items-center gap-1 text-xs font-medium text-[#1d1d1f] underline underline-offset-2 hover:text-[#86868b]"
                >
                  <Maximize2 size={11} /> 계약서 다시 보기
                </button>
              </div>

              <label className="flex items-start gap-2 rounded-2xl bg-[#f5f5f7] p-3.5 text-xs text-[#1d1d1f]">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#1d1d1f]" />
                본 계약 내용을 모두 확인하였으며, 전자서명이 서면 서명과 동일한 법적 효력을 가짐에 동의합니다.
              </label>

              <label className="flex items-start gap-2 rounded-2xl bg-[#f5f5f7] p-3.5 text-xs text-[#1d1d1f]">
                <input type="checkbox" checked={authorityConfirmed} onChange={(e) => setAuthorityConfirmed(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#1d1d1f]" />
                본인은 위 회사를 대표하여 본 계약을 체결할 권한이 있는 자(대표자 또는 정당하게 위임받은 자)임을 확인합니다.
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs text-[#86868b]">서명자 이름</label>
                  <input
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="예: 홍길동"
                    className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2.5 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-[#86868b]">직위/직책 (선택)</label>
                  <input
                    value={signerTitle}
                    onChange={(e) => setSignerTitle(e.target.value)}
                    placeholder="예: 대표이사"
                    className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2.5 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
                  />
                </div>
              </div>

              <SignaturePad onChange={setSignatureBlob} />

              {signError && <p className="text-xs text-red-500">{signError}</p>}

              <div className="flex gap-2">
                <button
                  onClick={() => setStep("view")}
                  className="flex-1 rounded-full border border-[#d1d1d6] py-2.5 text-sm font-medium text-[#1d1d1f] transition hover:border-[#86868b]"
                >
                  뒤로
                </button>
                <button
                  onClick={handleSubmitSignature}
                  disabled={signSubmitting || !consent || !authorityConfirmed || !signerName.trim() || !signatureBlob}
                  className="flex-1 rounded-full bg-[#1d1d1f] py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
                >
                  {signSubmitting ? "제출 중..." : "동의하고 서명 제출"}
                </button>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="py-6 text-center">
              <p className="text-lg font-bold text-[#1d1d1f]">서명이 완료되었습니다</p>
              <p className="mt-2 text-sm text-[#86868b]">계약이 정상적으로 체결되었습니다. 곧 담당자가 계정 안내 이메일을 보내드릴 예정입니다.</p>
              <button
                onClick={() => setContactOpen(true)}
                className="mx-auto mt-4 rounded-full border border-[#d1d1d6] px-5 py-2 text-sm font-medium text-[#1d1d1f] transition hover:border-[#86868b]"
              >
                계약 관련 문의하기
              </button>
            </div>
          )}
        </div>
      </div>

      {contactOpen && (
        <ContactModal
          onClose={() => setContactOpen(false)}
          initialMessage={`[계약 문의${view?.companyName ? ` - ${view.companyName}` : ""}]\n\n`}
        />
      )}
    </div>
  );
}

function ContractView({
  view,
  contractId,
  email,
  onRequestRevision,
  onProceedToSign,
  onOpenPreview,
}: {
  view: ContractSigningView;
  contractId: string;
  email: string;
  onRequestRevision: () => void;
  onProceedToSign: () => void;
  onOpenPreview: () => void;
}) {
  const [bizRegCertFile, setBizRegCertFile] = useState<File | null>(null);
  const [certUploading, setCertUploading] = useState(false);
  const [certUploaded, setCertUploaded] = useState(view.bizRegCertUploaded);
  const [certError, setCertError] = useState("");

  async function handleUploadBizRegCert(file: File) {
    setBizRegCertFile(file);
    setCertUploading(true);
    setCertError("");
    try {
      const dataUrl = await blobToDataUrl(file);
      await uploadContractBizRegCert(contractId, email, dataUrl);
      setCertUploaded(true);
    } catch (e) {
      setCertError("첨부 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setCertUploading(false);
    }
  }

  if (view.status === "revision_requested") {
    return (
      <div className="py-6 text-center">
        <p className="text-lg font-bold text-[#1d1d1f]">검토 중입니다</p>
        <p className="mt-2 text-sm text-[#86868b]">보내주신 수정 요청을 담당자가 확인하고 있습니다. 수정된 계약서가 준비되면 다시 안내드리겠습니다.</p>
      </div>
    );
  }
  if (view.status === "signed" || view.status === "linked") {
    return (
      <div className="space-y-4 py-6">
        <div className="text-center">
          <p className="text-lg font-bold text-[#1d1d1f]">이미 서명 완료된 계약입니다</p>
          <p className="mt-2 text-sm text-[#86868b]">
            {view.signedAt ? new Date(view.signedAt).toLocaleString("ko-KR") : ""}에 서명이 완료되었습니다.
          </p>
          <button
            onClick={onOpenPreview}
            className="mx-auto mt-5 flex items-center gap-1.5 rounded-full bg-[#1d1d1f] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black"
          >
            <Maximize2 size={14} /> 계약서 보기
          </button>
          <p className="mt-3 text-xs leading-relaxed text-[#86868b]">
            계약서 원본은 위 버튼으로 언제든 다시 확인하실 수 있습니다. PDF로 저장해 보관하시는 것을 권장드립니다.
          </p>
        </div>

        {(view.signerName || view.contentHash) && (
          <div className="space-y-1 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-left text-xs text-[#1d1d1f]">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">서명 증빙 정보</p>
            {view.signerName && (
              <p>서명자: {view.signerName}{view.signerTitle ? ` (${view.signerTitle})` : ""}</p>
            )}
            {view.signedAt && <p>서명 일시: {new Date(view.signedAt).toLocaleString("ko-KR")}</p>}
            {view.signerIp && <p>접속 IP: {view.signerIp}</p>}
            {view.signerUserAgent && <p className="break-all">기기 정보: {view.signerUserAgent}</p>}
            {view.contentHash && <p className="break-all text-[#86868b]">본문 해시(SHA-256): {view.contentHash}</p>}
          </div>
        )}
      </div>
    );
  }
  if (view.status === "draft") {
    return (
      <div className="py-6 text-center">
        <p className="text-lg font-bold text-[#1d1d1f]">아직 발송되지 않은 계약입니다</p>
        <p className="mt-2 text-sm text-[#86868b]">담당자에게 문의해주세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-[#1d1d1f]">{view.title}</h1>
        <p className="mt-1 text-sm text-[#86868b]">{view.companyName} · {view.productName || view.contactName}</p>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-2xl bg-[#f5f5f7] p-4 text-xs">
        <p className="text-[#86868b]">계약금액</p>
        <p className="text-[#1d1d1f]">{formatMoney(view.amount, view.currency)}{view.vatApplicable ? " (VAT별도)" : ""}</p>
        {(view.periodStart || view.periodEnd) && (
          <>
            <p className="text-[#86868b]">용역기간</p>
            <p className="text-[#1d1d1f]">{view.periodStart || "-"} ~ {view.periodEnd || "-"}</p>
          </>
        )}
        {view.paymentTerms && (
          <>
            <p className="text-[#86868b]">대금지급</p>
            <p className="whitespace-pre-wrap text-[#1d1d1f]">{view.paymentTerms}</p>
          </>
        )}
      </div>

      <div>
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
              지금 첨부해주시면 계약 후 계정 발급이 더 빨라져요 (나중에 이메일로 보내주셔도 됩니다)
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

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-xs text-[#86868b]">
            계약서 본문{view.attachments.length > 0 ? ` · 별첨 ${view.attachments.length}건` : ""}
          </p>
          <button
            type="button"
            onClick={onOpenPreview}
            className="flex items-center gap-1 text-xs font-medium text-[#1d1d1f] underline underline-offset-2 hover:text-[#86868b]"
          >
            <Maximize2 size={11} /> 크게 보기
          </button>
        </div>
        <div
          className="tiptap-content max-h-96 overflow-y-auto rounded-2xl border border-[#e5e5e5] p-4 text-xs leading-relaxed text-[#1d1d1f]"
          dangerouslySetInnerHTML={{ __html: sanitizeContractHtml(plainTextToHtml(view.bodyText)) }}
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={onRequestRevision}
          className="flex-1 rounded-full border border-[#d1d1d6] py-2.5 text-sm font-medium text-[#1d1d1f] transition hover:border-[#86868b]"
        >
          수정 요청하기
        </button>
        <button
          onClick={onProceedToSign}
          className="flex-1 rounded-full bg-[#1d1d1f] py-2.5 text-sm font-semibold text-white transition hover:bg-black"
        >
          동의하고 서명하기
        </button>
      </div>
    </div>
  );
}
