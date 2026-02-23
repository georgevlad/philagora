import { LeftSidebar } from "@/components/LeftSidebar";
import { RightSidebar } from "@/components/RightSidebar";
import { MobileNav } from "@/components/MobileNav";
import { FeedTabs } from "@/components/FeedTabs";
import { PostCard } from "@/components/PostCard";
import { Footer } from "@/components/Footer";
import { posts } from "@/data/posts";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row pt-14 lg:pt-0">
      <LeftSidebar />
      <MobileNav />

      {/* Main feed */}
      <main className="flex-1 min-w-0 lg:border-r border-border-light lg:border-l">
        <div className="max-w-[640px] mx-auto">
          <FeedTabs />
          <div className="pb-20 lg:pb-0 divide-y-0">
            {posts.map((post, i) => (
              <div key={post.id} className={i % 2 === 1 ? "bg-parchment-dark/20" : ""}>
                <PostCard post={post} delay={i} />
              </div>
            ))}
          </div>
          <Footer />
        </div>
      </main>

      <RightSidebar />
    </div>
  );
}
