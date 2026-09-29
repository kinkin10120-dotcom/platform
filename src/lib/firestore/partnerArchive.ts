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
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { CommentAuthorRole, PartnerArchiveComment, PartnerArchiveFile } from "@/lib/types";
import { translateForCache } from "@/lib/i18n";

// 관리자 ↔ 협력사 전용 프로젝트 단위 자료함 — 업무(task)와 무관하다. 클라이언트(고객)는
// firestore.rules에 이 컬렉션을 아예 허용하지 않아 접근 경로 자체가 없다.
const filesColRef = collection(db, "partnerArchiveFiles");
const commentsColRef = collection(db, "partnerArchiveComments");

function fileFromDoc(d: any): PartnerArchiveFile {
  const data = d.data();
  return {
    id: d.id,
    projectId: data.projectId,
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
    authorId: data.authorId,
    authorName: data.authorName,
    authorRole: data.authorRole,
    text: data.text,
    textZh: data.textZh ?? undefined,
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
  uploadedByName: string
) {
  const storagePath = `partnerArchive/${projectId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  const existingSnap = await getDocs(
    query(filesColRef, where("projectId", "==", projectId), where("name", "==", file.name))
  );
  const version = existingSnap.size + 1;

  return addDoc(filesColRef, {
    projectId,
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
  text: string
) {
  // 저장 시점에 미리 번역해서 중국 업체 협력사가 볼 때 즉석 번역 없이 바로 뜨게 한다.
  const [textZh] = await translateForCache([text]);
  return addDoc(commentsColRef, {
    projectId,
    authorId,
    authorName,
    authorRole,
    text,
    ...(textZh ? { textZh } : {}),
    createdAt: serverTimestamp(),
  });
}

export async function updatePartnerArchiveComment(commentId: string, text: string) {
  const [textZh] = await translateForCache([text]);
  return updateDoc(doc(db, "partnerArchiveComments", commentId), { text, textZh: textZh ?? null });
}

export async function deletePartnerArchiveComment(commentId: string) {
  return deleteDoc(doc(db, "partnerArchiveComments", commentId));
}
