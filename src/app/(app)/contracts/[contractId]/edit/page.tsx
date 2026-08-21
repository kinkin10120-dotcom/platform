"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import ContractBodyEditor from "@/components/ContractBodyEditor";
import { listenContract, updateContractDraft } from "@/lib/firestore/contracts";
import { resolveContractTokens, plainTextToHtml } from "@/lib/contractTemplate";
import { Contract } from "@/lib/types";

// "크게 편집"은 예전엔 position:fixed로 화면을 덮는 모달이었는데, iOS 사파리는 그런 화면
// 안에서는 핀치 줌이 거의 동작하지 않고 상단 툴바(position:sticky)도 스크롤/줌 제스처와
// 부딪혀 화면이 틀어지는 문제가 있었다 — 둘 다 브라우저가 "일반 페이지"에서만 제대로
// 지원하는 기본 동작이라, 모달 대신 주소가 따로 있는 독립 페이지로 옮겨서 문제 자체를
// 피한다. 본문 저장은 이 페이지에서 직접 Firestore에 쓰고, 목록 화면은 listenContract로
// 실시간 구독 중이라 뒤로가기만 하면 최신 내용이 자동으로 반영된다.
export default function ContractEditPage() {
  const params = useParams<{ contractId: string }>();
  const router = useRouter();
  const contractId = params.contractId;

  const [contract, setContract] = useState<Contract | null>(null);
  const [bodyText, setBodyText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const initialized = useRef(false);
  // 메인 계약 상세 화면(ContractEditForm)과 같은 이유로, 여기서도 렌더링할 때마다 자동으로
  // 토큰을 치환하지 않는다 — 본문을 한 번이라도 직접 고치면 그 결과가 그대로 저장값으로
  // 굳어버려서, 그 뒤로 상호명 등을 고쳐도 이미 치환된 자리엔 반영이 안 됐다. "본문에 적용"을
  // 눌렀을 때만 치환하고, 누를 때마다 에디터를 새로 그려서 확실히 반영되게 한다.
  const [bodyTextVersion, setBodyTextVersion] = useState(0);

  useEffect(() => listenContract(contractId, setContract), [contractId]);

  // 최초 로드 시 한 번만 본문을 채운다 — 이후 Firestore 실시간 스냅샷이 다시 올 때마다
  // (예: 저장 직후 자기 자신의 변경이 되돌아올 때) 덮어써서 방금 타이핑한 내용이 사라지는
  // 일이 없도록 한다.
  useEffect(() => {
    if (initialized.current || !contract) return;
    initialized.current = true;
    // 메인 상세 화면(ContractEditForm)과 동일하게, 고객이 "수정 요청"에서 직접 고친
    // 본문(빨간 글자로 표시됨)이 있으면 그걸 시작점으로 보여준다 — 여기서도 안 그러면
    // 고객이 뭘 고쳤는지 이 화면에서는 보이지 않는 것처럼 느껴진다.
    setBodyText(contract.revisionRequestedBodyText || contract.bodyText || "");
  }, [contract]);

  async function handleSave() {
    if (!contract) return;
    setSaving(true);
    try {
      // 고객의 수정 요청 본문(revisionRequestedBodyText)은 관리자가 실제로 본문을 고쳐 저장하는
      // 순간 이미 반영/처리된 것이므로 비운다 — 안 그러면 여기서 저장한 뒤 목록으로 돌아가도
      // 상세 화면이 방금 고친 내용 대신 고객이 보낸 원본 요청을 다시 시작점으로 보여준다.
      await updateContractDraft(contract.id, { bodyText, revisionRequestedBodyText: undefined });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  function handleApplyTokens() {
    if (!contract) return;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setBodyText((prev) => resolveContractTokens(prev, contract));
    setBodyTextVersion((v) => v + 1);
  }

  if (!contract) {
    return <p className="p-6 text-sm text-[#86868b]">불러오는 중...</p>;
  }

  return (
    <ContractBodyEditor
      key={bodyTextVersion}
      pageStyle
      standalonePage
      contractId={contract.id}
      value={plainTextToHtml(bodyText)}
      onChange={setBodyText}
      topBar={
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/contracts")}
              title="계약 목록으로"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d1d1d6] text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
            >
              <ArrowLeft size={16} />
            </button>
            <p className="text-sm text-[#86868b]">계약서 본문 편집 — 계약 목록으로 돌아가려면 왼쪽 버튼을 누르세요.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleApplyTokens}
              title='본문 안의 "(대표자)"/"(담당자명)" 같은 괄호 표기를 지금 저장된 값으로 바꿔 넣습니다'
              className="rounded-full border border-dashed border-[#d1d1d6] px-4 py-2 text-sm font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
            >
              본문에 적용
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-full bg-[#1d1d1f] px-5 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
            >
              {saved ? <Check size={15} /> : null} {saving ? "저장 중..." : saved ? "저장됨" : "저장"}
            </button>
          </div>
        </div>
      }
      headerData={{
        title: contract.title,
        companyName: contract.companyName,
        productName: contract.productName,
        contactName: contract.contactName,
        amount: contract.amount,
        currency: contract.currency,
        vatApplicable: contract.vatApplicable,
        periodStart: contract.periodStart,
        periodEnd: contract.periodEnd,
        paymentTerms: contract.paymentTerms,
        handyhandIsGap: contract.handyhandIsGap,
      }}
    />
  );
}
