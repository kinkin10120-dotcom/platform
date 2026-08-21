import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HANDYWORKS | 제조 파트너와 진짜로 연결되는 방법",
  description: "기획부터 납품까지 모든 과정을 한 곳에서 투명하게 공유합니다.",
  icons: {
    icon: "/handyworks-favicon.png",
    apple: "/handyworks-favicon.png",
  },
  openGraph: {
    title: "HANDYWORKS | 제조 파트너와 진짜로 연결되는 방법",
    description: "기획부터 납품까지 모든 과정을 HANDYWORKS 플랫폼 한 곳에서 투명하게 공유합니다.",
    url: "https://handyhand.co.kr/handyworks",
    siteName: "HANDYWORKS",
    images: [{ url: "https://handyhand.co.kr/og-image.png", width: 1080, height: 1080 }],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "HANDYWORKS | 제조 파트너와 진짜로 연결되는 방법",
    description: "기획부터 납품까지 모든 과정을 한 곳에서 투명하게 공유합니다.",
    images: ["https://handyhand.co.kr/og-image.png"],
  },
};

export default function HandyWorksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
