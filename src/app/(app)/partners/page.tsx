"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Trash2, KeyRound } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listenPartners, updatePartnerBrandName } from "@/lib/firestore/users";
import { listenAllProjects } from "@/lib/firestore/projects";
import { listenClients } from "@/lib/firestore/clients";
import { createPartnerAccount, updatePartnerProjects, deleteClientAccount, sendPasswordResetEmail, setUserPasswordDirectly } from "@/lib/functions";
import { AppUser, Project, Client } from "@/lib/types";
import SupplierOrdersTab from "@/components/SupplierOrdersTab";
import SupplierInvoicesTab from "@/components/SupplierInvoicesTab";
import SupplierQuotesTab from "@/components/SupplierQuotesTab";

// 중국 파트너 공장 등 제조 협력사 계정 — 지정된 프로젝트의 일정·업무·첨부 자료·코멘트만
// 보여주고, 계약·견적 등 고객 쪽 데이터는 애초에 접근 경로가 없다(firestore.rules). 협력사와
// 관련된 화면(계정, 구매 발주, 청구서, 견적서)을 전부 이 안에 모아서, 고객 쪽 발주 관리
// 화면과 섞이지 않게 한다.
export default function PartnersPage() {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin";
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"accounts" | "supplier" | "supplierInvoices" | "supplierQuotes">(() => {
    const t = searchParams.get("tab");
    return t === "supplier" || t === "supplierInvoices" || t === "supplierQuotes" ? t : "accounts";
  });
  // 구매발주서 미리보기 중에는 위 헤더·탭을 감춰서 A4 문서만 꽉 차게 보이게 한다.
  const [supplierPreviewing, setSupplierPreviewing] = useState(false);

  const [partners, setPartners] = useState<AppUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [partnerLang, setPartnerLang] = useState<"ko" | "zh">("ko");
  const [brandName, setBrandName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [passwordTarget, setPasswordTarget] = useState<AppUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [settingPassword, setSettingPassword] = useState(false);
  const [sendingResetEmail, setSendingResetEmail] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    const unsub1 = listenPartners(setPartners);
    const unsub2 = listenAllProjects(setProjects);
    const unsub3 = listenClients(setClients);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [isAdmin]);

  const clientName = (clientId?: string) => (clientId ? clients.find((c) => c.id === clientId)?.name ?? clientId : "미지정");

  function toggleProject(id: string) {
    setSelectedProjectIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  function openCreateForm() {
    setEditingUid(null);
    setName("");
    setEmail("");
    setSelectedProjectIds([]);
    setPartnerLang("ko");
    setBrandName("");
    setError("");
    setShowForm(true);
  }

  function openEditForm(p: AppUser) {
    setEditingUid(p.uid);
    setName(p.name);
    setEmail(p.email);
    setSelectedProjectIds(p.projectIds ?? []);
    setPartnerLang(p.partnerLang ?? "ko");
    setBrandName(p.brandName ?? "");
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (selectedProjectIds.length === 0) {
      setError("볼 수 있는 프로젝트를 하나 이상 선택해주세요.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      if (editingUid) {
        await updatePartnerProjects(editingUid, selectedProjectIds, partnerLang);
        await updatePartnerBrandName(editingUid, brandName);
      } else {
        const { uid } = await createPartnerAccount({ email: email.trim(), name: name.trim(), projectIds: selectedProjectIds, partnerLang });
        if (brandName.trim()) await updatePartnerBrandName(uid, brandName);
      }
      setShowForm(false);
    } catch (err: any) {
      setError(err?.message ?? "처리 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteClientAccount(deleteTarget.uid);
    setDeleteTarget(null);
    setDeleteInput("");
  }

  function openPasswordModal(p: AppUser) {
    setPasswordTarget(p);
    setNewPassword("");
    setPasswordMsg("");
  }

  async function handleSendResetEmail() {
    if (!passwordTarget) return;
    setSendingResetEmail(true);
    setPasswordMsg("");
    try {
      await sendPasswordResetEmail(passwordTarget.email, passwordTarget.name);
      setPasswordMsg("재설정 메일을 보냈습니다.");
    } catch {
      setPasswordMsg("메일 발송에 실패했습니다.");
    } finally {
      setSendingResetEmail(false);
    }
  }

  // 이메일 재설정 링크는 Firebase가 호스팅하는 페이지라, 중국 등 일부 해외 네트워크에서는
  // 협력사가 그 링크 자체에 접속을 못 하는 경우가 있다 — 그럴 때 관리자가 여기서 새
  // 비밀번호를 직접 입력해 즉시 바꿔주면, 상대는 이메일을 열 필요 없이 그 비밀번호로
  // 바로 로그인하면 된다.
  async function handleSetPasswordDirectly() {
    if (!passwordTarget || newPassword.length < 6) return;
    setSettingPassword(true);
    setPasswordMsg("");
    try {
      await setUserPasswordDirectly(passwordTarget.uid, newPassword);
      setPasswordMsg("비밀번호가 변경됐습니다. 이 비밀번호를 협력사에게 직접 전달해주세요.");
      setNewPassword("");
    } catch {
      setPasswordMsg("비밀번호 변경에 실패했습니다.");
    } finally {
      setSettingPassword(false);
    }
  }

  if (appUser && !isAdmin) {
    return <p className="text-sm text-[#86868b]">접근 권한이 없습니다.</p>;
  }

  return (
    <div className="space-y-6">
      <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${supplierPreviewing ? "hidden" : ""}`}>
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-[#1d1d1f]">
            <span className="h-2 w-2 rounded-full bg-[#1d1d1f]" />
            협력사 관리
          </h1>
          <p className="mt-1 pl-4 text-sm text-[#86868b]">
            협력사 계정·구매 발주·청구서·견적서를 한곳에서 관리합니다. 협력사 계정에겐 계약·견적 등
            고객 쪽 데이터는 노출되지 않고, 지정된 프로젝트의 일정·업무·첨부 자료·코멘트만 보입니다.
          </p>
        </div>
        {tab === "accounts" && (
          <button
            onClick={openCreateForm}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1 self-start whitespace-nowrap rounded-full bg-[#1d1d1f] px-4 text-sm font-medium text-white transition hover:bg-black"
          >
            <Plus size={16} /> 협력사 계정 추가
          </button>
        )}
      </div>

      <div className={`flex flex-wrap gap-2 ${supplierPreviewing ? "hidden" : ""}`}>
        <div className="flex rounded-full bg-[#1d1d1f] p-1">
          <button
            onClick={() => setTab("accounts")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${tab === "accounts" ? "bg-white text-[#1d1d1f] shadow-sm" : "text-white"}`}
          >
            협력사 계정
          </button>
          <button
            onClick={() => setTab("supplier")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${tab === "supplier" ? "bg-white text-[#1d1d1f] shadow-sm" : "text-white"}`}
          >
            구매 발주
          </button>
          <button
            onClick={() => setTab("supplierInvoices")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${tab === "supplierInvoices" ? "bg-white text-[#1d1d1f] shadow-sm" : "text-white"}`}
          >
            협력사 청구서
          </button>
          <button
            onClick={() => setTab("supplierQuotes")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${tab === "supplierQuotes" ? "bg-white text-[#1d1d1f] shadow-sm" : "text-white"}`}
          >
            협력사 견적서
          </button>
        </div>
      </div>

      {tab === "supplier" && <SupplierOrdersTab onPreview={setSupplierPreviewing} />}
      {tab === "supplierInvoices" && <SupplierInvoicesTab />}
      {tab === "supplierQuotes" && <SupplierQuotesTab />}

      {tab === "accounts" && showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-3xl bg-white p-5">
          {!editingUid && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#86868b]">이름 (담당자명 또는 회사명)</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
                  placeholder="예: 란후이 공장"
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
            </>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#86868b]">업체 언어 (화면에 표시될 언어)</label>
            <div className="flex gap-2">
              {(["ko", "zh"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setPartnerLang(lang)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    partnerLang === lang ? "bg-[#1d1d1f] text-white" : "bg-[#f5f5f7] text-[#86868b] hover:bg-[#ececee]"
                  }`}
                >
                  {lang === "ko" ? "한국 업체 (한국어)" : "중국 업체 (中文)"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#86868b]">볼 수 있는 프로젝트</label>
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-[#e5e5e5] p-2">
              {projects.map((p) => (
                <label key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[#f5f5f7]">
                  <input
                    type="checkbox"
                    checked={selectedProjectIds.includes(p.id)}
                    onChange={() => toggleProject(p.id)}
                    className="h-3.5 w-3.5 accent-[#1d1d1f]"
                  />
                  <span className="text-[#1d1d1f]">{p.name}</span>
                  <span className="text-xs text-[#86868b]">{clientName(p.clientId)}</span>
                </label>
              ))}
              {projects.length === 0 && <p className="px-2 py-1.5 text-xs text-[#86868b]">등록된 프로젝트가 없습니다.</p>}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#86868b]">
              견적서·청구서 로고 영역에 표시할 회사명 (선택)
            </label>
            <input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="비워두면 기본 HANDYHAND 로고가 그대로 나옵니다"
              className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none placeholder:text-[#d1d1d6] focus:border-[#86868b]"
            />
            <p className="mt-1 text-xs text-[#d1d1d6]">
              이 협력사가 견적서·청구서를 낼 때, 상단 HANDYHAND 로고 자리에 이미지 대신 이 글자가 뜹니다.
            </p>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
            >
              {submitting ? "저장 중..." : editingUid ? "프로젝트 범위 저장" : "계정 생성"}
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

      {tab === "accounts" && (
      <>
      <div className="space-y-2">
        {partners.map((p) => (
          <div key={p.uid} className="rounded-3xl bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 font-medium text-[#1d1d1f]">
                  {p.name}
                  <span className="rounded-full bg-[#f5f5f7] px-2 py-0.5 text-[10px] font-medium text-[#86868b]">
                    {p.partnerLang === "zh" ? "中文" : "한국어"}
                  </span>
                </p>
                <p className="text-xs text-[#86868b]">{p.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => openPasswordModal(p)}
                  title="비밀번호 관리"
                  className="rounded-full p-2 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                >
                  <KeyRound size={15} />
                </button>
                <button
                  onClick={() => setDeleteTarget(p)}
                  title="계정 삭제"
                  className="rounded-full p-2 text-[#86868b] hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {/* 프로젝트가 삭제되면 이름을 찾을 수 없어 원본 ID가 그대로 보였다 — 지워진
                  프로젝트는 뱃지 자체를 숨긴다(데이터는 그대로 두고 화면에서만 거른다). */}
              {(p.projectIds ?? [])
                .map((pid) => projects.find((pr) => pr.id === pid))
                .filter((proj): proj is Project => !!proj)
                .map((proj) => (
                  <span key={proj.id} className="rounded-full bg-[#f5f5f7] px-2.5 py-0.5 text-xs text-[#86868b]">
                    {proj.name}
                  </span>
                ))}
              {(p.projectIds ?? []).filter((pid) => projects.some((pr) => pr.id === pid)).length === 0 && (
                <span className="text-xs text-[#86868b]">지정된 프로젝트가 없습니다.</span>
              )}
            </div>
            <button
              onClick={() => openEditForm(p)}
              className="mt-3 text-xs font-medium text-[#1d1d1f] underline underline-offset-2 hover:text-[#86868b]"
            >
              프로젝트 범위 수정
            </button>
          </div>
        ))}
        {partners.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#d1d1d6] bg-white py-16 text-center">
            <p className="text-sm text-[#86868b]">등록된 협력사 계정이 없습니다.</p>
          </div>
        )}
      </div>

      {passwordTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPasswordTarget(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-[#1d1d1f]">{passwordTarget.name} 비밀번호 관리</p>

            <div className="space-y-2 rounded-2xl bg-[#f5f5f7] p-4">
              <p className="text-sm text-[#1d1d1f]">이메일로 재설정 링크 보내기</p>
              <p className="text-xs text-[#86868b]">기본 방식 — 협력사가 메일의 링크를 열어 직접 비밀번호를 설정합니다.</p>
              <button
                onClick={handleSendResetEmail}
                disabled={sendingResetEmail}
                className="w-full rounded-full border border-[#d1d1d6] bg-white py-2 text-sm font-medium text-[#1d1d1f] transition hover:border-[#86868b] disabled:opacity-50"
              >
                {sendingResetEmail ? "발송 중..." : "재설정 메일 보내기"}
              </button>
            </div>

            <div className="space-y-2 rounded-2xl bg-[#f5f5f7] p-4">
              <p className="text-sm text-[#1d1d1f]">비밀번호 직접 설정</p>
              <p className="text-xs text-[#86868b]">
                중국 등 일부 해외 네트워크에서는 재설정 메일의 링크(Firebase 호스팅)에 접속이 안 될 수 있습니다 —
                그런 경우 여기서 새 비밀번호를 직접 정해서 협력사에게 알려주세요.
              </p>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="새 비밀번호 (6자 이상)"
                className="w-full rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-sm focus:border-[#86868b] focus:outline-none"
              />
              <button
                onClick={handleSetPasswordDirectly}
                disabled={settingPassword || newPassword.length < 6}
                className="w-full rounded-full bg-[#1d1d1f] py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-40"
              >
                {settingPassword ? "변경 중..." : "이 비밀번호로 바로 설정"}
              </button>
            </div>

            {passwordMsg && <p className="text-xs text-[#1d1d1f]">{passwordMsg}</p>}

            <div className="flex justify-end">
              <button onClick={() => setPasswordTarget(null)} className="rounded-full border border-[#d1d1d6] px-4 py-2 text-sm text-[#1d1d1f]">닫기</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-[#1d1d1f]">협력사 계정 삭제</p>
            <p className="text-sm text-[#86868b]">
              <b className="text-[#1d1d1f]">{deleteTarget.name}</b> 계정을 삭제합니다. 삭제하면 복구할 수 없습니다. 계속하려면 아래에 <span className="font-semibold text-red-500">바로삭제</span>를 입력하세요.
            </p>
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
                disabled={deleteInput !== "바로삭제"}
                className="rounded-full bg-red-500 px-4 py-2 text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
