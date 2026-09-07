import type { Metadata } from "next";
import { LeftSidebar } from "@/components/LeftSidebar";
import { RightSidebar } from "@/components/RightSidebar";
import { MobileNav } from "@/components/MobileNav";
import { AgoraHero } from "@/components/AgoraHero";
import { FeedTabs, type FeedSearchParams } from "@/components/FeedTabs";
import { FeedSection } from "@/components/FeedSection";
import { Footer } from "@/components/Footer";
import { getIdentityFromCookies } from "@/lib/auth";
import { getAllPhilosophers, getInterleavedFeed } from "@/lib/data";
import { normalizeFeedContentType } from "@/lib/feed-utils";

// Re-render this page on every request so published posts appear immediately
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    absolute: "Philagora - Philosophy, interrupted by the news.",
  },
  alternates: {
    canonical: "/",
  },
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<FeedSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const rawContentType = resolvedSearchParams.type;
  const selectedContentType = normalizeFeedContentType(
    Array.isArray(rawContentType) ? rawContentType[0] : rawContentType
  );
  const identity = await getIdentityFromCookies();
  const userId = identity.type === "user" ? identity.id : undefined;
  const { posts, hasMore } = getInterleavedFeed({
    contentType: selectedContentType === "all" ? undefined : selectedContentType,
    limit: 15,
    userId,
  });
  const philosophers = getAllPhilosophers();

  return (
    <div className="min-h-screen flex flex-col pt-14 lg:flex-row lg:pt-0 overflow-x-hidden">
      <LeftSidebar philosophers={philosophers} />
      <MobileNav />

      <main className="flex-1 min-w-0 lg:border-r border-border-light lg:border-l bg-[linear-gradient(180deg,rgba(248,243,234,0.5),rgba(244,239,230,0.12))]">
        <div className="max-w-[700px] mx-auto">
          <AgoraHero />
          <FeedTabs
            activeType={selectedContentType}
            searchParams={resolvedSearchParams}
          />
          <FeedSection
            key={selectedContentType}
            initialPosts={posts}
            initialHasMore={hasMore}
            contentType={selectedContentType}
          />
          <Footer />
        </div>
      </main>

      <RightSidebar philosophers={philosophers} />
    </div>
  );
}
