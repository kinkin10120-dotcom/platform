import type { Metadata } from "next";
import AboutClient from "./AboutClient";

export const metadata: Metadata = {
  title: "기업소개 | HANDYHAND",
  description: "2013년 설립 이후 수백 개의 제품을 함께해온 제조 파트너, 핸디핸드를 소개합니다. 원스탑 제품개발, 글로벌 네트워크, 자체 브랜드 운영까지.",
  openGraph: {
    title: "기업소개 | HANDYHAND",
    description: "2013년 설립 이후 수백 개의 제품을 함께해온 제조 파트너, 핸디핸드를 소개합니다.",
    url: "https://handyhand.co.kr/about",
    type: "website",
  },
};

export default function AboutPage() {
  return <AboutClient />;
}
