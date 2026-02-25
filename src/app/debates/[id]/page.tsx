import { notFound } from "next/navigation";
import { getPhilosophersMap, getAllPhilosophers, getDebateById } from "@/lib/data";
import { DebatePageClient } from "./DebatePageClient";

export default async function DebatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const debate = getDebateById(id);

  if (!debate) {
    notFound();
  }

  const philosophersMap = getPhilosophersMap();
  const philosophers = getAllPhilosophers();

  return (
    <DebatePageClient
      debate={debate}
      philosophersMap={philosophersMap}
      philosophers={philosophers}
    />
  );
}
