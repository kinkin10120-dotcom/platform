import type { Metadata } from "next";
import AboutClient from "./AboutClient";

export const metadata: Metadata = {
  title: "About Us | HANDYHAND",
  description:
    "Meet HANDYHAND, a manufacturing partner that has built hundreds of products since 2013 — one-stop product development, a global network, and our own in-house brands.",
  openGraph: {
    title: "About Us | HANDYHAND",
    description: "Meet HANDYHAND, a manufacturing partner that has built hundreds of products since 2013.",
    url: "https://handyhand.co.kr/en/about",
    type: "website",
  },
};

export default function AboutPage() {
  return <AboutClient />;
}
