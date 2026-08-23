import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CommentAuthorRole, ModelAnnotation, TaskComment } from "@/lib/types";

function annotationsColRef(taskId: string, fileId: string) {
  return collection(db, "tasks", taskId, "files", fileId, "annotations");
}

function commentsColRef(taskId: string, fileId: string, annotationId: string) {
  return collection(db, "tasks", taskId, "files", fileId, "annotations", annotationId, "comments");
}

export function listenAnnotations(taskId: string, fileId: string, cb: (annotations: ModelAnnotation[]) => void) {
  const q = query(annotationsColRef(taskId, fileId), orderBy("number", "asc"));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          taskId,
          fileId,
          position: data.position,
          number: data.number,
          createdBy: data.createdBy,
          createdByName: data.createdByName,
          createdByRole: data.createdByRole,
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
          resolved: !!data.resolved,
        } as ModelAnnotation;
      })
    );
  });
}

// 핀 생성과 최초 코멘트 작성을 한 번의 입력으로 처리한다 — 순번은 현재 개수+1로 매긴다.
export async function createAnnotation(
  taskId: string,
  fileId: string,
  position: { x: number; y: number; z: number },
  createdBy: string,
  createdByName: string,
  createdByRole: CommentAuthorRole,
  firstCommentText: string
) {
  const existingSnap = await getDocs(annotationsColRef(taskId, fileId));
  const number = existingSnap.size + 1;
  const annotationRef = await addDoc(annotationsColRef(taskId, fileId), {
    position,
    number,
    createdBy,
    createdByName,
    createdByRole,
    createdAt: serverTimestamp(),
    resolved: false,
  });
  await addDoc(commentsColRef(taskId, fileId, annotationRef.id), {
    authorId: createdBy,
    authorName: createdByName,
    authorRole: createdByRole,
    text: firstCommentText,
    createdAt: serverTimestamp(),
  });
  return annotationRef.id;
}

export function listenAnnotationComments(
  taskId: string,
  fileId: string,
  annotationId: string,
  cb: (comments: TaskComment[]) => void
) {
  const q = query(commentsColRef(taskId, fileId, annotationId), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          taskId,
          authorId: data.authorId,
          authorName: data.authorName,
          authorRole: data.authorRole,
          text: data.text,
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
        } as TaskComment;
      })
    );
  });
}

export async function addAnnotationComment(
  taskId: string,
  fileId: string,
  annotationId: string,
  authorId: string,
  authorName: string,
  authorRole: CommentAuthorRole,
  text: string
) {
  return addDoc(commentsColRef(taskId, fileId, annotationId), {
    authorId,
    authorName,
    authorRole,
    text,
    createdAt: serverTimestamp(),
  });
}

export async function toggleAnnotationResolved(taskId: string, fileId: string, annotationId: string, resolved: boolean) {
  return updateDoc(doc(db, "tasks", taskId, "files", fileId, "annotations", annotationId), { resolved });
}

export async function deleteAnnotation(taskId: string, fileId: string, annotationId: string) {
  return deleteDoc(doc(db, "tasks", taskId, "files", fileId, "annotations", annotationId));
}
