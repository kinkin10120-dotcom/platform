import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Contract, ContractAttachment, ContractStatus, Currency } from "@/lib/types";

const colRef = collection(db, "contracts");

function fromDoc(d: any): Contract {
  const data = d.data();
  return {
    id: d.id,
    title: data.title,
    companyName: data.companyName,
    productName: data.productName ?? undefined,
    bizRegNumber: data.bizRegNumber ?? undefined,
    bizCeoName: data.bizCeoName ?? undefined,
    bizAddress: data.bizAddress ?? undefined,
    contactName: data.contactName,
    contactEmail: data.contactEmail,
    contactPhone: data.contactPhone ?? undefined,
    amount: data.amount ?? 0,
    currency: data.currency ?? "KRW",
    vatApplicable: !!data.vatApplicable,
    periodStart: data.periodStart ?? undefined,
    periodEnd: data.periodEnd ?? undefined,
    paymentTerms: data.paymentTerms ?? undefined,
    handyhandIsGap: !!data.handyhandIsGap,
    bodyText: data.bodyText ?? "",
    attachments: data.attachments ?? undefined,
    version: data.version ?? 1,
    history: (data.history ?? []).map((h: any) => ({
      version: h.version,
      bodyText: h.bodyText,
      attachments: h.attachments ?? undefined,
      note: h.note ?? undefined,
      updatedAt: h.updatedAt?.toMillis ? h.updatedAt.toMillis() : h.updatedAt,
    })),
    status: data.status ?? "draft",
    revisionNote: data.revisionNote ?? undefined,
    revisionRequestedBodyText: data.revisionRequestedBodyText ?? undefined,
    sentBy: data.sentBy ?? undefined,
    sentAt: data.sentAt?.toMillis ? data.sentAt.toMillis() : data.sentAt,
    sentIp: data.sentIp ?? undefined,
    sentUserAgent: data.sentUserAgent ?? undefined,
    sentContentHash: data.sentContentHash ?? undefined,
    viewedAt: data.viewedAt?.toMillis ? data.viewedAt.toMillis() : data.viewedAt,
    viewedVersion: data.viewedVersion,
    signedAt: data.signedAt?.toMillis ? data.signedAt.toMillis() : data.signedAt,
    signerName: data.signerName ?? undefined,
    signerTitle: data.signerTitle ?? undefined,
    authorityConfirmed: !!data.authorityConfirmed,
    consentAcknowledged: !!data.consentAcknowledged,
    signerEmail: data.signerEmail ?? undefined,
    signatureUrl: data.signatureUrl ?? undefined,
    signedBodyText: data.signedBodyText ?? undefined,
    signedAttachments: data.signedAttachments ?? undefined,
    signedVersion: data.signedVersion ?? undefined,
    contentHash: data.contentHash ?? undefined,
    signerIp: data.signerIp ?? undefined,
    signerUserAgent: data.signerUserAgent ?? undefined,
    linkedClientId: data.linkedClientId ?? undefined,
    bizRegCertUrl: data.bizRegCertUrl ?? undefined,
    memo: data.memo ?? "",
    createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
    updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now(),
    createdBy: data.createdBy,
  };
}

export function listenAllContracts(cb: (contracts: Contract[]) => void) {
  const q = query(colRef, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map(fromDoc)));
}

export function listenContract(id: string, cb: (contract: Contract | null) => void) {
  return onSnapshot(doc(db, "contracts", id), (snap) => cb(snap.exists() ? fromDoc(snap) : null));
}

export interface CreateContractInput {
  title: string;
  companyName: string;
  productName?: string;
  bizRegNumber?: string;
  bizCeoName?: string;
  bizAddress?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  amount: number;
  currency: Currency;
  vatApplicable?: boolean;
  periodStart?: string;
  periodEnd?: string;
  paymentTerms?: string;
  handyhandIsGap?: boolean;
  bodyText: string;
  createdBy: string;
  // 이미 계정이 있는 클라이언트에게 보내는 추가 계약이면 여기서 바로 연결한다 — 그 클라이언트의
  // 로그인 계정에서 "계약" 메뉴(getMyContracts)로 곧바로 보이게 된다. 계정이 없는 신규
  // 거래처는 지금까지처럼 서명 완료 후 CreateAccountSection에서 나중에 연결한다.
  linkedClientId?: string;
  // 견적서 수락 시 고객이 이미 사업자등록증을 첨부했다면 그대로 이어받는다 — 계약 서명
  // 페이지의 첨부 박스는 이 값이 이미 있으면 자동으로 숨겨져서, 중복으로 다시 요구하지 않는다.
  bizRegCertUrl?: string;
  // 복제로 만든 계약은 원본의 별첨을 그대로 이어받는다(같은 Storage 파일을 가리키는 URL 배열을
  // 복사할 뿐이다 — deleteContract는 Storage 파일을 지우지 않으므로 원본을 지워도 안전하다).
  attachments?: ContractAttachment[];
}

