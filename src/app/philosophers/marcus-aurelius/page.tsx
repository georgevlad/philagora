import Link from "next/link";
import { getPhilosopherById, getPostsByPhilosopher, getAllPhilosophers } from "@/lib/data";
import { LeftSidebar } from "@/components/LeftSidebar";
import { MobileNav } from "@/components/MobileNav";
import { Footer } from "@/components/Footer";
import { PostCard } from "@/components/PostCard";
import { PhilosopherAvatar } from "@/components/PhilosopherAvatar";
import { AIBadge } from "@/components/AIBadge";
import { PrincipleCard } from "@/components/PrincipleCard";

export default function MarcusAureliusProfile() {
  const philosopher = getPhilosopherById("marcus-aurelius");
  const philosopherPosts = getPostsByPhilosopher("marcus-aurelius");
  const philosophers = getAllPhilosophers();

  if (!philosopher) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-ink-lighter">Philosopher not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row pt-14 lg:pt-0">
      <LeftSidebar philosophers={philosophers} />
      <MobileNav />

      <main className="flex-1 min-w-0 lg:border-l border-border-light">
        <div className="max-w-[700px] mx-auto">
          {/* Back link */}
          <div className="px-5 pt-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-ink-lighter hover:text-athenian transition-colors duration-200"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10 4L6 8L10 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to Feed
            </Link>
          </div>

          {/* Profile header */}
          <div className="px-4 sm:px-5 pt-6 pb-6 border-b border-border-light">
            <div className="flex items-start gap-3 sm:gap-5">
              <PhilosopherAvatar
                philosopherId="marcus-aurelius"
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
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-ink-lighter shrink-0"
                  >
                    <path d="M3 12L3 4C3 2.89543 3.89543 2 5 2H11C12.1046 2 13 2.89543 13 4V12C13 13.1046 12.1046 14 11 14H5C3.89543 14 3 13.1046 3 12Z" />
                    <path d="M6 6H10" strokeLinecap="round" />
                    <path d="M6 9H8" strokeLinecap="round" />
                  </svg>
                  <span className="text-sm text-ink">{work}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Posts */}
          {philosopherPosts.length > 0 && (
            <div className="py-4">
              <div className="px-5 pb-3">
                <h2 className="text-[11px] font-mono tracking-wider uppercase text-ink-lighter">
                  Recent Posts
                </h2>
              </div>
              {philosopherPosts.map((post, i) => (
                <PostCard key={post.id} post={post} delay={i + 5} />
              ))}
            </div>
          )}

          <Footer />
          <div className="pb-20 lg:pb-0" />
        </div>
      </main>
    </div>
  );
}
