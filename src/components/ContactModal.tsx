"use client";

import { useState, useEffect } from "react";
import { X, Mail, MapPin } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

const CONTACT_TYPES = ["제품개발", "디자인", "기구설계", "전자·PCBA", "금형·양산·소싱", "컨설팅", "브랜딩", "지원사업·펀딩", "기타 문의"] as const;

const inputClass =
  "w-full rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b] transition";

export function ContactModal({ onClose, initialType }: { onClose: () => void; initialType?: string }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", type: initialType ?? "", message: "" });
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("전송 실패");
      trackEvent("generate_lead", { form: "contact", type: form.type || undefined });
      setDone(true);
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
            <p className="text-xs font-semibold uppercase tracking-widest text-[#86868b]">Contact Us</p>
            <h2 className="text-lg font-bold text-[#1d1d1f]">문의하기</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#86868b] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 sm:p-8">
          {done ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#1d1d1f] text-white text-2xl">✓</div>
              <p className="text-xl font-bold text-[#1d1d1f]">감사합니다</p>
              <p className="mt-2 text-sm text-[#86868b]">
                문의가 접수되었습니다.<br />담당자가 확인 후 빠르게 연락드리겠습니다.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => { setDone(false); setForm({ name: "", email: "", phone: "", type: "", message: "" }); setAgree(false); }}
                  className="rounded-full border border-[#e5e5e5] bg-white px-6 py-2.5 text-sm font-medium text-[#1d1d1f] transition hover:border-[#86868b]"
                >
                  다시 문의하기
                </button>
                <button
                  onClick={onClose}
                  className="rounded-full bg-[#1d1d1f] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-black"
                >
                  닫기
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
                    아이디어를<br />현실로 만들어드립니다
                  </h3>
                  <p className="text-xs leading-relaxed text-white/50">
                    제품 기획부터 설계, 금형, 양산, 납품까지<br />AI 진단과 HANDYWORKS 플랫폼으로 전 과정을 투명하게 함께합니다.
                  </p>
                </div>
                <div className="mt-8 space-y-3 border-t border-white/10 pt-6 text-sm">
                  <div className="flex items-start gap-2">
                    <Mail size={14} className="mt-0.5 text-white/30" />
                    <div>
                      <p className="text-xs text-white/30">이메일</p>
                      <p className="text-xs text-white/80">handyhand91@naver.com</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="mt-0.5 text-white/30" />
                    <div>
                      <p className="text-xs text-white/30">소재지</p>
                      <p className="text-xs text-white/80">경기도 고양시 덕양구 삼원로63 고양아크비즈F804호</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {["제품기획", "설계", "금형", "양산"].map((s) => (
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
                      <label className="mb-1.5 block text-xs font-medium text-[#86868b]">이름 *</label>
                      <input required value={form.name} onChange={set("name")} placeholder="홍길동" className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#86868b]">연락처</label>
                      <input value={form.phone} onChange={set("phone")} placeholder="010-0000-0000" className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#86868b]">이메일 *</label>
                    <input required type="email" value={form.email} onChange={set("email")} placeholder="you@company.com" className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#86868b]">문의 유형</label>
                    <div className="flex flex-wrap gap-2">
                      {CONTACT_TYPES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, type: t }))}
                          className={`rounded-full border px-3 py-1 text-xs transition ${
                            form.type === t
                              ? "border-[#1d1d1f] bg-[#1d1d1f] text-white"
                              : "border-[#e5e5e5] text-[#86868b] hover:border-[#86868b] hover:text-[#1d1d1f]"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#86868b]">문의 내용 *</label>
                    <textarea
                      required
                      value={form.message}
                      onChange={set("message")}
                      rows={5}
                      placeholder="어떤 제품을 개발하고 싶으신지, 현재 단계가 어디인지 간략히 알려주세요."
                      className="w-full resize-none rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b] transition"
                    />
                  </div>
                  <label className="flex items-start gap-2 text-xs text-[#86868b]">
                    <input type="checkbox" required checked={agree} onChange={(e) => setAgree(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#1d1d1f]" />
                    <span>
                      개인정보 수집·이용에 동의합니다 (필수) — 수집 항목: 이름, 이메일, 연락처 / 목적: 문의 상담 및 회신 / 보유기간: 처리 목적 달성 후 1년.{" "}
                      <a href="/privacy" target="_blank" rel="noreferrer" className="underline hover:text-[#1d1d1f]">자세히 보기</a>
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={submitting || !agree}
                    className="w-full rounded-full bg-[#1d1d1f] py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
                  >
                    {submitting ? "전송 중..." : "문의 보내기 →"}
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
