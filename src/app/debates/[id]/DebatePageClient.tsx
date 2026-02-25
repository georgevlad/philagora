"use client";

import { use } from "react";
import Link from "next/link";
import { debates } from "@/data/debates";
import type { Philosopher } from "@/lib/types";
import type { DebatePost as DebatePostType } from "@/data/debates";
import { LeftSidebar } from "@/components/LeftSidebar";
import { MobileNav } from "@/components/MobileNav";
import { Footer } from "@/components/Footer";
import { PhilosopherAvatar } from "@/components/PhilosopherAvatar";
import { AIBadge } from "@/components/AIBadge";
import { useScrollReveal } from "@/hooks/useScrollReveal";

function DebatePostCard({
  post,
  delay,
  philosophersMap,
}: {
  post: DebatePostType;
  delay: number;
  philosophersMap: Record<string, Philosopher>;
}) {
  const ref = useScrollReveal(delay);
  const philosopher = philosophersMap[post.philosopherId];
  if (!philosopher) return null;

  return (
    <div
      ref={ref}
      className="animate-fade-in-up px-5 py-4 border-b border-border-light"
    >
      <div className="flex gap-3">
        <Link href={`/philosophers/${post.philosopherId}`}>
          <PhilosopherAvatar
            philosopherId={post.philosopherId}
            name={philosopher.name}
            color={philosopher.color}
            initials={philosopher.initials}
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/philosophers/${post.philosopherId}`}
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

          {post.replyTo && (
            <div className="flex items-center gap-1.5 mb-2 text-xs text-ink-lighter">
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M6 3L3 6L6 9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 6H10C12.2091 6 14 7.79086 14 10V13" strokeLinecap="round" />
              </svg>
              Replying
            </div>
          )}

          <div
            className="text-[15px] text-ink whitespace-pre-line"
            style={{
              borderLeft: `2px solid ${philosopher.color}25`,
              paddingLeft: "12px",
              lineHeight: "1.7",
            }}
          >
            {post.content}
          </div>
        </div>
      </div>
    </div>
  );
}

function PhaseLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[11px] font-mono tracking-widest uppercase text-ink-lighter">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function NeutralSynthesisCard({
  agree,
  diverge,
  unresolvedQuestion,
}: {
  agree: string;
  diverge: string;
  unresolvedQuestion: string;
}) {
  const ref = useScrollReveal();

  return (
    <div
      ref={ref}
      className="animate-fade-in-up mx-3 sm:mx-5 my-6 rounded-lg overflow-hidden"
      style={{
        backgroundColor: "rgba(240, 230, 214, 0.5)",
        borderTop: "2px solid var(--color-border)",
        border: "1px solid var(--color-border-light)",
        borderTopStyle: "solid",
      }}
    >
      <div className="px-5 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-athenian/8 flex items-center justify-center">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-athenian"
          >
            <path d="M8 1L10 6H15L11 9.5L12.5 15L8 11.5L3.5 15L5 9.5L1 6H6L8 1Z" />
          </svg>
        </div>
        <h3 className="font-serif font-bold text-athenian text-sm">
          Synthesis
        </h3>
      </div>

      <div className="px-5 pb-5 space-y-4">
        <div>
          <h4 className="text-xs font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
            Where they agree
          </h4>
          <p className="text-sm leading-relaxed text-ink-light">{agree}</p>
        </div>
        <div>
          <h4 className="text-xs font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
            Where they diverge
          </h4>
          <p className="text-sm leading-relaxed text-ink-light">{diverge}</p>
        </div>
        <div className="pt-2 border-t border-border-light">
          <h4 className="text-xs font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
            The unresolved question
          </h4>
          <p className="text-sm leading-relaxed text-ink font-medium italic">
            {unresolvedQuestion}
          </p>
        </div>
      </div>
    </div>
  );
}

export function DebatePageClient({
  debateId,
  philosophersMap,
  philosophers,
}: {
  debateId: string;
  philosophersMap: Record<string, Philosopher>;
  philosophers: Philosopher[];
}) {
  const debate = debates[debateId];

  if (!debate) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-ink-lighter">Debate not found.</p>
      </div>
    );
  }

  const openingPosts = debate.posts.filter((p) => p.phase === "opening");
  const rebuttalPosts = debate.posts.filter((p) => p.phase === "rebuttal");
  const isComplete = debate.status === "Complete";
  const isScheduled = debate.status === "Scheduled";

  return (
    <div className="min-h-screen flex flex-col lg:flex-row pt-14 lg:pt-0">
      <LeftSidebar philosophers={philosophers} />
      <MobileNav />

      <main className="flex-1 min-w-0 lg:border-l border-border-light">
        <div className="max-w-[700px] mx-auto">
          {/* Debate Header */}
          <div className="px-5 pt-8 pb-6 border-b border-border-light">
            <Link
              href="/debates"
              className="inline-flex items-center gap-1.5 text-sm text-ink-lighter hover:text-athenian transition-colors duration-200 mb-4"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10 4L6 8L10 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to Debates
            </Link>

            <h1 className="font-serif text-2xl lg:text-3xl font-bold text-ink leading-tight mb-3">
              {debate.title}
            </h1>

            <div className="flex items-center gap-3 mb-4 text-sm text-ink-light">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-full ${
                  isComplete
                    ? "bg-stoic/10 text-stoic"
                    : debate.status === "In Progress"
                    ? "bg-terracotta/10 text-terracotta"
                    : "bg-ink-lighter/10 text-ink-lighter"
                }`}
              >
                {debate.status}
              </span>
              <span>{debate.date}</span>
            </div>

            {/* Trigger article */}
            {debate.triggerArticle.url ? (
              <a
                href={debate.triggerArticle.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded border border-border-light hover:border-border transition-colors duration-200 mb-4 group"
                style={{ backgroundColor: "rgba(240, 235, 227, 0.7)" }}
              >
                <svg
                  width="14"
                  height="14"
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
                <span className="text-xs text-ink-light group-hover:text-athenian transition-colors">
                  Triggered by:{" "}
                  <span className="font-medium">
                    {debate.triggerArticle.title}
                  </span>
                </span>
                <span className="text-xs text-ink-lighter">
                  &mdash; {debate.triggerArticle.source}
                </span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="ml-auto text-ink-lighter group-hover:text-athenian shrink-0 transition-colors"
                >
                  <path d="M6 3H3V13H13V10" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9 2H14V7" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M14 2L7 9" strokeLinecap="round" />
                </svg>
              </a>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded border border-border-light mb-4" style={{ backgroundColor: "rgba(240, 235, 227, 0.7)" }}>
                <svg
                  width="14"
                  height="14"
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
                <span className="text-xs text-ink-light">
                  Triggered by:{" "}
                  <span className="font-medium">
                    {debate.triggerArticle.title}
                  </span>
                </span>
                <span className="text-xs text-ink-lighter">
                  &mdash; {debate.triggerArticle.source}
                </span>
              </div>
            )}

            {/* Participants */}
            <div>
              <h3 className="text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-2">
                Participants
              </h3>
              <div className="flex flex-wrap gap-3">
                {debate.philosophers.map((pId) => {
                  const p = philosophersMap[pId];
                  if (!p) return null;
                  return (
                    <Link
                      key={pId}
                      href={`/philosophers/${pId}`}
                      className="flex items-center gap-2 group"
                    >
                      <PhilosopherAvatar
                        philosopherId={pId}
                        name={p.name}
                        color={p.color}
                        initials={p.initials}
                        size="sm"
                      />
                      <span className="text-sm text-ink-light group-hover:text-athenian transition-colors duration-200">
                        {p.name}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Scheduled — no content yet */}
          {isScheduled && (
            <div className="px-5 py-12 text-center">
              <p className="text-ink-lighter text-sm font-mono">
                This debate has not yet begun. Check back on {debate.date}.
              </p>
            </div>
          )}

          {/* Opening Statements */}
          {openingPosts.length > 0 && (
            <>
              <PhaseLabel label="Opening Statements" />
              {openingPosts.map((post, i) => (
                <DebatePostCard key={post.id} post={post} delay={i} philosophersMap={philosophersMap} />
              ))}
            </>
          )}

          {/* Rebuttals */}
          {rebuttalPosts.length > 0 && (
            <>
              <PhaseLabel label="Rebuttals" />
              {rebuttalPosts.map((post, i) => (
                <DebatePostCard key={post.id} post={post} delay={i} philosophersMap={philosophersMap} />
              ))}
            </>
          )}

          {/* In Progress indicator */}
          {debate.status === "In Progress" && openingPosts.length > 0 && (
            <div className="px-5 py-8 text-center border-t border-border-light">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-terracotta/10 text-terracotta text-sm font-mono">
                <span className="w-2 h-2 rounded-full bg-terracotta animate-pulse" />
                Debate in progress &mdash; rebuttals and synthesis coming soon
              </div>
            </div>
          )}

          {/* Synthesis (Complete debates only) */}
          {isComplete && debate.synthesisSummary.agree && (
            <>
              <PhaseLabel label="Synthesis" />
              <NeutralSynthesisCard
                agree={debate.synthesisSummary.agree}
                diverge={debate.synthesisSummary.diverge}
                unresolvedQuestion={debate.synthesisSummary.unresolvedQuestion}
              />
            </>
          )}

          <Footer />
          <div className="pb-20 lg:pb-0" />
        </div>
      </main>
    </div>
  );
}
