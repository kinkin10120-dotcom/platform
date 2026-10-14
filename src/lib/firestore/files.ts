import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { TaskFile } from "@/lib/types";
import { isCnProxyOn, uploadFileViaProxy, deleteFileViaProxy, toProxiedUrl } from "@/lib/storageProxy";

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
          url: toProxiedUrl(data.url),
          storagePath: data.storagePath,
          size: data.size,
          contentType: data.contentType,
          uploadedBy: data.uploadedBy,
          uploadedByName: data.uploadedByName,
          uploadedAt: data.uploadedAt?.toMillis ? data.uploadedAt.toMillis() : Date.now(),
          version: data.version ?? 1,
          aiAnalysis: data.aiAnalysis,
          visibleToClient: data.visibleToClient ?? true,
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
  uploadedByName: string,
  uploaderRole?: string
) {
  const storagePath = `projects/${projectId}/tasks/${taskId}/${Date.now()}_${file.name}`;
  let url: string;
  if (isCnProxyOn()) {
    url = await uploadFileViaProxy(storagePath, file, file.type || "application/octet-stream");
  } else {
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);
    url = await getDownloadURL(storageRef);
  }

  const existingSnap = await getDocs(query(colRef(taskId), where("name", "==", file.name)));
  const version = existingSnap.size + 1;

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isCad = CAD_EXTS.includes(ext);

  // 협력사(외부 제조사)가 올린 자료는 관리자가 확인하기 전까지 클라이언트(고객)에게 바로
  // 노출되면 안 된다 — 기본값을 비공개로 두고, 관리자가 확인 후 setFileVisibleToClient로
  // 공개 전환한다. 관리자·클라이언트가 직접 올린 자료는 지금까지처럼 바로 공개된다.
  const visibleToClient = uploaderRole !== "partner";

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
    visibleToClient,
    ...(isCad ? { aiAnalysis: { status: "pending" } } : {}),
  });

  if (isCad) {
    runAiAnalysis(taskId, docRef.id, file);
  }

  return docRef;
}

export async function setFileVisibleToClient(taskId: string, fileId: string, visible: boolean) {
  return updateDoc(doc(db, "tasks", taskId, "files", fileId), { visibleToClient: visible });
}

export async function deleteTaskFile(taskId: string, fileId: string, storagePath: string) {
  await deleteDoc(doc(db, "tasks", taskId, "files", fileId));
  try {
    if (isCnProxyOn()) {
      await deleteFileViaProxy(storagePath);
    } else {
      await deleteObject(ref(storage, storagePath));
    }
  } catch (e) {
    console.warn("스토리지 파일 삭제 실패(이미 삭제되었을 수 있음)", e);
  }
}
