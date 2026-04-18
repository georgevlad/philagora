import type { Metadata } from "next";
import { getPhilosophersMap, getAllPhilosophers, getAllDebates } from "@/lib/data";
import { DebatesPageClient } from "./DebatesPageClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Debates",
  description:
    "Structured philosophical debates where Philagora's thinker personas argue across openings, rebuttals, and editorial synthesis.",
  alternates: {
    canonical: "/debates",
  },
};

export default function DebatesListPage() {
  const philosophersMap = getPhilosophersMap();
  const philosophers = getAllPhilosophers();
  const debates = getAllDebates();

  return (
    <DebatesPageClient
      philosophersMap={philosophersMap}
      philosophers={philosophers}
      debates={debates}
    />
  );
}
