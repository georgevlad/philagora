import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getAgoraThreadById,
  getPhilosophersMap,
  getAllPhilosophers,
} from "@/lib/data";
import { getIdentityFromCookies } from "@/lib/auth";
import {
  canReadAgoraThread,
  canFollowUpAgoraThread,
  isPublicAgoraThread,
} from "@/lib/agora-access";
import { redirect } from "next/navigation";
import { truncateSeoText } from "@/lib/seo";
import { buildQAPageSchema } from "@/lib/seo/schema";
import { ThreadPageClient } from "./ThreadPageClient";

interface Props {
  params: Promise<{ threadId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { threadId } = await params;
  const thread = getAgoraThreadById(threadId);

  if (!thread || !isPublicAgoraThread(thread)) {
    return {
      title: "Agora conversation",
      description: "A conversation in the Agora.",
      openGraph: {
        title: "Agora conversation",
        description: "A conversation in the Agora.",
      },
      twitter: {
        title: "Agora conversation",
        description: "A conversation in the Agora.",
      },
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
    `${namesList || "Philagora's philosophers"} respond to: "${thread.question}"`,
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
  const identity = await getIdentityFromCookies();
  const candidate = getAgoraThreadById(threadId);
  const thread =
    candidate && canReadAgoraThread(candidate, identity) ? candidate : null;
  if (thread?.followUpTo) redirect(`/agora/${thread.followUpTo}#follow-up`);
  const initialCanFollowUp = thread
    ? canFollowUpAgoraThread(thread, identity)
    : false;
  if (
    thread &&
    identity.type !== "admin" &&
    (identity.type !== "user" || thread.userId !== identity.id)
  )
    thread.userId = null;
  const philosophers = getAllPhilosophers();
  const threadJsonLd =
    thread && isPublicAgoraThread(thread) && thread.responses.length > 0
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
        initialCanFollowUp={initialCanFollowUp}
        viewerKey={
          identity.type === "user"
            ? identity.id
            : identity.type === "admin"
              ? "admin"
              : "guest"
        }
        philosophers={philosophers}
      />
    </>
  );
}
