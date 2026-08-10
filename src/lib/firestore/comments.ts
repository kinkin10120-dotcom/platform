import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TaskComment, CommentAuthorRole } from "@/lib/types";

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
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
        } as TaskComment;
      })
    );
  });
}

export async function updateComment(taskId: string, commentId: string, text: string) {
  return updateDoc(doc(db, "tasks", taskId, "comments", commentId), { text });
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
  return addDoc(colRef(taskId), {
    authorId,
    authorName,
    authorRole,
    text,
    createdAt: serverTimestamp(),
  });
}
