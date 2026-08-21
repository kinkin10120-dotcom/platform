import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/login", "/home", "/clients", "/projects", "/inquiries", "/notices", "/quotes", "/templates", "/api"],
    },
    sitemap: "https://handyhand.co.kr/sitemap.xml",
  };
}
