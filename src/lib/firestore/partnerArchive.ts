import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { CommentAuthorRole, PartnerArchiveComment, PartnerArchiveFile } from "@/lib/types";
import { translateForCache, translateToKoreanForCache } from "@/lib/i18n";

// 관리자 ↔ 협력사 전용 프로젝트 단위 자료함 — 업무(task)와 무관하다. 클라이언트(고객)는
// firestore.rules에 이 컬렉션을 아예 허용하지 않아 접근 경로 자체가 없다.
const filesColRef = collection(db, "partnerArchiveFiles");

// 공장 현장에서 생산 과정 동영상·고화질 사진을 올리는 경우를 감안한 한도 — 중국 등 해외
// 협력사의 느린 네트워크 환경에서 큰 파일이 끝없이 업로드되다 실패하는 걸 막기 위해 업로드
// 전에 미리 걸러낸다.
export const PARTNER_ARCHIVE_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const commentsColRef = collection(db, "partnerArchiveComments");

function fileFromDoc(d: any): PartnerArchiveFile {
  const data = d.data();
  return {
    id: d.id,
    projectId: data.projectId,
    taskId: data.taskId ?? undefined,
    taskName: data.taskName ?? undefined,
    name: data.name,
    url: data.url,
    storagePath: data.storagePath,
    size: data.size,
    contentType: data.contentType,
    uploadedBy: data.uploadedBy,
    uploadedByName: data.uploadedByName,
    uploadedAt: data.uploadedAt?.toMillis ? data.uploadedAt.toMillis() : Date.now(),
    version: data.version ?? 1,
  };
}

function commentFromDoc(d: any): PartnerArchiveComment {
  const data = d.data();
  return {
    id: d.id,
    projectId: data.projectId,
    taskId: data.taskId ?? undefined,
    taskName: data.taskName ?? undefined,
    authorId: data.authorId,
    authorName: data.authorName,
    authorRole: data.authorRole,
    text: data.text,
    textZh: data.textZh ?? undefined,
    textKo: data.textKo ?? undefined,
    createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
  };
}

export function listenPartnerArchiveFiles(
  projectId: string,
  cb: (files: PartnerArchiveFile[]) => void,
  onError?: (e: Error) => void
) {
  const q = query(filesColRef, where("projectId", "==", projectId));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map(fileFromDoc).sort((a, b) => b.uploadedAt - a.uploadedAt)),
    (e) => {
      console.error("[listenPartnerArchiveFiles] 협력사 자료함 파일 조회 실패", e);
      onError?.(e);
    }
  );
}

export function listenPartnerArchiveComments(
  projectId: string,
  cb: (comments: PartnerArchiveComment[]) => void,
  onError?: (e: Error) => void
) {
  // where + orderBy(다른 필드)는 복합 색인이 필요한데 안 만들어져 있으면 쿼리가 조용히
  // 실패한다(listenTasksByProject와 같은 이유로 여기서도 정렬은 클라이언트에서 한다).
  const q = query(commentsColRef, where("projectId", "==", projectId));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map(commentFromDoc).sort((a, b) => a.createdAt - b.createdAt)),
    (e) => {
      console.error("[listenPartnerArchiveComments] 협력사 자료함 코멘트 조회 실패", e);
      onError?.(e);
    }
  );
}

export async function uploadPartnerArchiveFile(
  projectId: string,
  file: File,
  uploadedBy: string,
  uploadedByName: string,
  onProgress?: (ratio: number) => void,
  // 어떤 업무 자료인지 라벨 — 고객 쪽 tasks 컬렉션에는 아무 것도 쓰지 않는다.
  task?: { taskId: string; taskName: string }
) {
  if (file.size > PARTNER_ARCHIVE_MAX_FILE_SIZE) {
    throw new Error(`파일이 너무 큽니다 (${Math.round(file.size / 1024 / 1024)}MB). 100MB 이하만 올릴 수 있습니다.`);
  }
  const storagePath = `partnerArchive/${projectId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, storagePath);
  const url = await new Promise<string>((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file);
    uploadTask.on(
      "state_changed",
      (snap) => onProgress?.(snap.bytesTransferred / snap.totalBytes),
      reject,
      () => getDownloadURL(uploadTask.snapshot.ref).then(resolve, reject)
    );
  });

  const existingSnap = await getDocs(
    query(filesColRef, where("projectId", "==", projectId), where("name", "==", file.name))
  );
  const version = existingSnap.size + 1;

  return addDoc(filesColRef, {
    projectId,
    ...(task ? { taskId: task.taskId, taskName: task.taskName } : {}),
    name: file.name,
    url,
    storagePath,
    size: file.size,
    contentType: file.type || "application/octet-stream",
    uploadedBy,
    uploadedByName,
    uploadedAt: serverTimestamp(),
    version,
  });
}

export async function deletePartnerArchiveFile(fileId: string, storagePath: string) {
  await deleteDoc(doc(db, "partnerArchiveFiles", fileId));
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (e) {
    console.warn("협력사 자료함 파일 스토리지 삭제 실패(이미 삭제되었을 수 있음)", e);
  }
}

export async function addPartnerArchiveComment(
  projectId: string,
  authorId: string,
  authorName: string,
  authorRole: CommentAuthorRole,
  text: string,
  task?: { taskId: string; taskName: string },
  // 글쓴이가 쓴 언어 — 중국 협력사(zh)면 반대 방향(중국어→한국어)으로 번역해 관리자가
  // 바로 한국어로 읽게 한다. 관리자/한국어 협력사는 기존대로 한국어→중국어.
  authorLang?: "ko" | "zh"
) {
  const [translated] =
    authorLang === "zh" ? await translateToKoreanForCache([text]) : await translateForCache([text]);
  return addDoc(commentsColRef, {
    projectId,
    ...(task ? { taskId: task.taskId, taskName: task.taskName } : {}),
    authorId,
    authorName,
    authorRole,
    text,
    ...(translated ? (authorLang === "zh" ? { textKo: translated } : { textZh: translated }) : {}),
    createdAt: serverTimestamp(),
  });
}

export async function updatePartnerArchiveComment(commentId: string, text: string, authorLang?: "ko" | "zh") {
  const [translated] =
    authorLang === "zh" ? await translateToKoreanForCache([text]) : await translateForCache([text]);
  return updateDoc(
    doc(db, "partnerArchiveComments", commentId),
    authorLang === "zh" ? { text, textKo: translated ?? null } : { text, textZh: translated ?? null }
  );
}

export async function deletePartnerArchiveComment(commentId: string) {
  return deleteDoc(doc(db, "partnerArchiveComments", commentId));
}
