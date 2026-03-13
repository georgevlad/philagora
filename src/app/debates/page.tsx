import { getPhilosophersMap, getAllPhilosophers, getAllDebates } from "@/lib/data";
import { DebatesPageClient } from "./DebatesPageClient";

export const dynamic = "force-dynamic";

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
