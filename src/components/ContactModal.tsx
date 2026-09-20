"use client";

import { useState, useEffect } from "react";
import { X, Mail, MapPin } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { formatPhoneInput } from "@/lib/formatInput";

type Lang = "ko" | "en";

// 영문 폼에서만 쓴다 — 한국어 폼은 formatPhoneInput(010-0000-0000 같은 국내 형식 고정)을
// 그대로 쓰므로 국가 선택이 필요 없다. 해외 문의는 번호 형식이 나라마다 달라 자동 하이픈
// 포맷을 적용할 수 없어서, 국가(국가번호) 선택 + 자유 입력 조합으로 대신한다.
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

// /api/contact는 관리자(한국어 사용자)에게 이메일을 보내는 용도라 이메일 템플릿 자체는
// 항상 한국어로 유지한다 — 여기서 바꾸는 건 고객이 보는 폼 화면 텍스트뿐이다. 영문 폼에서
// 고른 문의 유형(예: "Design")은 영문 그대로 관리자 메일의 "문의 유형" 칸에 들어간다.
const CONTENT = {
  ko: {
    contactTypes: ["제품개발", "디자인", "기구설계", "전자·PCBA", "금형·양산·소싱", "컨설팅", "브랜딩", "지원사업·펀딩", "기타 문의"],
    sendError: "전송 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
    kicker: "Contact Us",
    title: "문의하기",
    doneTitle: "감사합니다",
    doneMessage: (<>문의가 접수되었습니다.<br />담당자가 확인 후 빠르게 연락드리겠습니다.</>),
    contactAgain: "다시 문의하기",
    close: "닫기",
    sideHeading: (<>아이디어를<br />현실로 만들어드립니다</>),
    sideDesc: (<>제품 기획부터 설계, 금형, 양산, 납품까지<br />AI 진단과 HANDYWORKS 플랫폼으로 전 과정을 투명하게 함께합니다.</>),
    emailLabel: "이메일",
    addressLabel: "소재지",
    address: "경기도 고양시 덕양구 삼원로63 고양아크비즈F804호",
    sideTags: ["제품기획", "설계", "금형", "양산"],
    nameLabel: "이름 *",
    namePlaceholder: "홍길동",
    phoneLabel: "연락처 *",
    phonePlaceholder: "010-0000-0000",
    emailFieldLabel: "이메일 *",
    emailPlaceholder: "you@company.com",
    typeLabel: "문의 유형",
    messageLabel: "문의 내용 *",
    messagePlaceholder: "어떤 제품을 개발하고 싶으신지, 현재 단계가 어디인지 간략히 알려주세요.",
    consentPrefix: "개인정보 수집·이용에 동의합니다 (필수) — 수집 항목: 이름, 이메일, 연락처 / 목적: 문의 상담 및 회신 / 보유기간: 처리 목적 달성 후 1년.",
    consentDetail: "자세히 보기",
    submitting: "전송 중...",
    submit: "문의 보내기 →",
  },
  en: {
    contactTypes: ["Product Development", "Design", "Engineering", "Electronics · PCBA", "Tooling · Production · Sourcing", "Consulting", "Branding", "Gov't Programs & Funding", "Other"],
    sendError: "Something went wrong while sending. Please try again shortly.",
    kicker: "Contact Us",
    title: "Contact Us",
    doneTitle: "Thank You",
    doneMessage: (<>Your inquiry has been received.<br />Our team will review it and get back to you shortly.</>),
    contactAgain: "Send Another Inquiry",
    close: "Close",
    sideHeading: (<>Turning Ideas Into<br />Reality</>),
    sideDesc: (<>From product planning to design, tooling, mass production, and delivery<br />— we work with you transparently at every step, with AI diagnostics and the HANDYWORKS platform.</>),
    emailLabel: "Email",
    addressLabel: "Address",
    address: "F804, Goyang ARC Biz, 63 Samwon-ro, Deogyang-gu, Goyang-si, Gyeonggi-do, Korea",
    sideTags: ["Planning", "Design", "Tooling", "Production"],
    nameLabel: "Name *",
    namePlaceholder: "Jane Doe",
    phoneLabel: "Phone *",
    phonePlaceholder: "555 000 0000",
    emailFieldLabel: "Email *",
    emailPlaceholder: "you@company.com",
    typeLabel: "Inquiry Type",
    messageLabel: "Message *",
    messagePlaceholder: "Briefly tell us what product you'd like to develop and what stage you're at.",
    consentPrefix: "I consent to the collection and use of my personal information (required) — Items: name, email, phone / Purpose: inquiry consultation and response / Retention: 1 year after purpose is fulfilled.",
    consentDetail: "Learn more",
    submitting: "Sending...",
    submit: "Send Inquiry →",
  },
};

const inputClass =
  "w-full rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b] transition";

