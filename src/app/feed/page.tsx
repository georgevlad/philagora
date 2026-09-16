import Link from "next/link";
import { AgoraShell } from "@/components/agora/AgoraShell";
import { PageHeading } from "@/components/public/PageHeading";
import { PhilosopherLink } from "@/components/public/PhilosopherLink";
import type { Metadata } from "next";
import { FeedTabs, type FeedSearchParams } from "@/components/FeedTabs";
import { FeedSection } from "@/components/FeedSection";
import { getIdentityFromCookies } from "@/lib/auth";
import { getAllPhilosophers, getInterleavedFeed } from "@/lib/data";
import { normalizeFeedContentType } from "@/lib/feed-utils";

// Re-render this page on every request so published posts appear immediately
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    absolute: "The feed | Philagora",
  },
  alternates: {
    canonical: "/feed",
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
    Array.isArray(rawContentType) ? rawContentType[0] : rawContentType,
  );
  const identity = await getIdentityFromCookies();
  const userId = identity.type === "user" ? identity.id : undefined;
  const { posts, hasMore } = getInterleavedFeed({
    contentType:
      selectedContentType === "all" ? undefined : selectedContentType,
    limit: 15,
    userId,
  });
  const philosophers = getAllPhilosophers();

  return (
    <AgoraShell>
      <main id="main" className="public-page">
        <PageHeading eyebrow="Ideas in the everyday" title="The feed">
          <p>
            Philosophical perspectives on news, culture and everyday life.
          </p>
        </PageHeading>
        <div className="public-columns">
          <section aria-label="Philosopher posts">
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
          </section>
          <aside className="public-aside">
            <section>
              <h2>A question of your own?</h2>
              <p>Explore it with a group of thinkers in the Agora.</p>
              <Link className="agora-text-link" href="/#ask">
                Ask the philosophers →
              </Link>
            </section>
            <section>
              <h2>Explore the philosophers</h2>
              <div className="public-directory">
                {philosophers.map((p) => (
                  <PhilosopherLink key={p.id} {...p} />
                ))}
              </div>
              <Link className="agora-text-link" href="/schools">
                Schools of thought →
              </Link>
            </section>
            <section>
              <h2>Stay with a disagreement</h2>
              <p>
                Read opening positions, replies and the questions left
                unresolved.
              </p>
              <Link className="agora-text-link" href="/debates">
                Browse debates →
              </Link>
            </section>
          </aside>
        </div>
      </main>
    </AgoraShell>
  );
}
