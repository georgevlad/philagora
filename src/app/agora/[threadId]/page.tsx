import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getAgoraThreadById,
  getPhilosophersMap,
  getAllPhilosophers,
} from "@/lib/data";
import { truncateSeoText } from "@/lib/seo";
import { buildQAPageSchema } from "@/lib/seo/schema";
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
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const truncatedQuestion =
    thread.question.length > 60
      ? `${thread.question.slice(0, 57).replace(/\s+\S*$/, "")}…`
      : thread.question;

  const philosophersMap = getPhilosophersMap();
  const names = thread.philosophers
    .map((philosopherId) => philosophersMap[philosopherId]?.name)
    .filter((name): name is string => Boolean(name));
  const namesList =
    names.length > 2
      ? `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`
      : names.join(" and ");
  const description = truncateSeoText(
    `${namesList || "Philagora's philosophers"} respond to: "${thread.question}"`
  );

  return {
    title: `${truncatedQuestion} — Philagora Agora`,
    description,
    alternates: {
      canonical: `/agora/${threadId}`,
    },
    openGraph: {
      title: `${truncatedQuestion} — Philagora Agora`,
      description,
      url: `/agora/${threadId}`,
      type: "article",
    },
    robots: thread.hiddenFromFeed
      ? {
          index: false,
          follow: false,
        }
      : undefined,
  };
}

export default async function AgoraThreadPage({ params }: Props) {
  const { threadId } = await params;
  const thread = getAgoraThreadById(threadId);
  const philosophersMap = getPhilosophersMap();
  const philosophers = getAllPhilosophers();
  const threadJsonLd =
    thread && !thread.hiddenFromFeed && thread.responses.length > 0
      ? buildQAPageSchema({
          url: `/agora/${threadId}`,
          question: thread.question,
          askedDate: thread.createdAt,
          answers: thread.responses.map((response) => ({
            text: response.posts.join("\n\n"),
          })),
        })
      : null;

  return (
    <>
      {threadJsonLd ? <JsonLd data={threadJsonLd} /> : null}
      <ThreadPageClient
        threadId={threadId}
        initialThread={thread}
        philosophersMap={philosophersMap}
        philosophers={philosophers}
      />
    </>
  );
}
