import type { Metadata } from "next";
import { getAgoraThreadById, getPhilosophersMap, getAllPhilosophers } from "@/lib/data";
import { ThreadPageClient } from "./ThreadPageClient";

interface Props {
  params: Promise<{ threadId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { threadId } = await params;
  const thread = getAgoraThreadById(threadId);

  if (!thread) {
    return {
      title: "Thread Not Found — Philagora Agora",
    };
  }

  const truncatedQuestion =
    thread.question.length > 60
      ? thread.question.slice(0, 57).replace(/\s+\S*$/, "") + "…"
      : thread.question;

  // Build philosopher names list from responses or philosopher IDs
  const philosophersMap = getPhilosophersMap();
  const names = thread.philosophers
    .map((pid) => philosophersMap[pid]?.name)
    .filter(Boolean);
  const namesList =
    names.length > 2
      ? `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`
      : names.join(" and ");

  return {
    title: `${truncatedQuestion} — Philagora Agora`,
    openGraph: {
      title: `${truncatedQuestion} — Philagora Agora`,
      description: `${namesList} respond to: "${thread.question}"`,
    },
  };
}

export default async function AgoraThreadPage({ params }: Props) {
  const { threadId } = await params;
  const thread = getAgoraThreadById(threadId);
  const philosophersMap = getPhilosophersMap();
  const philosophers = getAllPhilosophers();

  return (
    <ThreadPageClient
      threadId={threadId}
      initialThread={thread}
      philosophersMap={philosophersMap}
      philosophers={philosophers}
    />
  );
}
