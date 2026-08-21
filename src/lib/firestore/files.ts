import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { TaskFile } from "@/lib/types";

const CAD_EXTS = ["stp", "step", "dxf", "dwg", "ipt", "iam", "sldprt", "sldasm"];

function colRef(taskId: string) {
  return collection(db, "tasks", taskId, "files");
}

async function runAiAnalysis(taskId: string, fileId: string, file: File) {
  const fileDoc = doc(db, "tasks", taskId, "files", fileId);
  try {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/analyze-cad", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error ?? "분석 실패");

    await updateDoc(fileDoc, {
      aiAnalysis: {
        status: "done",
        partName: data.partName ?? data.assemblyName ?? "",
        complexity: data.complexity ?? "",
        material: data.material ?? "",
        surfaceTreatment: data.surfaceTreatment ?? "",
        recommendedMethods: data.recommendedMethods ?? [],
        summary: data.summary ?? "",
        analyzedAt: Date.now(),
      },
    });
  } catch (e) {
    await updateDoc(fileDoc, {
      aiAnalysis: {
        status: "error",
        error: e instanceof Error ? e.message : "분석 중 오류가 발생했습니다.",
      },
    });
  }
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
          version: data.version ?? 1,
          aiAnalysis: data.aiAnalysis,
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

  const existingSnap = await getDocs(query(colRef(taskId), where("name", "==", file.name)));
  const version = existingSnap.size + 1;

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isCad = CAD_EXTS.includes(ext);

  const docRef = await addDoc(colRef(taskId), {
    name: file.name,
    url,
    storagePath,
    size: file.size,
    contentType: file.type || "application/octet-stream",
    uploadedBy,
    uploadedByName,
    uploadedAt: serverTimestamp(),
    version,
    ...(isCad ? { aiAnalysis: { status: "pending" } } : {}),
  });

  if (isCad) {
    runAiAnalysis(taskId, docRef.id, file);
  }

  return docRef;
}

export async function deleteTaskFile(taskId: string, fileId: string, storagePath: string) {
  await deleteDoc(doc(db, "tasks", taskId, "files", fileId));
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (e) {
    console.warn("스토리지 파일 삭제 실패(이미 삭제되었을 수 있음)", e);
  }
}
