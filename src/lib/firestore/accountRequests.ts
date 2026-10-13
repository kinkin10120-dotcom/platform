import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

// 로그인 페이지의 "계정 생성 문의" — 아직 계정이 없는(로그인 안 된) 방문자가 보내는 공개
// 폼이다. /api/quote와 같은 이유로(관리자가 로그인 상태가 아닐 수도 있는 리드 알림이라
// 인앱 알림보다 이메일이 더 확실하다) API 라우트에서 이메일 발송과 함께 호출한다.
export async function createAccountRequest(input: { name: string; email: string; company?: string; message?: string }) {
  return addDoc(collection(db, "accountRequests"), {
    name: input.name,
    email: input.email,
    company: input.company ?? "",
    message: input.message ?? "",
    status: "pending",
    createdAt: serverTimestamp(),
  });
}
