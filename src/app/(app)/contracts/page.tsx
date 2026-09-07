"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Trash2, X, Copy, Check, FileSignature, ChevronDown, Maximize2, Plus, Printer, BookmarkPlus, Download, Pencil, Mail } from "lucide-react";
import ContractBodyEditor from "@/components/ContractBodyEditor";
import { ContractHeaderData } from "@/components/ContractPreviewDocument";
import { useAuth } from "@/lib/auth-context";
import { formatMoney } from "@/lib/orderCalc";
import { DEFAULT_CONTRACT_BODY_TEMPLATE, resolveContractTokens, plainTextToHtml } from "@/lib/contractTemplate";
import { HANDYHAND_SEAL_URL } from "@/lib/tiptapSignatureBlock";
import { sanitizeContractHtml } from "@/lib/contractSanitize";
import { formatPhoneInput, formatBizRegNumberInput, formatAmountInput } from "@/lib/formatInput";
import {
  listenAllContracts,
  createContract,
  updateContractDraft,
  deleteContract,
  duplicateContract,
  linkContractToClient,
  ContractDraftPatch,
} from "@/lib/firestore/contracts";
import { listenContractTemplates, createContractTemplate, updateContractTemplate, deleteContractTemplate } from "@/lib/firestore/contractTemplates";
import { createClient, updateClient, listenClients } from "@/lib/firestore/clients";
import { createClientAccount, resendContractInvite, sendContract } from "@/lib/functions";
import { Client, Contract, ContractAttachment, ContractRevision, ContractStatus, CONTRACT_STATUS_LABEL, ContractTemplate, Currency } from "@/lib/types";

const STATUS_STYLE: Record<ContractStatus, string> = {
  draft: "bg-[#f5f5f7] text-[#86868b]",
  sent: "bg-amber-50 text-amber-600",
  revision_requested: "bg-red-50 text-red-500",
  signed: "bg-blue-50 text-blue-600",
  linked: "bg-green-50 text-green-600",
};

const DELETE_KEYWORD = "바로삭제";

