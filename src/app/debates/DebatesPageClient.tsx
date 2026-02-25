"use client";

import Link from "next/link";
import { debatesList } from "@/data/debates";
import type { Philosopher } from "@/lib/types";
import { LeftSidebar } from "@/components/LeftSidebar";
import { MobileNav } from "@/components/MobileNav";
import { Footer } from "@/components/Footer";
import { PhilosopherAvatar } from "@/components/PhilosopherAvatar";
import { useScrollReveal } from "@/hooks/useScrollReveal";

function DebateListCard({
  debate,
  index,
  philosophersMap,
}: {
  debate: (typeof debatesList)[0];
  index: number;
  philosophersMap: Record<string, Philosopher>;
}) {
  const ref = useScrollReveal(index);
  const firstPost = debate.posts[0];
  const preview = firstPost
    ? firstPost.content.slice(0, 120) + (firstPost.content.length > 120 ? "..." : "")
    : "Debate not yet started.";

  return (
    <Link href={`/debates/${debate.id}`}>
      <div
        ref={ref}
        className="animate-fade-in-up p-5 border border-border-light rounded-lg hover:border-border hover:bg-parchment-dark/40 transition-all duration-200 mb-4"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
      >
        <div className="flex items-center gap-3 mb-3">
          <span
            className={`text-[10px] font-mono tracking-wide px-2.5 py-0.5 rounded-full ${
              debate.status === "Complete"
                ? "bg-stoic/10 text-stoic"
                : debate.status === "In Progress"
                ? "bg-terracotta/10 text-terracotta"
                : "bg-ink-lighter/10 text-ink-lighter"
            }`}
          >
            {debate.status}
          </span>
          <span className="text-xs text-ink-lighter">{debate.date}</span>
        </div>

        <h3 className="font-serif text-lg font-bold text-ink leading-snug mb-2">
          {debate.title}
        </h3>

        {/* Trigger article */}
        <div className="flex items-center gap-2 mb-3 text-xs text-ink-lighter">
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="shrink-0"
          >
            <path d="M3 12L3 4C3 2.89543 3.89543 2 5 2H11C12.1046 2 13 2.89543 13 4V12C13 13.1046 12.1046 14 11 14H5C3.89543 14 3 13.1046 3 12Z" />
            <path d="M6 6H10" strokeLinecap="round" />
            <path d="M6 9H8" strokeLinecap="round" />
          </svg>
          <span>
            {debate.triggerArticle.title} &mdash; {debate.triggerArticle.source}
          </span>
        </div>

        {/* Preview */}
        <p className="text-sm text-ink-light leading-relaxed mb-3">
          {preview}
        </p>

        {/* Participants */}
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {debate.philosophers.map((pId) => {
              const p = philosophersMap[pId];
              return p ? (
                <div key={pId} className="ring-2 ring-parchment rounded-full">
                  <PhilosopherAvatar
                    philosopherId={pId}
                    name={p.name}
                    color={p.color}
                    initials={p.initials}
                    size="sm"
                  />
                </div>
              ) : null;
            })}
          </div>
          <span className="text-xs text-ink-lighter">
            {debate.philosophers
              .map((pId) => philosophersMap[pId]?.name)
              .filter(Boolean)
              .join(", ")}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function DebatesPageClient({
  philosophersMap,
  philosophers,
}: {
  philosophersMap: Record<string, Philosopher>;
  philosophers: Philosopher[];
}) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row pt-14 lg:pt-0">
      <LeftSidebar philosophers={philosophers} />
      <MobileNav />

      <main className="flex-1 min-w-0 lg:border-l border-border-light">
        <div className="max-w-[700px] mx-auto">
          <div className="px-5 pt-8 pb-6 border-b border-border-light">
            <h1 className="font-serif text-2xl lg:text-3xl font-bold text-ink leading-tight mb-2">
              Debates
            </h1>
            <p className="text-[15px] text-ink-light leading-relaxed">
              Structured philosophical debates triggered by current events. Each debate features opening statements, rebuttals, and a synthesis of key tensions and agreements.
            </p>
          </div>

          <div className="px-5 py-6">
            {debatesList.map((debate, i) => (
              <DebateListCard
                key={debate.id}
                debate={debate}
                index={i}
                philosophersMap={philosophersMap}
              />
            ))}
          </div>

          <Footer />
          <div className="pb-20 lg:pb-0" />
        </div>
      </main>
    </div>
  );
}
