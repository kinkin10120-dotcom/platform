import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
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
    clientId: data.clientId ?? undefined,
    name: data.name,
    nameZh: data.nameZh ?? undefined,
    description: data.description ?? "",
    descriptionZh: data.descriptionZh ?? undefined,
    clientDisplayName: data.clientDisplayName ?? undefined,
    clientLogoUrl: data.clientLogoUrl ?? undefined,
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

// 협력사 홈 화면용 — 배정된 프로젝트 ID 목록을 listenProject로 하나씩 개별 구독하면,
// 프록시를 거치는 세션에서는 프로젝트 수만큼 실시간 리스너 채널이 동시에 열려(연결당
// 왕복 지연이 있는 중국 우회 경로에서 특히 느리게 느껴졌다) 전체 로딩이 오래 걸렸다.
// Firestore의 list 규칙은 문서별로 재평가되므로(firestore.rules의 projects 참고)
// where(documentId(),"in",...) 배치 쿼리도 개별 구독과 동일하게 안전하다 — "in"은
// 한 번에 최대 10개까지만 지원해 10개씩 묶어서 리스너를 연다.
export function listenProjectsByIds(ids: string[], cb: (projects: Project[]) => void) {
  if (ids.length === 0) {
    cb([]);
    return () => {};
  }
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
  const byChunk: Project[][] = chunks.map(() => []);
  const unsubs = chunks.map((chunk, i) => {
    const q = query(colRef, where(documentId(), "in", chunk));
    return onSnapshot(q, (snap) => {
      byChunk[i] = snap.docs.map(fromDoc);
      cb(byChunk.flat());
    });
  });
  return () => unsubs.forEach((u) => u());
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
  // 협력사와 먼저 자료 공유를 시작해야 하는 경우가 있어, 고객사를 정하지 않고도 프로젝트를
  // 만들 수 있게 clientId를 선택값으로 뺐다 — 나중에 updateProject로 지정/변경한다.
  clientId?: string;
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
  // 협력사 계정은 clients 컬렉션을 못 읽으므로, 로고·표시명을 프로젝트 문서에 그대로 복사해둔다.
  const clientData = input.clientId ? (await getDoc(doc(db, "clients", input.clientId))).data() ?? null : null;
  const { clientId, ...rest } = input;
  return addDoc(colRef, {
    ...rest,
    ...(clientId ? { clientId } : {}),
    ...(nameZh ? { nameZh } : {}),
    ...(input.description && descriptionZh ? { descriptionZh } : {}),
    ...(clientId ? { clientDisplayName: clientData?.name ?? "", clientLogoUrl: clientData?.logoUrl ?? null } : {}),
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
  // 고객사를 나중에 지정/변경하는 경우 — createProject 때와 똑같이 로고·표시명을 복사해둔다.
  if ("clientId" in rest && rest.clientId) {
    const clientSnap = await getDoc(doc(db, "clients", rest.clientId));
    const clientData = clientSnap.exists() ? clientSnap.data() : null;
    rest.clientDisplayName = clientData?.name ?? "";
    rest.clientLogoUrl = clientData?.logoUrl ?? null;
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
