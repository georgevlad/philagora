import { getPhilosophersMap, getAllPhilosophers } from "@/lib/data";
import { DebatePageClient } from "./DebatePageClient";

export default async function DebatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const philosophersMap = getPhilosophersMap();
  const philosophers = getAllPhilosophers();

  return (
    <DebatePageClient
      debateId={id}
      philosophersMap={philosophersMap}
      philosophers={philosophers}
    />
  );
}
