import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#000000",
  // 홈 화면에 추가한 PWA(standalone)는 iOS에서 상태 표시줄이 웹 콘텐츠 위에 오버레이로
  // 그려진다(appleWebApp.statusBarStyle 값과 무관하게) — viewport-fit=cover가 없으면
  // safe-area-inset-* 값이 항상 0으로 계산돼, 아래 헤더의 안전영역 패딩이 무의미해진다.
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://handyhand.co.kr"),
  title: "HANDYHAND | 아이디어에서 완제품까지",
  icons: {
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
  },
  description: "제품기획 · 설계 · 개발 · 금형 · 양산을 한 번에. 2013년 설립 이후 수백 개의 제품을 함께해온 제조 파트너 핸디핸드입니다.",
  openGraph: {
    title: "HANDYHAND | 아이디어에서 완제품까지",
    description: "제품기획 · 설계 · 개발 · 금형 · 양산을 한 번에. 2013년 설립 이후 수백 개의 제품을 함께해온 제조 파트너 핸디핸드입니다.",
    url: "https://handyhand.co.kr",
    siteName: "HANDYHAND",
    images: [{ url: "/og-image.png", width: 1080, height: 1080 }],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "HANDYHAND | 아이디어에서 완제품까지",
    description: "제품기획 · 설계 · 개발 · 금형 · 양산을 한 번에.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  return (
    <html lang="ko">
      <body>
        {gaId && <GoogleAnalytics gaId={gaId} />}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
