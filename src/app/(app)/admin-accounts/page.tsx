"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, Trash2, KeyRound, ShieldCheck, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenAdmins } from "@/lib/firestore/users";
import { createAdminAccount, deleteClientAccount, sendPasswordResetEmail, cleanupSharedPushTokens } from "@/lib/functions";
import { AppUser } from "@/lib/types";

// 관리자 계정 관리 — 최초 관리자는 Firebase 콘솔에서 수동으로 만들었지만, 그 뒤로 추가하는
// 관리자는 이 화면에서 바로 만든다(콘솔에서 Auth 계정·Firestore 문서를 따로 만들다 ID가
// 어긋나는 실수를 막는다).
export default function AdminAccountsPage() {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin";

  const [admins, setAdmins] = useState<AppUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [cleaning, setCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ checkedUsers: number; sharedTokens: number; affectedUsers: number } | null>(null);
  const [cleanupError, setCleanupError] = useState("");

  async function handleCleanupPushTokens() {
    setCleaning(true);
    setCleanupError("");
    setCleanupResult(null);
    try {
      const res = await cleanupSharedPushTokens();
      setCleanupResult(res);
    } catch (err: any) {
      setCleanupError(err?.message ?? "점검 중 오류가 발생했습니다.");
    } finally {
      setCleaning(false);
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    return listenAdmins(setAdmins);
  }, [isAdmin]);

  function openCreateForm() {
    setName("");
    setEmail("");
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await createAdminAccount({ email: email.trim(), name: name.trim() });
      setShowForm(false);
    } catch (err: any) {
      setError(err?.message ?? "처리 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteClientAccount(deleteTarget.uid);
      setDeleteTarget(null);
      setDeleteInput("");
    } catch (err: any) {
      setError(err?.message ?? "삭제 중 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
    }
  }

  if (appUser && !isAdmin) {
    return <p className="text-sm text-[#86868b]">접근 권한이 없습니다.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-[#1d1d1f]">
            <span className="h-2 w-2 rounded-full bg-[#1d1d1f]" />
            관리자 계정
          </h1>
          <p className="mt-1 pl-4 text-sm text-[#86868b]">
            새 관리자 계정을 만들고 관리합니다. 관리자는 모든 고객·협력사 데이터에 접근할 수 있으니 신뢰할 수 있는 사람에게만 발급하세요.
          </p>
        </div>
        <button
          onClick={openCreateForm}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1 self-start whitespace-nowrap rounded-full bg-[#1d1d1f] px-4 text-sm font-medium text-white transition hover:bg-black"
        >
          <Plus size={16} /> 관리자 계정 추가
        </button>
      </div>

      <div className="space-y-2 rounded-3xl bg-white p-5">
        <div className="flex items-start gap-2.5">
          <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#1d1d1f]">공유된 기기 푸시 토큰 정리</p>
            <p className="mt-0.5 text-xs leading-relaxed text-[#86868b]">
              같은 브라우저에서 로그아웃 없이(또는 이 점검 로직이 생기기 전에) 다른 계정으로 전환하면, 그 기기의 푸시 토큰이 두 계정에 동시에 남아 다른 계정에게 갈 알림이 이 기기로도 함께 오는 문제가 있었습니다. 지금 한 번 실행하면 그렇게 두 계정 이상에 걸쳐 남아있는 토큰을 찾아 전부 제거합니다(해당 계정은 다음에 알림을 다시 켜면 새로 등록됩니다).
            </p>
            <button
              onClick={handleCleanupPushTokens}
              disabled={cleaning}
              className="mt-3 rounded-full border border-[#d1d1d6] px-4 py-1.5 text-xs font-medium text-[#1d1d1f] transition hover:border-[#86868b] disabled:opacity-50"
            >
              {cleaning ? "점검 중..." : "지금 점검 및 정리"}
            </button>
            {cleanupError && <p className="mt-2 text-xs text-red-500">{cleanupError}</p>}
            {cleanupResult && (
              <p className="mt-2 text-xs text-green-600">
                전체 {cleanupResult.checkedUsers}개 계정 확인 · 공유된 토큰 {cleanupResult.sharedTokens}개 · 영향받은 계정 {cleanupResult.affectedUsers}개 정리 완료
              </p>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-3xl bg-white p-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#86868b]">이름</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#86868b]">이메일 (로그인 계정)</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
            >
              {submitting ? "생성 중..." : "계정 생성"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-full border border-[#d1d1d6] px-4 py-2 text-sm text-[#1d1d1f] hover:bg-[#f5f5f7]"
            >
              취소
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {admins.map((a) => (
          <div key={a.uid} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white p-5">
            <div>
              <p className="flex items-center gap-1.5 font-medium text-[#1d1d1f]">
                <ShieldCheck size={14} className="text-[#86868b]" />
                {a.name}
                {a.uid === appUser?.uid && (
                  <span className="rounded-full bg-[#f5f5f7] px-2 py-0.5 text-[10px] font-medium text-[#86868b]">나</span>
                )}
              </p>
              <p className="text-xs text-[#86868b]">{a.email}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => sendPasswordResetEmail(a.email, a.name)}
                title="비밀번호 재설정 메일 발송"
                className="rounded-full p-2 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
              >
                <KeyRound size={15} />
              </button>
              {/* 본인 계정은 이 화면에서 못 지운다 — 실수로 자기 권한을 없애 로그인 불가 상태가
                  되는 걸 막는다. 정말 본인 계정을 지워야 하면 다른 관리자가 처리해야 한다. */}
              {a.uid !== appUser?.uid && (
                <button
                  onClick={() => setDeleteTarget(a)}
                  title="계정 삭제"
                  className="rounded-full p-2 text-[#86868b] hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
        ))}
        {admins.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#d1d1d6] bg-white py-16 text-center">
            <p className="text-sm text-[#86868b]">불러오는 중...</p>
          </div>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-[#1d1d1f]">관리자 계정 삭제</p>
            <p className="text-sm text-[#86868b]">
              <b className="text-[#1d1d1f]">{deleteTarget.name}</b> 계정을 삭제합니다. 삭제하면 복구할 수 없습니다. 계속하려면 아래에 <span className="font-semibold text-red-500">바로삭제</span>를 입력하세요.
            </p>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <input
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="바로삭제"
              className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm focus:border-[#86868b] focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="rounded-full border border-[#d1d1d6] px-4 py-2 text-sm text-[#1d1d1f]">취소</button>
              <button
                onClick={handleDelete}
                disabled={deleteInput !== "바로삭제" || deleting}
                className="rounded-full bg-red-500 px-4 py-2 text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
