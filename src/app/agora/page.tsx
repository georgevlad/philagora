import { getPhilosophersMap, getAllPhilosophers, getAllAgoraThreads } from "@/lib/data";
import { AgoraPageClient } from "./AgoraPageClient";

export default function AgoraPage() {
  const philosophersMap = getPhilosophersMap();
  const philosophers = getAllPhilosophers();
  const threads = getAllAgoraThreads();

  return (
    <AgoraPageClient
      philosophersMap={philosophersMap}
      philosophers={philosophers}
      threads={threads}
    />
  );
}
