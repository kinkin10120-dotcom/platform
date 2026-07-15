"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const CONTACT_TYPES = ["제품개발", "금형·양산", "OEM 협력", "제조 컨설팅", "계정 생성", "기타 문의"] as const;

const inputClass =
  "w-full rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b] transition";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

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
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* 네비게이션 */}
      <nav className="fixed top-4 z-50 w-full px-4 sm:px-8">
        <div className="mx-auto flex max-w-md items-center justify-between rounded-full border border-[#e5e5e5] bg-white/90 px-5 py-2.5 shadow-sm backdrop-blur-xl">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium text-[#86868b] transition hover:text-[#1d1d1f]">
            <ArrowLeft size={16} />
            <img src="/logo.png" alt="HANDYHAND" className="h-4 w-auto" style={{ filter: "brightness(0)" }} />
          </Link>
          <span className="text-sm font-semibold text-[#1d1d1f]">문의하기</span>
          <div className="w-24" />
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-6 pt-28 pb-20">
        {/* 헤더 */}
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#86868b]">Contact Us</p>
          <h1 className="text-4xl font-bold text-[#1d1d1f] sm:text-5xl">문의하기</h1>
          <p className="mt-4 text-[#86868b]">어떤 단계에 있든 환영합니다. 아이디어만 있어도 괜찮습니다.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* 왼쪽 정보 카드 */}
          <div className="flex flex-col justify-between rounded-3xl bg-[#1d1d1f] p-8 text-white lg:col-span-2">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/30">HANDYHAND</p>
              <h2 className="mb-4 text-2xl font-bold leading-snug">
                아이디어를<br />현실로 만들어드립니다
              </h2>
              <p className="text-sm leading-relaxed text-white/50">
                제품 기획부터 설계, 금형, 양산, 납품까지<br />
                전 과정을 함께합니다. 어떤 단계에 있든 환영합니다.
              </p>
            </div>

            <div className="mt-10 space-y-4 border-t border-white/10 pt-8 text-sm">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-white/30">✉</span>
                <div>
                  <p className="text-xs text-white/30">이메일</p>
                  <p className="text-white/80">info@handyhand.co.kr</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-white/30">◎</span>
                <div>
                  <p className="text-xs text-white/30">소재지</p>
                  <p className="text-white/80">경기도 고양시 덕양구 삼원로63 고양아크비즈F804호</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {["제품기획", "설계", "금형", "양산"].map((s) => (
                  <span key={s} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/40">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 오른쪽 폼 */}
          <div className="rounded-3xl bg-white p-8 lg:col-span-3">
            {done ? (
              <div className="flex h-full flex-col items-center justify-center py-20 text-center">
                <p className="text-2xl font-bold text-[#1d1d1f]">감사합니다</p>
                <p className="mt-3 text-sm text-[#86868b]">
                  문의가 접수되었습니다.<br />담당자가 확인 후 빠르게 연락드리겠습니다.
                </p>
                <div className="mt-8 flex gap-3">
                  <button
                    onClick={() => { setDone(false); setForm({ name: "", email: "", phone: "", type: "", message: "" }); }}
                    className="rounded-full border border-[#e5e5e5] px-6 py-2.5 text-sm font-medium text-[#1d1d1f] transition hover:border-[#86868b]"
                  >
                    다시 문의하기
                  </button>
                  <Link
                    href="/"
                    className="rounded-full bg-[#1d1d1f] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-black"
                  >
                    홈으로
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
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
                        className={`rounded-full border px-4 py-1.5 text-sm transition ${
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
                    rows={6}
                    placeholder="어떤 제품을 개발하고 싶으신지, 현재 단계가 어디인지 간략히 알려주세요."
                    className="w-full resize-none rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b] transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full bg-[#1d1d1f] py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
                >
                  {submitting ? "전송 중..." : "문의 보내기 →"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
