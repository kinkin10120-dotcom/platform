import { deleteDoc, doc, collection, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { QuoteLineItem } from "@/lib/firestore/quotes";

// "견적서 바로 만들기"의 임시저장 — 예전엔 브라우저 로컬 스토리지에만 저장해서, 브라우저가
// 저장소를 정리하거나 다른 기기·브라우저로 로그인하면 그대로 사라졌다. 다른 관리자 데이터와
// 마찬가지로 Firestore에 저장해 브라우저와 무관하게 남도록 한다.
export interface QuoteDraft {
  id: string;
  savedAt: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  items: QuoteLineItem[];
  priceDrafts: Record<number, string>;
  quoteMemo: string;
}

const colRef = collection(db, "quoteDrafts");

export function listenQuoteDrafts(cb: (drafts: QuoteDraft[]) => void) {
  const q = query(colRef, orderBy("savedAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        savedAt: data.savedAt?.toMillis ? data.savedAt.toMillis() : data.savedAt ?? Date.now(),
        name: data.name ?? "",
        company: data.company ?? "",
        email: data.email ?? "",
        phone: data.phone ?? "",
        items: data.items ?? [],
        priceDrafts: data.priceDrafts ?? {},
        quoteMemo: data.quoteMemo ?? "",
      } as QuoteDraft;
    }));
  });
}

export async function saveQuoteDraft(id: string, draft: Omit<QuoteDraft, "id" | "savedAt">) {
  await setDoc(doc(colRef, id), { ...draft, savedAt: serverTimestamp() });
}

export async function deleteQuoteDraft(id: string) {
  await deleteDoc(doc(colRef, id));
}
