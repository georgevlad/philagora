import { LeftSidebar } from "@/components/LeftSidebar";
import { RightSidebar } from "@/components/RightSidebar";
import { MobileNav } from "@/components/MobileNav";
import { FeedTabs } from "@/components/FeedTabs";
import { PostCard } from "@/components/PostCard";
import { TensionCard } from "@/components/TensionCard";
import { Footer } from "@/components/Footer";
import { getPublishedPosts, getAllPhilosophers } from "@/lib/data";
import type { FeedPost } from "@/lib/types";

// Re-render this page on every request so published posts appear immediately
export const dynamic = "force-dynamic";

// ── Feed item types ─────────────────────────────────────────────────

type FeedItem =
  | { type: "post"; post: FeedPost; index: number }
  | { type: "tension"; postA: FeedPost; postB: FeedPost };

function sharesSameArticle(a: FeedPost, b: FeedPost): boolean {
  if (!a.citation || !b.citation) return false;
  if (a.citation.url && b.citation.url && a.citation.url === b.citation.url)
    return true;
  if (
    a.citation.title &&
    b.citation.title &&
    a.citation.source &&
    b.citation.source
  ) {
    return (
      a.citation.title === b.citation.title &&
      a.citation.source === b.citation.source
    );
  }
  return false;
}

function buildFeedItems(posts: FeedPost[]): FeedItem[] {
  const items: FeedItem[] = [];
  let lastTensionArticle: string | null = null;

  for (let i = 0; i < posts.length; i++) {
    items.push({ type: "post", post: posts[i], index: i });

    if (i < posts.length - 1) {
      const current = posts[i];
      const next = posts[i + 1];
      const sameArticle = sharesSameArticle(current, next);
      const differentStance = current.stance !== next.stance;
      const articleKey =
        current.citation?.url || current.citation?.title || null;
      const notDuplicate = articleKey !== lastTensionArticle;

      if (sameArticle && differentStance && notDuplicate) {
        items.push({ type: "tension", postA: current, postB: next });
        lastTensionArticle = articleKey;
      }
    }
  }

  return items;
}

// ── Page ────────────────────────────────────────────────────────────

export default function HomePage() {
  const posts = getPublishedPosts();
  const philosophers = getAllPhilosophers();
  const feedItems = buildFeedItems(posts);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row pt-14 lg:pt-0">
      <LeftSidebar philosophers={philosophers} />
      <MobileNav />

      {/* Main feed */}
      <main className="flex-1 min-w-0 lg:border-r border-border-light lg:border-l">
        <div className="max-w-[640px] mx-auto">
          <FeedTabs />
          <div className="pb-20 lg:pb-0 py-2">
            {feedItems.length > 0 ? (
              feedItems.map((item, i) =>
                item.type === "post" ? (
                  <PostCard
                    key={item.post.id}
                    post={item.post}
                    delay={item.index}
                  />
                ) : (
                  <TensionCard
                    key={`tension-${i}`}
                    philosopherA={{
                      name: item.postA.philosopherName,
                      id: item.postA.philosopherId,
                      color: item.postA.philosopherColor,
                      initials: item.postA.philosopherInitials,
                      stance: item.postA.stance,
                    }}
                    philosopherB={{
                      name: item.postB.philosopherName,
                      id: item.postB.philosopherId,
                      color: item.postB.philosopherColor,
                      initials: item.postB.philosopherInitials,
                      stance: item.postB.stance,
                    }}
                    articleTitle={item.postA.citation?.title || ""}
                  />
                )
              )
            ) : (
              <div className="px-6 py-16 text-center">
                <p className="font-serif text-lg text-ink-light mb-2">
                  No posts yet.
                </p>
                <p className="text-sm text-ink-lighter">
                  Content is being curated by the philosophers.
                </p>
              </div>
            )}
          </div>
          <Footer />
        </div>
      </main>

      <RightSidebar />
    </div>
  );
}
