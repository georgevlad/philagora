import type { Metadata } from "next";
import { getPhilosophersMap, getAllPhilosophers } from "@/lib/data";
import { SchoolsPageClient } from "./SchoolsPageClient";

// Railway's database volume is only available at runtime. Do not cache the
// build-time empty roster as the public schools directory.
export const dynamic = "force-dynamic";

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