export default function ContractsPage() {
  const { appUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selected, setSelected] = useState<Contract | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  // 복제 중인 계약 id — 같은 카드를 연타해서 사본이 여러 개 생기는 걸 막는다.
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [prefill, setPrefill] = useState<{ companyName?: string; contactName?: string; contactEmail?: string; bizRegCertUrl?: string } | null>(null);

  useEffect(() => listenAllContracts(setContracts), []);

  // 견적 관리("계약서 작성하기")에서 회사명·담당자·이메일(그리고 이미 첨부된 사업자등록증이
  // 있으면 그것도)을 채운 채로 넘어올 때 처리한다 — 처리 후에는 새로고침/뒤로가기 시 모달이
  // 다시 열리지 않도록 쿼리스트링을 지운다.
  useEffect(() => {
    const companyName = searchParams.get("prefillCompany");
    const contactName = searchParams.get("prefillContact");
    const contactEmail = searchParams.get("prefillEmail");
    const bizRegCertUrl = searchParams.get("prefillBizRegCertUrl");
    if (!companyName && !contactName && !contactEmail && !bizRegCertUrl) return;
    setPrefill({
      companyName: companyName ?? undefined,
      contactName: contactName ?? undefined,
      contactEmail: contactEmail ?? undefined,
      bizRegCertUrl: bizRegCertUrl ?? undefined,
    });
    setCreateOpen(true);
    router.replace("/contracts");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) return;
    const fresh = contracts.find((c) => c.id === selected.id);
    if (fresh) setSelected(fresh);
  }, [contracts]); // eslint-disable-line react-hooks/exhaustive-deps

  // 같은 거래처와 두 번째 계약을 맺을 때, 매번 처음부터 다시 쓰지 않도록 기존 건을 그대로 복사한다.
  // 복제본은 항상 "작성중"이라 실수로 발송되지 않고, 만든 직후 바로 선택해 편집으로 이어지게 한다.
  async function handleDuplicate(source: Contract) {
    if (!appUser || duplicatingId) return;
    setDuplicatingId(source.id);
    try {
      const ref = await duplicateContract(source, appUser.uid);
      // 구독(listenAllContracts)이 새 문서를 실어올 때까지 목록엔 아직 없다 — 도착하면 위쪽
      // useEffect가 selected를 최신 문서로 교체해주므로, 여기서는 id만 맞춰 심어두면 된다.
      setSelected({ ...source, id: ref.id, title: `${source.title} (사본)`, status: "draft" } as Contract);
    } finally {
      setDuplicatingId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!selected || deleteConfirmText !== DELETE_KEYWORD) return;
    await deleteContract(selected.id);
    setSelected(null);
    setDeleteConfirmOpen(false);
    setDeleteConfirmText("");
  }

  if (appUser?.role !== "admin") {
    return <p className="text-sm text-[#86868b]">접근 권한이 없습니다.</p>;
  }

  const canDelete = selected && selected.status !== "signed" && selected.status !== "linked";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-[#1d1d1f]">
            <span className="h-2 w-2 rounded-full bg-[#1d1d1f]" />
            계약 관리
          </h1>
          <p className="mt-1 pl-4 text-sm text-[#86868b]">계정이 없는 신규 거래처와 계약서를 작성·발송하고 전자서명을 받습니다.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <button
            onClick={() => setCreateOpen(true)}
            className="mb-1 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[#d1d1d6] py-2.5 text-xs font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
          >
            <FileSignature size={14} /> 새 계약 작성
          </button>

          {contracts.length === 0 && (
            <div className="rounded-3xl border border-dashed border-[#d1d1d6] bg-white p-10 text-center text-sm text-[#86868b]">
              작성된 계약이 없습니다.
            </div>
          )}
          {contracts.map((c) => (
            <ContractCard
              key={c.id}
              contract={c}
              selected={selected?.id === c.id}
              onClick={() => setSelected(c)}
              onDelete={() => { setSelected(c); setDeleteConfirmOpen(true); }}
              onDuplicate={() => handleDuplicate(c)}
            />
          ))}
        </div>

        {selected && (
          <div className="space-y-4 self-start rounded-3xl bg-white p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[#1d1d1f]">{selected.companyName}</p>
                <p className="mt-0.5 text-xs text-[#86868b]">
                  {selected.title} · {selected.productName || selected.contactName} · {new Date(selected.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
                </p>
                {(selected.status === "sent" || selected.status === "revision_requested") && (
                  <p className="mt-1 text-xs text-[#86868b]">
                    {selected.viewedAt
                      ? `열람함 · ${new Date(selected.viewedAt).toLocaleString("ko-KR")}`
                      : "아직 열람하지 않음"}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[selected.status]}`}>
                  {CONTRACT_STATUS_LABEL[selected.status]}
                </span>
                {canDelete && (
                  <button onClick={() => setDeleteConfirmOpen(true)} className="rounded-full p-1.5 text-[#d1d1d6] transition hover:bg-red-50 hover:text-red-500" title="삭제">
                    <Trash2 size={15} />
                  </button>
                )}
                <button onClick={() => setSelected(null)} className="rounded-full p-1.5 text-[#d1d1d6] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]" title="닫기">
                  <X size={15} />
                </button>
              </div>
            </div>

            {selected.status === "revision_requested" && selected.revisionRequestedBodyText && (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-xs text-red-600">
                고객이 계약서 본문을 직접 수정해서 요청을 보냈습니다. 아래 본문에 이미 반영되어 있고,
                <span className="font-semibold">고객이 새로 넣은 부분은 빨간 글자</span>로 표시되어 있어요.
              </div>
            )}
            {selected.status === "revision_requested" && !selected.revisionRequestedBodyText && selected.revisionNote && (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide">수정 요청 내용</p>
                <p className="whitespace-pre-wrap">{selected.revisionNote}</p>
              </div>
            )}

            {selected.status === "draft" || selected.status === "revision_requested" ? (
              <ContractEditForm contract={selected} />
            ) : (
              <ContractReadOnlyView contract={selected} />
            )}
          </div>
        )}
      </div>

      {deleteConfirmOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setDeleteConfirmOpen(false)}>
          <div className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div>
              <h2 className="text-lg font-semibold text-[#1d1d1f]">계약 삭제</h2>
              <p className="mt-1.5 text-sm text-[#86868b]">
                <span className="font-medium text-[#1d1d1f]">{selected.title}</span> 계약을 삭제합니다. 이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[#86868b]">
                삭제하려면 <span className="font-semibold text-[#1d1d1f]">{DELETE_KEYWORD}</span>를 입력하세요
              </label>
              <input
                autoFocus
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleConfirmDelete(); }}
                placeholder={DELETE_KEYWORD}
                className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setDeleteConfirmOpen(false); setDeleteConfirmText(""); }}
                className="rounded-full border border-[#d1d1d6] px-4 py-2 text-sm text-[#1d1d1f] hover:bg-[#f5f5f7]"
              >
                취소
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteConfirmText !== DELETE_KEYWORD}
                className="rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <CreateContractModal
          initialCompanyName={prefill?.companyName}
          initialContactName={prefill?.contactName}
          initialContactEmail={prefill?.contactEmail}
          initialBizRegCertUrl={prefill?.bizRegCertUrl}
          onClose={() => { setCreateOpen(false); setPrefill(null); }}
          onCreated={(c) => { setSelected(c); setCreateOpen(false); setPrefill(null); }}
        />
      )}
    </div>
  );
}

function ContractCard({
  contract: c,
  selected,
  onClick,
  onDelete,
  onDuplicate,
}: {
  contract: Contract;
  selected: boolean;
  onClick: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const canDelete = c.status !== "signed" && c.status !== "linked";
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
      className={`w-full cursor-pointer rounded-2xl border p-4 text-left transition ${
        selected ? "border-[#1d1d1f] bg-[#e5e5e5]" : "border-[#e5e5e5] bg-white hover:border-[#86868b]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-medium text-[#1d1d1f]">{c.companyName}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          {(c.status === "sent" || c.status === "revision_requested") && !c.viewedAt && (
            <span title="아직 열람하지 않음" className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          )}
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[c.status]}`}>
            {CONTRACT_STATUS_LABEL[c.status]}
          </span>
          {/* 서명이 끝난 계약도 복제는 할 수 있어야 한다 — 오히려 "지난번과 같은 조건으로 한 건 더"가
              가장 흔한 경우다(삭제와 달리 원본을 건드리지 않으므로 상태와 무관하게 허용한다). */}
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            title="복제하기"
            className="rounded-full p-1 text-[#d1d1d6] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
          >
            <Copy size={13} />
          </button>
          {canDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              title="삭제"
              className="rounded-full p-1 text-[#d1d1d6] transition hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-[#86868b] line-clamp-1">{c.title} · {c.contactName}</p>
      <p className="mt-1.5 text-xs text-[#d1d1d6]">
        {formatMoney(c.amount, c.currency)} · {new Date(c.createdAt).toLocaleDateString("ko-KR")}
      </p>
    </div>
  );
}

function ContractEditForm({ contract }: { contract: Contract }) {
  const { appUser } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    title: contract.title,
    companyName: contract.companyName,
    productName: contract.productName ?? "",
    bizRegNumber: contract.bizRegNumber ?? "",
    bizCeoName: contract.bizCeoName ?? "",
    bizAddress: contract.bizAddress ?? "",
    contactName: contract.contactName,
    contactEmail: contract.contactEmail,
    contactPhone: contract.contactPhone ?? "",
    amount: String(contract.amount || ""),
    currency: contract.currency,
    vatApplicable: !!contract.vatApplicable,
    periodStart: contract.periodStart ?? "",
    periodEnd: contract.periodEnd ?? "",
    paymentTerms: contract.paymentTerms ?? "",
    // 고객이 "수정 요청"에서 직접 계약서를 고쳐 보냈다면(revisionRequestedBodyText), 그걸
    // 그대로 시작점으로 보여준다 — 고객이 새로 넣은 부분은 RevisionMark(빨간 글자)로 이미
    // 표시되어 있어 담당자가 어디를 바꿨는지 바로 알아볼 수 있다.
    bodyText: contract.revisionRequestedBodyText || contract.bodyText,
    attachments: contract.attachments ?? [],
  });
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState("");
  const [openingBigEdit, setOpeningBigEdit] = useState(false);
  const [openingPreview, setOpeningPreview] = useState(false);
  const [templateSaveOpen, setTemplateSaveOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [templateLoadOpen, setTemplateLoadOpen] = useState(false);

  useEffect(() => listenContractTemplates(setTemplates), []);

  function handleLoadTemplate(t: ContractTemplate) {
    if (!confirm(`"${t.name}" 템플릿으로 지금 본문을 덮어씁니다. 계속할까요?`)) return;
    set("bodyText", t.bodyHtml);
    setBodyTextDirty(true);
    setBodyTextVersion((v) => v + 1);
    setTemplateLoadOpen(false);
  }
  // 본문/별첨은 "크게 편집"·"별첨 편집"처럼 별도 화면(다른 라우트)에서도 저장할 수 있다 —
  // 이 폼의 bodyText/attachments는 마운트 시점 값으로 고정되어 그 화면에서의 저장을 자동으로
  // 따라잡지 못하는데, 그 상태에서 "임시 저장"을 누르면 여기 남아있는 옛 값으로 방금 다른
  // 화면에서 저장한 최신 내용을 덮어써 버린다 — 이 세션에서 실제로 건드린 경우에만 해당
  // 필드를 저장 패치에 포함시켜, 안 건드린 필드는 절대 되돌리지 않게 한다.
  const [bodyTextDirty, setBodyTextDirty] = useState(false);
  // "본문에 적용" 클릭 시 이 값을 올려서 ContractBodyEditor를 강제로 다시 마운트시킨다 —
  // 그 컴포넌트 내부의 "포커스 중이면 외부 value 변경을 무시한다" 로직이 언제 어떤 이유로
  // 안 먹는지 알 수 없는 경우까지 대비해, 아예 새 에디터 인스턴스를 새 값으로 처음부터
  // 그려서 무조건 반영되게 한다.
  const [bodyTextVersion, setBodyTextVersion] = useState(0);
  const [attachmentsDirty, setAttachmentsDirty] = useState(false);

  // 위 주석대로 form은 마운트 시점 값으로 고정되는데, Next.js가 이 화면을 완전히 새로 마운트하지
  // 않고 재사용하는 경우(예: "크게 편집"에서 저장 후 뒤로가기)엔 그 마운트 시점 자체가 오래된
  // 스냅샷이라 "저장됨"이 뜬 최신 내용이 여기 뷰어에는 전혀 안 보이는 문제가 있었다 — 이 세션에서
  // 아직 손대지 않은 필드(dirty가 아닌 상태)에 한해서만, 실시간 구독으로 들어온 최신 값을
  // 그대로 따라가게 한다(손댄 뒤라면 여전히 덮어쓰지 않는다).
  const lastSyncedBodyText = useRef(form.bodyText);
  useEffect(() => {
    if (bodyTextDirty) return;
    const latest = contract.revisionRequestedBodyText || contract.bodyText;
    if (latest === lastSyncedBodyText.current) return;
    lastSyncedBodyText.current = latest;
    setForm((prev) => ({ ...prev, bodyText: latest }));
    setBodyTextVersion((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract.bodyText, contract.revisionRequestedBodyText]);

  useEffect(() => {
    if (attachmentsDirty) return;
    setForm((prev) => ({ ...prev, attachments: contract.attachments ?? [] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract.attachments]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // 본문 안의 "(대표자)"/"(담당자명)" 같은 괄호 표기를 지금 입력된 값으로 바꿔 넣는다.
  // 예전엔 이 치환을 렌더링할 때마다 자동으로(값을 보여주기만 하고) 했는데, 본문을 한
  // 글자라도 직접 고치는 순간 그 결과가 실제 저장값으로 그대로 굳어버려서, 그 이후로는
  // 필드를 다시 고쳐도 이미 치환된 자리엔 반영이 안 되는 문제가 있었다 — 언제든 원하는
  // 시점에 눌러서 최신 값을 반영할 수 있도록 버튼으로 바꾼다.
  function handleApplyTokens() {
    // ContractBodyEditor는 사용자가 에디터에 포커스를 두고 타이핑 중일 땐 외부 value 변경을
    // 무시한다(그래야 타이핑 중 한글 조합이 안 깨진다) — 직전에 본문 에디터를 만졌다면
    // 이 포커스가 아직 남아있어, 버튼으로 강제 반영해도 조용히 무시돼버린다. 명시적으로
    // 포커스를 해제해서 "지금은 진짜 외부 변화"임을 알려준다.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const f = { ...contract, ...form, amount: Number(form.amount) || 0 };
    const nextBody = resolveContractTokens(form.bodyText, f, { keepContractDateToken: true });
    setForm((prev) => ({ ...prev, bodyText: nextBody }));
    setBodyTextDirty(true);
    setBodyTextVersion((v) => v + 1);
  }

  async function handleSaveAsTemplate() {
    if (!appUser || !templateName.trim()) return;
    setTemplateSaving(true);
    try {
      await createContractTemplate({ name: templateName.trim(), bodyHtml: form.bodyText, createdBy: appUser.uid });
      setTemplateSaveOpen(false);
      setTemplateName("");
    } finally {
      setTemplateSaving(false);
    }
  }

  function addAttachment() {
    const next: ContractAttachment = {
      id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
      title: `별첨 ${form.attachments.length + 1}`,
      bodyHtml: "",
    };
    setForm((prev) => ({ ...prev, attachments: [...prev.attachments, next] }));
    setAttachmentsDirty(true);
  }

  function updateAttachment(id: string, patch: Partial<ContractAttachment>) {
    setForm((prev) => ({
      ...prev,
      attachments: prev.attachments.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
    setAttachmentsDirty(true);
  }

  function removeAttachment(id: string) {
    setForm((prev) => ({ ...prev, attachments: prev.attachments.filter((a) => a.id !== id) }));
    setAttachmentsDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    setActionError("");
    try {
      const patch: ContractDraftPatch = {
        title: form.title,
        companyName: form.companyName,
        productName: form.productName || undefined,
        bizRegNumber: form.bizRegNumber || undefined,
        bizCeoName: form.bizCeoName || undefined,
        bizAddress: form.bizAddress || undefined,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone || undefined,
        amount: Number(form.amount) || 0,
        currency: form.currency,
        vatApplicable: form.vatApplicable,
        periodStart: form.periodStart || undefined,
        periodEnd: form.periodEnd || undefined,
        paymentTerms: form.paymentTerms || undefined,
      };
      // 이 세션에서 실제로 건드리지 않았다면 패치에서 아예 빼서, "크게 편집"/"별첨 편집"
      // 등 다른 화면에서 그 사이 저장한 최신 내용을 옛 값으로 덮어쓰지 않게 한다.
      if (bodyTextDirty) {
        patch.bodyText = form.bodyText;
        // 고객이 보낸 수정 요청 본문(revisionRequestedBodyText)은 "아직 반영 전"인 동안만
        // 시작점으로 계속 보여주기 위한 값이다 — 관리자가 실제로 본문을 고쳐서 저장한
        // 순간 그 요청은 이미 반영/처리된 것이므로 비워둔다. 안 그러면 저장 후 다시 열 때마다
        // (또는 "크게 편집"에서 저장 후 여기로 돌아올 때) 방금 고친 내용 대신 고객이 보낸
        // 원본 요청이 다시 시작점으로 뜨면서 방금 한 편집이 사라진 것처럼 보였다.
        patch.revisionRequestedBodyText = undefined;
      }
      if (attachmentsDirty) patch.attachments = form.attachments;
      await updateContractDraft(contract.id, patch);
    } catch (e: any) {
      setActionError(e?.message ?? "저장 중 오류가 발생했습니다.");
      throw e;
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    if (!confirm("이 내용으로 계약서를 발송하시겠습니까?\n발송하면 고객에게 서명 요청 메일이 바로 전송됩니다.")) return;
    setSending(true);
    setActionError("");
    try {
      // 먼저 지금 편집 내용을 저장한 뒤, 발송 자체는 Cloud Function이 처리한다 — 발송한
      // 관리자·시각·IP·기기 정보를 서버에서 직접 관측해 신뢰할 수 있는 값으로 남기기 위함
      // (클라이언트가 직접 쓰면 IP를 조작할 수 있어 증빙으로 쓸 수 없다).
      await handleSave();
      await sendContract(contract.id);
    } catch (e: any) {
      setActionError(e?.message ?? "발송 중 오류가 발생했습니다.");
    } finally {
      setSending(false);
    }
  }

  const inputClass = "w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]";

  // ContractEditForm은 draft/revision_requested 상태에서만 렌더링된다. draft는 항상 버전 1(한 번도
  // 발송 안 된 최초 초안)이고, revision_requested는 이미 한 번 이상 발송된 뒤 고객이 수정을 요청한 상태다.
  const stageLabel =
    contract.status === "revision_requested"
      ? `버전 ${contract.version} · 고객 수정 요청 반영 중 — 아래 본문을 수정 후 발송하면 버전 ${contract.version + 1}로 재발송됩니다`
      : `버전 1 · 아직 발송되지 않은 초안입니다 (발송해야 상대방이 볼 수 있어요)`;

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-[#f5f5f7] px-3 py-2 text-xs font-medium text-[#1d1d1f]">{stageLabel}</p>

      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-xs text-[#86868b]">계약 제목</label>
          <input value={form.title} onChange={(e) => set("title", e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-[#86868b]">상호명 ({contract.handyhandIsGap ? "을" : "갑"})</label>
          <input value={form.companyName} onChange={(e) => set("companyName", e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-[#86868b]">제품/서비스명</label>
          <input value={form.productName} onChange={(e) => set("productName", e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-[#86868b]">사업자등록번호</label>
          <input value={form.bizRegNumber} onChange={(e) => set("bizRegNumber", formatBizRegNumberInput(e.target.value))} inputMode="numeric" className={inputClass} />
        </div>
        {/* 대표자 입력과 "본문에 적용" 버튼은 텍스트 타이핑 중 높이가 바뀔 일이 없는(버튼은
            고정, 대표자 칸은 짧은 값 위주) 조합이라 한 줄에 나란히 둬도 안전하다 — 아래
            텍스트 입력 쌍들은 실제 기기에서 타이핑 중(특히 자동완성 제안이 뜰 때) 한쪽만
            높이가 미세하게 달라져 옆 칸과 어긋나는 문제가 있어서 전부 한 줄씩 세로로 뺐다. */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs text-[#86868b]">대표자</label>
            <input value={form.bizCeoName} onChange={(e) => set("bizCeoName", e.target.value)} className={inputClass} />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleApplyTokens}
              title='본문 안의 "(대표자)"/"(담당자명)" 같은 괄호 표기를 지금 입력된 값으로 바꿔 넣습니다'
              className="w-full rounded-xl border border-dashed border-[#d1d1d6] px-3 py-2 text-sm font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
            >
              본문에 적용
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-[#86868b]">사업장 주소</label>
          <input value={form.bizAddress} onChange={(e) => set("bizAddress", e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-[#86868b]">담당자명</label>
          <input value={form.contactName} onChange={(e) => set("contactName", e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-[#86868b]">담당자 연락처</label>
          <input value={form.contactPhone} onChange={(e) => set("contactPhone", formatPhoneInput(e.target.value))} inputMode="numeric" className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-[#86868b]">담당자 이메일 (서명 페이지 본인확인에 쓰입니다)</label>
          <input type="email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-[#86868b]">계약금액</label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={formatAmountInput(form.amount)}
              onChange={(e) => set("amount", e.target.value.replace(form.currency === "USD" ? /[^0-9.]/g : /[^0-9]/g, ""))}
              inputMode="decimal"
              className={`${inputClass} min-w-0 flex-1`}
            />
            <select
              value={form.currency}
              onChange={(e) => {
                const currency = e.target.value as Currency;
                set("currency", currency);
                // 달러는 해외결제라 부가세 대상이 아니다 — 통화를 USD로 바꾸면 VAT 별도 체크도 같이 풀어준다.
                if (currency === "USD" && form.vatApplicable) set("vatApplicable", false);
              }}
              className="shrink-0 rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm outline-none focus:border-[#86868b]"
            >
              <option value="KRW">KRW</option>
              <option value="USD">USD</option>
            </select>
            {form.currency !== "USD" && (
              <label className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f]">
                <input type="checkbox" checked={form.vatApplicable} onChange={(e) => set("vatApplicable", e.target.checked)} />
                VAT 별도
              </label>
            )}
          </div>
        </div>
        {/* type="date" 입력은 iOS Safari에서 자기 고유의 넓은 콘텐츠 크기를 그리드/플렉스
            트랙 크기 계산에 반영해버려서, min-w-0/overflow-hidden을 다 줘도 여전히 옆 칸을
            밀어내며 튀어나왔다 — 원인은 Safari가 이 입력을 네이티브 UI(OS 날짜 피커 모양)로
            그릴 때 그 모양을 유지하는 데 필요한 고유 최소 폭을 강제하기 때문이었다.
            -webkit-appearance:none으로 그 네이티브 외형을 꺼서, 일반 텍스트 입력처럼 순수
            CSS 박스 모델(width:100%)을 그대로 따르게 만든다 — 탭하면 여전히 날짜 피커가
            뜨는 동작 자체는 유지된다. 다만 값이 비어있을 때(placeholder 상태)는 내부
            "연도-월-일" 자리표시 세그먼트가 상속된 line-height를 따르지 않고 자체 기본값을
            써서 아직 값을 고르기 전엔 다른 입력칸보다 얇게 보였다 — 높이를 명시적으로
            고정해 값 유무와 무관하게 항상 같은 높이가 되게 한다. */}
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0 overflow-hidden">
            <label className="mb-1.5 block text-xs text-[#86868b]">용역기간 시작</label>
            <input
              type="date"
              value={form.periodStart}
              onChange={(e) => set("periodStart", e.target.value)}
              className={`${inputClass} block h-[38px] w-full min-w-0 bg-white [color-scheme:light]`}
              style={{ WebkitAppearance: "none", appearance: "none" }}
            />
          </div>
          <div className="min-w-0 overflow-hidden">
            <label className="mb-1.5 block text-xs text-[#86868b]">용역기간 종료</label>
            <input
              type="date"
              value={form.periodEnd}
              onChange={(e) => set("periodEnd", e.target.value)}
              className={`${inputClass} block h-[38px] w-full min-w-0 bg-white [color-scheme:light]`}
              style={{ WebkitAppearance: "none", appearance: "none" }}
            />
          </div>
        </div>
      </div>

      <div>
        <div className="contract-body-toolbar mb-1.5 flex items-center justify-between gap-2">
          <label className="shrink-0 whitespace-nowrap text-xs text-[#86868b]">계약서 본문</label>
          <div className="flex items-center gap-2.5">
            {templates.length > 0 && (
              <button
                type="button"
                onClick={() => setTemplateLoadOpen((v) => !v)}
                className="flex items-center gap-1 whitespace-nowrap text-xs font-medium text-[#1d1d1f] hover:text-[#86868b]"
              >
                <Download size={11} /> <span className="contract-body-toolbar-label underline underline-offset-2">템플릿 불러오기</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setTemplateSaveOpen((v) => !v)}
              className="flex items-center gap-1 whitespace-nowrap text-xs font-medium text-[#1d1d1f] hover:text-[#86868b]"
            >
              <BookmarkPlus size={11} /> <span className="contract-body-toolbar-label underline underline-offset-2">템플릿으로 저장</span>
            </button>
            <button
              type="button"
              disabled={openingBigEdit}
              onClick={async () => {
                setOpeningBigEdit(true);
                try {
                  await handleSave();
                  router.push(`/contracts/${contract.id}/edit`);
                } catch {
                  setOpeningBigEdit(false);
                }
              }}
              className="flex items-center gap-1 whitespace-nowrap text-xs font-medium text-[#1d1d1f] hover:text-[#86868b] disabled:opacity-50"
            >
              <Maximize2 size={11} /> <span className="contract-body-toolbar-label underline underline-offset-2">{openingBigEdit ? "여는 중..." : "크게 편집"}</span>
            </button>
            <button
              type="button"
              disabled={openingPreview}
              onClick={async () => {
                setOpeningPreview(true);
                try {
                  await handleSave();
                  router.push(`/contracts/${contract.id}/preview`);
                } catch {
                  setOpeningPreview(false);
                }
              }}
              className="flex items-center gap-1 whitespace-nowrap text-xs font-medium text-[#1d1d1f] hover:text-[#86868b] disabled:opacity-50"
            >
              <Printer size={11} /> <span className="contract-body-toolbar-label underline underline-offset-2">{openingPreview ? "여는 중..." : "미리보기 / 인쇄"}</span>
            </button>
          </div>
        </div>

        {templateLoadOpen && (
          <div className="mb-2 space-y-1 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] p-2">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleLoadTemplate(t)}
                className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-[#1d1d1f] hover:bg-white"
              >
                {t.name}
              </button>
            ))}
          </div>
        )}

        {templateSaveOpen && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-[#d1d1d6] bg-[#f5f5f7] p-2">
            <input
              autoFocus
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="템플릿 이름 (예: 개발+양산 계약서)"
              className="flex-1 rounded-lg border border-[#d1d1d6] bg-white px-2.5 py-1.5 text-xs text-[#1d1d1f] outline-none focus:border-[#86868b]"
            />
            <button
              type="button"
              onClick={handleSaveAsTemplate}
              disabled={templateSaving || !templateName.trim()}
              className="rounded-lg bg-[#1d1d1f] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {templateSaving ? "저장 중..." : "저장"}
            </button>
            <button
              type="button"
              onClick={() => { setTemplateSaveOpen(false); setTemplateName(""); }}
              className="rounded-lg p-1.5 text-[#86868b] hover:bg-white"
            >
              <X size={13} />
            </button>
          </div>
        )}

        <ContractBodyEditor
          key={bodyTextVersion}
          contractId={contract.id}
          value={plainTextToHtml(form.bodyText)}
          onChange={(html) => { set("bodyText", html); setBodyTextDirty(true); }}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="block text-xs text-[#86868b]">별첨 문서</label>
          <button
            type="button"
            onClick={addAttachment}
            className="flex items-center gap-1 text-xs font-medium text-[#1d1d1f] underline underline-offset-2 hover:text-[#86868b]"
          >
            <Plus size={11} /> 별첨 추가
          </button>
        </div>
        {form.attachments.length === 0 ? (
          <p className="text-xs text-[#86868b]">도면·사양 등 본문과 별도 페이지로 붙일 문서가 있으면 추가하세요.</p>
        ) : (
          <div className="space-y-3">
            {form.attachments.map((a) => (
              <div key={a.id} className="rounded-2xl border border-[#e5e5e5] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <input
                    value={a.title}
                    onChange={(e) => updateAttachment(a.id, { title: e.target.value })}
                    className="flex-1 rounded-xl border border-[#d1d1d6] px-3 py-1.5 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
                  />
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.id)}
                    className="rounded-full p-1.5 text-[#d1d1d6] transition hover:bg-red-50 hover:text-red-500"
                    title="별첨 삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <ContractBodyEditor
                  contractId={contract.id}
                  value={plainTextToHtml(a.bodyHtml)}
                  onChange={(html) => updateAttachment(a.id, { bodyHtml: html })}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {actionError && <p className="text-xs text-red-500">{actionError}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => handleSave().catch(() => {})}
          disabled={saving}
          className="flex-1 rounded-full border border-[#d1d1d6] py-2.5 text-sm font-medium text-[#1d1d1f] transition hover:border-[#86868b] disabled:opacity-50"
        >
          {saving ? "저장 중..." : "임시 저장"}
        </button>
        <button
          onClick={handleSend}
          disabled={sending || !form.contactEmail.trim() || !form.companyName.trim()}
          className="flex-1 rounded-full bg-[#1d1d1f] py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
        >
          {sending ? "발송 중..." : contract.status === "revision_requested" ? "수정 반영 후 재발송" : "발송"}
        </button>
      </div>

      <ContractHistoryList history={contract.history} />
    </div>
  );
}

function ContractHistoryList({ history }: { history: ContractRevision[] }) {
  const [open, setOpen] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);

  if (history.length === 0) return null;

  const sorted = [...history].sort((a, b) => b.version - a.version);

  return (
    <div className="rounded-2xl border border-[#e5e5e5]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-xs font-medium text-[#1d1d1f]"
      >
        발송 이력 ({history.length}개 버전 발송됨)
        <ChevronDown size={14} className={`text-[#86868b] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-[#e5e5e5] p-3">
          {sorted.map((h) => (
            <div key={h.version} className="rounded-xl bg-[#f5f5f7] p-3 text-xs">
              <button
                onClick={() => setExpandedVersion((v) => (v === h.version ? null : h.version))}
                className="flex w-full items-center justify-between text-left font-medium text-[#1d1d1f]"
              >
                <span>버전 {h.version} · {new Date(h.updatedAt).toLocaleString("ko-KR")}에 발송</span>
                <ChevronDown size={12} className={`shrink-0 text-[#86868b] transition-transform ${expandedVersion === h.version ? "rotate-180" : ""}`} />
              </button>
              {h.note && <p className="mt-1.5 text-red-500">고객 수정 요청: {h.note}</p>}
              {expandedVersion === h.version && (
                <div
                  className="tiptap-content mt-2 max-h-60 overflow-y-auto rounded-lg border border-[#e5e5e5] bg-white p-3 text-[11px] leading-relaxed text-[#1d1d1f]"
                  dangerouslySetInnerHTML={{ __html: sanitizeContractHtml(plainTextToHtml(h.bodyText)) }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 기기 정보·해시처럼 길어서 한 줄로 잘려 보이는 값도, 필요할 때 전체를 그대로 복사할 수 있게
// 옆에 작은 복사 버튼을 붙인다(화면 표시는 잘라서 깔끔하게, 실제 값은 항상 전체 그대로 복사됨).
function CopyableField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="flex items-center gap-1.5">
      <p className="min-w-0 flex-1 truncate">{label}: {value}</p>
      <button
        onClick={handleCopy}
        title="전체 복사"
        className="shrink-0 rounded-lg p-1 text-blue-500 transition hover:bg-blue-100"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  );
}

function ContractReadOnlyView({ contract }: { contract: Contract }) {
  const router = useRouter();
  // signedBodyText는 서명 시점에 서버에서 이미 토큰이 치환된 상태로 저장되지만, 방어적으로
  // 한 번 더 치환을 거쳐도(치환할 토큰이 없으면) 그대로 반환되므로 항상 안전하다.
  const bodyText = resolveContractTokens(contract.signedBodyText ?? contract.bodyText, contract);
  const [copied, setCopied] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState("");

  function handleCopyLink() {
    const url = `${window.location.origin}/contracts/sign/${contract.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleResend() {
    setResending(true);
    setResendError("");
    try {
      await resendContractInvite(contract.id);
      setResent(true);
      setTimeout(() => setResent(false), 2000);
    } catch (e: any) {
      setResendError(e?.message ?? "재발송 중 오류가 발생했습니다.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-2xl bg-[#f5f5f7] p-4 text-xs">
        <p className="text-[#86868b]">상호명</p><p className="text-[#1d1d1f]">{contract.companyName}</p>
        {contract.productName && (
          <>
            <p className="text-[#86868b]">제품/서비스명</p><p className="text-[#1d1d1f]">{contract.productName}</p>
          </>
        )}
        <p className="text-[#86868b]">담당자</p><p className="text-[#1d1d1f]">{contract.contactName} ({contract.contactEmail})</p>
        <p className="text-[#86868b]">계약금액</p><p className="text-[#1d1d1f]">{formatMoney(contract.amount, contract.currency)}{contract.vatApplicable ? " (VAT별도)" : ""}</p>
        {(contract.periodStart || contract.periodEnd) && (
          <>
            <p className="text-[#86868b]">용역기간</p>
            <p className="text-[#1d1d1f]">{contract.periodStart || "-"} ~ {contract.periodEnd || "-"}</p>
          </>
        )}
      </div>

      {contract.sentBy && (
        <div className="space-y-1 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs text-[#1d1d1f]">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">발송 정보 ({contract.handyhandIsGap ? "갑" : "을"})</p>
          <p>발송자: {contract.sentBy}</p>
          <p>발송 일시: {contract.sentAt ? new Date(contract.sentAt).toLocaleString("ko-KR") : "-"}</p>
          <p>접속 IP: {contract.sentIp || "-"}</p>
          <CopyableField label="기기 정보" value={contract.sentUserAgent || "-"} />
          <CopyableField label="본문 해시(SHA-256)" value={contract.sentContentHash || "-"} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={HANDYHAND_SEAL_URL} alt="직인" className="h-16 rounded-lg border border-amber-100 bg-white object-contain" />
        </div>
      )}

      {contract.status === "sent" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={handleCopyLink}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[#1d1d1f] py-2.5 text-xs font-medium text-[#1d1d1f] transition hover:bg-[#1d1d1f] hover:text-white"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "복사됨" : "서명 링크 복사"}
            </button>
            <button
              onClick={handleResend}
              disabled={resending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[#1d1d1f] py-2.5 text-xs font-medium text-[#1d1d1f] transition hover:bg-[#1d1d1f] hover:text-white disabled:opacity-50"
            >
              {resent ? <Check size={13} /> : <Mail size={13} />} {resending ? "재발송 중..." : resent ? "재발송됨" : "메일 재발송"}
            </button>
          </div>
          {resendError && <p className="text-xs text-red-500">{resendError}</p>}
        </div>
      )}

      {(contract.status === "signed" || contract.status === "linked") && (
        <div className="space-y-2 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs text-[#1d1d1f]">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">서명 증빙 정보</p>
          <p>서명자: {contract.signerName}{contract.signerTitle ? ` (${contract.signerTitle})` : ""} ({contract.signerEmail})</p>
          <p>권한 확인: {contract.authorityConfirmed ? "본인이 체결 권한 있음을 확인함" : "-"}</p>
          <p>전자서명 동의: {contract.consentAcknowledged ? "서면과 동일한 법적 효력에 동의함" : "-"}</p>
          <p>서명 일시: {contract.signedAt ? new Date(contract.signedAt).toLocaleString("ko-KR") : "-"}</p>
          <p>접속 IP: {contract.signerIp || "-"}</p>
          <CopyableField label="기기 정보" value={contract.signerUserAgent || "-"} />
          <CopyableField label="본문 해시(SHA-256)" value={contract.contentHash || "-"} />
          {contract.signatureUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={contract.signatureUrl} alt="서명" className="h-16 rounded-lg border border-blue-100 bg-white object-contain" />
          )}
        </div>
      )}

      {contract.bizRegCertUrl && (
        <a
          href={contract.bizRegCertUrl}
          target="_blank"
          rel="noreferrer"
          className="block rounded-xl bg-green-50 px-3 py-2 text-xs font-medium text-green-600 underline underline-offset-2"
        >
          고객이 첨부한 사업자등록증 보기
        </a>
      )}

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-xs text-[#86868b]">
            계약서 본문 {contract.status === "signed" || contract.status === "linked" ? "(서명본, 수정 불가)" : ""}
            {(contract.status === "signed" || contract.status === "linked" ? contract.signedAttachments : contract.attachments)?.length
              ? ` · 별첨 ${(contract.status === "signed" || contract.status === "linked" ? contract.signedAttachments : contract.attachments)!.length}건`
              : ""}
          </p>
          <button
            type="button"
            onClick={() => router.push(`/contracts/${contract.id}/preview`)}
            className="flex items-center gap-1 text-xs font-medium text-[#1d1d1f] underline underline-offset-2 hover:text-[#86868b]"
          >
            <Maximize2 size={11} /> 크게 미리보기
          </button>
        </div>
        <div
          className="tiptap-content max-h-96 overflow-y-auto rounded-2xl border border-[#e5e5e5] p-4 text-xs leading-relaxed text-[#1d1d1f]"
          dangerouslySetInnerHTML={{ __html: sanitizeContractHtml(plainTextToHtml(bodyText)) }}
        />
      </div>

      <ContractHistoryList history={contract.history} />

      {contract.status === "signed" && !contract.handyhandIsGap && !contract.linkedClientId && <CreateAccountSection contract={contract} />}

      {contract.status === "linked" && contract.linkedClientId && (
        <Link
          href={`/clients/${contract.linkedClientId}`}
          className="flex items-center justify-center gap-1.5 rounded-full bg-[#1d1d1f] py-2.5 text-sm font-medium text-white transition hover:bg-black"
        >
          연결된 클라이언트로 이동
        </Link>
      )}
    </div>
  );
}

function CreateAccountSection({ contract }: { contract: Contract }) {
  const { appUser } = useAuth();
  const [email, setEmail] = useState(contract.contactEmail);
  const [name, setName] = useState(contract.contactName);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!appUser || !email.trim() || !name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const clientRef = await createClient(contract.companyName, `계약서(${contract.title})로부터 생성됨`, appUser.uid);
      await updateClient(clientRef.id, {
        bizCompanyName: contract.companyName,
        bizRegNumber: contract.bizRegNumber ?? "",
        bizCeoName: contract.bizCeoName ?? "",
        bizPhone: contract.contactPhone ?? "",
        bizAddress: contract.bizAddress ?? "",
      });
      await createClientAccount({ email: email.trim(), name: name.trim(), clientId: clientRef.id });
      await linkContractToClient(contract.id, clientRef.id);
    } catch (e: any) {
      setError(e?.message ?? "계정 생성 중 오류가 발생했습니다.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[#e5e5e5] p-4">
      <p className="text-xs font-semibold text-[#1d1d1f]">계정 만들기</p>
      <p className="text-xs text-[#86868b]">클라이언트를 새로 만들고 이 정보로 로그인 계정을 발급합니다. 계정 생성 시 비밀번호 설정 링크가 이메일로 발송됩니다.</p>
      <div className="grid grid-cols-2 gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="담당자명" className="rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm outline-none focus:border-[#86868b]" />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일" className="rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm outline-none focus:border-[#86868b]" />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        onClick={handleCreate}
        disabled={creating}
        className="w-full rounded-full bg-[#1d1d1f] py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
      >
        {creating ? "생성 중..." : "클라이언트 + 계정 만들기"}
      </button>
    </div>
  );
}

function CreateContractModal({
  onClose,
  onCreated,
  initialCompanyName,
  initialContactName,
  initialContactEmail,
  initialBizRegCertUrl,
}: {
  onClose: () => void;
  onCreated: (contract: Contract) => void;
  initialCompanyName?: string;
  initialContactName?: string;
  initialContactEmail?: string;
  initialBizRegCertUrl?: string;
}) {
  const { appUser } = useAuth();
  const [title, setTitle] = useState("제품개발 용역 계약서");
  const [companyName, setCompanyName] = useState(initialCompanyName ?? "");
  const [contactName, setContactName] = useState(initialContactName ?? "");
  const [contactEmail, setContactEmail] = useState(initialContactEmail ?? "");
  const [bodyText, setBodyText] = useState(DEFAULT_CONTRACT_BODY_TEMPLATE);
  const [handyhandIsGap, setHandyhandIsGap] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [linkedClientId, setLinkedClientId] = useState("");

  useEffect(() => listenContractTemplates(setTemplates), []);
  useEffect(() => listenClients(setClients), []);

  // 이미 계정 있는 클라이언트를 골랐으면 상호명은 굳이 다시 타이핑할 필요 없이 그 회사명을
  // 그대로 채워준다 — 나중에 상세 화면에서 언제든 고칠 수 있다.
  function handleSelectClient(id: string) {
    setLinkedClientId(id);
    const client = clients.find((c) => c.id === id);
    if (client) setCompanyName(client.name);
  }

  // 저장된 템플릿이 있으면 기본 템플릿({{companyName}} 식) 대신 첫 번째 저장된 템플릿을
  // 기본값으로 미리 선택해둔다 — 실제로 쓰는 건 항상 커스텀 템플릿 쪽이라, 매번 새로
  // 작성할 때마다 드롭다운에서 다시 골라야 하는 걸 없앤다.
  useEffect(() => {
    if (!selectedTemplateId && templates.length > 0) {
      setSelectedTemplateId(templates[0].id);
      setBodyText(templates[0].bodyHtml);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates]);

  function handleSelectTemplate(id: string) {
    setSelectedTemplateId(id);
    setBodyText(id ? templates.find((t) => t.id === id)!.bodyHtml : DEFAULT_CONTRACT_BODY_TEMPLATE);
  }

  async function handleDeleteTemplate() {
    if (!selectedTemplateId) return;
    await deleteContractTemplate(selectedTemplateId);
    handleSelectTemplate("");
  }

  async function handleSubmit() {
    if (!appUser || !companyName.trim() || !contactName.trim() || !contactEmail.trim()) return;
    setSubmitting(true);
    try {
      const ref = await createContract({
        title: title.trim(),
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        amount: 0,
        currency: "KRW",
        vatApplicable: false,
        handyhandIsGap,
        linkedClientId: linkedClientId || undefined,
        bizRegCertUrl: initialBizRegCertUrl,
        bodyText,
        createdBy: appUser.uid,
      });
      onCreated({
        id: ref.id,
        title: title.trim(),
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        amount: 0,
        currency: "KRW",
        vatApplicable: false,
        handyhandIsGap,
        ...(linkedClientId ? { linkedClientId } : {}),
        ...(initialBizRegCertUrl ? { bizRegCertUrl: initialBizRegCertUrl } : {}),
        bodyText,
        attachments: [],
        version: 1,
        history: [],
        status: "draft",
        memo: "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: appUser.uid,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="max-h-[90dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-3xl bg-white p-6 shadow-xl sm:max-h-none" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#1d1d1f]">새 계약 작성</h2>
            <p className="mt-1 text-xs text-[#86868b]">기본 정보만 먼저 입력하고, 나머지(본문·금액·기간·제품명 등)는 저장 후 상세 화면에서 편집할 수 있습니다.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#d1d1d6] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]">
            <X size={15} />
          </button>
        </div>

        <div className="grid grid-cols-2 items-end gap-3">
          <div>
            <label className="mb-1.5 block text-xs text-[#86868b]">계약 제목</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </div>
          <label className="flex h-[38px] items-center justify-between gap-2 rounded-xl border border-[#e5e5e5] px-3">
            <span className="text-xs text-[#1d1d1f]">{handyhandIsGap ? "우리 회사가 갑" : "우리 회사가 을"}</span>
            <input
              type="checkbox"
              checked={handyhandIsGap}
              onChange={(e) => setHandyhandIsGap(e.target.checked)}
              className="h-4 w-4 shrink-0 accent-[#1d1d1f]"
            />
          </label>
        </div>
        {templates.length > 0 && (
          <div>
            <label className="mb-1.5 block text-xs text-[#86868b]">본문 템플릿</label>
            <div className="flex gap-2">
              <select
                value={selectedTemplateId}
                onChange={(e) => handleSelectTemplate(e.target.value)}
                className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {selectedTemplateId && (
                <>
                  <button
                    type="button"
                    onClick={() => setEditingTemplate(templates.find((t) => t.id === selectedTemplateId) ?? null)}
                    title="이 템플릿 편집"
                    className="rounded-xl border border-[#d1d1d6] p-2 text-[#86868b] hover:border-[#86868b] hover:text-[#1d1d1f]"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteTemplate}
                    title="이 템플릿 삭제"
                    className="rounded-xl border border-[#d1d1d6] p-2 text-[#86868b] hover:border-red-200 hover:text-red-500"
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        {clients.length > 0 && (
          <div>
            <label className="mb-1.5 block text-xs text-[#86868b]">기존 클라이언트 연결 (선택)</label>
            <select
              value={linkedClientId}
              onChange={(e) => handleSelectClient(e.target.value)}
              className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
            >
              <option value="">계정 없는 신규 거래처</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {linkedClientId && (
              <p className="mt-1 text-xs text-[#86868b]">발송하면 이 클라이언트의 로그인 계정 &quot;계약&quot; 메뉴에도 바로 표시됩니다.</p>
            )}
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-xs text-[#86868b]">상호명 ({handyhandIsGap ? "을" : "갑"})</label>
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-[#86868b]">담당자명</label>
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-[#86868b]">담당자 이메일</label>
          <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputClass} />
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || !companyName.trim() || !contactName.trim() || !contactEmail.trim()}
          className="w-full rounded-full bg-[#1d1d1f] py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
        >
          {submitting ? "작성 중..." : "작성하고 계속 편집하기"}
        </button>
      </div>

      {editingTemplate && (
        <TemplateEditModal
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSaved={(bodyHtml) => {
            setBodyText(bodyHtml);
            setEditingTemplate(null);
          }}
        />
      )}
    </div>
  );
}

function TemplateEditModal({
  template,
  onClose,
  onSaved,
}: {
  template: ContractTemplate;
  onClose: () => void;
  onSaved: (bodyHtml: string) => void;
}) {
  const [name, setName] = useState(template.name);
  const [bodyHtml, setBodyHtml] = useState(template.bodyHtml);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await updateContractTemplate(template.id, { name: name.trim(), bodyHtml });
      onSaved(bodyHtml);
    } finally {
      setSaving(false);
    }
  }

  // 템플릿은 특정 계약 건과 무관한 공용 본문이라 실제 회사명·금액이 없다 — 그래도 실제
  // 계약서에 적용했을 때 헤더 블록이 본문 위 공간을 얼마나 차지하는지(쪽 나눔 위치)를
  // 템플릿 작성 시점에 미리 볼 수 있도록, 자리표시자 값으로 채운 헤더를 보여준다.
  const placeholderHeaderData: ContractHeaderData = {
    title: name || "계약서",
    companyName: "(회사명)",
    contactName: "(담당자명)",
    amount: 0,
    currency: "KRW",
    paymentTerms: "(대금지급 방식)",
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-3xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* 상단(제목·템플릿 이름)은 고정해두고, 아래 본문 영역만 스크롤되게 분리한다 —
            본문이 A4 한 페이지 분량이라 길어서, 이름 입력칸이 스크롤에 밀려 안 보이면
            다시 위로 올려야 하는 게 불편했다. */}
        <div className="shrink-0 space-y-3 p-6 pb-3">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold text-[#1d1d1f]">템플릿 편집</h2>
            <button onClick={onClose} className="rounded-full p-1.5 text-[#d1d1d6] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]">
              <X size={15} />
            </button>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[#86868b]">템플릿 이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
            />
          </div>
        </div>
        <div className="no-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-6 pb-6">
          <div>
            <label className="mb-1.5 block text-xs text-[#86868b]">본문 — 실제 계약서와 같은 A4 여백 기준으로 보입니다</label>
            <ContractBodyEditor
              pageStyle
              contractId={`template-${template.id}`}
              headerData={placeholderHeaderData}
              value={bodyHtml}
              onChange={setBodyHtml}
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="w-full rounded-full bg-[#1d1d1f] py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
