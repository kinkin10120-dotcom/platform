"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, MessageCircleQuestion, Send, ChevronLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createInquiry, listenMyInquiries } from "@/lib/firestore/inquiries";
import { Inquiry } from "@/lib/types";

export default function InquiryWidget() {
  const { appUser } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "form">("list");
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!appUser) return;
    return listenMyInquiries(appUser.uid, setInquiries);
  }, [appUser]);

  async function handleSubmit() {
    if (!appUser || !title.trim() || !content.trim()) return;
    setSending(true);
    try {
      await createInquiry({
        userId: appUser.uid,
        userName: appUser.name,
        clientId: appUser.clientId,
        title: title.trim(),
        content: content.trim(),
      });
      fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: appUser.name, title: title.trim(), content: content.trim() }),
      }).catch(console.error);
      setTitle("");
      setContent("");
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setView("list");
      }, 1500);
    } finally {
      setSending(false);
    }
  }

  if (!appUser || !mounted || appUser.role === "admin") return null;

  const widget = (
    <>
      {/* 플로팅 버튼 */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 transition"
        aria-label="문의하기"
      >
        {open ? <X size={20} /> : <MessageCircleQuestion size={20} />}
      </button>

      {/* 팝업 */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-80 rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between bg-brand-600 px-4 py-3">
            <div className="flex items-center gap-2">
              {view === "form" && (
                <button onClick={() => setView("list")} className="text-white/80 hover:text-white">
                  <ChevronLeft size={18} />
                </button>
              )}
              <span className="text-sm font-semibold text-white">
                {view === "list" ? "문의 내역" : "새 문의"}
              </span>
            </div>
            {view === "list" && (
              <button
                onClick={() => setView("form")}
                className="rounded-lg bg-white/20 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/30"
              >
                + 문의하기
              </button>
            )}
          </div>

          {/* 문의 작성 폼 */}
          {view === "form" && (
            <div className="p-4 space-y-3" ref={formRef}>
              {sent ? (
                <div className="py-6 text-center text-sm text-brand-600 font-medium">
                  문의가 접수되었습니다 ✓
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">제목</label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="문의 제목을 입력하세요"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">내용</label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="문의 내용을 자세히 작성해주세요"
                      rows={5}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none resize-none"
                    />
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={sending || !title.trim() || !content.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
                  >
                    <Send size={14} />
                    {sending ? "전송 중..." : "문의 보내기"}
                  </button>
                </>
              )}
            </div>
          )}

          {/* 문의 목록 */}
          {view === "list" && (
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
              {inquiries.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  아직 접수된 문의가 없습니다.
                  <br />
                  <span className="text-xs">궁금한 점이 있으면 언제든 문의해주세요!</span>
                </div>
              ) : (
                inquiries.map((q) => (
                  <div key={q.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{q.title}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        q.status === "answered"
                          ? "bg-green-50 text-green-600"
                          : "bg-amber-50 text-amber-600"
                      }`}>
                        {q.status === "answered" ? "답변완료" : "검토중"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-1">{q.content}</p>
                    {q.answer && (
                      <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2">
                        <p className="text-xs font-medium text-gray-500 mb-0.5">답변</p>
                        <p className="text-xs text-gray-700 whitespace-pre-wrap">{q.answer}</p>
                      </div>
                    )}
                    <p className="mt-1 text-xs text-gray-300">
                      {new Date(q.createdAt).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </>
  );

  return createPortal(widget, document.body);
}
