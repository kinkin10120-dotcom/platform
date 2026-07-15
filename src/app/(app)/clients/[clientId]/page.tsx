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
import { listenUsersByClient } from "@/lib/firestore/users";
import { createClientAccount } from "@/lib/functions";
import { Client, Project, AppUser, ProjectType, PROJECT_TYPE_LABEL, ALL_PROJECT_TYPES } from "@/lib/types";

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
  const [savingProject, setSavingProject] = useState(false);

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
  const [uPassword, setUPassword] = useState("");
  const [savingUser, setSavingUser] = useState(false);
  const [userError, setUserError] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    const u1 = listenClient(clientId, setClient);
    const u2 = listenProjectsByClient(clientId, setProjects);
    const u3 = listenUsersByClient(clientId, setUsers);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [clientId]);

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
      await createProject({
        clientId,
        name: pName.trim(),
        description: pDesc.trim(),
        projectType: pType.length > 0 ? pType : undefined,
        startDate: pStart,
        endDate: pEnd,
        createdBy: appUser.uid,
      });
      setPName("");
      setPDesc("");
      setPType([]);
      setPStart("");
      setPEnd("");
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
      await createClientAccount({ email: uEmail.trim(), password: uPassword, name: uName.trim(), clientId });
      setUName("");
      setUEmail("");
      setUPassword("");
      setShowUserForm(false);
    } catch (err: any) {
      setUserError(err?.message ?? "계정 생성에 실패했습니다. Cloud Functions 배포 여부를 확인해주세요.");
    } finally {
      setSavingUser(false);
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

  if (!client) return <p className="text-sm text-gray-400">불러오는 중...</p>;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/clients" className="text-xs text-gray-400 hover:underline">
          ← 클라이언트 목록
        </Link>
        <div className="mt-2 flex items-start gap-4">
          {/* 로고 영역 */}
          <div className="group relative shrink-0">
            {client.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={client.logoUrl}
                alt={`${client.name} 로고`}
                className="h-16 w-16 rounded-xl border border-gray-200 object-contain bg-white p-1"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-gray-300">
                <ImagePlus size={22} />
              </div>
            )}
            <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-xl bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
              <span className="text-xs font-medium text-white">{uploadingLogo ? "..." : "변경"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
            </label>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900">{client.name}</h1>
              <button onClick={() => { setEditName(client.name); setEditMemo(client.memo ?? ""); setEditBizCompanyName(client.bizCompanyName ?? ""); setEditBizRegNumber(client.bizRegNumber ?? ""); setEditBizCeoName(client.bizCeoName ?? ""); setEditBizPhone(client.bizPhone ?? ""); setEditBizAddress(client.bizAddress ?? ""); setEditClientOpen(true); }} className="text-gray-400 hover:text-gray-600">
                <Pencil size={15} />
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`"${client.name}" 클라이언트를 삭제하시겠습니까?\n관련 데이터는 삭제되지 않습니다.`)) return;
                  await deleteClient(clientId);
                  router.push("/clients");
                }}
                className="text-gray-300 hover:text-red-500"
              >
                <Trash2 size={15} />
              </button>
            </div>
            {client.memo && <p className="text-sm text-gray-500">{client.memo}</p>}
            <p className="mt-0.5 text-xs text-gray-400">로고 위에 마우스를 올리면 변경할 수 있습니다.</p>
          </div>
        </div>
      </div>

      {editClientOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg space-y-4">
            <h2 className="text-lg font-semibold">클라이언트 수정</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">클라이언트명</label>
                <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명 (메모)</label>
                <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" rows={2} value={editMemo} onChange={e => setEditMemo(e.target.value)} />
              </div>
              <hr className="border-gray-100" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">사업자 정보</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">기업명 (법인명)</label>
                <input placeholder="주식회사 핸디핸드" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={editBizCompanyName} onChange={e => setEditBizCompanyName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">사업자등록번호</label>
                <input placeholder="000-00-00000" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={editBizRegNumber} onChange={e => setEditBizRegNumber(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">대표명</label>
                <input placeholder="홍길동" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={editBizCeoName} onChange={e => setEditBizCeoName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">대표전화</label>
                <input placeholder="02-0000-0000" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={editBizPhone} onChange={e => setEditBizPhone(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">사업장주소</label>
                <input placeholder="서울특별시 ..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={editBizAddress} onChange={e => setEditBizAddress(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditClientOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600">취소</button>
              <button onClick={handleSaveClient} disabled={savingClient} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50">
                {savingClient ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 사업자 정보 */}
      {(client.bizCompanyName || client.bizRegNumber || client.bizCeoName || client.bizPhone || client.bizAddress) && (
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">사업자 정보</h2>
          <dl className="space-y-2 text-sm">
            {client.bizCompanyName && (
              <div className="flex gap-4">
                <dt className="w-28 shrink-0 text-gray-400">기업명</dt>
                <dd className="text-gray-800">{client.bizCompanyName}</dd>
              </div>
            )}
            {client.bizRegNumber && (
              <div className="flex gap-4">
                <dt className="w-28 shrink-0 text-gray-400">사업자등록번호</dt>
                <dd className="text-gray-800">{client.bizRegNumber}</dd>
              </div>
            )}
            {client.bizCeoName && (
              <div className="flex gap-4">
                <dt className="w-28 shrink-0 text-gray-400">대표명</dt>
                <dd className="text-gray-800">{client.bizCeoName}</dd>
              </div>
            )}
            {client.bizPhone && (
              <div className="flex gap-4">
                <dt className="w-28 shrink-0 text-gray-400">대표전화</dt>
                <dd className="text-gray-800">{client.bizPhone}</dd>
              </div>
            )}
            {client.bizAddress && (
              <div className="flex gap-4">
                <dt className="w-28 shrink-0 text-gray-400">사업장주소</dt>
                <dd className="text-gray-800">{client.bizAddress}</dd>
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
          <h2 className="text-sm font-semibold text-gray-700">프로젝트</h2>
          <button
            onClick={() => setShowProjectForm((v) => !v)}
            className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
          >
            <Plus size={14} /> 프로젝트 생성
          </button>
        </div>

        {showProjectForm && (
          <form onSubmit={handleCreateProject} className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-white p-5">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-700">프로젝트명</label>
              <input required value={pName} onChange={(e) => setPName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-700">프로젝트 유형 (복수 선택 가능)</label>
              <div className="flex flex-wrap gap-2">
                {ALL_PROJECT_TYPES.map((t) => {
                  const selected = pType.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPType(prev => selected ? prev.filter(x => x !== t) : [...prev, t])}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                        selected ? "border-brand-600 bg-brand-50 text-brand-700" : "border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {PROJECT_TYPE_LABEL[t]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-700">설명</label>
              <input value={pDesc} onChange={(e) => setPDesc(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">시작일</label>
              <input required type="date" value={pStart} onChange={(e) => setPStart(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">종료(마감)일</label>
              <input required type="date" value={pEnd} onChange={(e) => setPEnd(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <button type="submit" disabled={savingProject} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                저장
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="rounded-xl border border-gray-200 bg-white p-4 hover:border-brand-300">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-gray-800">{p.name}</p>
                {p.projectType && p.projectType.map((t) => (
                  <span key={t} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-600">
                    {PROJECT_TYPE_LABEL[t]}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-400">{p.startDate} ~ {p.endDate}</p>
            </Link>
          ))}
          {projects.length === 0 && <p className="text-sm text-gray-400">등록된 프로젝트가 없습니다.</p>}
        </div>
      </section>

      {/* 클라이언트 계정 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">클라이언트 로그인 계정</h2>
          <button
            onClick={() => setShowUserForm((v) => !v)}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <KeyRound size={14} /> 계정 추가
          </button>
        </div>

        {showUserForm && (
          <form onSubmit={handleCreateUser} className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-white p-5">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">이름</label>
              <input required value={uName} onChange={(e) => setUName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">이메일</label>
              <input required type="email" value={uEmail} onChange={(e) => setUEmail(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-700">임시 비밀번호 (8자 이상)</label>
              <input required minLength={8} value={uPassword} onChange={(e) => setUPassword(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <p className="mt-1 text-xs text-gray-400">생성 후 이 비밀번호를 클라이언트에게 직접 전달해주세요.</p>
            </div>
            {userError && <p className="col-span-2 text-xs text-red-500">{userError}</p>}
            <div className="col-span-2">
              <button type="submit" disabled={savingUser} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                계정 생성
              </button>
            </div>
          </form>
        )}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3">이름</th>
                <th className="px-4 py-3">이메일</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid} className="border-t border-gray-100">
                  <td className="px-4 py-3 text-gray-800">{u.name}</td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-gray-400">
                    등록된 계정이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
