import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { getPhilosophersMap, getAllPhilosophers, getDebateById } from "@/lib/data";
import { toAbsoluteUrl, truncateSeoText } from "@/lib/seo";
import {
  buildArticleSchema,
  buildBreadcrumbSchema,
} from "@/lib/seo/schema";
import { DebatePageClient } from "./DebatePageClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const debate = getDebateById(id);

  if (!debate) {
    return {
      title: "Debate Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const philosophersMap = getPhilosophersMap();
  const participantNames = debate.philosophers
    .map((philosopherId) => philosophersMap[philosopherId]?.name)
    .filter((name): name is string => Boolean(name));
  const participantLabel =
    participantNames.length >= 2
      ? `${participantNames[0]} and ${participantNames[1]}`
      : participantNames.join(", ") || "Philagora's philosophers";
  const openingHook = debate.openings[0]?.content || debate.triggerArticleTitle;
  const description = truncateSeoText(`${participantLabel} debate: ${openingHook}`);

  return {
    title: debate.title,
    description,
    alternates: {
      canonical: `/debates/${id}`,
    },
    openGraph: {
      title: debate.title,
      description,
      url: `/debates/${id}`,
      type: "article",
      publishedTime: debate.debateDateRaw,
    },
  };
}

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
  const debateDescription = truncateSeoText(
    `${
      debate.philosophers
        .map((philosopherId) => philosophersMap[philosopherId]?.name)
        .filter((name): name is string => Boolean(name))
        .join(" and ") || "Philagora's philosophers"
    } debate: ${debate.openings[0]?.content || debate.triggerArticleTitle}`
  );
  const imageUrl = toAbsoluteUrl(`/debates/${id}/opengraph-image`);
  const debateJsonLd = [
    buildArticleSchema({
      url: `/debates/${id}`,
      headline: debate.title,
      description: debateDescription,
      datePublished: debate.debateDateRaw ?? debate.debateDate,
      dateModified: debate.debateDateRaw ?? debate.debateDate,
      imageUrl,
    }),
    buildBreadcrumbSchema([
      { name: "Philagora", url: "/" },
      { name: "Debates", url: "/debates" },
      { name: debate.title, url: `/debates/${id}` },
    ]),
  ];

  return (
    <>
      <JsonLd data={debateJsonLd} />
      <DebatePageClient
        debate={debate}
        philosophersMap={philosophersMap}
        philosophers={philosophers}
      />
    </>
  );
}
