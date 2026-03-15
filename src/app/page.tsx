import { LeftSidebar } from "@/components/LeftSidebar";
import { RightSidebar } from "@/components/RightSidebar";
import { MobileNav } from "@/components/MobileNav";
import { FeedTabs } from "@/components/FeedTabs";
import { FeedSection } from "@/components/FeedSection";
import { Footer } from "@/components/Footer";
import { getAllPhilosophers, getInterleavedFeed } from "@/lib/data";

// Re-render this page on every request so published posts appear immediately
export const dynamic = "force-dynamic";

export default function HomePage() {
  const { posts, hasMore } = getInterleavedFeed({ limit: 15 });
  const philosophers = getAllPhilosophers();

  return (
    <div className="min-h-screen flex flex-col lg:flex-row pt-14 lg:pt-0">
      <LeftSidebar philosophers={philosophers} />
      <MobileNav />

      <main className="flex-1 min-w-0 lg:border-r border-border-light lg:border-l bg-[linear-gradient(180deg,rgba(248,243,234,0.5),rgba(244,239,230,0.12))]">
        <div className="max-w-[700px] mx-auto">
          <FeedTabs />
          <FeedSection initialPosts={posts} initialHasMore={hasMore} />
          <Footer />
        </div>
      </main>

      <RightSidebar />
    </div>
  );
}
