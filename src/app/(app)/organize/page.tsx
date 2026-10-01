"use client";

import { useEffect, useRef, useState } from "react";
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
  Mic,
  Paperclip,
  Scissors,
  Trash2,
  X,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { zh, usePartnerZh } from "@/lib/i18n";
import {
  uploadPartnerArchiveFile,
  addPartnerArchiveComment,
  deletePartnerArchiveFile,
  deletePartnerArchiveComment,
  PARTNER_ARCHIVE_MAX_FILE_SIZE,
} from "@/lib/firestore/partnerArchive";
import { getAdmins } from "@/lib/firestore/users";
import { createNotification } from "@/lib/firestore/notifications";
import { compressImage } from "@/lib/imageCompress";
import { extractFileText } from "@/lib/extractFileText";
import { sortProjectsByUsage, recordProjectUsage } from "@/lib/projectUsage";
import { downloadCsv } from "@/lib/csvExport";

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
  status: string;
  description?: string;
}
interface ProjectCandidate {
  projectId: string;
  projectName: string;
  clientName: string;
  tasks: TaskCandidate[];
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

interface RecentLog {
  id: string;
  kind: "file" | "comment";
  projectId: string;
  taskName: string;
  name: string;
  createdAt: number;
  storagePath?: string;
  ownerId: string;
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
    throw new Error(`서버 응답을 읽을 수 없습니다 (${res.status}).`);
  }
  if (!res.ok) throw new Error(data.error ?? "요청 실패");
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

