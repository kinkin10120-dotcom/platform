import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FreelanceFeedConfig, FreelanceJob, FreelanceJobStatus, FreelanceJobPlatform } from "@/lib/types";

const jobsRef = collection(db, "freelanceJobs");
const configsRef = collection(db, "freelanceFeedConfigs");

export function listenFreelanceJobs(cb: (jobs: FreelanceJob[]) => void) {
  const q = query(jobsRef, orderBy("postedAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        platform: data.platform,
        title: data.title,
        titleKo: data.titleKo,
        description: data.description,
        descriptionKo: data.descriptionKo,
        link: data.link,
        postedAt: data.postedAt?.toMillis ? data.postedAt.toMillis() : data.postedAt,
        fetchedAt: data.fetchedAt?.toMillis ? data.fetchedAt.toMillis() : data.fetchedAt,
        status: data.status ?? "new",
      } as FreelanceJob;
    }));
  });
}

export async function updateFreelanceJobStatus(id: string, status: FreelanceJobStatus) {
  return updateDoc(doc(db, "freelanceJobs", id), { status });
}

export async function deleteFreelanceJob(id: string) {
  return deleteDoc(doc(db, "freelanceJobs", id));
}

export function listenFeedConfigs(cb: (configs: FreelanceFeedConfig[]) => void) {
  const q = query(configsRef, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        platform: data.platform,
        label: data.label,
        url: data.url,
        enabled: data.enabled,
        createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
      } as FreelanceFeedConfig;
    }));
  });
}

export async function addFeedConfig(platform: FreelanceJobPlatform, label: string, url: string) {
  return addDoc(configsRef, { platform, label, url, enabled: true, createdAt: serverTimestamp() });
}

export async function updateFeedConfig(id: string, data: Partial<Pick<FreelanceFeedConfig, "label" | "url" | "enabled">>) {
  return updateDoc(doc(db, "freelanceFeedConfigs", id), data);
}

export async function deleteFeedConfig(id: string) {
  return deleteDoc(doc(db, "freelanceFeedConfigs", id));
}
