import type { Metadata } from "next";
import AiAnalysisClient from "./AiAnalysisClient";

export const metadata: Metadata = {
  title: "AI Manufacturing Analysis | HANDYHAND",
  description:
    "Upload a drawing and AI analyzes shape, dimensions, material, and manufacturing method for free. Results are automatically linked to your quote request.",
  openGraph: {
    title: "AI Manufacturing Analysis | HANDYHAND",
    description: "Upload a drawing and AI analyzes shape, dimensions, material, and manufacturing method for free.",
    url: "https://handyhand.co.kr/en/ai-analysis",
    type: "website",
  },
};

export default function AiAnalysisPage() {
  return <AiAnalysisClient />;
}
