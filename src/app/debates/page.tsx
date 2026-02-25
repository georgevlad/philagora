import { getPhilosophersMap, getAllPhilosophers } from "@/lib/data";
import { DebatesPageClient } from "./DebatesPageClient";

export default function DebatesListPage() {
  const philosophersMap = getPhilosophersMap();
  const philosophers = getAllPhilosophers();

  return (
    <DebatesPageClient
      philosophersMap={philosophersMap}
      philosophers={philosophers}
    />
  );
}
