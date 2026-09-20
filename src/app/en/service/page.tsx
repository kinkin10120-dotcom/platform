import type { Metadata } from "next";
import ServiceClient from "./ServiceClient";

export const metadata: Metadata = {
  title: "Services | HANDYHAND",
  description:
    "Pick only the services you need — product development, consulting, manufacturing, production, and crowdfunding support, all from HANDYHAND.",
  openGraph: {
    title: "Services | HANDYHAND",
    description: "Pick only the services you need — product development, consulting, manufacturing, production, and funding.",
    url: "https://handyhand.co.kr/en/service",
    type: "website",
  },
};

export default function ServicePage() {
  return <ServiceClient />;
}
