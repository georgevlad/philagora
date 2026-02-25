import { getPhilosophersMap, getAllPhilosophers } from "@/lib/data";
import { AgoraPageClient } from "./AgoraPageClient";

export default function AgoraPage() {
  const philosophersMap = getPhilosophersMap();
  const philosophers = getAllPhilosophers();

  return (
    <AgoraPageClient
      philosophersMap={philosophersMap}
      philosophers={philosophers}
    />
  );
}
