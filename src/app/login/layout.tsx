import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HANDYWORKS | 제조 파트너와 진짜로 연결되는 방법",
  icons: {
    icon: "/handyworks-favicon.png",
    apple: "/handyworks-favicon.png",
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
