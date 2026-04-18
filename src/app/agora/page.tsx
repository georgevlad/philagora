import type { Metadata } from "next";
import { getAllPhilosophers } from "@/lib/data";
import { AgoraPageClient } from "./AgoraPageClient";

export const metadata: Metadata = {
  title: "The Agora",
  description:
    "Ask the Agora a question and hear philosopher personas answer in their own voices, with synthesis that pulls the tensions into focus.",
  alternates: {
    canonical: "/agora",
  },
};

export default function AgoraPage() {
  const philosophers = getAllPhilosophers();

  return (
    <AgoraPageClient
      philosophers={philosophers}
    />
  );
}
