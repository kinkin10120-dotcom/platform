import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

export const viewport: Viewport = {
  colorScheme: "light",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://handyhand.co.kr"),
  title: "HANDYHAND | 아이디어에서 완제품까지",
  icons: {
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  description: "제품기획 · 설계 · 개발 · 금형 · 양산을 한 번에. 2005년부터 글로벌 파트너와 함께해온 제품개발 전문기업입니다.",
  openGraph: {
    title: "HANDYHAND | 아이디어에서 완제품까지",
    description: "제품기획 · 설계 · 개발 · 금형 · 양산을 한 번에. 2005년부터 글로벌 파트너와 함께해온 제품개발 전문기업입니다.",
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
  return (
    <html lang="ko">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
