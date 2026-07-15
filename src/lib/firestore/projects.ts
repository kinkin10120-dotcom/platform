import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
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
    projectType: Array.isArray(data.projectType)
      ? data.projectType
      : data.projectType === "dev_mass"
        ? ["dev", "mass"]
        : data.projectType
          ? [data.projectType]
          : undefined,
    sortOrder: data.sortOrder ?? null,
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
    createdAt: serverTimestamp(),
  });
}

export async function updateProject(id: string, patch: Partial<Project>) {
  const { id: _omit, ...rest } = patch as any;
  return updateDoc(doc(db, "projects", id), rest);
}

export async function deleteProject(id: string) {
  return deleteDoc(doc(db, "projects", id));
}
