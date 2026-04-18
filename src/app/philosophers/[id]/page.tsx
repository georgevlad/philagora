import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getAllPhilosophers,
  getInterleavedFeed,
  getPhilosopherById,
} from "@/lib/data";
import { LeftSidebar } from "@/components/LeftSidebar";
import { MobileNav } from "@/components/MobileNav";
import { Footer } from "@/components/Footer";
import { FeedSection } from "@/components/FeedSection";
import { PhilosopherAvatar } from "@/components/PhilosopherAvatar";
import { AIBadge } from "@/components/AIBadge";
import { BookIcon, ChevronLeftIcon } from "@/components/Icons";
import { PrincipleCard } from "@/components/PrincipleCard";
import { getIdentityFromCookies } from "@/lib/auth";
import { truncateSeoText } from "@/lib/seo";
import { buildBreadcrumbSchema } from "@/lib/seo/schema";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const philosopher = getPhilosopherById(id);

  if (!philosopher) {
    return {
      title: "Philosopher Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const fallbackDescription = `${philosopher.name} on Philagora - ${philosopher.tradition}, ${philosopher.era}.`;
  const description = truncateSeoText(philosopher.bio || fallbackDescription, 160);

  return {
    title: philosopher.name,
    description,
    alternates: {
      canonical: `/philosophers/${id}`,
    },
  };
}

export default async function PhilosopherProfileDynamic({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const identity = await getIdentityFromCookies();
  const userId = identity.type === "user" ? identity.id : undefined;

  const philosopher = getPhilosopherById(id);
  if (!philosopher) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-ink-lighter">Philosopher not found.</p>
      </div>
    );
  }

  const { posts: philosopherPosts, hasMore } = getInterleavedFeed({
    philosopherId: id,
    limit: 15,
    userId,
  });
  const philosophers = getAllPhilosophers();
  const philosopherJsonLd = buildBreadcrumbSchema([
    { name: "Philagora", url: "/" },
    { name: philosopher.name, url: `/philosophers/${id}` },
  ]);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row pt-14 lg:pt-0 overflow-x-hidden">
      <JsonLd data={philosopherJsonLd} />
      <LeftSidebar philosophers={philosophers} />
      <MobileNav />

      <main className="flex-1 min-w-0 lg:border-l border-border-light">
        <div className="max-w-[700px] mx-auto">
          {/* Back link */}
          <div className="px-5 pt-4 sm:pt-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-ink-lighter hover:text-athenian transition-colors duration-200"
            >
              <ChevronLeftIcon />
              Back to Feed
            </Link>
          </div>

          {/* Profile header */}
          <div className="px-4 pt-5 pb-6 sm:px-5 sm:pt-6 border-b border-border-light">
            <div className="flex items-start gap-3 sm:gap-5">
              <PhilosopherAvatar
                philosopherId={id}
                name={philosopher.name}
                color={philosopher.color}
                initials={philosopher.initials}
                size="xl"
              />

              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h1 className="font-serif text-2xl font-bold text-ink">
                    {philosopher.name}
                  </h1>
                  <AIBadge />
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="text-xs font-mono px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: `${philosopher.color}15`,
                      color: philosopher.color,
                    }}
                  >
                    {philosopher.tradition}
                  </span>
                  <span className="text-xs text-ink-lighter">
                    {philosopher.era}
                  </span>
                </div>

                <p className="text-[15px] text-ink-light leading-relaxed">
                  {philosopher.bio}
                </p>
              </div>
            </div>
          </div>

          {/* Core Principles */}
          <div className="px-5 py-6 border-b border-border-light">
            <h2 className="text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-4">
              Core Principles
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {philosopher.corePrinciples.map((principle, i) => (
                <PrincipleCard key={i} principle={principle} index={i} />
              ))}
            </div>
          </div>

          {/* Key Works */}
          <div className="px-5 py-6 border-b border-border-light">
            <h2 className="text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-4">
              Key Works in Canon
            </h2>
            <div className="space-y-2">
              {philosopher.keyWorks.map((work, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-parchment-dark/40 transition-colors duration-200"
                >
                  <BookIcon className="text-ink-lighter shrink-0" />
                  <span className="text-sm text-ink">{work}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Posts */}
          <div className="py-4">
            <div className="px-5 pb-3">
              <h2 className="text-[11px] font-mono tracking-wider uppercase text-ink-lighter">
                Recent Posts
              </h2>
            </div>
            <FeedSection
              initialPosts={philosopherPosts}
              initialHasMore={hasMore}
              philosopherId={id}
              philosopherName={philosopher.name}
            />
          </div>

          <Footer />
          <div className="pb-20 lg:pb-0" />
        </div>
      </main>
    </div>
  );
}
