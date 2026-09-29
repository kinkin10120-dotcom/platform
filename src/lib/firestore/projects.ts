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
import { translateForCache } from "@/lib/i18n";

const colRef = collection(db, "projects");

function fromDoc(d: any): Project {
  const data = d.data();
  return {
    id: d.id,
    clientId: data.clientId,
    name: data.name,
    nameZh: data.nameZh ?? undefined,
    description: data.description ?? "",
    descriptionZh: data.descriptionZh ?? undefined,
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
  // 에러 콜백이 없으면, 비공개 프로젝트를 직접 URL로 열었을 때(permission-denied) 콜백이
  // 아예 안 불려서 화면이 "불러오는 중..."에 무한정 멈춘다 — snap.exists()===false와 동일하게
  // null로 처리해 "찾을 수 없음" 화면으로 자연스럽게 빠지게 한다.
  return onSnapshot(
    doc(db, "projects", projectId),
    (snap) => {
      if (!snap.exists()) return cb(null);
      cb(fromDoc(snap));
    },
    () => cb(null)
  );
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
  // 협력사(중국 업체) 계정이 볼 때 즉석 번역 대신 바로 중국어가 뜨도록, 저장 시점에 미리
  // 번역해둔다 — 실패해도 nameZh/descriptionZh 없이 그냥 저장되고 화면에서 즉석 번역으로 대체된다.
  const [nameZh, descriptionZh] = await translateForCache([input.name, input.description ?? ""]);
  return addDoc(colRef, {
    ...input,
    ...(nameZh ? { nameZh } : {}),
    ...(input.description && descriptionZh ? { descriptionZh } : {}),
    status: "active" as ProjectStatus,
    // 세팅이 끝나기 전엔 고객에게 안 보이게 기본 비공개로 시작한다 — 상세 화면에서 관리자가
    // 직접 "고객에게 공개" 토글을 켜야 그 순간부터 firestore.rules상 조회가 허용된다.
    clientVisible: false,
    createdAt: serverTimestamp(),
  });
}

export async function updateProject(id: string, patch: Partial<Project>) {
  const { id: _omit, ...rest } = patch as any;
  if (rest.name || rest.description) {
    const [nameZh, descriptionZh] = await translateForCache([rest.name ?? "", rest.description ?? ""]);
    if (rest.name && nameZh) rest.nameZh = nameZh;
    if (rest.description && descriptionZh) rest.descriptionZh = descriptionZh;
  }
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
