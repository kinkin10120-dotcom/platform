import type { Metadata } from "next";
import PortfolioClient from "./PortfolioClient";

export const metadata: Metadata = {
  title: "Portfolio | HANDYHAND",
  description: "From client projects to our own in-house brands — see what HANDYHAND has built, from development through production and delivery.",
  openGraph: {
    title: "Portfolio | HANDYHAND",
    description: "From client projects to our own in-house brands — see what HANDYHAND has built.",
    url: "https://handyhand.co.kr/en/portfolio",
    type: "website",
  },
};

export default function PortfolioPage() {
  return <PortfolioClient />;
}
