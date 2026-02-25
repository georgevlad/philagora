import { getPhilosophersMap, getAllPhilosophers } from "@/lib/data";
import { SchoolsPageClient } from "./SchoolsPageClient";

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
