import { getFunctions, httpsCallable } from "firebase/functions";
import app from "@/lib/firebase";

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

export async function sendPasswordResetEmail(email: string, name?: string) {
  const fn = httpsCallable<{ email: string; name?: string }, { ok: boolean }>(
    functions,
    "sendPasswordResetLink"
  );
  const res = await fn({ email, name });
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
