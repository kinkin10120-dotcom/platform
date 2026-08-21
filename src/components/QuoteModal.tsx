"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

const STAGES = ["올인원", "디자인", "기구설계", "시제품", "금형", "양산", "상세페이지 제작", "크라우드펀딩 컨설팅"] as const;

export function QuoteModal({ onClose, prefillDescription, initialStage }: { onClose: () => void; prefillDescription?: string; initialStage?: string }) {
  const [form, setForm] = useState({
    name: "", company: "", email: "", phone: "", description: prefillDescription ?? "", stage: initialStage ?? "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    trackEvent("form_start", { form: "quote", page: window.location.pathname });
    return () => { document.body.style.overflow = ""; };
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      files.forEach((f) => fd.append("files", f));
      const res = await fetch("/api/quote", { method: "POST", body: fd });
      if (!res.ok) throw new Error("전송 실패");
      trackEvent("generate_lead", { form: "quote", stage: form.stage || undefined });
      setDone(true);
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
            <p className="text-2xl font-bold text-[#1d1d1f]">감사합니다</p>
            <p className="mt-3 text-sm text-[#86868b]">견적 요청이 접수되었습니다.<br />담당자가 확인 후 빠르게 연락드리겠습니다.</p>
            <button onClick={onClose} className="mt-8 rounded-full bg-black px-8 py-3 text-sm font-medium text-white transition hover:bg-[#1d1d1f]">
              닫기
            </button>
          </div>
        ) : (
          <>
            <div className="border-b border-[#f0f0f0] pb-4 mb-6">
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#86868b]">Quote Request</p>
              <h2 className="text-2xl font-bold text-[#1d1d1f]">견적 요청</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#86868b]">이름 *</label>
                  <input required value={form.name} onChange={set("name")} placeholder="홍길동"
                    className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2.5 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#86868b]">회사 / 브랜드명</label>
                  <input value={form.company} onChange={set("company")} placeholder="(주)회사이름"
                    className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2.5 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#86868b]">이메일 *</label>
                  <input required type="email" value={form.email} onChange={set("email")} placeholder="you@company.com"
                    className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2.5 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#86868b]">연락처</label>
                  <input value={form.phone} onChange={set("phone")} placeholder="010-0000-0000"
                    className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2.5 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#86868b]">개발 단계</label>
                <div className="flex gap-2 flex-wrap">
                  {STAGES.map((s) => (
                    <button key={s} type="button" onClick={() => setForm((f) => ({ ...f, stage: s }))}
                      className={`rounded-full border px-4 py-1.5 text-sm transition ${
                        form.stage === s
                          ? "border-black bg-black text-white"
                          : "border-[#d1d1d6] text-[#86868b] hover:border-[#86868b] hover:text-[#1d1d1f]"
                      }`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#86868b]">제품 개요 *</label>
                <textarea required value={form.description} onChange={set("description")} rows={4}
                  placeholder="어떤 제품을 개발하고 싶으신지 간략히 설명해주세요."
                  className="w-full resize-none rounded-xl border border-[#d1d1d6] px-3 py-2.5 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]" />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#86868b]">자료 첨부 <span className="font-normal text-[#d1d1d6]">(선택 · PDF, 이미지, PPT 등 · 여러 파일 가능)</span></label>
                <label className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3 transition ${files.length > 0 ? "border-[#1d1d1f] bg-[#f5f5f7]" : "border-[#d1d1d6] hover:border-[#86868b]"}`}>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.zip,.stp,.step,.dxf,.dwg"
                    onChange={(e) => {
                      const newFiles = Array.from(e.target.files ?? []);
                      setFiles((prev) => {
                        const names = new Set(prev.map((f) => f.name));
                        return [...prev, ...newFiles.filter((f) => !names.has(f.name))];
                      });
                      e.target.value = "";
                    }}
                  />
                  <span className="text-sm text-[#86868b]">
                    {files.length > 0 ? (
                      <span className="text-[#1d1d1f]">📎 {files.length}개 파일 첨부됨 · 클릭하여 추가</span>
                    ) : (
                      "파일을 선택하거나 클릭하여 추가"
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
              </div>

              <label className="flex items-start gap-2 text-xs text-[#86868b]">
                <input type="checkbox" required checked={agree} onChange={(e) => setAgree(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-black" />
                <span>
                  개인정보 수집·이용에 동의합니다 (필수) — 수집 항목: 이름, 이메일, 연락처, 회사명 / 목적: 견적 상담 및 회신 / 보유기간: 처리 목적 달성 후 1년.{" "}
                  <a href="/privacy" target="_blank" rel="noreferrer" className="underline hover:text-[#1d1d1f]">자세히 보기</a>
                </span>
              </label>

              <button type="submit" disabled={submitting || !agree}
                className="w-full rounded-full bg-black py-3 text-sm font-semibold text-white transition hover:bg-[#1d1d1f] disabled:opacity-50">
                {submitting ? "전송 중..." : "견적 요청 보내기"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
