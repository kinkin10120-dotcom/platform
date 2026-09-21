"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Plus, KeyRound, Pencil, Trash2, ImagePlus } from "lucide-react";
import KakaoMap from "@/components/KakaoMap";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listenClient, updateClient, deleteClient, uploadClientLogo } from "@/lib/firestore/clients";
import { listenProjectsByClient, createProject } from "@/lib/firestore/projects";
import { listenUsersByClient, updateUserName } from "@/lib/firestore/users";
import { listenTemplates, applyTemplateToProject } from "@/lib/firestore/templates";
import { createClientAccount, sendPasswordResetEmail, deleteClientAccount } from "@/lib/functions";
import { Client, Project, AppUser, ProjectType, PROJECT_TYPE_LABEL, ALL_PROJECT_TYPES, WorkflowTemplate } from "@/lib/types";
import { formatPhoneInput, formatBizRegNumberInput } from "@/lib/formatInput";

export default function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const { appUser } = useAuth();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);

  const [showProjectForm, setShowProjectForm] = useState(false);
  const [pName, setPName] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pType, setPType] = useState<ProjectType[]>([]);
  const [pStart, setPStart] = useState("");
  const [pEnd, setPEnd] = useState("");
  const [pTemplateId, setPTemplateId] = useState("");
  const [savingProject, setSavingProject] = useState(false);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);

  const [editClientOpen, setEditClientOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editMemo, setEditMemo] = useState("");
  const [editBizCompanyName, setEditBizCompanyName] = useState("");
  const [editBizRegNumber, setEditBizRegNumber] = useState("");
  const [editBizCeoName, setEditBizCeoName] = useState("");
  const [editBizPhone, setEditBizPhone] = useState("");
  const [editBizAddress, setEditBizAddress] = useState("");
  const [savingClient, setSavingClient] = useState(false);

  const [showUserForm, setShowUserForm] = useState(false);
  const [uName, setUName] = useState("");
  const [uEmail, setUEmail] = useState("");
  const [savingUser, setSavingUser] = useState(false);
  const [userError, setUserError] = useState("");
  const [resettingUid, setResettingUid] = useState<string | null>(null);
  const [resetSentUid, setResetSentUid] = useState<string | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<AppUser | null>(null);
  const [editingUserUid, setEditingUserUid] = useState<string | null>(null);
  const [editingUserName, setEditingUserName] = useState("");
  const [savingUserName, setSavingUserName] = useState(false);
  const [deleteUserConfirmText, setDeleteUserConfirmText] = useState("");
  const DELETE_USER_KEYWORD = "계정삭제";
  const [showDeleteClientModal, setShowDeleteClientModal] = useState(false);
  const [deleteClientConfirmText, setDeleteClientConfirmText] = useState("");
  const [deletingClient, setDeletingClient] = useState(false);
  const DELETE_CLIENT_KEYWORD = "클라이언트삭제";
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const isAdmin = appUser?.role === "admin";

  useEffect(() => {
    if (!clientId || !isAdmin) return;
    const u1 = listenClient(clientId, setClient);
    const u2 = listenProjectsByClient(clientId, setProjects);
    const u3 = listenUsersByClient(clientId, setUsers);
    const u4 = listenTemplates(setTemplates);
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [clientId, isAdmin]);

  async function handleSaveClient() {
    setSavingClient(true);
    try {
      await updateClient(clientId, {
        name: editName.trim(),
        memo: editMemo.trim(),
        bizCompanyName: editBizCompanyName.trim(),
        bizRegNumber: editBizRegNumber.trim(),
        bizCeoName: editBizCeoName.trim(),
        bizPhone: editBizPhone.trim(),
        bizAddress: editBizAddress.trim(),
      });
      setEditClientOpen(false);
    } finally {
      setSavingClient(false);
    }
  }

  async function handleCreateProject(e: FormEvent) {
    e.preventDefault();
    if (!appUser) return;
    setSavingProject(true);
    try {
      const ref = await createProject({
        clientId,
        name: pName.trim(),
        description: pDesc.trim(),
        projectType: pType.length > 0 ? pType : undefined,
        startDate: pStart,
        endDate: pEnd,
        createdBy: appUser.uid,
      });
      if (pTemplateId) {
        const template = templates.find((t) => t.id === pTemplateId);
        if (template) {
          await applyTemplateToProject(template, ref.id, clientId, pStart);
        }
      }
      setPName("");
      setPDesc("");
      setPType([]);
      setPStart("");
      setPEnd("");
      setPTemplateId("");
      setShowProjectForm(false);
    } finally {
      setSavingProject(false);
    }
  }

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    setUserError("");
    setSavingUser(true);
    try {
      await createClientAccount({ email: uEmail.trim(), name: uName.trim(), clientId });
      setUName("");
      setUEmail("");
      setShowUserForm(false);
    } catch (err: any) {
      setUserError(err?.message ?? "계정 생성에 실패했습니다. Cloud Functions 배포 여부를 확인해주세요.");
    } finally {
      setSavingUser(false);
    }
  }

  async function handleSaveUserName() {
    if (!editingUserUid || !editingUserName.trim()) return;
    setSavingUserName(true);
    try {
      await updateUserName(editingUserUid, editingUserName.trim());
      setEditingUserUid(null);
    } finally {
      setSavingUserName(false);
    }
  }

  async function handleResendReset(u: AppUser) {
    setResettingUid(u.uid);
    setResetSentUid(null);
    try {
      await sendPasswordResetEmail(u.email, u.name, client?.name);
      setResetSentUid(u.uid);
      setTimeout(() => setResetSentUid(null), 3000);
    } catch (err: any) {
      setUserError(err?.message ?? "재설정 메일 발송에 실패했습니다.");
    } finally {
      setResettingUid(null);
    }
  }

  async function handleConfirmDeleteUser() {
    if (!deleteUserTarget || deleteUserConfirmText !== DELETE_USER_KEYWORD) return;
    setDeletingUid(deleteUserTarget.uid);
    try {
      await deleteClientAccount(deleteUserTarget.uid);
      setDeleteUserTarget(null);
      setDeleteUserConfirmText("");
    } catch (err: any) {
      setUserError(err?.message ?? "계정 삭제에 실패했습니다.");
    } finally {
      setDeletingUid(null);
    }
  }

  async function handleConfirmDeleteClient() {
    if (deleteClientConfirmText !== DELETE_CLIENT_KEYWORD) return;
    setDeletingClient(true);
    try {
      await deleteClient(clientId);
      router.push("/clients");
    } finally {
      setDeletingClient(false);
    }
  }

  async function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      await uploadClientLogo(clientId, file);
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  }

  if (appUser && !isAdmin) {
    return <p className="text-sm text-[#86868b]">접근 권한이 없습니다.</p>;
  }

  if (!client) return <p className="text-sm text-[#86868b]">불러오는 중...</p>;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/clients" className="text-xs text-[#86868b] hover:underline">
          ← 클라이언트 목록
        </Link>
        <div className="mt-2 flex items-start gap-4">
          {/* 로고 영역 — 모든 클라이언트가 동일한 정사각형 크기 */}
          <div className="group relative h-20 w-20 shrink-0">
            {client.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={client.logoUrl}
                alt={`${client.name} 로고`}
                className="h-full w-full rounded-xl border border-[#e5e5e5] object-cover bg-white"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-[#d1d1d6] bg-[#f5f5f7] text-[#d1d1d6]">
                <ImagePlus size={22} />
              </div>
            )}
            <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-xl bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
              <span className="text-xs font-medium text-white">{uploadingLogo ? "..." : "변경"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
            </label>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-[#1d1d1f]">{client.name}</h1>
              <button onClick={() => { setEditName(client.name); setEditMemo(client.memo ?? ""); setEditBizCompanyName(client.bizCompanyName ?? ""); setEditBizRegNumber(client.bizRegNumber ?? ""); setEditBizCeoName(client.bizCeoName ?? ""); setEditBizPhone(client.bizPhone ?? ""); setEditBizAddress(client.bizAddress ?? ""); setEditClientOpen(true); }} className="text-[#86868b] hover:text-[#1d1d1f]">
                <Pencil size={15} />
              </button>
              <button
                onClick={() => { setDeleteClientConfirmText(""); setShowDeleteClientModal(true); }}
                className="text-[#d1d1d6] hover:text-red-500"
              >
                <Trash2 size={15} />
              </button>
            </div>
            {client.memo && <p className="text-sm text-[#86868b]">{client.memo}</p>}
            <p className="mt-0.5 text-xs text-[#86868b]">로고 위에 마우스를 올리면 변경할 수 있습니다.</p>
          </div>
        </div>
      </div>

      {editClientOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="no-scrollbar w-full max-w-md rounded-3xl bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-[#1d1d1f]">클라이언트 수정</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[#1d1d1f] mb-1">클라이언트명</label>
                <input className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]" value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1d1d1f] mb-1">설명 (메모)</label>
                <textarea className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]" rows={2} value={editMemo} onChange={e => setEditMemo(e.target.value)} />
              </div>
              <hr className="border-[#f0f0f0]" />
              <p className="text-xs font-semibold text-[#86868b] uppercase tracking-wide">사업자 정보</p>
              <div>
                <label className="block text-sm font-medium text-[#1d1d1f] mb-1">기업명 (법인명)</label>
                <input placeholder="주식회사 핸디핸드" className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]" value={editBizCompanyName} onChange={e => setEditBizCompanyName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1d1d1f] mb-1">사업자등록번호</label>
                <input placeholder="000-00-00000" inputMode="numeric" className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]" value={editBizRegNumber} onChange={e => setEditBizRegNumber(formatBizRegNumberInput(e.target.value))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1d1d1f] mb-1">대표명</label>
                <input placeholder="홍길동" className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]" value={editBizCeoName} onChange={e => setEditBizCeoName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1d1d1f] mb-1">대표전화</label>
                <input placeholder="02-0000-0000" inputMode="numeric" className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]" value={editBizPhone} onChange={e => setEditBizPhone(formatPhoneInput(e.target.value))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1d1d1f] mb-1">사업장주소</label>
                <input placeholder="서울특별시 ..." className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]" value={editBizAddress} onChange={e => setEditBizAddress(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditClientOpen(false)} className="rounded-full border border-[#d1d1d6] px-4 py-2 text-sm text-[#1d1d1f] hover:bg-[#f5f5f7]">취소</button>
              <button onClick={handleSaveClient} disabled={savingClient} className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm text-white transition hover:bg-black disabled:opacity-50">
                {savingClient ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 사업자 정보 */}
      {(client.bizCompanyName || client.bizRegNumber || client.bizCeoName || client.bizPhone || client.bizAddress) && (
        <section className="rounded-3xl bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-[#1d1d1f]">사업자 정보</h2>
          <dl className="space-y-2 text-sm">
            {client.bizCompanyName && (
              <div className="flex gap-4">
                <dt className="w-28 shrink-0 text-[#86868b]">기업명</dt>
                <dd className="text-[#1d1d1f]">{client.bizCompanyName}</dd>
              </div>
            )}
            {client.bizRegNumber && (
              <div className="flex gap-4">
                <dt className="w-28 shrink-0 text-[#86868b]">사업자등록번호</dt>
                <dd className="text-[#1d1d1f]">{client.bizRegNumber}</dd>
              </div>
            )}
            {client.bizCeoName && (
              <div className="flex gap-4">
                <dt className="w-28 shrink-0 text-[#86868b]">대표명</dt>
                <dd className="text-[#1d1d1f]">{client.bizCeoName}</dd>
              </div>
            )}
            {client.bizPhone && (
              <div className="flex gap-4">
                <dt className="w-28 shrink-0 text-[#86868b]">대표전화</dt>
                <dd className="text-[#1d1d1f]">{client.bizPhone}</dd>
              </div>
            )}
            {client.bizAddress && (
              <div className="flex gap-4">
                <dt className="w-28 shrink-0 text-[#86868b]">사업장주소</dt>
                <dd className="text-[#1d1d1f]">{client.bizAddress}</dd>
              </div>
            )}
          </dl>
          {client.bizAddress && (
            <div className="mt-4">
              <KakaoMap address={client.bizAddress} />
            </div>
          )}
        </section>
      )}

      {/* 프로젝트 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#1d1d1f]">프로젝트</h2>
          <button
            onClick={() => setShowProjectForm((v) => !v)}
            className="flex items-center gap-1 rounded-full bg-[#1d1d1f] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-black"
          >
            <Plus size={14} /> 프로젝트 생성
          </button>
        </div>

        {showProjectForm && (
          <form onSubmit={handleCreateProject} className="grid grid-cols-2 gap-3 rounded-3xl bg-white p-5">
            <div className="col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#86868b]">프로젝트명</label>
              <input required value={pName} onChange={(e) => setPName(e.target.value)} className="w-full appearance-none rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]" />
            </div>
            <div className="col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#86868b]">프로젝트 유형 (복수 선택 가능)</label>
              <div className="flex flex-wrap gap-2">
                {ALL_PROJECT_TYPES.map((t) => {
                  const selected = pType.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPType(prev => selected ? prev.filter(x => x !== t) : [...prev, t])}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        selected ? "border-[#1d1d1f] bg-[#1d1d1f] text-white" : "border-[#d1d1d6] text-[#86868b] hover:bg-[#f5f5f7]"
                      }`}
                    >
                      {PROJECT_TYPE_LABEL[t]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#86868b]">설명</label>
              <input value={pDesc} onChange={(e) => setPDesc(e.target.value)} className="w-full appearance-none rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]" />
            </div>
            <div className="col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#86868b]">업무 템플릿 (선택)</label>
              <select
                value={pTemplateId}
                onChange={(e) => setPTemplateId(e.target.value)}
                className="w-full appearance-none rounded-xl border border-[#d1d1d6] bg-white bg-[length:14px] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-8 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")" }}
              >
                <option value="">템플릿 없이 시작</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {pTemplateId && (
                <p className="mt-1 text-xs text-[#86868b]">프로젝트 생성 시 시작일을 기준으로 템플릿 업무가 자동 생성됩니다.</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#86868b]">시작일</label>
              <input required type="date" value={pStart} onChange={(e) => setPStart(e.target.value)} className="w-full appearance-none rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#86868b]">종료(마감)일</label>
              <input required type="date" value={pEnd} onChange={(e) => setPEnd(e.target.value)} className="w-full appearance-none rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]" />
            </div>
            <div className="col-span-2">
              <button type="submit" disabled={savingProject} className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50">
                저장
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition hover:shadow-[0_8px_24px_rgba(0,0,0,0.07)]">
              <p className="font-medium text-[#1d1d1f]">{p.name}</p>
              {p.projectType && p.projectType.length > 0 && (
                <div className="no-scrollbar mt-1.5 flex items-center gap-2 overflow-x-auto">
                  {p.projectType.map((t) => (
                    <span key={t} className="shrink-0 rounded-full bg-[#f5f5f7] px-2 py-0.5 text-xs text-[#1d1d1f]">
                      {PROJECT_TYPE_LABEL[t]}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-1.5 text-xs text-[#86868b]">{p.startDate} ~ {p.endDate}</p>
            </Link>
          ))}
          {projects.length === 0 && <p className="text-sm text-[#86868b]">등록된 프로젝트가 없습니다.</p>}
        </div>
      </section>

      {/* 클라이언트 계정 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#1d1d1f]">클라이언트 로그인 계정</h2>
          <button
            onClick={() => setShowUserForm((v) => !v)}
            className="flex items-center gap-1 rounded-full border border-[#d1d1d6] px-3 py-1.5 text-xs font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]"
          >
            <KeyRound size={14} /> 계정 추가
          </button>
        </div>

        {showUserForm && (
          <form onSubmit={handleCreateUser} className="grid grid-cols-2 gap-3 rounded-3xl bg-white p-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#86868b]">이름</label>
              <input required value={uName} onChange={(e) => setUName(e.target.value)} className="w-full appearance-none rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#86868b]">이메일</label>
              <input required type="email" value={uEmail} onChange={(e) => setUEmail(e.target.value)} className="w-full appearance-none rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]" />
            </div>
            <p className="col-span-2 text-xs text-[#86868b]">생성 후 클라이언트 이메일로 비밀번호 설정 링크와 간단한 사용법 안내가 자동 발송됩니다.</p>
            {userError && <p className="col-span-2 text-xs text-red-500">{userError}</p>}
            <div className="col-span-2">
              <button type="submit" disabled={savingUser} className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50">
                계정 생성
              </button>
            </div>
          </form>
        )}

        <div className="overflow-hidden rounded-3xl bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#ececef] text-left font-medium text-[#86868b]">
              <tr>
                <th className="px-4 py-3">이름</th>
                <th className="px-4 py-3">이메일</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid} className="border-t border-[#f0f0f0]">
                  <td className="px-4 py-3 text-[#1d1d1f]">
                    {editingUserUid === u.uid ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          value={editingUserName}
                          onChange={(e) => setEditingUserName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && handleSaveUserName()}
                          className="w-24 rounded-lg border border-[#d1d1d6] px-2 py-1 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
                        />
                        <button onClick={handleSaveUserName} disabled={savingUserName || !editingUserName.trim()} className="text-xs font-medium text-[#1d1d1f] underline underline-offset-2 disabled:opacity-40">
                          저장
                        </button>
                        <button onClick={() => setEditingUserUid(null)} className="text-xs text-[#86868b] underline underline-offset-2">
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingUserUid(u.uid); setEditingUserName(u.name); }}
                        className="flex items-center gap-1.5 hover:text-[#86868b]"
                        title="이름 수정"
                      >
                        {u.name}
                        <Pencil size={12} className="text-[#d1d1d6]" />
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#86868b]">{u.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => handleResendReset(u)}
                        disabled={resettingUid === u.uid}
                        className="text-xs font-medium text-[#86868b] underline underline-offset-2 hover:text-[#1d1d1f] disabled:opacity-40"
                      >
                        {resetSentUid === u.uid ? "발송됨 ✓" : resettingUid === u.uid ? "발송 중..." : "비밀번호 재설정 메일 발송"}
                      </button>
                      <button
                        onClick={() => { setDeleteUserTarget(u); setDeleteUserConfirmText(""); }}
                        disabled={deletingUid === u.uid}
                        className="shrink-0 text-[#d1d1d6] hover:text-red-500 disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-[#86868b]">
                    등록된 계정이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {deleteUserTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setDeleteUserTarget(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h2 className="text-lg font-semibold text-[#1d1d1f]">계정 삭제</h2>
              <p className="mt-1.5 text-sm text-[#86868b]">
                <span className="font-medium text-[#1d1d1f]">{deleteUserTarget.name}</span>({deleteUserTarget.email}) 계정을 삭제합니다. 이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[#86868b]">
                삭제하려면 <span className="font-semibold text-[#1d1d1f]">{DELETE_USER_KEYWORD}</span>를 입력하세요
              </label>
              <input
                autoFocus
                value={deleteUserConfirmText}
                onChange={(e) => setDeleteUserConfirmText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleConfirmDeleteUser(); }}
                placeholder={DELETE_USER_KEYWORD}
                className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteUserTarget(null)}
                className="rounded-full border border-[#d1d1d6] px-4 py-2 text-sm text-[#1d1d1f] hover:bg-[#f5f5f7]"
              >
                취소
              </button>
              <button
                onClick={handleConfirmDeleteUser}
                disabled={deleteUserConfirmText !== DELETE_USER_KEYWORD}
                className="rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteClientModal && client && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowDeleteClientModal(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h2 className="text-lg font-semibold text-[#1d1d1f]">클라이언트 삭제</h2>
              <p className="mt-1.5 text-sm text-[#86868b]">
                <span className="font-medium text-[#1d1d1f]">{client.name}</span> 클라이언트를 삭제합니다. 관련 데이터(프로젝트·계정)는 삭제되지 않지만, 이 작업 자체는 되돌릴 수 없습니다.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[#86868b]">
                삭제하려면 <span className="font-semibold text-[#1d1d1f]">{DELETE_CLIENT_KEYWORD}</span>를 입력하세요
              </label>
              <input
                autoFocus
                value={deleteClientConfirmText}
                onChange={(e) => setDeleteClientConfirmText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleConfirmDeleteClient(); }}
                placeholder={DELETE_CLIENT_KEYWORD}
                className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteClientModal(false)}
                className="rounded-full border border-[#d1d1d6] px-4 py-2 text-sm text-[#1d1d1f] hover:bg-[#f5f5f7]"
              >
                취소
              </button>
              <button
                onClick={handleConfirmDeleteClient}
                disabled={deleteClientConfirmText !== DELETE_CLIENT_KEYWORD || deletingClient}
                className="rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deletingClient ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
