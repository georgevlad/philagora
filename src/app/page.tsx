import { LeftSidebar } from "@/components/LeftSidebar";
import { RightSidebar } from "@/components/RightSidebar";
import { MobileNav } from "@/components/MobileNav";
import { FeedTabs } from "@/components/FeedTabs";
import { FeedSection } from "@/components/FeedSection";
import { Footer } from "@/components/Footer";
import { getIdentityFromCookies } from "@/lib/auth";
import { getAllPhilosophers, getInterleavedFeed } from "@/lib/data";

// Re-render this page on every request so published posts appear immediately
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const identity = await getIdentityFromCookies();
  const userId = identity.type === "user" ? identity.id : undefined;
  const { posts, hasMore } = getInterleavedFeed({ limit: 15, userId });
  const philosophers = getAllPhilosophers();

  return (
    <div className="min-h-screen flex flex-col pt-[80px] lg:flex-row lg:pt-0 overflow-x-hidden">
      <LeftSidebar philosophers={philosophers} />
      <MobileNav topContent={<FeedTabs mobileIntegrated />} />

      <main className="flex-1 min-w-0 lg:border-r border-border-light lg:border-l bg-[linear-gradient(180deg,rgba(248,243,234,0.5),rgba(244,239,230,0.12))]">
        <div className="max-w-[700px] mx-auto">
          <div className="hidden lg:block">
            <FeedTabs />
          </div>
          <FeedSection initialPosts={posts} initialHasMore={hasMore} />
          <Footer />
        </div>
      </main>

      <RightSidebar />
    </div>
  );
}
