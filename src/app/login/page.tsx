"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence } from "firebase/auth";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { X } from "lucide-react";
import Image from "next/image";
import { auth, db } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saveEmail, setSaveEmail] = useState(false);
  const [autoLogin, setAutoLogin] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("savedEmail");
    if (saved) { setEmail(saved); setSaveEmail(true); }
    const auto = localStorage.getItem("autoLogin");
    if (auto === "true") setAutoLogin(true);
  }, []);

  const [modalOpen, setModalOpen] = useState(false);
  const [reqName, setReqName] = useState("");
  const [reqEmail, setReqEmail] = useState("");
  const [reqCompany, setReqCompany] = useState("");
  const [reqMessage, setReqMessage] = useState("");
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqDone, setReqDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await setPersistence(auth, autoLogin ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email, password);
      if (saveEmail) { localStorage.setItem("savedEmail", email); } else { localStorage.removeItem("savedEmail"); }
      localStorage.setItem("autoLogin", String(autoLogin));
      router.replace("/home");
    } catch (err: any) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestSubmit(e: FormEvent) {
    e.preventDefault();
    setReqSubmitting(true);
    try {
      await addDoc(collection(db, "accountRequests"), {
        name: reqName,
        email: reqEmail,
        company: reqCompany,
        message: reqMessage,
        createdAt: serverTimestamp(),
        status: "pending",
      });
      setReqDone(true);
    } catch {
      // silent fail
    } finally {
      setReqSubmitting(false);
    }
  }

  function closeModal() {
    setModalOpen(false);
    setReqDone(false);
    setReqName("");
    setReqEmail("");
    setReqCompany("");
    setReqMessage("");
  }

  const inputClass =
    "w-full rounded-xl border border-[#d1d1d6] bg-white px-3 py-2.5 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b] transition";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-4 py-12">
      <button
        onClick={() => router.back()}
        className="fixed left-4 top-4 flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-medium text-[#1d1d1f] shadow-sm transition hover:bg-[#f5f5f7]"
      >
        ← 뒤로
      </button>
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="mb-6 text-center">
          <Image src="/handyworks-logo.png" alt="HandyWorks" width={148} height={44} className="mx-auto" style={{ objectFit: "contain", filter: "brightness(0)" }} />
          <p className="mt-2 text-xs text-[#86868b]">제품개발·생산 프로젝트 관리</p>
        </div>

        {/* 카드 */}
        <div className="rounded-2xl bg-white p-7 shadow-sm">
          <h1 className="mb-1 text-base font-semibold text-[#1d1d1f]">로그인</h1>
          <p className="mb-5 text-xs text-[#86868b]">프로젝트 일정·업무·자료를 한 곳에서 관리하세요.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#86868b]">이메일</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#86868b]">비밀번호</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-[#86868b]">
                <input type="checkbox" checked={saveEmail} onChange={(e) => setSaveEmail(e.target.checked)} className="h-3.5 w-3.5 rounded accent-[#1d1d1f]" />
                아이디 저장
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-[#86868b]">
                <input type="checkbox" checked={autoLogin} onChange={(e) => setAutoLogin(e.target.checked)} className="h-3.5 w-3.5 rounded accent-[#1d1d1f]" />
                자동 로그인
              </label>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-[#1d1d1f] py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
            >
              {submitting ? "로그인 중..." : "로그인"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-[#86868b]">계정이 없으신가요?</p>
            <button
              onClick={() => setModalOpen(true)}
              className="mt-1.5 text-xs font-medium text-[#1d1d1f] underline underline-offset-2 hover:text-[#86868b] transition"
            >
              계정 생성 문의하기
            </button>
          </div>
        </div>
      </div>

      {/* 계정 문의 모달 */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-0 pb-0 backdrop-blur-sm sm:items-center sm:px-4 sm:pb-4">
          <div className="relative w-full max-w-sm rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={closeModal}
              className="absolute right-5 top-5 rounded-full p-1.5 text-[#86868b] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
            >
              <X size={18} />
            </button>

            {reqDone ? (
              <div className="py-8 text-center">
                <p className="text-xl font-bold text-[#1d1d1f]">문의 완료</p>
                <p className="mt-3 text-sm text-[#86868b]">담당자가 확인 후 연락드리겠습니다.</p>
                <button
                  onClick={closeModal}
                  className="mt-8 rounded-full bg-[#1d1d1f] px-8 py-3 text-sm font-semibold text-white transition hover:bg-black"
                >
                  닫기
                </button>
              </div>
            ) : (
              <>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#86868b]">Account Request</p>
                <h2 className="mb-6 text-xl font-bold text-[#1d1d1f]">계정 생성 문의</h2>
                <form onSubmit={handleRequestSubmit} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#86868b]">이름 *</label>
                    <input
                      type="text"
                      required
                      value={reqName}
                      onChange={(e) => setReqName(e.target.value)}
                      className={inputClass}
                      placeholder="홍길동"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#86868b]">이메일 *</label>
                    <input
                      type="email"
                      required
                      value={reqEmail}
                      onChange={(e) => setReqEmail(e.target.value)}
                      className={inputClass}
                      placeholder="you@company.com"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#86868b]">회사명</label>
                    <input
                      type="text"
                      value={reqCompany}
                      onChange={(e) => setReqCompany(e.target.value)}
                      className={inputClass}
                      placeholder="(주)회사이름"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#86868b]">문의 내용</label>
                    <textarea
                      value={reqMessage}
                      onChange={(e) => setReqMessage(e.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-xl border border-[#d1d1d6] bg-white px-3 py-2.5 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b] transition"
                      placeholder="계정 생성 관련 문의사항을 입력해주세요."
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={reqSubmitting}
                    className="w-full rounded-full bg-[#1d1d1f] py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
                  >
                    {reqSubmitting ? "전송 중..." : "문의 보내기"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
