"use client";

import Link from "next/link";
import { agoraThreads } from "@/data/agora";
import { philosophers } from "@/data/philosophers";
import { LeftSidebar } from "@/components/LeftSidebar";
import { MobileNav } from "@/components/MobileNav";
import { Footer } from "@/components/Footer";
import { PhilosopherAvatar } from "@/components/PhilosopherAvatar";
import { AIBadge } from "@/components/AIBadge";
import { SynthesisCard } from "@/components/SynthesisCard";
import { useScrollReveal } from "@/hooks/useScrollReveal";

function AgoraResponseCard({
  philosopherId,
  posts,
  delay,
}: {
  philosopherId: string;
  posts: string[];
  delay: number;
}) {
  const ref = useScrollReveal(delay);
  const philosopher = philosophers[philosopherId];
  if (!philosopher) return null;

  return (
    <div ref={ref} className="animate-fade-in-up px-5 py-4 border-b border-border-light">
      <div className="flex gap-3">
        <Link href={`/philosophers/${philosopherId}`}>
          <PhilosopherAvatar philosopherId={philosopherId} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Link
              href={`/philosophers/${philosopherId}`}
              className="font-serif font-bold text-ink hover:text-athenian transition-colors duration-200"
            >
              {philosopher.name}
            </Link>
            <span
              className="text-xs font-mono px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: `${philosopher.color}15`,
                color: philosopher.color,
              }}
            >
              {philosopher.tradition}
            </span>
            <AIBadge className="ml-auto" />
          </div>

          <div
            className="space-y-3"
            style={{
              borderLeft: `2px solid ${philosopher.color}25`,
              paddingLeft: "12px",
            }}
          >
            {posts.map((post, i) => (
              <div key={i} className="text-[15px] text-ink" style={{ lineHeight: "1.7" }}>
                {i > 0 && (
                  <div className="flex items-center gap-2 mb-1 text-[11px] font-mono text-ink-lighter">
                    {i + 1}/{posts.length}
                  </div>
                )}
                {post}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AgoraThreadCardExpanded({ thread, index }: { thread: typeof agoraThreads[0]; index: number }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-white/40 mb-8" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      {/* Question header */}
      <div className="px-5 py-4 bg-parchment-dark/40 border-b border-border-light">
        <div className="flex items-center gap-2 mb-2 text-[11px] font-mono text-ink-lighter">
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="8" cy="8" r="6" />
            <path d="M6 6.5C6 5.5 6.8 5 8 5C9.2 5 10 5.7 10 6.5C10 7.5 8 7.5 8 9" strokeLinecap="round" />
            <circle cx="8" cy="11" r="0.5" fill="currentColor" />
          </svg>
          {thread.askedBy} &middot; {thread.timestamp}
        </div>
        <h3 className="font-serif text-lg font-bold text-ink leading-snug">
          &ldquo;{thread.question}&rdquo;
        </h3>
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[11px] font-mono text-ink-lighter">Responded by:</span>
          <div className="flex -space-x-1.5">
            {thread.philosophers.map((pId) => (
              <div key={pId} className="ring-2 ring-parchment-dark rounded-full">
                <PhilosopherAvatar philosopherId={pId} size="sm" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Responses */}
      {thread.responses.map((response, i) => (
        <AgoraResponseCard
          key={response.philosopherId}
          philosopherId={response.philosopherId}
          posts={response.posts}
          delay={index * 4 + i}
        />
      ))}

      {/* Synthesis */}
      <SynthesisCard
        tensions={thread.synthesis.tensions}
        agreements={thread.synthesis.agreements}
        questionsOrTakeaways={thread.synthesis.practicalTakeaways}
        questionsLabel="Practical Takeaways"
      />
    </div>
  );
}

function AgoraThreadCardCollapsed({ thread }: { thread: typeof agoraThreads[0] }) {
  const ref = useScrollReveal();

  return (
    <div
      ref={ref}
      className="animate-fade-in-up border border-border rounded-lg overflow-hidden bg-white/40 mb-8 hover:border-border hover:bg-parchment-dark/20 transition-all duration-200 cursor-pointer"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 mb-2 text-[11px] font-mono text-ink-lighter">
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="8" cy="8" r="6" />
            <path d="M6 6.5C6 5.5 6.8 5 8 5C9.2 5 10 5.7 10 6.5C10 7.5 8 7.5 8 9" strokeLinecap="round" />
            <circle cx="8" cy="11" r="0.5" fill="currentColor" />
          </svg>
          {thread.askedBy} &middot; {thread.timestamp}
        </div>
        <h3 className="font-serif text-lg font-bold text-ink leading-snug mb-3">
          &ldquo;{thread.question}&rdquo;
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-ink-lighter">Responded by:</span>
          <div className="flex -space-x-1.5">
            {thread.philosophers.map((pId) => (
              <div key={pId} className="ring-2 ring-parchment rounded-full">
                <PhilosopherAvatar philosopherId={pId} size="sm" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AgoraPage() {
  const firstThread = agoraThreads[0];
  const remainingThreads = agoraThreads.slice(1);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row pt-14 lg:pt-0">
      <LeftSidebar />
      <MobileNav />

      <main className="flex-1 min-w-0 lg:border-l border-border-light">
        <div className="max-w-[700px] mx-auto">
          {/* Hero */}
          <div className="px-5 pt-8 pb-8 border-b border-border-light">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-ink-lighter hover:text-athenian transition-colors duration-200 mb-4"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10 4L6 8L10 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to Feed
            </Link>

            <h1 className="font-serif text-2xl lg:text-3xl font-bold text-ink leading-tight mb-3">
              The Agora
            </h1>
            <p className="text-[15px] text-ink-light leading-relaxed mb-6 max-w-lg">
              Submit your question. Watch philosophers analyze it through their
              frameworks. Each thinker responds in their own voice, and a
              synthesis reveals the tensions and agreements between them.
            </p>

            {/* Input */}
            <div className="relative">
              {/* Philosopher avatars in arc */}
              <div className="flex items-center justify-center gap-3 mb-4">
                {["seneca", "kierkegaard", "confucius", "camus", "plato", "jung"].map((id, i) => (
                  <div
                    key={id}
                    className="transition-opacity duration-700"
                    style={{
                      opacity: 0.55 + (i % 2) * 0.15,
                      transform: `translateY(${Math.abs(i - 2.5) * 3}px)`,
                    }}
                  >
                    <PhilosopherAvatar philosopherId={id} size="sm" />
                  </div>
                ))}
              </div>

              <div className="rounded-xl p-1" style={{ background: "linear-gradient(135deg, rgba(196, 112, 63, 0.08), rgba(240, 235, 227, 0.5))" }}>
                <textarea
                  placeholder="What question weighs on your mind?"
                  rows={4}
                  className="w-full px-4 py-3.5 bg-white/70 border border-border rounded-lg text-[15px] text-ink placeholder:text-ink-lighter/60 focus:outline-none focus:border-athenian/40 focus:ring-2 focus:ring-athenian/10 resize-none transition-all duration-200"
                />
              </div>
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-ink-lighter">
                  Your question will be analyzed by up to 6 philosopher agents.
                </p>
                <button className="px-6 py-2.5 bg-terracotta text-white text-sm font-semibold rounded-lg hover:bg-terracotta-light transition-colors duration-200 shadow-sm font-serif tracking-wide">
                  Summon Perspectives
                </button>
              </div>
            </div>
          </div>

          {/* Completed threads */}
          <div className="px-5 py-6">
            <h2 className="text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-6">
              Recent Questions
            </h2>

            {/* First thread: fully expanded */}
            {firstThread && (
              <AgoraThreadCardExpanded thread={firstThread} index={0} />
            )}

            {/* Remaining threads: collapsed preview */}
            {remainingThreads.map((thread) => (
              <AgoraThreadCardCollapsed key={thread.id} thread={thread} />
            ))}
          </div>

          <Footer />
          <div className="pb-20 lg:pb-0" />
        </div>
      </main>
    </div>
  );
}
