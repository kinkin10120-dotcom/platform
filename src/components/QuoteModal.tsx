"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { formatPhoneInput } from "@/lib/formatInput";

type Lang = "ko" | "en";

// /api/quote는 관리자(한국어 사용자)에게 이메일을 보내는 용도라 이메일 템플릿 자체는 항상
// 한국어로 유지한다 — ContactModal과 같은 이유.
const COUNTRY_CODES: { code: string; name: string; dial: string }[] = [
  { code: "US", name: "United States", dial: "+1" },
  { code: "CA", name: "Canada", dial: "+1" },
  { code: "GB", name: "United Kingdom", dial: "+44" },
  { code: "AU", name: "Australia", dial: "+61" },
  { code: "DE", name: "Germany", dial: "+49" },
  { code: "FR", name: "France", dial: "+33" },
  { code: "JP", name: "Japan", dial: "+81" },
  { code: "CN", name: "China", dial: "+86" },
  { code: "SG", name: "Singapore", dial: "+65" },
  { code: "HK", name: "Hong Kong", dial: "+852" },
  { code: "AE", name: "United Arab Emirates", dial: "+971" },
  { code: "AR", name: "Argentina", dial: "+54" },
  { code: "AT", name: "Austria", dial: "+43" },
  { code: "BE", name: "Belgium", dial: "+32" },
  { code: "BR", name: "Brazil", dial: "+55" },
  { code: "CH", name: "Switzerland", dial: "+41" },
  { code: "CL", name: "Chile", dial: "+56" },
  { code: "CO", name: "Colombia", dial: "+57" },
  { code: "CZ", name: "Czech Republic", dial: "+420" },
  { code: "DK", name: "Denmark", dial: "+45" },
  { code: "EG", name: "Egypt", dial: "+20" },
  { code: "ES", name: "Spain", dial: "+34" },
  { code: "FI", name: "Finland", dial: "+358" },
  { code: "GR", name: "Greece", dial: "+30" },
  { code: "ID", name: "Indonesia", dial: "+62" },
  { code: "IE", name: "Ireland", dial: "+353" },
  { code: "IL", name: "Israel", dial: "+972" },
  { code: "IN", name: "India", dial: "+91" },
  { code: "IT", name: "Italy", dial: "+39" },
  { code: "MX", name: "Mexico", dial: "+52" },
  { code: "MY", name: "Malaysia", dial: "+60" },
  { code: "NL", name: "Netherlands", dial: "+31" },
  { code: "NO", name: "Norway", dial: "+47" },
  { code: "NZ", name: "New Zealand", dial: "+64" },
  { code: "PH", name: "Philippines", dial: "+63" },
  { code: "PL", name: "Poland", dial: "+48" },
  { code: "PT", name: "Portugal", dial: "+351" },
  { code: "RO", name: "Romania", dial: "+40" },
  { code: "SA", name: "Saudi Arabia", dial: "+966" },
  { code: "SE", name: "Sweden", dial: "+46" },
  { code: "TH", name: "Thailand", dial: "+66" },
  { code: "TR", name: "Turkey", dial: "+90" },
  { code: "TW", name: "Taiwan", dial: "+886" },
  { code: "VN", name: "Vietnam", dial: "+84" },
  { code: "ZA", name: "South Africa", dial: "+27" },
  { code: "KR", name: "South Korea", dial: "+82" },
  { code: "OTHER", name: "Other", dial: "" },
];

