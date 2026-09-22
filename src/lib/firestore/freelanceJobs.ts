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
        proposalDraft: data.proposalDraft,
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

// 실제로 지원하기로 한 공고에 한해서만 누를 때 생성한다(모든 공고에 자동으로 만들지 않음).
export async function generateProposalDraft(id: string, title: string, description: string) {
  const res = await fetch("/api/generate-proposal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description }),
  });
  if (!res.ok) throw new Error("제안서 생성에 실패했습니다.");
  const data = (await res.json()) as { proposal?: string; error?: string };
  if (!data.proposal) throw new Error(data.error ?? "제안서 생성에 실패했습니다.");
  await updateDoc(doc(db, "freelanceJobs", id), { proposalDraft: data.proposal });
  return data.proposal;
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