export async function createContract(input: CreateContractInput) {
  const ref = doc(colRef);
  await setDoc(ref, {
    title: input.title,
    companyName: input.companyName,
    ...(input.productName ? { productName: input.productName } : {}),
    ...(input.bizRegNumber ? { bizRegNumber: input.bizRegNumber } : {}),
    ...(input.bizCeoName ? { bizCeoName: input.bizCeoName } : {}),
    ...(input.bizAddress ? { bizAddress: input.bizAddress } : {}),
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    ...(input.contactPhone ? { contactPhone: input.contactPhone } : {}),
    amount: input.amount,
    currency: input.currency,
    vatApplicable: !!input.vatApplicable,
    ...(input.periodStart ? { periodStart: input.periodStart } : {}),
    ...(input.periodEnd ? { periodEnd: input.periodEnd } : {}),
    ...(input.paymentTerms ? { paymentTerms: input.paymentTerms } : {}),
    handyhandIsGap: !!input.handyhandIsGap,
    ...(input.linkedClientId ? { linkedClientId: input.linkedClientId } : {}),
    ...(input.bizRegCertUrl ? { bizRegCertUrl: input.bizRegCertUrl } : {}),
    bodyText: input.bodyText,
    attachments: input.attachments ?? [],
    version: 1,
    history: [],
    status: "draft" as ContractStatus,
    memo: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: input.createdBy,
  });
  return ref;
}

export type ContractDraftPatch = Partial<
  Pick<
    Contract,
    | "title"
    | "companyName"
    | "productName"
    | "bizRegNumber"
    | "bizCeoName"
    | "bizAddress"
    | "contactName"
    | "contactEmail"
    | "contactPhone"
    | "amount"
    | "currency"
    | "vatApplicable"
    | "periodStart"
    | "periodEnd"
    | "paymentTerms"
    | "handyhandIsGap"
    | "bodyText"
    | "revisionRequestedBodyText"
    | "attachments"
    | "memo"
  >
>;

// 같은 거래처와 계약을 한 건 더 맺는 경우(이중 계약)를 위해, 기존 계약의 입력값과 본문을 그대로
// 가진 새 "작성중" 계약을 만든다. 서명·발송에 관한 흔적(status/서명 이미지/서명자/발송·열람 시각/
// signedBodyText/history/version)은 절대 따라오면 안 되므로, 문서를 통째로 복사하지 않고
// createContract가 받는 입력 필드만 골라 넘긴다 — 새로 추가되는 서명 관련 필드가 실수로
// 딸려오는 일이 구조적으로 불가능하다.
export async function duplicateContract(source: Contract, createdBy: string) {
  return createContract({
    title: `${source.title} (사본)`,
    companyName: source.companyName,
    productName: source.productName,
    bizRegNumber: source.bizRegNumber,
    bizCeoName: source.bizCeoName,
    bizAddress: source.bizAddress,
    contactName: source.contactName,
    contactEmail: source.contactEmail,
    contactPhone: source.contactPhone,
    amount: source.amount,
    currency: source.currency,
    vatApplicable: source.vatApplicable,
    periodStart: source.periodStart,
    periodEnd: source.periodEnd,
    paymentTerms: source.paymentTerms,
    handyhandIsGap: source.handyhandIsGap,
    // 서명 완료본(signedBodyText)이 아니라 편집 원본을 복사한다 — 서명본은 토큰이 이미 값으로
    // 치환·동결된 상태라, 이걸 물려받으면 새 계약에서 금액·기간을 고쳐도 본문이 안 따라온다.
    bodyText: source.bodyText,
    attachments: source.attachments,
    linkedClientId: source.linkedClientId,
    bizRegCertUrl: source.bizRegCertUrl,
    createdBy,
  });
}

export async function updateContractDraft(id: string, patch: ContractDraftPatch) {
  // Firestore는 필드값으로 undefined를 허용하지 않는다 — 선택 필드가 비어있을 때(사업자번호,
  // 용역기간, 대금지급방식 등) undefined가 그대로 전달되면 updateDoc 자체가 실패한다.
  // 값이 비었다는 뜻을 그대로 반영하도록 undefined는 null로 바꿔서 보낸다.
  const sanitized = Object.fromEntries(
    Object.entries(patch).map(([key, value]) => [key, value === undefined ? null : value])
  );
  return updateDoc(doc(db, "contracts", id), { ...sanitized, updatedAt: serverTimestamp() });
}

export async function linkContractToClient(contractId: string, clientId: string) {
  return updateDoc(doc(db, "contracts", contractId), {
    linkedClientId: clientId,
    status: "linked" as ContractStatus,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteContract(id: string) {
  return deleteDoc(doc(db, "contracts", id));
}
