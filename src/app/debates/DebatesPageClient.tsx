import Link from "next/link";
import type { Philosopher, DebateListItem } from "@/lib/types";
import { AgoraShell } from "@/components/agora/AgoraShell";
import { PageHeading } from "@/components/public/PageHeading";
import { EmptyState } from "@/components/public/PageState";
import { PhilosopherLink } from "@/components/public/PhilosopherLink";

export function DebatesPageClient({
  philosophersMap,
  debates,
}: {
  philosophersMap: Record<string, Philosopher>;
  debates: DebateListItem[];
}) {
  return (
    <AgoraShell>
      <main id="main" className="public-page">
        <PageHeading eyebrow="Where ideas meet resistance" title="Debates">
          <p>
            One question, different convictions. Follow the arguments from
            opening positions to the questions left unresolved.
          </p>
        </PageHeading>
        {debates.length ? (
          debates.map((debate) => (
            <article key={debate.id} className="public-debate-card">
              <div>
                <p className="public-post-meta">
                  <span className="agora-badge">{debate.status}</span>
                  <time dateTime={debate.debateDateRaw}>
                    {debate.debateDate}
                  </time>
                </p>
                <h2>
                  <Link href={`/debates/${debate.id}`}>{debate.title}</Link>
                </h2>
                {debate.triggerArticleTitle && (
                  <p className="agora-meta">
                    Sparked by {debate.triggerArticleTitle}
                    {debate.triggerArticleSource
                      ? ` · ${debate.triggerArticleSource}`
                      : ""}
                  </p>
                )}
                <div className="public-people">
                  {debate.philosophers.map(
                    (id) =>
                      philosophersMap[id] && (
                        <PhilosopherLink key={id} {...philosophersMap[id]} />
                      ),
                  )}
                </div>
                <Link
                  className="agora-text-link"
                  href={`/debates/${debate.id}`}
                >
                  {debate.status === "Scheduled"
                    ? "View the upcoming debate"
                    : "Enter the debate"}{" "}
                  →
                </Link>
              </div>
              <div className="public-debate-previews">
                {!!debate.openingPreviews.length && (
                  <p className="agora-eyebrow">Opening perspectives</p>
                )}
                {debate.openingPreviews.length ? (
                  debate.openingPreviews.map((op, i) => (
                    <div key={i}>
                      <p className="agora-meta public-person-name">
                        {philosophersMap[op.philosopherId]?.name ||
                          "Opening perspective"}
                      </p>
                      <blockquote>{op.snippet}</blockquote>
                    </div>
                  ))
                ) : (
                  <p className="agora-notice">
                    The question is set. Opening perspectives will appear when
                    the debate begins.
                  </p>
                )}
              </div>
            </article>
          ))
        ) : (
          <EmptyState
            title="The next debate is still to come."
            href="/feed"
            action="Explore the feed"
          >
            Published debates will appear here, from the first positions to the
            final synthesis.
          </EmptyState>
        )}
      </main>
    </AgoraShell>
  );
}
