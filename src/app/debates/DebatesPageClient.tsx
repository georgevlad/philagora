"use client";

import Link from "next/link";
import type { Philosopher, DebateListItem } from "@/lib/types";
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
  debate: DebateListItem;
  index: number;
  philosophersMap: Record<string, Philosopher>;
}) {
  const ref = useScrollReveal(index);
  const preview = debate.firstPostPreview || "Debate not yet started.";
  const isInProgress = debate.status === "In Progress";
  const accent = isInProgress ? "var(--color-burgundy)" : "var(--color-athenian)";
  const softBg = isInProgress ? "rgba(122, 62, 58, 0.05)" : "rgba(49, 78, 61, 0.05)";

  return (
    <Link href={`/debates/${debate.id}`}>
      <article
        ref={ref}
        className="animate-fade-in-up mb-5 rounded-[26px] border border-border-light/90 bg-[linear-gradient(180deg,rgba(248,243,234,0.95),rgba(244,239,230,0.92))] overflow-hidden shadow-[0_16px_34px_rgba(42,36,31,0.045)] hover:shadow-[0_22px_42px_rgba(42,36,31,0.07)] transition-all duration-200 hover:-translate-y-0.5"
        style={{ borderTop: `3px solid ${accent}` }}
      >
        <div className="px-6 pt-5 pb-6 sm:px-7">
          <div className="flex items-center gap-3 flex-wrap mb-5">
            <span
              className={`inline-flex items-center px-3 py-1 text-[10px] font-mono tracking-[0.18em] uppercase rounded-full border ${
                isInProgress
                  ? "bg-burgundy/10 text-burgundy border-burgundy/20"
                  : "bg-athenian/8 text-athenian border-athenian/15"
              }`}
            >
              {debate.status}
            </span>
            <span className="text-[13px] text-ink-lighter">{debate.debateDate}</span>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.55fr_0.95fr] lg:items-start">
            <div>
              <h3 className="font-serif text-[26px] sm:text-[29px] leading-[1.1] font-medium text-ink text-balance mb-4">
                {debate.title}
              </h3>

              <div
                className="rounded-2xl px-4 py-3 mb-5 border"
                style={{
                  background: `linear-gradient(180deg, ${softBg}, rgba(248,243,234,0.78))`,
                  borderColor: isInProgress ? "rgba(122, 62, 58, 0.14)" : "rgba(49, 78, 61, 0.12)",
                }}
              >
                <div className="flex items-center gap-2 mb-1.5 text-[10px] font-mono tracking-[0.18em] uppercase text-ink-faint">
                  <svg
                    width="14"
                    height="14"
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
                  Trigger article
                </div>
                <p className="text-[15px] leading-snug text-ink-light">
                  {debate.triggerArticleTitle} <span className="text-ink-lighter">- {debate.triggerArticleSource}</span>
                </p>
              </div>

              <p className="prose-reading text-[17px] text-ink-light leading-[1.75] max-w-3xl">
                {preview}
              </p>
            </div>

            <div className="rounded-2xl border border-border-light/80 bg-[linear-gradient(180deg,rgba(238,230,216,0.58),rgba(248,243,234,0.92))] px-4 py-4">
              <div className="flex items-center gap-2 mb-4 text-[10px] font-mono tracking-[0.2em] uppercase text-ink-faint">
                <span>Participating voices</span>
                <div className="flex-1 h-px bg-border-light/70" />
              </div>

              <div className="space-y-3">
                {debate.philosophers.map((pId) => {
                  const p = philosophersMap[pId];
                  if (!p) return null;
                  return (
                    <div key={pId} className="flex items-center gap-3">
                      <div className="ring-2 ring-card rounded-full">
                        <PhilosopherAvatar
                          philosopherId={pId}
                          name={p.name}
                          color={p.color}
                          initials={p.initials}
                          size="sm"
                        />
                      </div>
                      <div>
                        <div className="font-serif text-[16px] font-semibold text-ink leading-none">{p.name}</div>
                        <div className="text-[11px] font-mono tracking-[0.14em] uppercase text-ink-faint mt-1">
                          {p.tradition}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

export function DebatesPageClient({
  philosophersMap,
  philosophers,
  debates,
}: {
  philosophersMap: Record<string, Philosopher>;
  philosophers: Philosopher[];
  debates: DebateListItem[];
}) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row pt-14 lg:pt-0">
      <LeftSidebar philosophers={philosophers} />
      <MobileNav />

      <main className="flex-1 min-w-0 lg:border-l border-border-light bg-[linear-gradient(180deg,rgba(248,243,234,0.48),rgba(244,239,230,0.12))]">
        <div className="max-w-[920px] mx-auto">
          <div className="px-6 pt-9 pb-8 border-b border-border-light/90">
            <div className="text-[10px] font-mono tracking-[0.22em] uppercase text-burgundy mb-4">
              Current Questions
            </div>
            <div className="max-w-[760px]">
              <h1 className="font-serif text-[34px] lg:text-[40px] leading-[1.06] font-medium text-ink mb-4 text-balance">
                Debates
              </h1>
              <p className="text-[16px] text-ink-light leading-[1.58] max-w-[690px]">
                Structured philosophical confrontations sparked by current events. Each debate stages opening positions, rebuttals, and a synthesis of the deepest fault lines.
              </p>
            </div>
            <div className="mt-7 h-px bg-gradient-to-r from-burgundy/35 via-border-light to-transparent" />
          </div>

          <div className="px-6 py-8">
            {debates.length > 0 ? (
              debates.map((debate, i) => (
                <DebateListCard
                  key={debate.id}
                  debate={debate}
                  index={i}
                  philosophersMap={philosophersMap}
                />
              ))
            ) : (
              <p className="text-center text-ink-lighter py-12 font-mono text-sm">No debates yet.</p>
            )}
          </div>

          <Footer />
          <div className="pb-20 lg:pb-0" />
        </div>
      </main>
    </div>
  );
}

