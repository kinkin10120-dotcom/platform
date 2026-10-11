import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HANDYWORKS | 제조 파트너와 진짜로 연결되는 방법",
  icons: {
    icon: "/handyworks-favicon.png",
    // 로그인 페이지에서 "홈 화면에 추가"하면(로그인 전 최초 설치가 주로 여기서 일어난다)
    // 이 흰색 h 아이콘이 붙는다 — 로그인 이후 앱 안의 다른 화면은 루트 레이아웃의 기본
    // 노란색 apple-touch-icon.png를 그대로 쓴다(여긴 건드리지 않음).
    apple: "/apple-touch-icon-white.png",
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
