import { collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

// 알림 발송이 실패했을 때 Cloud Functions가 남기는 경고. 여태 이런 실패는 로그에만 남아서
// "알림이 오는지"를 사람이 직접 테스트해봐야 알 수 있었다 — 이걸 관리자 화면 상단에 띄워서
// 고장이 먼저 알려주게 한다.
export interface SystemAlert {
  id: string;
  kind: string;
  message: string;
  count: number;
  lastAt: number;
}

const colRef = collection(db, "systemAlerts");

export function listenUnresolvedSystemAlerts(cb: (alerts: SystemAlert[]) => void) {
  // resolved == false 하나만 거는 쿼리라 복합 색인이 필요 없다. 건수가 많을 일이 없어서
  // 정렬은 받아온 뒤 화면에서 한다.
  const q = query(colRef, where("resolved", "==", false));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            kind: data.kind ?? "",
            message: data.message ?? "",
            count: data.count ?? 1,
            lastAt: data.lastAt?.toMillis ? data.lastAt.toMillis() : Date.now(),
          } as SystemAlert;
        })
        .sort((a, b) => b.lastAt - a.lastAt);
      cb(items);
    },
    // 관리자가 아니면 조회가 거부되는 게 정상이다 — 화면을 깨뜨리지 않고 조용히 빈 목록으로 둔다.
    () => cb([])
  );
}

export async function resolveSystemAlert(id: string) {
  return updateDoc(doc(db, "systemAlerts", id), { resolved: true });
}

export async function deleteSystemAlert(id: string) {
  return deleteDoc(doc(db, "systemAlerts", id));
}
