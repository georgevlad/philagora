import { getAllPhilosophers } from "@/lib/data";
import { AgoraPageClient } from "./AgoraPageClient";

export default function AgoraPage() {
  const philosophers = getAllPhilosophers();

  return (
    <AgoraPageClient
      philosophers={philosophers}
    />
  );
}