const CONTENT = {
  ko: {
    stages: ["올인원", "디자인", "기구설계", "시제품", "금형", "양산", "상세페이지 제작", "크라우드펀딩 컨설팅"],
    allInOne: "올인원",
    sendError: "전송 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
    doneTitle: "감사합니다",
    doneMessage: (<>견적 요청이 접수되었습니다.<br />담당자가 확인 후 빠르게 연락드리겠습니다.</>),
    close: "닫기",
    kicker: "Quote Request",
    title: "견적 요청",
    nameLabel: "이름 *",
    namePlaceholder: "홍길동",
    companyLabel: "회사 / 브랜드명 *",
    companyPlaceholder: "(주)회사이름",
    emailLabel: "이메일 *",
    emailPlaceholder: "you@company.com",
    phoneLabel: "연락처 *",
    phonePlaceholder: "010-0000-0000",
    stageLabel: "개발 단계 (다중 선택 가능)",
    descriptionLabel: "제품 개요 *",
    descriptionPlaceholder: "어떤 제품을 개발하고 싶으신지 간략히 설명해주세요.",
    attachLabel: "자료 첨부",
    attachHint: "(선택 · PDF, 이미지, PPT 등 · 전체 4MB 이하)",
    attachedCount: (n: number) => `📎 ${n}개 파일 첨부됨 · 클릭하여 추가`,
    attachPrompt: "파일을 선택하거나 클릭하여 추가",
    attachOverflowPrefix: "4MB가 넘는 자료는",
    attachOverflowSuffix: "으로 바로 보내주세요.",
    attachTooBig: "첨부 파일은 전체 4MB 이하만 가능합니다. 위 이메일 주소로 별도 전달해주세요.",
    consentPrefix: "개인정보 수집·이용에 동의합니다 (필수) — 수집 항목: 이름, 이메일, 연락처, 회사명 / 목적: 견적 상담 및 회신 / 보유기간: 처리 목적 달성 후 1년.",
    consentDetail: "자세히 보기",
    submitting: "전송 중...",
    submit: "견적 요청 보내기",
  },
  en: {
    stages: ["All-in-One", "Design", "Engineering", "Prototype", "Tooling", "Mass Production", "Landing Page Design", "Crowdfunding Consulting"],
    allInOne: "All-in-One",
    sendError: "Something went wrong while sending. Please try again shortly.",
    doneTitle: "Thank You",
    doneMessage: (<>Your quote request has been received.<br />Our team will review it and get back to you shortly.</>),
    close: "Close",
    kicker: "Quote Request",
    title: "Request a Quote",
    nameLabel: "Name *",
    namePlaceholder: "Jane Doe",
    companyLabel: "Company / Brand *",
    companyPlaceholder: "Your Company Inc.",
    emailLabel: "Email *",
    emailPlaceholder: "you@company.com",
    phoneLabel: "Phone *",
    phonePlaceholder: "555 000 0000",
    stageLabel: "Development Stage (select all that apply)",
    descriptionLabel: "Product Overview *",
    descriptionPlaceholder: "Briefly describe the product you'd like to develop.",
    attachLabel: "Attachments",
    attachHint: "(optional · PDF, images, PPT, etc. · 4MB total max)",
    attachedCount: (n: number) => `📎 ${n} file${n === 1 ? "" : "s"} attached · Click to add more`,
    attachPrompt: "Select files or click to add",
    attachOverflowPrefix: "For files over 4MB, please email them directly to",
    attachOverflowSuffix: ".",
    attachTooBig: "Attachments must total 4MB or less. Please send larger files to the email address above.",
    consentPrefix: "I consent to the collection and use of my personal information (required) — Items: name, email, phone, company / Purpose: quote consultation and response / Retention: 1 year after purpose is fulfilled.",
    consentDetail: "Learn more",
    submitting: "Sending...",
    submit: "Send Quote Request",
  },
};

// Vercel 서버리스 함수는 요청 본문 크기가 4.5MB를 넘으면 무조건 실패한다(플랜과 무관한
// 플랫폼 제약이라 서버 코드로는 못 늘림) — multipart 오버헤드와 다른 폼 필드까지 감안해
// 여유 있게 4MB로 클라이언트에서 미리 막는다. 안 그러면 제출이 조용히 실패하고 사용자는
// 왜 안 되는지 전혀 알 수 없다.
const MAX_TOTAL_FILE_BYTES = 4 * 1024 * 1024;

