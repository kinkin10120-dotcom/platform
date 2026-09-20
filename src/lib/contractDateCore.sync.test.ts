import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// src/lib/contractDateCore.ts와 functions/src/contractDateCore.ts는 서로 다른 빌드·배포
// 단위(Next.js 앱 / Cloud Functions)라 실제로 import해서 공유할 수 없어서, "완전히 같은
// 내용이어야 한다"는 규칙으로만 관리한다. 이 테스트가 그 규칙을 강제한다 — 실제로 두 파일의
// 날짜 포맷 로직이 따로 놀아서, 관리자 화면(정상 "오후")과 고객이 보는 서명 페이지(서버를
// 거침, "PM")가 같은 데이터를 다르게 보여준 적이 있었다. 이 테스트가 실패하면 방금 고친
// 파일의 반대쪽 사본(src/lib 쪽을 고쳤으면 functions/src 쪽, 반대도 마찬가지)도 똑같이
// 고쳐야 한다는 뜻이다.
describe("계약서 서버·클라이언트 공용 로직 사본 동기화", () => {
  it.each(["contractDateCore.ts", "contractHtmlCore.ts"])("src/lib/%s와 functions/src/%s는 바이트 단위로 같아야 한다", (filename) => {
    const clientPath = join(__dirname, filename);
    const serverPath = join(__dirname, "..", "..", "functions", "src", filename);
    const clientSource = readFileSync(clientPath, "utf-8");
    const serverSource = readFileSync(serverPath, "utf-8");
    expect(serverSource).toBe(clientSource);
  });
});
