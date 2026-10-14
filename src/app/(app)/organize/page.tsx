"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  documentId,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Copy,
  FileBarChart,
  MessageSquarePlus,
  Mic,
  Paperclip,
  Scissors,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { zh, usePartnerZh, useZhAutoTranslate } from "@/lib/i18n";
import { setAiAssistantDraft } from "@/lib/aiAssistantHandoff";
import {
  uploadPartnerArchiveFile,
  addPartnerArchiveComment,
  deletePartnerArchiveFile,
  deletePartnerArchiveComment,
  PARTNER_ARCHIVE_MAX_FILE_SIZE,
} from "@/lib/firestore/partnerArchive";
import { getAdmins } from "@/lib/firestore/users";
import { createNotification } from "@/lib/firestore/notifications";
import { listenConversations, listenMessages, createConversation, renameConversation, addMessage, deleteConversation } from "@/lib/firestore/assistantChat";
import { toProxiedUrl } from "@/lib/storageProxy";
import { AssistantConversation, AssistantMessage } from "@/lib/types";
import { compressImage } from "@/lib/imageCompress";
import { extractFileText } from "@/lib/extractFileText";
import { sortProjectsByUsage, recordProjectUsage } from "@/lib/projectUsage";

// 협력사 전용 "정리 도구" — work-intake(intake.handyhand.co.kr)의 협력사 화면과 같은
// 아이디어(텍스트/사진을 던지면 AI가 맞는 프로젝트·업무를 찾아 코멘트까지 써준다)를
// 사이트 안에 그대로 들여왔다. 별도 앱으로 두면 이미 로그인된 세션인데도 다시 로그인해야
// 하고 새 탭으로 열려 다른 메뉴와 경험이 달랐는데, 이걸 없애려고 사이트 내부 페이지로
// 새로 만들었다(로그인·세션은 useAuth() 그대로 재사용). 최종 저장 위치는 "협력사
// 자료함"(partnerArchiveFiles/partnerArchiveComments)이고, 업무 완료 처리·체크리스트·
// 새 업무 생성은 여전히 하지 않는다(Firestore 규칙상 관리자 전용 쓰기라 애초에 안 되고,
// 그 권한을 열지는 별도로 판단하기로 함).

interface TaskCandidate {
  taskId: string;
  taskName: string;
  taskNameZh?: string;
  status: string;
  dueDate?: string;
  description?: string;
}
interface ProjectCandidate {
  projectId: string;
  projectName: string;
  projectNameZh?: string;
  clientName: string;
  tasks: TaskCandidate[];
}

interface PriceHistoryEntry {
  name: string;
  spec?: string;
  unit?: string;
  unitPrice: number;
  currency: string;
  quantity?: number;
  source: "견적서" | "발주서" | "카탈로그";
  date: string;
}

// AI 비서가 "견적서/청구서 작성"이나 "가격 질문"을 판단할 때 참고할, 이 협력사 본인의
// 과거 견적서·발주서 품목 단가를 모은다. 실시간 구독까지는 필요 없어(비서를 부를 때만
// 한 번 쓰는 참고 자료) getDocs로 한 번만 읽는다.
async function fetchPriceHistory(partnerId: string): Promise<PriceHistoryEntry[]> {
  const toDateStr = (v: unknown): string => {
    const ts = v as { toDate?: () => Date } | undefined;
    return ts?.toDate ? ts.toDate().toISOString().slice(0, 10) : "";
  };
  const [quoteSnap, orderSnap, internalSnap, supplierProductSnap] = await Promise.all([
    getDocs(query(collection(db, "supplierQuotes"), where("partnerId", "==", partnerId))),
    getDocs(query(collection(db, "supplierOrders"), where("partnerId", "==", partnerId))),
    getDocs(query(collection(db, "clientProductInternal"), where("partnerId", "==", partnerId))),
    getDocs(query(collection(db, "supplierProducts"), where("partnerId", "==", partnerId))),
  ]);
  const out: PriceHistoryEntry[] = [];
  quoteSnap.docs.forEach((d) => {
    const data = d.data();
    const date = toDateStr(data.submittedAt);
    (data.items ?? []).forEach((it: { nameKo?: string; name: string; spec?: string; unit?: string; unitPrice: number; quantity?: number }) => {
      if (!it.unitPrice) return;
      out.push({ name: it.nameKo || it.name, spec: it.spec, unit: it.unit, unitPrice: it.unitPrice, currency: data.currency, quantity: it.quantity, source: "견적서", date });
    });
  });
  orderSnap.docs.forEach((d) => {
    const data = d.data();
    const date = toDateStr(data.createdAt);
    (data.items ?? []).forEach((it: { name: string; spec?: string; unit?: string; unitPrice: number; quantity?: number }) => {
      if (!it.unitPrice) return;
      out.push({ name: it.name, spec: it.spec, unit: it.unit, unitPrice: it.unitPrice, currency: data.currency, quantity: it.quantity, source: "발주서", date });
    });
  });
  internalSnap.docs.forEach((d) => {
    const data = d.data();
    if (!data.purchasePrice) return;
    out.push({
      name: data.productName || "",
      unit: data.productUnit,
      unitPrice: data.purchasePrice,
      currency: data.purchaseCurrency ?? "USD",
      source: "카탈로그",
      date: toDateStr(data.updatedAt),
    });
  });
  supplierProductSnap.docs.forEach((d) => {
    const data = d.data();
    if (!data.purchasePrice) return;
    out.push({
      name: data.name ?? "",
      spec: data.spec,
      unit: data.unit,
      unitPrice: data.purchasePrice,
      currency: data.purchaseCurrency ?? "USD",
      source: "카탈로그",
      date: toDateStr(data.updatedAt),
    });
  });
  out.sort((a, b) => b.date.localeCompare(a.date));
  return out.slice(0, 200);
}

interface OrderStatusEntry {
  soNumber: string;
  items: string;
  totalAmount: number;
  currency: string;
  issuedAt: string;
  invoiceStatus: "미청구" | "청구됨(지급 대기)" | "지급완료";
}

// AI 비서가 "내 발주 중 뭐가 아직 입금 안 됐지?" 같은 질문에 답할 때 쓴다. 발행된 발주서
// (status가 draft인 건 아직 협력사에게 공개 전이라 제외 — 다른 화면과 동일한 기준) 각각이
// 어느 청구서에 담겨 제출/지급됐는지 교차 확인해서 상태를 매긴다.
async function fetchOrderStatus(partnerId: string): Promise<OrderStatusEntry[]> {
  const toDateStr = (v: unknown): string => {
    const ts = v as { toDate?: () => Date } | undefined;
    return ts?.toDate ? ts.toDate().toISOString().slice(0, 10) : "";
  };
  const [orderSnap, invoiceSnap] = await Promise.all([
    getDocs(query(collection(db, "supplierOrders"), where("partnerId", "==", partnerId))),
    getDocs(query(collection(db, "supplierInvoices"), where("partnerId", "==", partnerId))),
  ]);
  // 발주서 id -> "지급완료" | "청구됨(지급 대기)" — 청구서 품목 중 source:"order"인 것만 본다.
  const invoiceStatusByOrderId = new Map<string, "지급완료" | "청구됨(지급 대기)">();
  invoiceSnap.docs.forEach((d) => {
    const data = d.data();
    const paid = data.status === "paid";
    (data.items ?? []).forEach((it: { source?: string; supplierOrderId?: string }) => {
      if (it.source !== "order" || !it.supplierOrderId) return;
      if (paid || !invoiceStatusByOrderId.has(it.supplierOrderId)) {
        invoiceStatusByOrderId.set(it.supplierOrderId, paid ? "지급완료" : "청구됨(지급 대기)");
      }
    });
  });
  const out: OrderStatusEntry[] = [];
  orderSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.status !== "issued") return;
    const items = (data.items ?? []).map((it: { name: string }) => it.name).join(", ");
    out.push({
      soNumber: data.soNumber ?? "",
      items,
      totalAmount: data.totalAmount ?? 0,
      currency: data.currency ?? "USD",
      issuedAt: toDateStr(data.issuedAt),
      invoiceStatus: invoiceStatusByOrderId.get(d.id) ?? "미청구",
    });
  });
  out.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  return out.slice(0, 100);
}

interface ArchiveFileEntry {
  id: string;
  name: string;
  url: string;
  projectName?: string;
  taskName?: string;
  uploadedAt: number;
}

