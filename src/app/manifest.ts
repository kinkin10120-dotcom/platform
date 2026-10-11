import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HANDYHAND",
    short_name: "HANDYHAND",
    description: "제품기획 · 설계 · 개발 · 금형 · 양산을 한 번에.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    // 브라우저 탭 파비콘(src/app/icon.png, 노란색)과는 별도로, 홈 화면/설치 아이콘은 흰색
    // 버전을 쓴다 — 탭 아이콘은 작아서 노란색이 잘 보이지만, 홈 화면 아이콘은 크게 찍혀서
    // 흰 h가 더 깔끔하게 보인다는 피드백에 따른 것.
    icons: [
      {
        src: "/icon-white-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
