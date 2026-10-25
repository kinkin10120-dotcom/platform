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

// 이메일 재설정 링크는 Firebase가 호스팅하는 페이지라 중국 등 일부 해외 네트워크에서
// 접속이 안 될 수 있다 — 그런 계정은 관리자가 화면에서 새 비밀번호를 직접 입력해 즉시
// 바꿔줄 수 있게 한다.
export async function setUserPasswordDirectly(uid: string, password: string) {
  const fn = httpsCallable<{ uid: string; password: string }, { ok: boolean }>(functions, "adminSetUserPassword");
  const res = await fn({ uid, password });
  return res.data;
}

export interface CreatePartnerAccountInput {
  email: string;
  name: string;
  projectIds: string[];
  partnerLang: "ko" | "zh";
}

export async function createPartnerAccount(input: CreatePartnerAccountInput) {
  const fn = httpsCallable<CreatePartnerAccountInput, { uid: string }>(functions, "createPartnerAccount");
  const res = await fn(input);
  return res.data;
}

export interface CreateAdminAccountInput {
  email: string;
  name: string;
}

export async function createAdminAccount(input: CreateAdminAccountInput) {
  const fn = httpsCallable<CreateAdminAccountInput, { uid: string }>(functions, "createAdminAccount");
  const res = await fn(input);
  return res.data;
}

export async function updatePartnerProjects(uid: string, projectIds: string[], partnerLang: "ko" | "zh") {
  const fn = httpsCallable<{ uid: string; projectIds: string[]; partnerLang: "ko" | "zh" }, { ok: boolean }>(
    functions,
    "updatePartnerProjects"
  );
  const res = await fn({ uid, projectIds, partnerLang });
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

// 같은 기기(브라우저)가 로그아웃 없이 또는 이 정리 로직 추가 이전에 다른 계정으로 전환되며
// 푸시 토큰이 두 계정에 동시에 남은 경우를 찾아 정리한다 — 1회성 점검 도구.
export async function cleanupSharedPushTokens() {
  const fn = httpsCallable<Record<string, never>, { checkedUsers: number; sharedTokens: number; affectedUsers: number }>(
    functions,
    "cleanupSharedPushTokens"
  );
  const res = await fn({});
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
  imageUrl?: string;
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
