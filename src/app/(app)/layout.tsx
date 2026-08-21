import type { Metadata } from "next";
import AppLayoutClient from "./AppLayoutClient";

export const metadata: Metadata = {
  title: "HANDYWORKS | 제조 파트너와 진짜로 연결되는 방법",
  description: "기획부터 납품까지 모든 과정을 한 곳에서 투명하게 공유합니다.",
  icons: {
    icon: "/handyworks-favicon.png",
    apple: "/handyworks-favicon.png",
  },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppLayoutClient>{children}</AppLayoutClient>;
}