export function ContactModal({
  onClose, initialType, initialMessage, lang = "ko",
}: { onClose: () => void; initialType?: string; initialMessage?: string; lang?: Lang }) {
  const t = CONTENT[lang];
  const [form, setForm] = useState({ name: "", email: "", phone: "", type: initialType ?? "", message: initialMessage ?? "" });
  const [country, setCountry] = useState("US");
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    trackEvent("form_start", { form: "contact", page: window.location.pathname });
    return () => { document.body.style.overflow = ""; };
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    try {
      const dial = COUNTRY_CODES.find((c) => c.code === country)?.dial ?? "";
      const phone = lang === "en" && dial ? `${dial} ${form.phone}`.trim() : form.phone;
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, phone }),
      });
      if (!res.ok) throw new Error("전송 실패");
      trackEvent("generate_lead", { form: "contact", type: form.type || undefined });
      setDone(true);
    } catch (e) {
      setSubmitError(t.sendError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-0 pb-0 backdrop-blur-sm sm:items-center sm:px-4 sm:pb-4">
      <div className="no-scrollbar relative w-full max-w-2xl rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl max-h-[92vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#f0f0f0] bg-white px-6 py-4 sm:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#86868b]">{t.kicker}</p>
            <h2 className="text-lg font-bold text-[#1d1d1f]">{t.title}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#86868b] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 sm:p-8">
          {done ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#1d1d1f] text-white text-2xl">✓</div>
              <p className="text-xl font-bold text-[#1d1d1f]">{t.doneTitle}</p>
              <p className="mt-2 text-sm text-[#86868b]">
                {t.doneMessage}
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => { setDone(false); setForm({ name: "", email: "", phone: "", type: "", message: "" }); setAgree(false); }}
                  className="rounded-full border border-[#e5e5e5] bg-white px-6 py-2.5 text-sm font-medium text-[#1d1d1f] transition hover:border-[#86868b]"
                >
                  {t.contactAgain}
                </button>
                <button
                  onClick={onClose}
                  className="rounded-full bg-[#1d1d1f] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-black"
                >
                  {t.close}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-5">
              {/* 왼쪽 정보 */}
              <div className="hidden lg:flex lg:col-span-2 flex-col justify-between rounded-2xl bg-[#1d1d1f] p-6 text-white">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/30">HANDYHAND</p>
                  <h3 className="mb-3 text-xl font-bold leading-snug">
                    {t.sideHeading}
                  </h3>
                  <p className="text-xs leading-relaxed text-white/50">
                    {t.sideDesc}
                  </p>
                </div>
                <div className="mt-8 space-y-3 border-t border-white/10 pt-6 text-sm">
                  <div className="flex items-start gap-2">
                    <Mail size={14} className="mt-0.5 text-white/30" />
                    <div>
                      <p className="text-xs text-white/30">{t.emailLabel}</p>
                      <p className="text-xs text-white/80">handyhand91@naver.com</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="mt-0.5 text-white/30" />
                    <div>
                      <p className="text-xs text-white/30">{t.addressLabel}</p>
                      <p className="text-xs text-white/80">{t.address}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {t.sideTags.map((s) => (
                      <span key={s} className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-white/40">{s}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 폼 */}
              <div className="lg:col-span-3">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#86868b]">{t.nameLabel}</label>
                      <input required value={form.name} onChange={set("name")} placeholder={t.namePlaceholder} className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#86868b]">{t.phoneLabel}</label>
                      {lang === "en" ? (
                        <div className="flex gap-1.5">
                          <select
                            value={country}
                            onChange={(e) => setCountry(e.target.value)}
                            className="w-[92px] shrink-0 rounded-xl border border-[#e5e5e5] bg-white px-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b] transition"
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
                            className={inputClass}
                          />
                        </div>
                      ) : (
                        <input
                          required
                          value={form.phone}
                          onChange={(e) => setForm((f) => ({ ...f, phone: formatPhoneInput(e.target.value) }))}
                          placeholder={t.phonePlaceholder}
                          className={inputClass}
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#86868b]">{t.emailFieldLabel}</label>
                    <input required type="email" value={form.email} onChange={set("email")} placeholder={t.emailPlaceholder} className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#86868b]">{t.typeLabel}</label>
                    <div className="flex flex-wrap gap-2">
                      {t.contactTypes.map((ct) => (
                        <button
                          key={ct}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, type: ct }))}
                          className={`rounded-full border px-3 py-1 text-xs transition ${
                            form.type === ct
                              ? "border-[#1d1d1f] bg-[#1d1d1f] text-white"
                              : "border-[#e5e5e5] text-[#86868b] hover:border-[#86868b] hover:text-[#1d1d1f]"
                          }`}
                        >
                          {ct}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#86868b]">{t.messageLabel}</label>
                    <textarea
                      required
                      value={form.message}
                      onChange={set("message")}
                      rows={5}
                      placeholder={t.messagePlaceholder}
                      className="w-full resize-none rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b] transition"
                    />
                  </div>
                  <label className="flex items-start gap-2 text-xs text-[#86868b]">
                    <input type="checkbox" required checked={agree} onChange={(e) => setAgree(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#1d1d1f]" />
                    <span>
                      {t.consentPrefix}{" "}
                      <a href="/privacy" target="_blank" rel="noreferrer" className="underline hover:text-[#1d1d1f]">{t.consentDetail}</a>
                    </span>
                  </label>

                  {submitError && <p className="text-xs text-red-500">{submitError}</p>}

                  <button
                    type="submit"
                    disabled={submitting || !agree}
                    className="w-full rounded-full bg-[#1d1d1f] py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
                  >
                    {submitting ? t.submitting : t.submit}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
