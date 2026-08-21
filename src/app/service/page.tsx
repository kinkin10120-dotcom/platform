import type { Metadata } from "next";
import ServiceClient from "./ServiceClient";

export const metadata: Metadata = {
  title: "서비스 | HANDYHAND",
  description: "올인원 제품화 솔루션부터 제조 컨설팅, HANDYWORKS 플랫폼, 소싱 관리, 브랜딩, 크라우드펀딩까지. 필요한 서비스만 골라 이용하세요.",
  openGraph: {
    title: "서비스 | HANDYHAND",
    description: "올인원 제품화 솔루션부터 제조 컨설팅, HANDYWORKS 플랫폼, 브랜딩, 크라우드펀딩까지.",
    url: "https://handyhand.co.kr/service",
    type: "website",
  },
};

export default function ServicePage() {
  return <ServiceClient />;
}
