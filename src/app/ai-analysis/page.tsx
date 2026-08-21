import type { Metadata } from "next";
import AiAnalysisClient from "./AiAnalysisClient";

export const metadata: Metadata = {
  title: "AI 제조분석 | HANDYHAND",
  description: "도면 파일을 올리면 AI가 형상·치수·재질·제조방법을 무료로 분석해드립니다. 분석 결과는 자동으로 견적 요청서에 연결됩니다.",
  openGraph: {
    title: "AI 제조분석 | HANDYHAND",
    description: "도면 파일을 올리면 AI가 형상·치수·재질·제조방법을 무료로 분석해드립니다.",
    url: "https://handyhand.co.kr/ai-analysis",
    type: "website",
  },
};

export default function AiAnalysisPage() {
  return <AiAnalysisClient />;
}
