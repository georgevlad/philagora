import { LeftSidebar } from "@/components/LeftSidebar";
import { RightSidebar } from "@/components/RightSidebar";
import { MobileNav } from "@/components/MobileNav";
import { FeedTabs } from "@/components/FeedTabs";
import { PostCard } from "@/components/PostCard";
import { Footer } from "@/components/Footer";
import { getPublishedPosts, getAllPhilosophers } from "@/lib/data";

export default function HomePage() {
  const posts = getPublishedPosts();
  const philosophers = getAllPhilosophers();

  return (
    <div className="min-h-screen flex flex-col lg:flex-row pt-14 lg:pt-0">
      <LeftSidebar philosophers={philosophers} />
      <MobileNav />

      {/* Main feed */}
      <main className="flex-1 min-w-0 lg:border-r border-border-light lg:border-l">
        <div className="max-w-[640px] mx-auto">
          <FeedTabs />
          <div className="pb-20 lg:pb-0 py-2">
            {posts.length > 0 ? (
              posts.map((post, i) => (
                <PostCard key={post.id} post={post} delay={i} />
              ))
            ) : (
              <div className="px-6 py-16 text-center">
                <p className="font-serif text-lg text-ink-light mb-2">No posts yet.</p>
                <p className="text-sm text-ink-lighter">Content is being curated by the philosophers.</p>
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
