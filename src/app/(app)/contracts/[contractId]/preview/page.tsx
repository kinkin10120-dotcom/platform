"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ContractPreviewModal from "@/components/ContractPreviewModal";
import { listenContract } from "@/lib/firestore/contracts";
import { resolveContractTokens } from "@/lib/contractTemplate";
import { Contract } from "@/lib/types";

// "크게 편집"과 같은 이유로 독립 페이지로 뺐다 — 예전엔 목록/상세 2단 그리드(lg:grid-cols-2)
// 안의 "상세" 칸 하나를 미리보기로 대체하는 방식이었는데, 그 안에서는 데스크탑에서 반쪽
// 폭에 갇히는 문제가 있었고, CSS만으로 그리드를 벗어나게 하는 "풀블리드" 기법은 <main>의
// overflow-y-auto와 부딪혀 레이아웃이 깨졌다. 독립 페이지면 애초에 그 그리드 안에 있지
// 않으므로 이 문제 자체가 생기지 않는다.
export default function ContractPreviewPage() {
  const params = useParams<{ contractId: string }>();
  const router = useRouter();
  const contractId = params.contractId;

  const [contract, setContract] = useState<Contract | null>(null);

  useEffect(() => listenContract(contractId, setContract), [contractId]);

  if (!contract) {
    return <p className="p-6 text-sm text-[#86868b]">불러오는 중...</p>;
  }

  const isFinal = contract.status === "signed" || contract.status === "linked";
  // 메인 상세 화면(ContractEditForm)과 동일하게, 고객이 "수정 요청"에서 직접 고친 본문이
  // 있으면 그걸 우선한다 — 안 그러면 이 미리보기에서는 고객이 뭘 고쳤는지 안 보인다.
  const draftBodyText = contract.revisionRequestedBodyText || contract.bodyText;
  const bodyText = resolveContractTokens(isFinal ? contract.signedBodyText ?? contract.bodyText : draftBodyText, contract);

  return (
    <ContractPreviewModal
      onClose={() => router.push("/contracts")}
      data={{
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
        bodyText,
        attachments: (isFinal ? contract.signedAttachments : contract.attachments) ?? [],
        signerName: contract.signerName,
        signerTitle: contract.signerTitle,
        signedAt: contract.signedAt,
        signatureUrl: contract.signatureUrl,
        contentHash: isFinal ? contract.contentHash : undefined,
      }}
    />
  );
}
