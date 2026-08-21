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
  where,
} from "firebase/firestore";
import { deleteObject, ref, listAll } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Project, ProjectStatus, ProjectType } from "@/lib/types";

const colRef = collection(db, "projects");

function fromDoc(d: any): Project {
  const data = d.data();
  return {
    id: d.id,
    clientId: data.clientId,
    name: data.name,
    description: data.description ?? "",
    startDate: data.startDate,
    endDate: data.endDate,
    status: data.status,
    clientVisible: data.clientVisible ?? true,
    projectType: Array.isArray(data.projectType)
      ? data.projectType
      : data.projectType === "dev_mass"
        ? ["dev", "mass"]
        : data.projectType
          ? [data.projectType]
          : undefined,
    sortOrder: data.sortOrder ?? null,
    calendarToken: data.calendarToken ?? undefined,
    createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
    createdBy: data.createdBy,
  };
}

export function listenProjectsByClient(clientId: string, cb: (projects: Project[]) => void, onError?: () => void) {
  const q = query(colRef, where("clientId", "==", clientId));
  return onSnapshot(q, (snap) => {
    const projects = snap.docs.map(fromDoc).sort((a, b) => a.startDate.localeCompare(b.startDate));
    cb(projects);
  }, onError);
}

export function listenAllProjects(cb: (projects: Project[]) => void) {
  const q = query(colRef, orderBy("startDate", "asc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map(fromDoc)));
}

export function listenProject(projectId: string, cb: (project: Project | null) => void) {
  return onSnapshot(doc(db, "projects", projectId), (snap) => {
    if (!snap.exists()) return cb(null);
    cb(fromDoc(snap));
  });
}

export async function createProject(input: {
  clientId: string;
  name: string;
  description?: string;
  projectType?: ProjectType[];
  startDate: string;
  endDate: string;
  createdBy: string;
}) {
  return addDoc(colRef, {
    ...input,
    status: "active" as ProjectStatus,
    // 세팅이 끝나기 전엔 고객에게 안 보이게 기본 비공개로 시작한다 — 상세 화면에서 관리자가
    // 직접 "고객에게 공개" 토글을 켜야 그 순간부터 firestore.rules상 조회가 허용된다.
    clientVisible: false,
    createdAt: serverTimestamp(),
  });
}

export async function updateProject(id: string, patch: Partial<Project>) {
  const { id: _omit, ...rest } = patch as any;
  return updateDoc(doc(db, "projects", id), rest);
}

export async function deleteProject(id: string) {
  const tasksSnap = await getDocs(query(collection(db, "tasks"), where("projectId", "==", id)));

  for (const taskDoc of tasksSnap.docs) {
    const [filesSnap, commentsSnap] = await Promise.all([
      getDocs(collection(db, "tasks", taskDoc.id, "files")),
      getDocs(collection(db, "tasks", taskDoc.id, "comments")),
    ]);
    await Promise.all(commentsSnap.docs.map((c) => deleteDoc(c.ref)));
    await Promise.all(filesSnap.docs.map((f) => deleteDoc(f.ref)));
    await deleteDoc(taskDoc.ref);
  }

  try {
    const projectFolder = ref(storage, `projects/${id}`);
    const listing = await listAll(projectFolder);
    await deleteStorageFolderRecursive(listing);
  } catch (e) {
    console.warn("프로젝트 스토리지 파일 삭제 실패(이미 없을 수 있음)", e);
  }

  return deleteDoc(doc(db, "projects", id));
}

async function deleteStorageFolderRecursive(listing: { items: ReturnType<typeof ref>[]; prefixes: ReturnType<typeof ref>[] }) {
  await Promise.all(listing.items.map((item) => deleteObject(item)));
  for (const prefix of listing.prefixes) {
    const sub = await listAll(prefix);
    await deleteStorageFolderRecursive(sub);
  }
}
