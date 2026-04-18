import type { Metadata } from "next";
import { getPhilosophersMap, getAllPhilosophers } from "@/lib/data";
import { SchoolsPageClient } from "./SchoolsPageClient";

export const metadata: Metadata = {
  title: "Schools of Thought",
  description:
    "Browse Philagora's philosophers by tradition and see how each school of thought frames the modern crises crowding the feed.",
  alternates: {
    canonical: "/schools",
  },
};

export default function SchoolsPage() {
  const philosophersMap = getPhilosophersMap();
  const philosophers = getAllPhilosophers();

  return (
    <SchoolsPageClient
      philosophersMap={philosophersMap}
      philosophers={philosophers}
    />
  );
}
