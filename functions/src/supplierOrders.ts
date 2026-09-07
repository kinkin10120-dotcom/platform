import { onRequest } from "firebase-functions/v2/https";
import { auth, db, storage } from "./shared";

// 구매발주 회신본(공장 도장 스캔본)을 여는 전용 엔드포인트.
//
// 업로드할 때 getDownloadURL()을 쓰면 영구적으로 살아있는 공개 토큰 URL이 발급된다 — 그 URL을
// 아는 사람은 로그인 없이 언제든 파일을 열 수 있고, 나중에 규칙을 조여도 이미 나간 토큰은
// 그대로 유효하다. 매입 원가가 찍힌 문서에 그런 영구 링크를 남기지 않으려고, 저장은 경로만
// 해두고 열어볼 때마다 여기서 관리자인지 확인한 뒤 파일 내용을 직접 흘려보낸다.
//
// 처음엔 짧은 유효기간의 서명 URL(getSignedUrl)을 주려고 했는데, 이 프로젝트의 함수 실행
// 서비스 계정에는 iam.serviceAccounts.signBlob 권한이 없어서 서명 자체가 실패한다(실제로
// 배포해서 확인했다). IAM 권한을 새로 부여하는 대신, 파일을 이 함수가 직접 내려주는 방식으로
// 해결한다 — 외부에 남는 URL이 아예 없어서 오히려 더 안전하다.
//
// onCall이 아니라 onRequest인 이유: 응답이 JSON이 아니라 파일 바이트라서다. 대신 인증을
// 직접 해야 하므로 Authorization 헤더의 Firebase ID 토큰을 검증한다.
export const supplierOrderFile = onRequest(
  // 브라우저에서 fetch로 부르므로 CORS가 필요하다. 우리 도메인에서만 허용한다.
  { cors: ["https://handyhand.co.kr", "http://localhost:3000"] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const header = req.headers.authorization ?? "";
    const idToken = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!idToken) {
      res.status(401).send("Unauthorized");
      return;
    }

    let uid: string;
    try {
      uid = (await auth.verifyIdToken(idToken)).uid;
    } catch {
      res.status(401).send("Unauthorized");
      return;
    }

    const callerSnap = await db.collection("users").doc(uid).get();
    if (callerSnap.data()?.role !== "admin") {
      res.status(403).send("Forbidden");
      return;
    }

    // 경로를 그대로 믿으면 관리자 계정이 털렸을 때 버킷의 아무 파일이나 뽑아갈 수 있는 통로가
    // 된다 — 이 함수가 열어줄 수 있는 범위를 구매발주 폴더로 못박는다.
    const path = (req.body?.path ?? "") as string;
    if (typeof path !== "string" || !path.startsWith("supplierOrders/") || path.includes("..")) {
      res.status(400).send("Bad Request");
      return;
    }

    const file = storage.bucket().file(path);
    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).send("Not Found");
      return;
    }

    const [metadata] = await file.getMetadata();
    const [buffer] = await file.download();
    res.setHeader("Content-Type", metadata.contentType ?? "application/octet-stream");
    // 이 응답이 중간 캐시나 브라우저 디스크 캐시에 남지 않게 한다.
    res.setHeader("Cache-Control", "private, no-store");
    res.status(200).send(buffer);
  }
);