// AI 비서가 "지난번에 올린 도면 찾아줘" 같은 자료함 검색 질문에 답할 때 쓴다. 프로젝트별로
// 나뉜 partnerArchiveFiles를, 이 협력사가 배정된 모든 프로젝트에 걸쳐 한 번에 모아온다.
async function fetchArchiveFiles(candidates: ProjectCandidate[]): Promise<ArchiveFileEntry[]> {
  const projectIds = candidates.map((p) => p.projectId);
  if (projectIds.length === 0) return [];
  const projectNameById = new Map(candidates.map((p) => [p.projectId, p.projectName]));
  const taskNameById = new Map(candidates.flatMap((p) => p.tasks.map((t) => [t.taskId, t.taskName] as const)));
  const out: ArchiveFileEntry[] = [];
  for (const part of chunk(projectIds, 10)) {
    // eslint-disable-next-line no-await-in-loop
    const snap = await getDocs(query(collection(db, "partnerArchiveFiles"), where("projectId", "in", part)));
    snap.docs.forEach((d) => {
      const data = d.data();
      out.push({
        id: d.id,
        name: data.name,
        url: data.url,
        projectName: projectNameById.get(data.projectId),
        taskName: data.taskId ? taskNameById.get(data.taskId) : undefined,
        uploadedAt: data.uploadedAt?.toMillis ? data.uploadedAt.toMillis() : Date.now(),
      });
    });
  }
  out.sort((a, b) => b.uploadedAt - a.uploadedAt);
  return out.slice(0, 200);
}

interface IntakeItem {
  id: string;
  file: File | null;
  text: string;
  previewUrl: string | null;
  status: "queued" | "classifying" | "ready" | "uploading" | "done" | "error";
  selectedProjectId: string;
  selectedTaskId: string;
  commentText: string;
  confidence?: "high" | "medium" | "low";
  errorMessage: string;
  uploadProgress: number;
  groupId: string | null;
}

// 업로드 직후 "취소" 토스트가 되돌리는 데 필요한 최소 정보.
interface UploadToast {
  id: string;
  label: string;
  fileDocId?: string;
  storagePath?: string;
  commentDocId?: string;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function newId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function prepareImagePayload(file: File | null) {
  if (!file || !file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return { imageBase64: undefined as string | undefined, imageFileType: undefined as string | undefined };
  }
  const compressed = await compressImage(file);
  const imageBase64 = await blobToBase64(compressed);
  return { imageBase64, imageFileType: "image/jpeg" as string | undefined };
}

const PDF_MAX_BYTES = 4 * 1024 * 1024;

async function preparePdfPayload(file: File | null) {
  if (!file || file.type !== "application/pdf" || file.size > PDF_MAX_BYTES) {
    return { pdfBase64: undefined as string | undefined };
  }
  return { pdfBase64: await blobToBase64(file) };
}

async function callClassify(
  group: { file: File | null; text: string }[],
  candidates: ProjectCandidate[],
  lang: "ko" | "zh",
  fixed?: { fixedProjectName: string; fixedTaskName: string }
) {
  const groupFiles = await Promise.all(
    group
      .filter((it) => it.file)
      .map(async (it) => {
        const { imageBase64, imageFileType } = await prepareImagePayload(it.file);
        return { fileName: it.file!.name, fileType: imageFileType ?? it.file!.type, imageBase64 };
      })
  );
  const text = group.map((it) => it.text.trim()).filter(Boolean).join("\n\n") || undefined;
  const single = group.length === 1 ? group[0] : null;
  // 이미지가 아닌 단일 파일(엑셀 등)은 AI가 내용을 볼 수 없으므로 미리 텍스트를 추출해 같이
  // 보낸다. PDF는 클라이언트에서 파싱하지 않고(웹팩 번들링 문제) 서버에서 추출한다.
  const fileTextExcerpt =
    single?.file && !single.file.type.startsWith("image/") ? await extractFileText(single.file) : null;
  const { pdfBase64 } = groupFiles.length > 1 ? { pdfBase64: undefined } : await preparePdfPayload(single?.file ?? null);
  const body =
    groupFiles.length > 1
      ? { text, groupFiles, candidates, lang, ...fixed }
      : {
          text,
          fileName: single?.file?.name,
          fileType: groupFiles[0]?.fileType ?? single?.file?.type,
          imageBase64: groupFiles[0]?.imageBase64,
          fileTextExcerpt: fileTextExcerpt ?? undefined,
          pdfBase64,
          candidates,
          lang,
          ...fixed,
        };
  const res = await fetch("/api/classify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  let data: { error?: string; [key: string]: unknown };
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(lang === "zh" ? `无法读取服务器响应 (${res.status})。` : `서버 응답을 읽을 수 없습니다 (${res.status}).`);
  }
  if (!res.ok) throw new Error(data.error ?? zh(lang === "zh", "요청 실패"));
  return data as { projectId: string | null; taskId: string | null; confidence?: "high" | "medium" | "low"; comment?: string };
}

function getRenderGroups(items: IntakeItem[]): (IntakeItem | IntakeItem[])[] {
  const seen = new Set<string>();
  const out: (IntakeItem | IntakeItem[])[] = [];
  for (const item of items) {
    if (item.groupId) {
      if (seen.has(item.groupId)) continue;
      seen.add(item.groupId);
      out.push(items.filter((it) => it.groupId === item.groupId));
    } else {
      out.push(item);
    }
  }
  return out;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function OrganizePage() {
  const { appUser } = useAuth();
  const isZh = usePartnerZh();
  const actorName = appUser?.name ?? "협력사";
  const router = useRouter();

  const [candidates, setCandidates] = useState<ProjectCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [draftText, setDraftText] = useState("");
  const [items, setItems] = useState<IntakeItem[]>([]);
  const [classifyingAll, setClassifyingAll] = useState(false);
  const [uploadingAll, setUploadingAll] = useState(false);
  const [recording, setRecording] = useState(false);
  // 음성 인식은 브라우저 API 특성상 "말하기 시작하기 전에" 언어를 하나 정해야 한다(텍스트처럼
  // 다 듣고 나서 언어를 알아내는 게 불가능하다) — 계정 기본 언어로 시작하되, 직접 바꾸면
  // 이 기기에서는 다음에도 그 언어를 기억해둔다.
  const [voiceLang, setVoiceLang] = useState<"ko" | "zh">(isZh ? "zh" : "ko");
  useEffect(() => {
    const saved = localStorage.getItem("organizeVoiceLang");
    if (saved === "ko" || saved === "zh") setVoiceLang(saved);
  }, []);
  function toggleVoiceLang() {
    setVoiceLang((prev) => {
      const next = prev === "ko" ? "zh" : "ko";
      localStorage.setItem("organizeVoiceLang", next);
      return next;
    });
  }
  const [dragActive, setDragActive] = useState(false);
  const [selectedForGroup, setSelectedForGroup] = useState<string[]>([]);
  const [globalError, setGlobalError] = useState("");
  const [splittingBriefing, setSplittingBriefing] = useState(false);
  const [toasts, setToasts] = useState<UploadToast[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // 일부 브라우저(특히 사파리)는 한글·중문 IME 조합을 끝내는 Enter 키 자체에서
  // e.nativeEvent.isComposing이 이미 false로 바뀌어 있어, 그것만으로는 못 거른다 —
  // compositionstart/end로 직접 조합 상태를 추적해 이중으로 막는다.
  const composingRef = useRef(false);
  // Enter 핸들러와 전송 버튼 양쪽에서 호출될 수 있는데, assistantLoading 상태만으로 막으면
  // React 상태 반영이 한 템포 늦어 거의 동시에 두 번 눌리는 경우(엔터+클릭 등) 막지 못해
  // 같은 메시지가 두 번 전송되는 문제가 있었다 — ref로 즉시(동기적으로) 막는다.
  const sendingRef = useRef(false);
  // 메시지를 막 보낸 직후, Firestore 실시간 리스너가 아직 그 쓰기를 못 따라잡은 "과거 스냅샷"을
  // 돌려줘서 방금 화면에 올린 메시지가 잠깐 사라지는 걸 막는다(이게 "다른 페이지 갔다 와야
  // 보인다"처럼 느껴지는 원인이었다) — 보낸 직후 일정 시간 동안은 메시지 수가 줄어드는
  // 스냅샷을 무시하고, 리스너가 따라잡으면(같거나 많아지면) 그대로 받아들인다.
  const lastSentAtRef = useRef(0);
  // AI 비서 — 클로드 같은 대화형 인터페이스. 메시지 하나(텍스트 + 선택적 첨부파일)를
  // 보내면 "자료 정리 / 견적서 작성 / 청구서 작성 / 가격 질문" 중 뭘 원하는지 AI가 스스로
  // 판단한다(/api/assistant). 자료 정리면 이 페이지의 업로드 큐에 담고, 견적서·청구서면
  // 각자의 작성 페이지로 내용을 채운 채 넘겨주고, 질문이면 대화창에 바로 답한다. 대화
  // 자체(무슨 요청을 했고 AI가 뭘로 이해했는지)는 새로고침·기기 교체에도 안 사라지도록
  // Firestore(assistantConversations)에 남긴다.
  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [chatAttachments, setChatAttachments] = useState<File[]>([]);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }
  function addToast(toast: UploadToast) {
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => dismissToast(toast.id), 6000);
  }
  async function handleUndoToast(toast: UploadToast) {
    dismissToast(toast.id);
    if (toast.fileDocId && toast.storagePath) await deletePartnerArchiveFile(toast.fileDocId, toast.storagePath);
    if (toast.commentDocId) await deletePartnerArchiveComment(toast.commentDocId);
  }

  useEffect(() => {
    if (!appUser) return;
    // 클로드·제미나이처럼 들어올 때마다 새 대화로 시작한다 — 지난 대화를 자동으로 이어서
    // 열면 완전히 다른 용건으로 왔는데 직전 맥락이 남아있어 오히려 헷갈린다는 피드백으로
    // 바꿨다. 지난 대화는 왼쪽 "대화 기록"에서 사람이 직접 골라 들어간다.
    return listenConversations(appUser.uid, setConversations);
  }, [appUser]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    return listenMessages(activeConversationId, (list) => {
      setMessages((prev) => (list.length < prev.length && Date.now() - lastSentAtRef.current < 8000 ? prev : list));
    });
  }, [activeConversationId]);

