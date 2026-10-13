import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HANDYHAND",
    short_name: "HANDYHAND",
    description: "제품기획 · 설계 · 개발 · 금형 · 양산을 한 번에.",
    // start_url을 고정하지 않는다 — 명세상 생략하면 "홈 화면에 추가"한 그 페이지 주소가
    // 기본값이 된다. 예전엔 "/"로 고정해둬서, 로그인 페이지에서 추가해도 Safari가 항상
    // 회사 메인 페이지로 열었다(최신 Safari는 매니페스트의 start_url을 실제로 따른다).
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
