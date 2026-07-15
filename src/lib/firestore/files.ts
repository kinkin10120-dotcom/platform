import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { TaskFile } from "@/lib/types";

function colRef(taskId: string) {
  return collection(db, "tasks", taskId, "files");
}

export function listenFiles(taskId: string, cb: (files: TaskFile[]) => void) {
  const q = query(colRef(taskId), orderBy("uploadedAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          taskId,
          name: data.name,
          url: data.url,
          storagePath: data.storagePath,
          size: data.size,
          contentType: data.contentType,
          uploadedBy: data.uploadedBy,
          uploadedByName: data.uploadedByName,
          uploadedAt: data.uploadedAt?.toMillis ? data.uploadedAt.toMillis() : Date.now(),
        } as TaskFile;
      })
    );
  });
}

export async function uploadTaskFile(
  projectId: string,
  taskId: string,
  file: File,
  uploadedBy: string,
  uploadedByName: string
) {
  const storagePath = `projects/${projectId}/tasks/${taskId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  return addDoc(colRef(taskId), {
    name: file.name,
    url,
    storagePath,
    size: file.size,
    contentType: file.type || "application/octet-stream",
    uploadedBy,
    uploadedByName,
    uploadedAt: serverTimestamp(),
  });
}

export async function deleteTaskFile(taskId: string, fileId: string, storagePath: string) {
  await deleteDoc(doc(db, "tasks", taskId, "files", fileId));
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (e) {
    console.warn("스토리지 파일 삭제 실패(이미 삭제되었을 수 있음)", e);
  }
}