  function startNewConversation() {
    setActiveConversationId(null);
    setMessages([]);
    setAssistantError("");
    setSidebarOpen(false);
  }

  async function handleDeleteConversation(c: AssistantConversation) {
    if (!confirm(zh(isZh, `"${c.title || "대화"}" 대화 기록을 삭제할까요?`))) return;
    if (c.id === activeConversationId) startNewConversation();
    await deleteConversation(c.id);
  }

  useEffect(() => {
    const ids = appUser?.projectIds ?? [];
    if (!appUser || ids.length === 0) {
      setCandidates([]);
      setLoadingCandidates(false);
      return;
    }
    (async () => {
      const list: ProjectCandidate[] = [];
      for (const part of chunk(ids, 10)) {
        // eslint-disable-next-line no-await-in-loop
        const projectsSnap = await getDocs(query(collection(db, "projects"), where(documentId(), "in", part)));
        // 프로젝트별 업무 조회를 순서대로 하나씩 기다리면, 프록시를 거치는 세션에서는 요청당
        // 지연이 그대로 누적돼(프로젝트 5개면 5번의 왕복을 차례로 기다림) 이 화면 전체가
        // 오래 멈춰 있는 것처럼 보였다 — 한꺼번에 병렬로 보낸다.
        const chunkResults = await Promise.all(
          projectsSnap.docs.map(async (p) => {
            const pd = p.data();
            const tasksSnap = await getDocs(query(collection(db, "tasks"), where("projectId", "==", p.id)));
            return {
              projectId: p.id,
              projectName: pd.name,
              projectNameZh: pd.nameZh || undefined,
              clientName: pd.clientDisplayName ?? "",
              tasks: tasksSnap.docs
                .filter((t) => !t.data().hiddenFromPartner)
                .map((t) => ({
                  taskId: t.id,
                  taskName: t.data().name,
                  taskNameZh: t.data().nameZh || undefined,
                  status: t.data().status,
                  dueDate: t.data().dueDate || undefined,
                  description: t.data().description || undefined,
                })),
            };
          })
        );
        list.push(...chunkResults);
      }
      setCandidates(list);
      setLoadingCandidates(false);
    })();
  }, [appUser]);