  const [candidates, setCandidates] = useState<ProjectCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [draftText, setDraftText] = useState("");
  const [items, setItems] = useState<IntakeItem[]>([]);
  const [classifyingAll, setClassifyingAll] = useState(false);
  const [uploadingAll, setUploadingAll] = useState(false);
  const [recording, setRecording] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedForGroup, setSelectedForGroup] = useState<string[]>([]);
  const [globalError, setGlobalError] = useState("");
  const [stickyTarget, setStickyTarget] = useState<{ projectId: string; taskId: string } | null>(null);
  const [splittingBriefing, setSplittingBriefing] = useState(false);
  const [toasts, setToasts] = useState<UploadToast[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

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
        for (const p of projectsSnap.docs) {
          const pd = p.data();
          // eslint-disable-next-line no-await-in-loop
          const tasksSnap = await getDocs(query(collection(db, "tasks"), where("projectId", "==", p.id)));
          list.push({
            projectId: p.id,
            projectName: pd.name,
            clientName: pd.clientDisplayName ?? "",
            tasks: tasksSnap.docs
              .filter((t) => !t.data().hiddenFromPartner)
              .map((t) => ({ taskId: t.id, taskName: t.data().name, status: t.data().status, description: t.data().description || undefined })),
          });
        }
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

  function addTextItem() {
    if (!draftText.trim()) return;
    const item: IntakeItem = {
      id: newId(),
      file: null,
      text: draftText.trim(),
      previewUrl: null,
      status: "queued",
      selectedProjectId: stickyTarget?.projectId ?? "",
      selectedTaskId: stickyTarget?.taskId ?? "",
      commentText: "",
      errorMessage: "",
      uploadProgress: 0,
      groupId: null,
    };
    setItems((prev) => [...prev, item]);
    setDraftText("");
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

  function addFileItems(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const newItems: IntakeItem[] = Array.from(fileList).map((file) => ({
      id: newId(),
      file,
      text: "",
      previewUrl: URL.createObjectURL(file),
      status: "queued",
      selectedProjectId: stickyTarget?.projectId ?? "",
      selectedTaskId: stickyTarget?.taskId ?? "",
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stickyTarget]);

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
    recognition.lang = isZh ? "zh-CN" : "ko-KR";
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
      updateItem(item.id, { status: "error", errorMessage: e instanceof Error ? e.message : "업로드 중 오류가 발생했습니다." });
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
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-[#1d1d1f]">
          <span className="h-2 w-2 rounded-full bg-[#1d1d1f]" />
          {zh(isZh, "정리 도구")}
        </h1>
        <p className="mt-1 pl-4 text-sm text-[#86868b]">
          {zh(isZh, "텍스트·사진을 올리면 AI가 맞는 프로젝트·업무를 찾아 자료함에 정리해드립니다.")}
        </p>
      </div>

      {loadingCandidates && <p className="text-sm text-[#86868b]">{zh(isZh, "불러오는 중...")}</p>}
      {!loadingCandidates && candidates.length === 0 && (
        <div className="rounded-3xl border border-dashed border-[#d1d1d6] bg-white p-10 text-center text-sm text-[#86868b]">
          {zh(isZh, "배정된 프로젝트가 없습니다.")}
        </div>
      )}

      {candidates.length > 0 && (
        <>
          <OrganizeRecentUploads
            appUser={appUser}
            isZh={isZh}
            onReuseTarget={(projectId, taskId) => setStickyTarget({ projectId, taskId })}
          />
          <OrganizeWeeklyReport candidates={candidates} isZh={isZh} lang={appUser.partnerLang ?? "ko"} />

          {allDone ? (
            <div className="space-y-4 rounded-3xl bg-white p-6">
              <p className="text-base font-medium text-[#1d1d1f]">{items.length}{zh(isZh, "개 자료 업로드를 모두 완료했습니다.")}</p>
              <button onClick={resetAll} className="w-full rounded-full bg-[#1d1d1f] py-2.5 text-sm font-semibold text-white hover:bg-black">
                {zh(isZh, "새로 시작하기")}
              </button>
            </div>
          ) : (
            <>
              {isStaging && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => { e.preventDefault(); setDragActive(false); addFileItems(e.dataTransfer.files); }}
                  className={`space-y-4 rounded-3xl border-2 border-dashed bg-white p-6 transition ${dragActive ? "border-[#1d1d1f] bg-[#f5f5f7]" : "border-[#e5e5e5]"}`}
                >
                  <div>
                    <label className="mb-1.5 block text-xs text-[#86868b]">{zh(isZh, "텍스트 붙여넣기 (메모·채팅 내용 등)")}</label>
                    <textarea
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      rows={5}
                      placeholder={zh(isZh, "여기에 붙여넣으세요... (이미지도 Ctrl+V로 바로 붙여넣을 수 있습니다)")}
                      className="w-full resize-none rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={addTextItem}
                        disabled={!draftText.trim()}
                        className="flex-1 rounded-full border border-dashed border-[#d1d1d6] py-2 text-sm font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f] disabled:opacity-50"
                      >
                        {zh(isZh, "+ 텍스트 항목으로 담기")}
                      </button>
                      <button
                        onClick={toggleVoiceInput}
                        className={`flex items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition ${recording ? "border-red-300 bg-red-50 text-red-600" : "border-[#d1d1d6] text-[#86868b] hover:border-[#86868b] hover:text-[#1d1d1f]"}`}
                      >
                        {recording ? (<><span className="h-2 w-2 rounded-full bg-red-500" />{zh(isZh, "듣는 중... (탭하여 종료)")}</>) : (<><Mic size={14} />{zh(isZh, "음성으로 입력")}</>)}
                      </button>
                    </div>
                    {draftText.trim() && (
                      <button
                        onClick={handleSplitBriefing}
                        disabled={splittingBriefing || loadingCandidates}
                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-[#d1d1d6] py-2 text-sm font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f] disabled:opacity-50"
                      >
                        <Scissors size={14} />
                        {splittingBriefing ? zh(isZh, "나누는 중...") : zh(isZh, "회의 브리핑 — 여러 업무로 나누기")}
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-[#86868b]">
                      {zh(isZh, "또는 파일 여러 개 (사진·영상 등, 한 번에 여러 개 선택 가능 — 이 영역에 끌어다 놓아도 됩니다)")}
                    </label>
                    <input type="file" multiple onChange={(e) => { addFileItems(e.target.files); e.target.value = ""; }} className="w-full text-sm text-[#1d1d1f]" />
                    <label className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#d1d1d6] py-2 text-center text-sm font-medium text-[#86868b] transition hover:border-[#86868b] hover:text-[#1d1d1f]">
                      <Camera size={14} />
                      {zh(isZh, "카메라로 바로 촬영")}
                      <input type="file" accept="image/*" capture="environment" onChange={(e) => { addFileItems(e.target.files); e.target.value = ""; }} className="hidden" />
                    </label>
                  </div>
                </div>
              )}

              {globalError && <p className="text-sm text-red-500">{globalError}</p>}

              {items.length > 0 && (
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
        </>
      )}

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
          {onUngroup && <button onClick={onUngroup} className="underline underline-offset-2 hover:text-[#1d1d1f]">묶음 풀기</button>}
          <button onClick={onRemove} className="hover:text-red-500"><Trash2 size={14} /></button>
        </div>
      </div>

      {first.status !== "queued" && first.status !== "classifying" && (
        <>
          <div className="flex gap-2">
            <select
              value={first.selectedProjectId}
              onChange={(e) => onChangeTarget(e.target.value, "")}
              className="flex-1 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs text-[#1d1d1f] outline-none focus:border-[#86868b]"
            >
              <option value="">{zh(isZh, "프로젝트 선택...")}</option>
              {sortProjectsByUsage(candidates.map((p) => ({ id: p.projectId }))).map((p) => {
                const full = candidates.find((c) => c.projectId === p.id)!;
                return <option key={full.projectId} value={full.projectId}>{full.projectName}</option>;
              })}
            </select>
            <select
              value={first.selectedTaskId}
              onChange={(e) => onChangeTarget(first.selectedProjectId, e.target.value)}
              disabled={!first.selectedProjectId}
              className="flex-1 rounded-xl border border-[#d1d1d6] bg-white px-3 py-1.5 text-xs text-[#1d1d1f] outline-none focus:border-[#86868b] disabled:opacity-50"
            >
              <option value="">{zh(isZh, "업무 선택 안 함(프로젝트 전체)")}</option>
              {tasks.map((t) => (
                <option key={t.taskId} value={t.taskId}>{t.taskName}</option>
              ))}
            </select>
          </div>
          <textarea
            value={first.commentText}
            onChange={(e) => onChangeComment(e.target.value)}
            rows={2}
            placeholder="코멘트"
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

function OrganizeRecentUploads({
  appUser,
  isZh,
  onReuseTarget,
}: {
  appUser: { uid: string; projectIds?: string[] };
  isZh: boolean;
  onReuseTarget: (projectId: string, taskId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<RecentLog[] | null>(null);
  const [search, setSearch] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const ids = appUser.projectIds ?? [];
    if (ids.length === 0) {
      setLogs([]);
      return;
    }
    const unsubs: (() => void)[] = [];
    const fileMap = new Map<string, RecentLog>();
    const commentMap = new Map<string, RecentLog>();
    function publish() {
      setLogs(Array.from(fileMap.values()).concat(Array.from(commentMap.values())).sort((a, b) => b.createdAt - a.createdAt).slice(0, 50));
    }
    for (const part of chunk(ids, 10)) {
      unsubs.push(
        onSnapshot(query(collection(db, "partnerArchiveFiles"), where("projectId", "in", part)), (snap) => {
          snap.docs.forEach((d) => {
            const data = d.data();
            fileMap.set(d.id, {
              id: d.id,
              kind: "file",
              projectId: data.projectId,
              taskName: data.taskName ?? "",
              name: data.name,
              storagePath: data.storagePath,
              createdAt: data.uploadedAt?.toMillis ? data.uploadedAt.toMillis() : 0,
              ownerId: data.uploadedBy,
            });
          });
          publish();
        })
      );
      unsubs.push(
        onSnapshot(query(collection(db, "partnerArchiveComments"), where("projectId", "in", part)), (snap) => {
          snap.docs.forEach((d) => {
            const data = d.data();
            commentMap.set(d.id, {
              id: d.id,
              kind: "comment",
              projectId: data.projectId,
              taskName: data.taskName ?? "",
              name: (data.text as string).slice(0, 40),
              createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0,
              ownerId: data.authorId,
            });
          });
          publish();
        })
      );
    }
    return () => unsubs.forEach((u) => u());
  }, [open, appUser.projectIds]);

  async function handleDelete(log: RecentLog) {
    if (log.kind === "file") {
      await deletePartnerArchiveFile(log.id, log.storagePath ?? "");
    } else {
      await deletePartnerArchiveComment(log.id);
    }
    setConfirmingId(null);
  }

  const q = search.trim().toLowerCase();
  const visible = (logs ?? []).filter((l) => !q || [l.name, l.taskName].some((f) => f.toLowerCase().includes(q)));

  return (
    <div className="rounded-3xl bg-white">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-5 py-3 text-sm font-medium text-[#86868b]">
        {zh(isZh, "최근 업로드 내역")}
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="max-h-80 overflow-y-auto border-t border-[#f0f0f2] px-5 py-3">
          {logs === null && <p className="text-sm text-[#86868b]">{zh(isZh, "불러오는 중...")}</p>}
          {logs && logs.length > 0 && (
            <div className="mb-3 flex gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={zh(isZh, "파일명·업무로 검색...")}
                className="w-full rounded-xl border border-[#d1d1d6] px-3 py-1.5 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]"
              />
              <button
                onClick={() => downloadCsv(`업로드내역_${new Date().toISOString().slice(0, 10)}.csv`, ["구분", "내용", "업무"], visible.map((l) => [l.kind, l.name, l.taskName]))}
                className="shrink-0 rounded-full border border-[#d1d1d6] px-3 py-1.5 text-xs text-[#86868b] hover:border-[#86868b] hover:text-[#1d1d1f]"
              >
                CSV
              </button>
            </div>
          )}
          {logs && logs.length === 0 && <p className="text-sm text-[#86868b]">-</p>}
          <ul className="space-y-2">
            {visible.map((log) => (
              <li key={log.id} className="rounded-xl bg-[#f5f5f7] px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <button onClick={() => onReuseTarget(log.projectId, "")} className="min-w-0 flex-1 truncate text-left text-[#1d1d1f] underline-offset-2 hover:underline">
                    {log.name}{log.taskName && <span className="text-[#86868b]"> · {log.taskName}</span>}
                  </button>
                  {log.ownerId !== appUser.uid ? null : confirmingId === log.id ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <button onClick={() => handleDelete(log)} className="text-red-500">{zh(isZh, "삭제")}</button>
                      <button onClick={() => setConfirmingId(null)} className="text-[#86868b]">{zh(isZh, "취소")}</button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmingId(log.id)} className="shrink-0 text-[#86868b] hover:text-red-500"><Trash2 size={12} /></button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function OrganizeWeeklyReport({ candidates, isZh, lang }: { candidates: ProjectCandidate[]; isZh: boolean; lang: "ko" | "zh" }) {
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
        setError(`최근 ${days}일간 이 프로젝트의 업로드·코멘트 기록이 없습니다.`);
        return;
      }
      const res = await fetch("/api/weekly-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName: project.projectName, clientName: project.clientName, days, taskActivities, lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "보고서 생성에 실패했습니다.");
      setReport(data.report ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "보고서 생성 중 오류가 발생했습니다.");
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
            <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="flex-1 rounded-xl border border-[#d1d1d6] px-3 py-2 text-sm text-[#1d1d1f] outline-none focus:border-[#86868b]">
              <option value="">{zh(isZh, "프로젝트 선택...")}</option>
              {candidates.map((p) => <option key={p.projectId} value={p.projectId}>{p.projectName}</option>)}
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
