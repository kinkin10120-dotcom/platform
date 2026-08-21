import type { Metadata } from "next";
import ProcessClient from "./ProcessClient";

export const metadata: Metadata = {
  title: "프로세스 | HANDYHAND",
  description: "아이디어 하나가 완제품이 되기까지, 핸디핸드가 함께하는 제품 개발 9단계 공정을 소개합니다.",
  openGraph: {
    title: "프로세스 | HANDYHAND",
    description: "아이디어 하나가 완제품이 되기까지, 핸디핸드가 함께하는 제품 개발 9단계 공정을 소개합니다.",
    url: "https://handyhand.co.kr/process",
    type: "website",
  },
};

export default function ProcessPage() {
  return <ProcessClient />;
}
