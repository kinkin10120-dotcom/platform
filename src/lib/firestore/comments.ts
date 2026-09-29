import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TaskComment, CommentAuthorRole } from "@/lib/types";
import { translateForCache } from "@/lib/i18n";

function colRef(taskId: string) {
  return collection(db, "tasks", taskId, "comments");
}

export async function getComments(taskId: string): Promise<TaskComment[]> {
  const snap = await getDocs(query(colRef(taskId), orderBy("createdAt", "asc")));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      taskId,
      authorId: data.authorId,
      authorName: data.authorName,
      authorRole: data.authorRole,
      text: data.text,
      textZh: data.textZh ?? undefined,
      createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
    } as TaskComment;
  });
}

export function listenComments(taskId: string, cb: (comments: TaskComment[]) => void) {
  const q = query(colRef(taskId), orderBy("createdAt", "asc"));
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
          textZh: data.textZh ?? undefined,
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
        } as TaskComment;
      })
    );
  });
}

export async function updateComment(taskId: string, commentId: string, text: string) {
  const [textZh] = await translateForCache([text]);
  return updateDoc(doc(db, "tasks", taskId, "comments", commentId), { text, textZh: textZh ?? null });
}

export async function deleteComment(taskId: string, commentId: string) {
  return deleteDoc(doc(db, "tasks", taskId, "comments", commentId));
}

export async function addComment(
  taskId: string,
  authorId: string,
  authorName: string,
  authorRole: CommentAuthorRole,
  text: string
) {
  // 협력사(중국 업체) 계정이 볼 때 즉석 번역 대신 바로 중국어가 뜨도록 등록 시점에 미리
  // 번역해둔다 — 실패해도 textZh 없이 등록되고 화면에서 즉석 번역으로 대체된다.
  const [textZh] = await translateForCache([text]);
  return addDoc(colRef(taskId), {
    authorId,
    authorName,
    authorRole,
    text,
    ...(textZh ? { textZh } : {}),
    createdAt: serverTimestamp(),
  });
}