  function updateItem(id: string, patch: Partial<IntakeItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      const rest = prev.filter((it) => it.id !== id);
      if (target?.groupId) {
        const remaining = rest.filter((it) => it.groupId === target.groupId);
        if (remaining.length === 1) return rest.map((it) => (it.id === remaining[0].id ? { ...it, groupId: null } : it));
      }
      return rest;
    });
    setSelectedForGroup((prev) => prev.filter((sid) => sid !== id));
  }

  function toggleSelectForGroup(id: string) {
    setSelectedForGroup((prev) => (prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]));
  }

  function handleGroupSelected() {
    if (selectedForGroup.length < 2) return;
    const groupId = newId();
    setItems((prev) => prev.map((it) => (selectedForGroup.includes(it.id) ? { ...it, groupId } : it)));
    setSelectedForGroup([]);
  }

  // 회의/현장에서 여러 프로젝트를 한 번에 언급한 긴 메모 하나를, 프로젝트/업무별로 이미
  // 분류·코멘트까지 끝난 "ready" 상태의 여러 항목으로 바로 쪼개 담는다.
  async function handleSplitBriefing() {
    if (!draftText.trim()) return;
    setSplittingBriefing(true);
    setGlobalError("");
    try {
      const res = await fetch("/api/split-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draftText.trim(), candidates, lang: appUser?.partnerLang ?? "ko" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "나누기에 실패했습니다.");
      const segments: { text?: string; projectId?: string | null; taskId?: string | null; confidence?: "high" | "medium" | "low"; comment?: string }[] =
        Array.isArray(data.segments) ? data.segments : [];
      if (segments.length === 0) {
        setGlobalError(zh(isZh, "나눌 내용을 찾지 못했습니다."));
        return;
      }
      const newItems: IntakeItem[] = segments.map((seg) => ({
        id: newId(),
        file: null,
        text: seg.text ?? "",
        previewUrl: null,
        status: "ready",
        selectedProjectId: seg.projectId ?? "",
        selectedTaskId: seg.taskId ?? "",
        commentText: seg.comment ?? "",
        confidence: seg.confidence,
        errorMessage: "",
        uploadProgress: 0,
        groupId: null,
      }));
      setItems((prev) => [...prev, ...newItems]);
      setDraftText("");
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : zh(isZh, "나누기에 실패했습니다."));
    } finally {
      setSplittingBriefing(false);
    }
  }

  // 입력창 텍스트 하나를 AI 비서(/api/assistant)에게 보낸다 — 의도를 스스로 판단해서
  // 자료 정리/견적서/청구서/질문 중 맞는 결과만 돌려준다. 결과에 따라 이 페이지
  // 업로드 큐에 바로 담거나, 작성 페이지로 넘기거나, 바로 이 자리에 답을 보여준다.
  function addChatAttachments(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setChatAttachments((prev) => [...prev, ...Array.from(fileList)]);
  }
  function removeChatAttachment(index: number) {
    setChatAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  // 대화창 전송 — 텍스트(+첨부파일)를 메시지로 기록하고 AI 비서(/api/assistant)에게
  // 보낸다. 의도에 따라: 자료 정리면 기존 업로드 큐에 담고, 견적서·청구서면 각자의 작성
  // 페이지로 넘길 준비를 해두고(실제 이동은 답변 말풍선의 버튼을 눌러야 한다), 질문이면
  // 바로 말풍선으로 답한다.
  async function handleSendChat() {
    const text = draftText.trim();
    if ((!text && chatAttachments.length === 0) || !appUser) return;
    if (sendingRef.current) return;
    sendingRef.current = true;
    lastSentAtRef.current = Date.now();
    setAssistantLoading(true);
    setAssistantError("");
    const attachments = chatAttachments;
    setDraftText("");
    setChatAttachments([]);
    try {
      let conversationId = activeConversationId;
      const isNewConversation = !conversationId;
      if (!conversationId) {
        // 제목은 AI 응답이 돌아온 뒤 대화 내용을 대표하는 짧은 제목으로 다시 붙인다 —
        // 여기서는 그때까지 목록에 보일 임시 제목만 둔다.
        conversationId = await createConversation(appUser.uid, text.slice(0, 20) || (attachments[0]?.name ?? zh(isZh, "새 대화")));
        setActiveConversationId(conversationId);
      }
      // Firestore 실시간 리스너가 반영되기를 기다리면(특히 막 만든 대화는 리스너가 막
      // 구독을 맺는 시점과 겹쳐) 화면에 바로 안 뜨고 다른 페이지를 갔다 와야 보이는 것처럼
      // 보일 수 있다 — 쓰기와 별개로 화면에는 즉시 반영한다(리스너는 나중에 같은 내용으로
      // 자연스럽게 덮어써서 맞춰진다).
      const userMsg: AssistantMessage = { id: newId(), role: "user", text, attachmentNames: attachments.map((f) => f.name), createdAt: Date.now() };
      setMessages((prev) => [...prev, userMsg]);
      await addMessage(conversationId, { role: "user", text, attachmentNames: attachments.map((f) => f.name) });

      const [priceHistory, orderStatus, archiveFilesFull] = await Promise.all([
        fetchPriceHistory(appUser.uid),
        fetchOrderStatus(appUser.uid),
        fetchArchiveFiles(candidates),
      ]);
      const toDateStr = (ms: number) => new Date(ms).toISOString().slice(0, 10);
      const archiveFiles = archiveFilesFull.map((f) => ({ id: f.id, name: f.name, projectName: f.projectName, taskName: f.taskName, uploadedAt: toDateStr(f.uploadedAt) }));

      // 첨부파일 묶음을 /api/classify와 같은 방식으로 payload화한다.
      let filePayload: Record<string, unknown> = {};
      if (attachments.length > 1) {
        const groupFiles = await Promise.all(
          attachments.map(async (file) => {
            const { imageBase64, imageFileType } = await prepareImagePayload(file);
            return { fileName: file.name, fileType: imageFileType ?? file.type, imageBase64 };
          })
        );
        filePayload = { groupFiles };
      } else if (attachments.length === 1) {
        const file = attachments[0];
        const { imageBase64, imageFileType } = await prepareImagePayload(file);
        const fileTextExcerpt = !file.type.startsWith("image/") ? await extractFileText(file) : null;
        const { pdfBase64 } = await preparePdfPayload(file);
        filePayload = {
          fileName: file.name,
          fileType: imageFileType ?? file.type,
          imageBase64,
          fileTextExcerpt: fileTextExcerpt ?? undefined,
          pdfBase64,
        };
      }

      // 직전 몇 턴을 같이 보내 후속 질문("그거 수량 500개로 바꿔줘" 같은)을 알아듣게 한다 —
      // 텍스트만 추려서(첨부파일 정보는 빼고) 최근 6개까지만, 토큰이 계속 불어나지 않게.
      // Claude API는 메시지가 반드시 user로 시작해야 한다 — 최근 6개를 자르면 짝이 안 맞아
      // assistant로 시작할 수 있으니, 그런 경우 맨 앞 한 개를 더 버려서 user로 맞춘다.
      let recentMessages = messages.slice(-6);
      if (recentMessages[0]?.role === "assistant") recentMessages = recentMessages.slice(1);
      const history = recentMessages.map((m) => ({ role: m.role, text: m.text }));
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text || undefined, candidates, priceHistory, orderStatus, archiveFiles, history, lang: appUser.partnerLang ?? "ko", ...filePayload }),
      });
      const raw = await res.text();
      let data: {
        error?: string;
        intent?: "file_intake" | "quote" | "invoice" | "question" | "archive_search" | "unclear";
        projectId?: string | null;
        taskId?: string | null;
        confidence?: "high" | "medium" | "low";
        comment?: string;
        items?: { name: string; spec?: string; quantity: number; unit?: string; unitPrice: number }[];
        orderNumbers?: string[];
        currency?: "USD" | "CNY" | "KRW" | null;
        memo?: string;
        answer?: string;
        reply?: string;
        fileIds?: string[];
        replyLang?: "ko" | "zh";
        title?: string;
      };
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(isZh ? `无法读取服务器响应 (${res.status})。` : `서버 응답을 읽을 수 없습니다 (${res.status}).`);
      }
      if (!res.ok) throw new Error(data.error ?? zh(isZh, "요청에 실패했습니다."));
      // 대화 목록 제목 — 첫 메시지 원문을 그대로 자르는 대신, AI가 이번 대화 전체를
      // 대표하도록 새로 지어준 짧은 제목으로 바꿔 붙인다(클로드·제미나이 대화 목록과 동일한 방식).
      if (isNewConversation && data.title) {
        renameConversation(conversationId, data.title).catch(() => {});
      }
      // 답변 언어는 계정 기본 설정이 아니라 클로드처럼 이번에 입력한 문장의 언어를 따라간다
      // (중국어 계정이라도 이번에 한국어로 물었으면 한국어로 답한다) — AI가 판단해 돌려준다.
      const replyIsZh = data.replyLang ? data.replyLang === "zh" : isZh;

      if (data.intent === "quote" || data.intent === "invoice") {
        const draftIntent = data.intent;
        // 세션스토리지 한 칸짜리 "보낸 시점에 심어두기" 방식은, 뒤이어 견적/청구 요청을 하나
        // 더 보내거나 같은 버튼을 두 번 누르면 앞서 만든 내용이 사라져 보이는 문제가 있었다
        // — 이제 draft를 메시지 자체에 들고 있다가, 버튼을 누르는 "그 순간"에 심어준다.
        // 청구서(invoice)는 지어낸 품목이 아니라, 이미 발행돼 아직 청구 안 된 실제 발주서를
        // 그대로 골라 담아야 금액이 맞는다 — AI가 [발주 현황]에서 해당하는 soNumber를
        // 골라주면(orderNumbers), 작성 화면에서 그 발주들의 체크박스를 자동으로 선택해준다
        // (잔금·선금 비율 계산은 그 화면의 기존 로직을 그대로 쓴다, 여기서 다시 안 만든다).
        const orderNumbers = draftIntent === "invoice" ? data.orderNumbers ?? [] : undefined;
        const draft = { items: data.items ?? [], orderNumbers, currency: data.currency, memo: data.memo };
        const itemsSummary = (data.items ?? []).map((it) => `${it.name} ${it.quantity}${it.unit ?? "EA"}`).join(", ");
        const orderSummary = orderNumbers && orderNumbers.length > 0 ? orderNumbers.join(", ") : "";
        const summaryText = [orderSummary, itemsSummary].filter(Boolean).join(" / ");
        // 단가·수량을 못 찾아 0으로 남은 품목이 있으면 작성 화면에서 제출 버튼이 "합계 0"
        // 때문에 눌리지 않는다 — 조용히 막히는 대신 왜 안 되는지 미리 알려준다.
        const missingPrice = (data.items ?? []).some((it) => !it.unitPrice || !it.quantity);
        const warning = missingPrice ? zh(replyIsZh, " (단가·수량을 못 찾은 품목이 있어요 — 작성 화면에서 직접 채워주셔야 제출됩니다.)") : "";
        const draftReplyText = `${draftIntent === "quote" ? zh(replyIsZh, "견적서") : zh(replyIsZh, "청구서")} ${zh(replyIsZh, "초안을 만들었어요")}: ${summaryText || zh(replyIsZh, "(품목 없음)")}${warning}`;
        setMessages((prev) => [...prev, { id: newId(), role: "assistant", text: draftReplyText, intent: draftIntent, draft, createdAt: Date.now() }]);
        await addMessage(conversationId, { role: "assistant", text: draftReplyText, intent: draftIntent, draft });
        return;
      }
      if (data.intent === "question") {
        const answerText = data.answer ?? "";
        setMessages((prev) => [...prev, { id: newId(), role: "assistant", text: answerText, intent: "question", createdAt: Date.now() }]);
        await addMessage(conversationId, { role: "assistant", text: answerText, intent: "question" });
        return;
      }
      if (data.intent === "archive_search") {
        // AI가 고른 fileIds를, 실제로 방금 조회해둔 자료함 목록(archiveFilesFull)과 대조해서만
        // 쓴다 — id를 지어냈거나 더 이상 존재하지 않는 파일을 그대로 믿지 않기 위함.
        const fileIds = data.fileIds ?? [];
        const matched = archiveFilesFull.filter((f) => fileIds.includes(f.id));
        // zh()는 고정 문구 사전 조회라 건수가 매번 바뀌는 문장에는 못 쓴다(끼워 넣은 숫자가
        // 다르면 매번 다른 문자열이라 사전에 못 걸림) — 이 두 문장만 직접 분기한다.
        const answerText = data.answer || (matched.length > 0
          ? (replyIsZh ? `在资料库中找到了 ${matched.length} 件。` : `자료함에서 ${matched.length}건을 찾았어요.`)
          : zh(replyIsZh, "자료함에서 해당하는 파일을 못 찾았어요."));
        setMessages((prev) => [...prev, { id: newId(), role: "assistant", text: answerText, intent: "archive_search", archiveResults: matched.length > 0 ? matched : undefined, createdAt: Date.now() }]);
        await addMessage(conversationId, { role: "assistant", text: answerText, intent: "archive_search", archiveResults: matched });
        return;
      }
      if (data.intent === "unclear") {
        // 네 가지 어디에도 안 맞는 애매한 말은 무작정 "담은 자료" 큐에 넣는 대신 되묻기만
        // 한다 — 자료 정리의 기본값이 아니다.
        const replyText = data.reply ?? zh(replyIsZh, "무슨 말씀이신지 잘 모르겠어요. 자료 정리, 견적서·청구서 작성, 가격·일정 질문, 자료함 검색 중 어떤 걸 원하시는지 알려주세요.");
        setMessages((prev) => [...prev, { id: newId(), role: "assistant", text: replyText, intent: "question", createdAt: Date.now() }]);
        await addMessage(conversationId, { role: "assistant", text: replyText, intent: "question" });
        return;
      }
      // file_intake (또는 판단 실패 시 기본값)
      const item: IntakeItem = {
        id: newId(),
        file: attachments[0] ?? null,
        text,
        previewUrl: attachments[0] ? URL.createObjectURL(attachments[0]) : null,
        status: "ready",
        selectedProjectId: data.projectId ?? "",
        selectedTaskId: data.taskId ?? "",
        commentText: data.comment ?? "",
        confidence: data.confidence,
        errorMessage: "",
        uploadProgress: 0,
        groupId: null,
      };
      setItems((prev) => [...prev, item]);
      const project = candidates.find((p) => p.projectId === data.projectId);
      const task = project?.tasks.find((t) => t.taskId === data.taskId);
      const fileIntakeText = project
        ? `"${project.projectName}"${task ? ` / "${task.taskName}"` : ""}${zh(replyIsZh, "로 분류했어요. 아래 담은 자료 목록에서 확인 후 업로드하세요.")}`
        : zh(replyIsZh, "맞는 프로젝트/업무를 확실히 찾지 못했어요. 아래 담은 자료 목록에서 직접 골라주세요.");
      const fileIntakeSummary = { projectName: project?.projectName, taskName: task?.taskName, confidence: data.confidence };
      setMessages((prev) => [...prev, { id: newId(), role: "assistant", text: fileIntakeText, intent: "file_intake", fileIntakeSummary, createdAt: Date.now() }]);
      await addMessage(conversationId, {
        role: "assistant",
        text: fileIntakeText,
        intent: "file_intake",
        fileIntakeSummary,
      });
    } catch (e) {
      setAssistantError(e instanceof Error ? e.message : zh(isZh, "AI 비서 요청에 실패했습니다."));
    } finally {
      setAssistantLoading(false);
      sendingRef.current = false;
    }
  }

  function addFileItems(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const newItems: IntakeItem[] = Array.from(fileList).map((file) => ({
      id: newId(),
      file,
      text: "",
      previewUrl: URL.createObjectURL(file),
      status: "queued",
      selectedProjectId: "",
      selectedTaskId: "",
      commentText: "",
      errorMessage: "",
      uploadProgress: 0,
      groupId: null,
    }));
    setItems((prev) => [...prev, ...newItems]);
  }

  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      if (!e.clipboardData) return;
      const files = Array.from(e.clipboardData.items)
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter((f): f is File => !!f);
      if (files.length === 0) return;
      e.preventDefault();
      const dt = new DataTransfer();
      files.forEach((f) => dt.items.add(f));
      addFileItems(dt.files);
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  function toggleVoiceInput() {
    if (recording) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setGlobalError(zh(isZh, "이 브라우저는 음성 입력을 지원하지 않습니다. Chrome에서 사용해주세요."));
      return;
    }
    const recognition = new Ctor();
    recognition.lang = voiceLang === "zh" ? "zh-CN" : "ko-KR";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      if (transcript.trim()) setDraftText((prev) => (prev ? `${prev} ${transcript.trim()}` : transcript.trim()));
    };
    recognition.onend = () => setRecording(false);
    recognition.onerror = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }

  async function handleClassifyAll() {
    if (items.length === 0) return;
    setClassifyingAll(true);
    setGlobalError("");
    const groups = getRenderGroups(items);
    await Promise.all(
      groups.map(async (g) => {
        const groupItems = Array.isArray(g) ? g : [g];
        const ids = groupItems.map((it) => it.id);
        setItems((prev) => prev.map((it) => (ids.includes(it.id) ? { ...it, status: "classifying" } : it)));
        try {
          const result = await callClassify(groupItems, candidates, appUser?.partnerLang ?? "ko");
          setItems((prev) =>
            prev.map((it) =>
              ids.includes(it.id)
                ? { ...it, status: "ready", selectedProjectId: result.projectId ?? "", selectedTaskId: result.taskId ?? "", commentText: result.comment ?? "", confidence: result.confidence }
                : it
            )
          );
        } catch (e) {
          setItems((prev) => prev.map((it) => (ids.includes(it.id) ? { ...it, status: "error", errorMessage: e instanceof Error ? e.message : "분류 실패" } : it)));
        }
      })
    );
    setClassifyingAll(false);
  }

  async function handleRegenerateComment(groupItems: IntakeItem[], projectId: string, taskId: string) {
    const project = candidates.find((p) => p.projectId === projectId);
    const task = project?.tasks.find((t) => t.taskId === taskId);
    const ids = groupItems.map((it) => it.id);
    try {
      const result = await callClassify(
        groupItems,
        candidates,
        appUser?.partnerLang ?? "ko",
        project && task ? { fixedProjectName: project.projectName, fixedTaskName: task.taskName } : undefined
      );
      if (result.comment) setItems((prev) => prev.map((it) => (ids.includes(it.id) ? { ...it, commentText: result.comment! } : it)));
    } catch {
      // 조용히 무시 — 코멘트는 직접 고쳐 쓰면 된다.
    }
  }

  async function notifyAdmins(message: string, projectId: string) {
    try {
      const admins = await getAdmins();
      await Promise.all(
        admins
          .filter((a) => a.uid !== appUser?.uid)
          .map((a) => createNotification({ userId: a.uid, projectId, type: "partner_archive", message }))
      );
    } catch {
      // 알림 발송 실패는 업로드 자체를 막지 않는다.
    }
  }

  async function uploadOneItem(item: IntakeItem): Promise<void> {
    if (!item.selectedProjectId || !appUser) return;
    updateItem(item.id, { status: "uploading", errorMessage: "", uploadProgress: 0 });
    try {
      const project = candidates.find((p) => p.projectId === item.selectedProjectId);
      const task = project?.tasks.find((t) => t.taskId === item.selectedTaskId);
      const taskTag = task ? { taskId: task.taskId, taskName: task.taskName } : undefined;

      let fileDocId: string | undefined;
      let storagePath: string | undefined;
      if (item.file) {
        const fileRef = await uploadPartnerArchiveFile(
          item.selectedProjectId,
          item.file,
          appUser.uid,
          actorName,
          (ratio) => updateItem(item.id, { uploadProgress: Math.round(ratio * 100) }),
          taskTag
        );
        fileDocId = fileRef.id;
        const fileSnap = await getDoc(fileRef);
        storagePath = fileSnap.data()?.storagePath;
      }

      const commentBody = item.commentText.trim() || (item.file ? "" : item.text.trim());
      let commentDocId: string | undefined;
      if (commentBody) {
        const commentRef = await addPartnerArchiveComment(item.selectedProjectId, appUser.uid, actorName, "partner", commentBody, taskTag, appUser.partnerLang);
        commentDocId = commentRef.id;
      }

      notifyAdmins(
        `${actorName}님이 협력사 자료함에 ${item.file ? `"${item.file.name}" 파일을` : "코멘트를"} 올렸습니다${task ? ` (업무: ${task.taskName})` : ""}.`,
        item.selectedProjectId
      ).catch(() => {});

      addToast({
        id: newId(),
        label: item.file ? item.file.name : task ? `${task.taskName} 코멘트` : "코멘트",
        fileDocId,
        storagePath,
        commentDocId,
      });

      updateItem(item.id, { status: "done" });
    } catch (e) {
      updateItem(item.id, { status: "error", errorMessage: e instanceof Error ? e.message : zh(isZh, "업로드 중 오류가 발생했습니다.") });
    }
  }

  async function handleUploadAll() {
    const uploadable = items.filter((it) => it.status === "ready" && it.selectedProjectId);
    if (uploadable.length === 0) return;
    setUploadingAll(true);
    for (const item of uploadable) {
      // eslint-disable-next-line no-await-in-loop
      await uploadOneItem(item);
    }
    new Set(uploadable.map((it) => it.selectedProjectId)).forEach((id) => recordProjectUsage(id));
    setUploadingAll(false);
  }

  function resetAll() {
    items.forEach((it) => it.previewUrl && URL.revokeObjectURL(it.previewUrl));
    setItems([]);
    setDraftText("");
    setGlobalError("");
  }

  const isStaging = items.length === 0 || items.every((it) => it.status === "queued");
  const doneCount = items.filter((it) => it.status === "done").length;
  const allDone = items.length > 0 && doneCount === items.length;

  if (!appUser || appUser.role !== "partner") {
    return <p className="text-sm text-[#86868b]">접근 권한이 없습니다.</p>;
  }

  return (
    <div className="flex items-start gap-4">
      {/* 왼쪽 — 지난 대화 기록 (클로드처럼). Firestore에 남아서 새로고침·기기 교체에도 안 사라진다. */}
      <aside className={`${sidebarOpen ? "fixed inset-0 z-40 lg:static lg:z-auto" : "hidden lg:block"} shrink-0`}>
        {/* 모바일에서만 — 뒤 화면을 어둡게 덮는 배경. 탭하면 닫힌다. 데스크톱(lg)에서는
            사이드바가 항상 고정으로 보이니 오버레이 자체가 필요 없다. */}
        {sidebarOpen && <div className="fixed inset-0 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
        <div className="relative z-10 flex h-full w-72 max-w-[82vw] flex-col gap-2 overflow-hidden bg-white p-3 lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)] lg:w-64 lg:max-w-none lg:rounded-3xl">
          <button
            onClick={startNewConversation}
            className="flex items-center gap-1.5 rounded-xl border border-dashed border-[#d1d1d6] px-3 py-2 text-sm font-medium text-[#1d1d1f] transition hover:border-[#86868b]"
          >
            <MessageSquarePlus size={15} /> {zh(isZh, "새 대화")}
          </button>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {conversations.length === 0 && (
              <p className="px-2 py-3 text-xs text-[#86868b]">{zh(isZh, "대화 기록이 없습니다.")}</p>
            )}
            {conversations.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center gap-1 rounded-xl pr-1 transition ${
                  c.id === activeConversationId ? "bg-[#f5f5f7]" : "hover:bg-[#f5f5f7]"
                }`}
              >
                <button
                  onClick={() => { setActiveConversationId(c.id); setSidebarOpen(false); }}
                  className={`min-w-0 flex-1 truncate px-3 py-2 text-left text-sm ${
                    c.id === activeConversationId ? "font-medium text-[#1d1d1f]" : "text-[#86868b] group-hover:text-[#1d1d1f]"
                  }`}
                >
                  {c.title || zh(isZh, "대화")}
                </button>
                <button
                  onClick={() => handleDeleteConversation(c)}
                  title={zh(isZh, "이 대화 삭제")}
                  className="shrink-0 rounded-full p-1.5 text-[#d1d1d6] opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 space-y-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-[#1d1d1f]">
              <span className="h-2 w-2 rounded-full bg-[#1d1d1f]" />
              {zh(isZh, "AI 비서")}
            </h1>
            <p className="mt-1 hidden pl-4 text-sm text-[#86868b] sm:block">
              {zh(isZh, "텍스트·사진을 올리면 AI가 자료 정리, 견적서·청구서 작성, 가격 질문까지 알아서 처리해드립니다.")}
            </p>
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#d1d1d6] px-3 py-1.5 text-xs font-medium text-[#1d1d1f] lg:hidden"
          >
            <MessageSquarePlus size={13} /> {zh(isZh, "대화 기록")}
          </button>
        </div>

        {loadingCandidates && <p className="text-sm text-[#86868b]">{zh(isZh, "불러오는 중...")}</p>}
        {!loadingCandidates && candidates.length === 0 && (
          <div className="rounded-3xl border border-dashed border-[#d1d1d6] bg-white p-10 text-center text-sm text-[#86868b]">
            {zh(isZh, "배정된 프로젝트가 없습니다.")}
          </div>
        )}

        {candidates.length > 0 && (
          <>
            {/* 대화창 — 가장 자주 쓰는 기능이라 화면 맨 위, 다른 도구보다 먼저 보이게 둔다. */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => { e.preventDefault(); setDragActive(false); addChatAttachments(e.dataTransfer.files); }}
              className={`flex flex-col overflow-hidden rounded-3xl bg-white transition ${dragActive ? "ring-2 ring-[#1d1d1f]" : ""}`}
            >
              <div className="h-[50dvh] min-h-[16rem] space-y-3 overflow-y-auto p-4 lg:h-[46vh]">
                {messages.length === 0 ? (
                  <p className="flex h-24 items-center justify-center text-center text-sm text-[#86868b]">
                    {zh(isZh, "무엇이든 적어보세요 — 자료 정리, 견적서·청구서 작성, 가격 질문까지 알아서 처리해드립니다.")}
                  </p>
                ) : (
                  messages.map((m) => (
                    <ChatBubble
                      key={m.id}
                      message={m}
                      isZh={isZh}
                      onOpenDraft={(kind, draft) => {
                        if (draft) setAiAssistantDraft({ kind, items: draft.items, orderNumbers: draft.orderNumbers, currency: draft.currency, memo: draft.memo });
                        router.push(kind === "quote" ? "/my-quotes" : "/my-invoices");
                      }}
                    />
                  ))
                )}
                {assistantLoading && (
                  <div className="flex items-end gap-2">
                    <Sparkles size={14} className="mb-2.5 shrink-0 text-[#4a7fd6]" />
                    <div className="flex items-center gap-2 rounded-2xl bg-[#f0f7ff] px-4 py-3">
                      <span className="text-sm text-[#4a7fd6]">{zh(isZh, "생각하는 중")}</span>
                      <span className="flex gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#4a7fd6] [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#4a7fd6] [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#4a7fd6]" />
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-[#f0f0f0] p-3">
                {chatAttachments.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {chatAttachments.map((f, i) => (
                      <span key={`${f.name}-${i}`} className="flex items-center gap-1 rounded-full bg-[#f5f5f7] px-2.5 py-1 text-xs text-[#1d1d1f]">
                        <Paperclip size={11} />
                        <span className="max-w-[8rem] truncate">{f.name}</span>
                        <button onClick={() => removeChatAttachment(i)} className="text-[#86868b] hover:text-red-500"><X size={11} /></button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <label className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#d1d1d6] text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]">
                    <Paperclip size={15} />
                    <input type="file" multiple onChange={(e) => { addChatAttachments(e.target.files); e.target.value = ""; }} className="hidden" />
                  </label>
                  <label className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#d1d1d6] text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]">
                    <Camera size={15} />
                    <input type="file" accept="image/*" capture="environment" onChange={(e) => { addChatAttachments(e.target.files); e.target.value = ""; }} className="hidden" />
                  </label>
                  <textarea
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    onCompositionStart={() => { composingRef.current = true; }}
                    onCompositionEnd={() => { composingRef.current = false; }}
                    // 한글·중문은 IME로 글자를 조합하는 도중에도 Enter 키 이벤트가 발생한다
                    // (글자 하나를 확정 짓는 Enter) — isComposing 체크 없이 Enter=전송으로
                    // 처리하면 그 확정 시점마다 그때까지 조합된 일부 글자만 끊어서 메시지가
                    // 여러 개로 쪼개져 전송된다("자", "줘"처럼 한 글자씩 따로 남는 원인).
                    // 사파리는 조합을 끝내는 그 Enter 키 자체에서 nativeEvent.isComposing이
                    // 이미 false라 그것만으론 못 거르므로, compositionend 추적을 더한다.
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !composingRef.current) { e.preventDefault(); handleSendChat(); } }}
                    rows={1}
                    placeholder={zh(isZh, "무엇이든 물어보세요...")}
                    className="max-h-32 min-h-9 flex-1 resize-none rounded-2xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
                  />
                  {!recording && (
                    <button
                      onClick={toggleVoiceLang}
                      title={zh(isZh, "음성 인식 언어")}
                      className="h-9 shrink-0 rounded-full border border-[#d1d1d6] px-2 text-[11px] font-semibold text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]"
                    >
                      {voiceLang === "zh" ? "中" : "한"}
                    </button>
                  )}
                  <button
                    onClick={toggleVoiceInput}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${recording ? "border-red-300 bg-red-50 text-red-600" : "border-[#d1d1d6] text-[#86868b] hover:border-[#86868b] hover:text-[#1d1d1f]"}`}
                  >
                    <Mic size={15} />
                  </button>
                  <button
                    onClick={handleSendChat}
                    disabled={assistantLoading || loadingCandidates || (!draftText.trim() && chatAttachments.length === 0)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1d1d1f] text-white transition hover:bg-black disabled:opacity-40"
                  >
                    <Send size={15} />
                  </button>
                </div>
                {draftText.trim() && (
                  <button
                    onClick={handleSplitBriefing}
                    disabled={splittingBriefing || loadingCandidates}
                    className="mt-2 flex items-center gap-1 text-xs font-medium text-[#86868b] transition hover:text-[#1d1d1f] disabled:opacity-50"
                  >
                    <Scissors size={12} />
                    {splittingBriefing ? zh(isZh, "나누는 중...") : zh(isZh, "회의 브리핑 — 여러 업무로 한번에 나누기")}
                  </button>
                )}
                {assistantError && <p className="mt-1.5 text-xs text-red-500">{assistantError}</p>}
              </div>
            </div>

            <OrganizeWeeklyReport candidates={candidates} isZh={isZh} lang={appUser.partnerLang ?? "ko"} />

            {/* 캡션 없이 바로 담기 — 사진 여러 장을 한꺼번에 던질 때는 AI 비서를 거치지 않고
                바로 아래 "담은 자료" 큐에 담아, 한 번에 "맞는 프로젝트/업무 찾기"로 처리한다. */}
            <details className="rounded-3xl bg-white p-4 text-sm">
              <summary className="cursor-pointer font-medium text-[#86868b]">
                {zh(isZh, "또는 캡션 없이 사진·파일 여러 개 한번에 담기")}
              </summary>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#d1d1d6] py-2 text-center text-sm font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]">
                  <Paperclip size={14} />
                  {zh(isZh, "파일 선택")}
                  <input type="file" multiple onChange={(e) => { addFileItems(e.target.files); e.target.value = ""; }} className="hidden" />
                </label>
                <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#d1d1d6] py-2 text-center text-sm font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]">
                  <Camera size={14} />
                  {zh(isZh, "카메라로 바로 촬영")}
                  <input type="file" accept="image/*" capture="environment" onChange={(e) => { addFileItems(e.target.files); e.target.value = ""; }} className="hidden" />
                </label>
              </div>
            </details>

            {globalError && <p className="text-sm text-red-500">{globalError}</p>}

            {allDone && (
              <div className="space-y-4 rounded-3xl bg-white p-6">
                <p className="text-base font-medium text-[#1d1d1f]">{items.length}{zh(isZh, "개 자료 업로드를 모두 완료했습니다.")}</p>
                <button onClick={resetAll} className="w-full rounded-full bg-[#1d1d1f] py-2.5 text-sm font-semibold text-white hover:bg-black">
                  {zh(isZh, "목록 비우기")}
                </button>
              </div>
            )}

            {items.length > 0 && !allDone && (
              <div className="space-y-3">
                {isStaging && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[#86868b]">{zh(isZh, "담은 자료")} {items.length}{zh(isZh, "개")}</p>
                    {selectedForGroup.length >= 2 && (
                      <button onClick={handleGroupSelected} className="rounded-full bg-[#1d1d1f] px-3 py-1.5 text-xs font-medium text-white hover:bg-black">
                        {zh(isZh, "선택한")} {selectedForGroup.length}{zh(isZh, "개 묶기 (같은 내용)")}
                      </button>
                    )}
                  </div>
                )}

                {getRenderGroups(items).map((g) => {
                  const groupItems = Array.isArray(g) ? g : [g];
                  const key = groupItems[0].groupId ?? groupItems[0].id;
                  return (
                    <OrganizeItemCard
                      key={key}
                      items={groupItems}
                      candidates={candidates}
                      isZh={isZh}
                      selectable={isStaging}
                      selected={groupItems.every((it) => selectedForGroup.includes(it.id))}
                      onToggleSelect={() => groupItems.forEach((it) => toggleSelectForGroup(it.id))}
                      onRemove={() => groupItems.forEach((it) => removeItem(it.id))}
                      onUngroup={groupItems[0].groupId ? () => setItems((prev) => prev.map((it) => (it.groupId === groupItems[0].groupId ? { ...it, groupId: null } : it))) : undefined}
                      onChangeTarget={(projectId, taskId) => {
                        groupItems.forEach((it) => updateItem(it.id, { selectedProjectId: projectId, selectedTaskId: taskId }));
                        handleRegenerateComment(groupItems, projectId, taskId);
                      }}
                      onChangeComment={(text) => groupItems.forEach((it) => updateItem(it.id, { commentText: text }))}
                    />
                  );
                })}

                {isStaging ? (
                  <button
                    onClick={handleClassifyAll}
                    disabled={classifyingAll || candidates.length === 0}
                    className="w-full rounded-full bg-[#1d1d1f] py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
                  >
                    {classifyingAll ? zh(isZh, "찾는 중...") : zh(isZh, "맞는 프로젝트/업무 찾기")}
                  </button>
                ) : (
                  <button
                    onClick={handleUploadAll}
                    disabled={uploadingAll || items.every((it) => it.status !== "ready")}
                    className="w-full rounded-full bg-[#1d1d1f] py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
                  >
                    {uploadingAll ? zh(isZh, "업로드 중...") : `${zh(isZh, "업로드")} (${items.filter((it) => it.status === "ready").length})`}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {toasts.length > 0 && (
        <div className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 space-y-2">
          {toasts.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 rounded-2xl bg-[#1d1d1f] px-4 py-3 text-sm text-white shadow-lg">
              <span className="min-w-0 flex-1 truncate">{t.label} {zh(isZh, "업로드됨")}</span>
              <button onClick={() => handleUndoToast(t)} className="shrink-0 text-xs font-medium text-white/80 underline underline-offset-2 hover:text-white">
                {zh(isZh, "취소")}
              </button>
              <button onClick={() => dismissToast(t.id)} className="shrink-0 text-white/60 hover:text-white"><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatBubble({
  message,
  isZh,
  onOpenDraft,
}: {
  message: AssistantMessage;
  isZh: boolean;
  onOpenDraft: (kind: "quote" | "invoice", draft: AssistantMessage["draft"]) => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] space-y-1.5 ${isUser ? "" : "flex items-start gap-2"}`}>
        {!isUser && <Sparkles size={14} className="mt-2 shrink-0 text-[#4a7fd6]" />}
        <div>
          {message.attachmentNames && message.attachmentNames.length > 0 && (
            <div className="mb-1 flex flex-wrap justify-end gap-1">
              {message.attachmentNames.map((name, i) => (
                <span key={i} className="flex items-center gap-1 rounded-full bg-[#f5f5f7] px-2 py-0.5 text-[10px] text-[#86868b]">
                  <Paperclip size={9} /> {name}
                </span>
              ))}
            </div>
          )}
          {message.text && (
            <div
              className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                isUser ? "bg-[#1d1d1f] text-white" : "bg-[#f0f7ff] text-[#1d1d1f]"
              }`}
            >
              {message.text}
            </div>
          )}
          {!isUser && (message.intent === "quote" || message.intent === "invoice") && (
            <button
              onClick={() => onOpenDraft(message.intent as "quote" | "invoice", message.draft)}
              className="mt-1.5 flex items-center gap-1 rounded-full bg-[#1d1d1f] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-black"
            >
              {message.intent === "quote" ? zh(isZh, "견적서 작성 화면 열기") : zh(isZh, "청구서 작성 화면 열기")}
            </button>
          )}
          {!isUser && message.intent === "archive_search" && message.archiveResults && message.archiveResults.length > 0 && (
            <div className="mt-1.5 space-y-1.5">
              {message.archiveResults.map((f) => (
                <a
                  key={f.id}
                  href={toProxiedUrl(f.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-[#d1d1d6] bg-white px-3 py-2 text-xs transition hover:border-[#86868b]"
                >
                  <Paperclip size={12} className="shrink-0 text-[#86868b]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[#1d1d1f]">{f.name}</p>
                    <p className="truncate text-[#86868b]">
                      {[f.projectName, f.taskName].filter(Boolean).join(" / ")}
                      {(f.projectName || f.taskName) && " · "}
                      {new Date(f.uploadedAt).toLocaleDateString(isZh ? "zh-CN" : "ko-KR")}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OrganizeItemCard({
  items,
  candidates,
  isZh,
  selectable,
  selected,
  onToggleSelect,
  onRemove,
  onUngroup,
  onChangeTarget,
  onChangeComment,
}: {
  items: IntakeItem[];
  candidates: ProjectCandidate[];
  isZh: boolean;
  selectable: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
  onUngroup?: () => void;
  onChangeTarget: (projectId: string, taskId: string) => void;
  onChangeComment: (text: string) => void;
}) {
  const first = items[0];
  const project = candidates.find((p) => p.projectId === first.selectedProjectId);
  const tasks = project?.tasks ?? [];
  const zhProjectNames = useZhAutoTranslate(isZh, candidates.map((p) => p.projectName));
  const zhTaskNames = useZhAutoTranslate(isZh, tasks.map((t) => t.taskName));
  const trProjectName = (p: ProjectCandidate) => (isZh && p.projectNameZh) || zhProjectNames[p.projectName] || p.projectName;
  const trTaskName = (t: TaskCandidate) => (isZh && t.taskNameZh) || zhTaskNames[t.taskName] || t.taskName;

  return (
    <div className="space-y-2 rounded-2xl bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {selectable && items.length === 1 && <input type="checkbox" checked={selected} onChange={onToggleSelect} className="h-4 w-4 shrink-0" />}
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {items.map((it) => (
              <span key={it.id} className="flex items-center gap-1 rounded-full bg-[#f5f5f7] px-2 py-1 text-xs text-[#1d1d1f]">
                {it.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.previewUrl} alt="" className="h-5 w-5 rounded object-cover" />
                ) : null}
                <span className="max-w-[9rem] truncate">{it.file?.name ?? it.text.slice(0, 20)}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-[#86868b]">
          {first.confidence && <span>{zh(isZh, "확신도")}: {first.confidence}</span>}
          {onUngroup && <button onClick={onUngroup} className="underline underline-offset-2 hover:text-[#1d1d1f]">{zh(isZh, "묶음 풀기")}</button>}
          <button onClick={onRemove} className="hover:text-red-500"><Trash2 size={14} /></button>
        </div>
      </div>

      {first.status !== "queued" && first.status !== "classifying" && (
        <>
          <div className="flex gap-2">
            <select
              value={first.selectedProjectId}
              onChange={(e) => onChangeTarget(e.target.value, "")}
              className="min-w-0 flex-1 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs text-[#1d1d1f] outline-none focus:border-[#86868b]"
            >
              <option value="">{zh(isZh, "프로젝트 선택...")}</option>
              {sortProjectsByUsage(candidates.map((p) => ({ id: p.projectId }))).map((p) => {
                const full = candidates.find((c) => c.projectId === p.id)!;
                return <option key={full.projectId} value={full.projectId}>{trProjectName(full)}</option>;
              })}
            </select>
            <select
              value={first.selectedTaskId}
              onChange={(e) => onChangeTarget(first.selectedProjectId, e.target.value)}
              disabled={!first.selectedProjectId}
              className="min-w-0 flex-1 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs text-[#1d1d1f] outline-none focus:border-[#86868b] disabled:opacity-50"
            >
              <option value="">{zh(isZh, "업무 선택 안 함(프로젝트 전체)")}</option>
              {tasks.map((t) => (
                <option key={t.taskId} value={t.taskId}>{trTaskName(t)}</option>
              ))}
            </select>
          </div>
          <textarea
            value={first.commentText}
            onChange={(e) => onChangeComment(e.target.value)}
            rows={2}
            placeholder={zh(isZh, "코멘트")}
            className="w-full resize-none rounded-xl border border-[#d1d1d6] px-3 py-1.5 text-xs text-[#1d1d1f] outline-none focus:border-[#86868b]"
          />
        </>
      )}

      {first.status === "classifying" && <p className="text-xs text-[#86868b]">{zh(isZh, "찾는 중...")}</p>}
      {first.status === "uploading" && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#f0f0f0]">
          <div className="h-full rounded-full bg-[#1d1d1f] transition-all" style={{ width: `${first.uploadProgress}%` }} />
        </div>
      )}
      {first.status === "done" && <p className="text-xs font-medium text-green-600">✓</p>}
      {first.status === "error" && <p className="text-xs text-red-500">{first.errorMessage}</p>}
    </div>
  );
}

function OrganizeWeeklyReport({ candidates, isZh, lang }: { candidates: ProjectCandidate[]; isZh: boolean; lang: "ko" | "zh" }) {
  const zhProjectNames = useZhAutoTranslate(isZh, candidates.map((p) => p.projectName));
  const trProjectName = (p: ProjectCandidate) => (isZh && p.projectNameZh) || zhProjectNames[p.projectName] || p.projectName;
  const [open, setOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [days, setDays] = useState(7);
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    const project = candidates.find((p) => p.projectId === selectedProjectId);
    if (!project) return;
    setGenerating(true);
    setError("");
    setReport("");
    try {
      const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;
      const taskActivities: { taskName: string; status: string; comments: string[]; fileNames: string[] }[] = [];
      for (const t of project.tasks) {
        // eslint-disable-next-line no-await-in-loop
        const commentsSnap = await getDocs(collection(db, "tasks", t.taskId, "comments"));
        const comments = commentsSnap.docs
          .map((c) => ({ text: c.data().text as string, createdAt: (c.data().createdAt?.toMillis?.() as number) ?? 0 }))
          .filter((c) => c.createdAt >= sinceMs)
          .map((c) => c.text);
        // eslint-disable-next-line no-await-in-loop
        const filesSnap = await getDocs(collection(db, "tasks", t.taskId, "files"));
        const fileNames = filesSnap.docs
          .map((f) => ({ name: f.data().name as string, uploadedAt: (f.data().uploadedAt?.toMillis?.() as number) ?? 0 }))
          .filter((f) => f.uploadedAt >= sinceMs)
          .map((f) => f.name);
        if (comments.length > 0 || fileNames.length > 0) taskActivities.push({ taskName: t.taskName, status: t.status, comments, fileNames });
      }
      if (taskActivities.length === 0) {
        setError(isZh ? `最近 ${days} 天内该项目没有上传·留言记录。` : `최근 ${days}일간 이 프로젝트의 업로드·코멘트 기록이 없습니다.`);
        return;
      }
      const res = await fetch("/api/weekly-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName: project.projectName, clientName: project.clientName, days, taskActivities, lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? zh(isZh, "보고서 생성에 실패했습니다."));
      setReport(data.report ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : zh(isZh, "보고서 생성 중 오류가 발생했습니다."));
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-3xl bg-white">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-5 py-3 text-sm font-medium text-[#86868b]">
        <span className="flex items-center gap-1.5"><FileBarChart size={16} />{zh(isZh, "주간 보고서 초안 만들기")}</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="space-y-3 border-t border-[#f0f0f2] px-5 py-3">
          <div className="flex gap-2">
            <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]">
              <option value="">{zh(isZh, "프로젝트 선택...")}</option>
              {candidates.map((p) => <option key={p.projectId} value={p.projectId}>{trProjectName(p)}</option>)}
            </select>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-xl border border-[#d1d1d6] px-2 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]">
              <option value={7}>{zh(isZh, "최근 7일")}</option>
              <option value={14}>{zh(isZh, "최근 14일")}</option>
              <option value={30}>{zh(isZh, "최근 30일")}</option>
            </select>
          </div>
          <button onClick={handleGenerate} disabled={!selectedProjectId || generating} className="w-full rounded-full bg-[#1d1d1f] py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50">
            {generating ? zh(isZh, "만드는 중...") : zh(isZh, "초안 만들기")}
          </button>
          {error && <p className="text-sm text-red-500">{error}</p>}
          {report && (
            <div className="space-y-2">
              <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-[#f5f5f7] p-3 text-sm text-[#1d1d1f]">{report}</div>
              <button onClick={handleCopy} className="flex w-full items-center justify-center gap-1.5 rounded-full border border-[#d1d1d6] py-2 text-sm text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]">
                <Copy size={14} />
                {copied ? zh(isZh, "복사됨!") : zh(isZh, "복사하기")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
