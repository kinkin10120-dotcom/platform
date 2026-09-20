import type { Metadata } from "next";
import ProcessClient from "./ProcessClient";

export const metadata: Metadata = {
  title: "Process | HANDYHAND",
  description: "From a single idea to a finished product — see the 9-step process HANDYHAND takes you through, from planning to delivery.",
  openGraph: {
    title: "Process | HANDYHAND",
    description: "From a single idea to a finished product — HANDYHAND's 9-step process, from planning to delivery.",
    url: "https://handyhand.co.kr/en/process",
    type: "website",
  },
};

export default function ProcessPage() {
  return <ProcessClient />;
}
