import { getFunctions, httpsCallable } from "firebase/functions";
import app from "@/lib/firebase";
import { Currency } from "@/lib/types";

const functions = getFunctions(app, "asia-northeast3"); // 함수 배포 리전과 동일하게 맞춰주세요

export interface CreateClientAccountInput {
  email: string;
  name: string;
  clientId: string;
}

export interface CreateClientAccountResult {
  uid: string;
}

export async function createClientAccount(input: CreateClientAccountInput) {
  const fn = httpsCallable<CreateClientAccountInput, CreateClientAccountResult>(
    functions,
    "createClientAccount"
  );
  const res = await fn(input);
  return res.data;
}

export async function sendPasswordResetEmail(email: string, name?: string, company?: string) {
  const fn = httpsCallable<{ email: string; name?: string; company?: string }, { ok: boolean }>(
    functions,
    "sendPasswordResetLink"
  );
  const res = await fn({ email, name, company });
  return res.data;
}

export async function sendContract(contractId: string) {
  const fn = httpsCallable<{ contractId: string }, { ok: boolean }>(functions, "sendContract");
  const res = await fn({ contractId });
  return res.data;
}

export async function deleteClientAccount(uid: string) {
  const fn = httpsCallable<{ uid: string }, { ok: boolean; uid: string }>(
    functions,
    "deleteClientAccount"
  );
  const res = await fn({ uid });
  return res.data;
}

// ---- 계약 전자서명 (로그인 없이 호출 — 상대방은 계정이 없는 상태) ----

export interface ContractSigningAttachment {
  id: string;
  title: string;
  bodyHtml: string;
}

export interface MyContractSummary {
  id: string;
  title: string;
  companyName: string;
  productName?: string;
  status: "draft" | "sent" | "revision_requested" | "signed" | "linked";
  amount: number;
  currency: "KRW" | "USD";
  createdAt: number;
  signedAt?: number;
}

export async function getMyContracts() {
  const fn = httpsCallable<void, { items: MyContractSummary[] }>(functions, "getMyContracts");
  const res = await fn();
  return res.data.items;
}

export interface ContractSigningView {
  status: "draft" | "sent" | "revision_requested" | "signed" | "linked";
  title: string;
  companyName: string;
  productName?: string;
  contactName: string;
  amount: number;
  currency: "KRW" | "USD";
  vatApplicable: boolean;
  periodStart?: string;
  periodEnd?: string;
  paymentTerms?: string;
  handyhandIsGap?: boolean;
  bodyText: string;
  attachments: ContractSigningAttachment[];
  version: number;
  signedAt?: number;
  bizRegCertUploaded: boolean;
  contentHash?: string;
  signerName?: string;
  signerTitle?: string;
  signerIp?: string;
  signerUserAgent?: string;
}

export async function getContractForSigning(contractId: string, email: string) {
  const fn = httpsCallable<{ contractId: string; email: string }, ContractSigningView>(
    functions,
    "getContractForSigning"
  );
  const res = await fn({ contractId, email });
  return res.data;
}

export interface SubmitContractSignatureInput {
  contractId: string;
  email: string;
  signerName: string;
  signerTitle?: string;
  authorityConfirmed: boolean;
  signatureDataUrl: string;
  consentAcknowledged: boolean;
  bizRegCertDataUrl?: string;
}

export async function submitContractSignature(input: SubmitContractSignatureInput) {
  const fn = httpsCallable<SubmitContractSignatureInput, { ok: boolean }>(
    functions,
    "submitContractSignature"
  );
  const res = await fn(input);
  return res.data;
}

export async function requestContractRevision(contractId: string, email: string, bodyText: string) {
  const fn = httpsCallable<{ contractId: string; email: string; bodyText: string }, { ok: boolean }>(
    functions,
    "requestContractRevision"
  );
  const res = await fn({ contractId, email, bodyText });
  return res.data;
}

export async function resendContractInvite(contractId: string) {
  const fn = httpsCallable<{ contractId: string }, { ok: boolean }>(functions, "resendContractInvite");
  const res = await fn({ contractId });
  return res.data;
}

export async function uploadContractBizRegCert(contractId: string, email: string, fileDataUrl: string) {
  const fn = httpsCallable<{ contractId: string; email: string; fileDataUrl: string }, { ok: boolean; bizRegCertUrl: string }>(
    functions,
    "uploadContractBizRegCert"
  );
  const res = await fn({ contractId, email, fileDataUrl });
  return res.data;
}

export interface IssueQuoteItemInput {
  name: string;
  unitPrice: number;
  currency: Currency;
  quantity: number;
  unit?: string;
  vatApplicable?: boolean;
}

export async function issueQuote(quoteId: string, items: IssueQuoteItemInput[], memo: string) {
  const fn = httpsCallable<{ quoteId: string; items: IssueQuoteItemInput[]; memo: string }, { ok: boolean }>(
    functions,
    "issueQuote"
  );
  const res = await fn({ quoteId, items, memo });
  return res.data;
}

export interface QuoteViewingResult {
  quoteId: string;
  name: string;
  company?: string;
  items: IssueQuoteItemInput[];
  quoteMemo: string;
  quoteStatus: "sent" | "accepted" | "declined" | "expired";
  quoteIssuedAt: number;
  quoteIssuedBy?: string;
  bizRegCertUploaded: boolean;
}

export async function getQuoteForViewing(quoteId: string, email: string) {
  const fn = httpsCallable<{ quoteId: string; email: string }, QuoteViewingResult>(functions, "getQuoteForViewing");
  const res = await fn({ quoteId, email });
  return res.data;
}

export async function respondToQuote(quoteId: string, email: string, accept: boolean, reason?: string) {
  const fn = httpsCallable<{ quoteId: string; email: string; accept: boolean; reason?: string }, { ok: boolean }>(
    functions,
    "respondToQuote"
  );
  const res = await fn({ quoteId, email, accept, reason });
  return res.data;
}

export async function uploadQuoteBizRegCert(quoteId: string, email: string, fileDataUrl: string) {
  const fn = httpsCallable<{ quoteId: string; email: string; fileDataUrl: string }, { ok: boolean; bizRegCertUrl: string }>(
    functions,
    "uploadQuoteBizRegCert"
  );
  const res = await fn({ quoteId, email, fileDataUrl });
  return res.data;
}

// 구매발주 회신본 열기 — 저장된 건 파일 경로뿐이고, 파일 내용은 이 엔드포인트가 관리자인지
// 확인한 뒤 직접 내려준다(외부에 남는 공개 URL을 만들지 않기 위함). 받은 바이트로 브라우저
// 안에서만 쓰이는 임시 주소(blob:)를 만들어 새 탭에서 연다 — 그 주소는 탭을 닫으면 사라진다.
export async function fetchSupplierOrderFile(path: string): Promise<string> {
  const { getAuth } = await import("firebase/auth");
  const user = getAuth(app).currentUser;
  if (!user) throw new Error("로그인이 필요합니다.");
  const idToken = await user.getIdToken();
  const res = await fetch("https://asia-northeast3-handyhand-a175a.cloudfunctions.net/supplierOrderFile", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error(`파일을 가져오지 못했습니다 (${res.status})`);
  return URL.createObjectURL(await res.blob());
}
