import type { Metadata } from "next";
import PortfolioClient from "./PortfolioClient";

export const metadata: Metadata = {
  title: "개발사례 | HANDYHAND",
  description: "MIDLAND, 신지모루, 오아시스랩스 등 실제 납품까지 완료한 고객사 프로젝트와 핸디핸드 자체 브랜드 제품들을 소개합니다.",
  openGraph: {
    title: "개발사례 | HANDYHAND",
    description: "실제 납품까지 완료한 고객사 프로젝트와 핸디핸드 자체 브랜드 제품들을 소개합니다.",
    url: "https://handyhand.co.kr/portfolio",
    type: "website",
  },
};

export default function PortfolioPage() {
  return <PortfolioClient />;
}