export function QuoteModal({
  onClose, prefillDescription, initialStage, lang = "ko",
}: { onClose: () => void; prefillDescription?: string; initialStage?: string; lang?: Lang }) {
  const t = CONTENT[lang];
  const [form, setForm] = useState({
    name: "", company: "", email: "", phone: "", description: prefillDescription ?? "", stage: initialStage ?? "",
  });
  const [country, setCountry] = useState("US");
  const [files, setFiles] = useState<File[]>([]);
  const [fileTooBig, setFileTooBig] = useState(false);
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    trackEvent("form_start", { form: "quote", page: window.location.pathname });
    return () => { document.body.style.overflow = ""; };
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const selectedStages = form.stage ? form.stage.split(", ") : [];
  // "올인원"/"All-in-One"은 다른 단계와 동시에 선택할 수 없는 단독 선택지라, 고르면 나머지를
  // 모두 비우고 반대로 다른 단계를 고르면 자동으로 해제한다 — 그 외 단계끼리는 자유 다중 선택.
  function toggleStage(s: string) {
    setForm((f) => {
      const current = f.stage ? f.stage.split(", ") : [];
      if (s === t.allInOne) {
        return { ...f, stage: current.includes(t.allInOne) ? "" : t.allInOne };
      }
      const rest = current.filter((x) => x !== t.allInOne);
      const next = rest.includes(s) ? rest.filter((x) => x !== s) : [...rest, s];
      return { ...f, stage: next.join(", ") };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    try {
      const dial = COUNTRY_CODES.find((c) => c.code === country)?.dial ?? "";
      const phone = lang === "en" && dial ? `${dial} ${form.phone}`.trim() : form.phone;
      const fd = new FormData();
      Object.entries({ ...form, phone }).forEach(([k, v]) => fd.append(k, v));
      files.forEach((f) => fd.append("files", f));
      const res = await fetch("/api/quote", { method: "POST", body: fd });
      if (!res.ok) throw new Error("전송 실패");
      trackEvent("generate_lead", { form: "quote", stage: form.stage || undefined });
      setDone(true);
    } catch (e) {
      setSubmitError(t.sendError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-0 pb-0 backdrop-blur-sm sm:items-center sm:px-4 sm:pb-4">
      <div className="no-scrollbar relative w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl sm:p-8 max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute right-5 top-5 rounded-full p-1.5 text-[#86868b] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]">
          <X size={18} />
        </button>

        {done ? (
          <div className="py-8 text-center">
            <p className="text-2xl font-bold text-[#1d1d1f]">{t.doneTitle}</p>
            <p className="mt-3 text-sm text-[#86868b]">{t.doneMessage}</p>
            <button onClick={onClose} className="mt-8 rounded-full bg-black px-8 py-3 text-sm font-medium text-white transition hover:bg-[#1d1d1f]">
              {t.close}
            </button>
          </div>
        ) : (
          <>
            <div className="border-b border-[#f0f0f0] pb-4 mb-6">
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#86868b]">{t.kicker}</p>
              <h2 className="text-2xl font-bold text-[#1d1d1f]">{t.title}</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#86868b]">{t.nameLabel}</label>
                  <input required value={form.name} onChange={set("name")} placeholder={t.namePlaceholder}
                    className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2.5 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#86868b]">{t.companyLabel}</label>
                  <input required value={form.company} onChange={set("company")} placeholder={t.companyPlaceholder}
                    className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2.5 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#86868b]">{t.emailLabel}</label>
                  <input required type="email" value={form.email} onChange={set("email")} placeholder={t.emailPlaceholder}
                    className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2.5 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#86868b]">{t.phoneLabel}</label>
                  {lang === "en" ? (
                    <div className="flex gap-1.5">
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="w-[88px] shrink-0 rounded-xl border border-[#d1d1d6] px-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.code} value={c.code}>{c.dial ? `${c.name} (${c.dial})` : c.name}</option>
                        ))}
                      </select>
                      <input
                        required
                        value={form.phone}
                        onChange={set("phone")}
                        placeholder={t.phonePlaceholder}
                        className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2.5 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]" />
                    </div>
                  ) : (
                    <input
                      required
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: formatPhoneInput(e.target.value) }))}
                      placeholder={t.phonePlaceholder}
                      className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2.5 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]" />
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#86868b]">{t.stageLabel}</label>
                <div className="flex gap-2 flex-wrap">
                  {t.stages.map((s) => (
                    <button key={s} type="button" onClick={() => toggleStage(s)}
                      className={`rounded-full border px-4 py-1.5 text-sm transition ${
                        selectedStages.includes(s)
                          ? "border-black bg-black text-white"
                          : "border-[#d1d1d6] text-[#86868b] hover:border-[#86868b] hover:text-[#1d1d1f]"
                      }`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#86868b]">{t.descriptionLabel}</label>
                <textarea required value={form.description} onChange={set("description")} rows={4}
                  placeholder={t.descriptionPlaceholder}
                  className="w-full resize-none rounded-xl border border-[#d1d1d6] px-3 py-2.5 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]" />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#86868b]">{t.attachLabel} <span className="font-normal text-[#d1d1d6]">{t.attachHint}</span></label>
                <label className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3 transition ${files.length > 0 ? "border-[#1d1d1f] bg-[#f5f5f7]" : "border-[#d1d1d6] hover:border-[#86868b]"}`}>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.zip,.stp,.step,.dxf,.dwg"
                    onChange={(e) => {
                      const newFiles = Array.from(e.target.files ?? []);
                      setFileTooBig(false);
                      setFiles((prev) => {
                        const names = new Set(prev.map((f) => f.name));
                        const merged = [...prev, ...newFiles.filter((f) => !names.has(f.name))];
                        const totalBytes = merged.reduce((sum, f) => sum + f.size, 0);
                        if (totalBytes > MAX_TOTAL_FILE_BYTES) {
                          setFileTooBig(true);
                          return prev;
                        }
                        return merged;
                      });
                      e.target.value = "";
                    }}
                  />
                  <span className="text-sm text-[#86868b]">
                    {files.length > 0 ? (
                      <span className="text-[#1d1d1f]">{t.attachedCount(files.length)}</span>
                    ) : (
                      t.attachPrompt
                    )}
                  </span>
                </label>
                {files.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {files.map((f, i) => (
                      <li key={i} className="flex items-center justify-between rounded-lg bg-[#f5f5f7] px-3 py-1.5 text-xs text-[#1d1d1f]">
                        <span className="truncate">📎 {f.name} <span className="text-[#86868b]">({(f.size / 1024).toFixed(0)} KB)</span></span>
                        <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                          className="ml-3 shrink-0 text-[#86868b] hover:text-[#1d1d1f]">✕</button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-1.5 text-xs text-[#86868b]">
                  {t.attachOverflowPrefix}{" "}
                  <a href="mailto:handyhand91@naver.com" className="underline hover:text-[#1d1d1f]">handyhand91@naver.com</a>
                  {t.attachOverflowSuffix}
                </p>
                {fileTooBig && (
                  <p className="mt-1 text-xs text-red-500">
                    {t.attachTooBig}
                  </p>
                )}
              </div>

              <label className="flex items-start gap-2 text-xs text-[#86868b]">
                <input type="checkbox" required checked={agree} onChange={(e) => setAgree(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-black" />
                <span>
                  {t.consentPrefix}{" "}
                  <a href="/privacy" target="_blank" rel="noreferrer" className="underline hover:text-[#1d1d1f]">{t.consentDetail}</a>
                </span>
              </label>

              {submitError && <p className="text-xs text-red-500">{submitError}</p>}

              <button type="submit" disabled={submitting || !agree}
                className="w-full rounded-full bg-black py-3 text-sm font-semibold text-white transition hover:bg-[#1d1d1f] disabled:opacity-50">
                {submitting ? t.submitting : t.submit}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
