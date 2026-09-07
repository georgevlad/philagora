import Link from "next/link";
import type { Philosopher, DebateDetail, DebatePost } from "@/lib/types";
import { AgoraShell } from "@/components/agora/AgoraShell";
import { PageHeading } from "@/components/public/PageHeading";
import { PhilosopherLink } from "@/components/public/PhilosopherLink";
import { SourceCitation } from "@/components/public/SourceCitation";

function DebateAnswer({
  post,
  allPosts,
}: {
  post: DebatePost;
  allPosts: DebatePost[];
}) {
  const target = allPosts.find((p) => p.id === post.replyTo);
  return (
    <article className="public-debate-answer" id={`contribution-${post.id}`}>
      <h3>
        <PhilosopherLink
          id={post.philosopherId}
          name={post.philosopherName}
          color={post.philosopherColor}
          initials={post.philosopherInitials}
          detail={post.philosopherTradition}
        />
      </h3>
      {post.replyTo && (
        <p className="agora-meta">
          {target ? (
            <a className="agora-text-link" href={`#contribution-${target.id}`}>
              Replying to {target.philosopherName} ↑
            </a>
          ) : (
            "In reply to an earlier perspective"
          )}
        </p>
      )}
      <div className="public-prose">{post.content}</div>
    </article>
  );
}

export function DebatePageClient({
  debate,
  philosophersMap,
}: {
  debate: DebateDetail;
  philosophersMap: Record<string, Philosopher>;
}) {
  const rounds = [
    { id: "openings", label: "Opening statements", posts: debate.openings },
    {
      id: "cross-examination",
      label: "Cross-examination",
      posts: debate.crossExaminations || [],
    },
    { id: "rebuttals", label: "Rebuttals", posts: debate.rebuttals },
    {
      id: "closing-perspectives",
      label: "Closing perspectives",
      posts: debate.synthesisPosts || [],
    },
  ].filter((round) => round.posts.length);
  const allPosts = rounds.flatMap((round) => round.posts);
  const synthesis = [
    {
      title: "Where they agree",
      summary: debate.synthesisSummaryAgree,
      points: debate.synthesisAgreements,
    },
    {
      title: "Where they diverge",
      summary: debate.synthesisSummaryDiverge,
      points: debate.synthesisTensions,
    },
    {
      title: "The unresolved question",
      summary: debate.synthesisSummaryUnresolved,
      points: debate.synthesisQuestions,
    },
  ].filter((part) => part.summary || part.points.length);
  return (
    <AgoraShell>
      <main id="main" className="public-page public-reading">
        <Link href="/debates" className="agora-text-link">
          ← Back to debates
        </Link>
        <PageHeading eyebrow="In debate" title={debate.title}>
          <p className="public-post-meta">
            <span className="agora-badge">{debate.status}</span>
            <time dateTime={debate.debateDateRaw}>{debate.debateDate}</time>
          </p>
        </PageHeading>
        {debate.triggerArticleTitle && (
          <SourceCitation
            citation={{
              title: debate.triggerArticleTitle,
              source: debate.triggerArticleSource || "",
              url: debate.triggerArticleUrl || undefined,
            }}
          />
        )}
        <div className="public-people">
          {debate.philosophers.map(
            (id) =>
              philosophersMap[id] && (
                <PhilosopherLink key={id} {...philosophersMap[id]} />
              ),
          )}
        </div>
        <p className="agora-notice">
          AI interpretations of historical thinkers. Each perspective is a
          starting point for your own thinking.
        </p>
        {!!(rounds.length || synthesis.length) && (
          <nav className="public-round-nav" aria-label="Debate phases">
            {rounds.map((round) => (
              <a key={round.id} href={`#${round.id}`}>
                {round.label}
              </a>
            ))}
            {!!synthesis.length && <a href="#synthesis">Synthesis</a>}
          </nav>
        )}
        {debate.status === "Scheduled" && (
          <div className="public-empty">
            <h2>The question is set.</h2>
            <p>
              This debate has not yet begun. Scheduled for {debate.debateDate}.
            </p>
          </div>
        )}
        {rounds.map((round, i) => (
          <section
            key={round.id}
            id={round.id}
            className="public-debate-round"
            aria-labelledby={`${round.id}-heading`}
          >
            <h2 id={`${round.id}-heading`}>
              {String(i + 1).padStart(2, "0")} · {round.label}
            </h2>
            {round.posts.map((post) => (
              <DebateAnswer key={post.id} post={post} allPosts={allPosts} />
            ))}
          </section>
        ))}
        {debate.status === "In Progress" && (
          <p className="agora-notice" role="status">
            This debate is in progress. The perspectives saved so far are shown
            here; further contributions will appear when published.
          </p>
        )}
        {!!synthesis.length && (
          <section
            className="public-synthesis"
            id="synthesis"
            aria-labelledby="synthesis-title"
          >
            <p className="agora-eyebrow">The debate, brought together</p>
            <h2 id="synthesis-title">Synthesis</h2>
            {synthesis.map((part) => (
              <div key={part.title}>
                <h3>{part.title}</h3>
                {part.summary && <p className="public-prose">{part.summary}</p>}
                {!!part.points.length && (
                  <ul className="public-prose">
                    {part.points.map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>
        )}
        {debate.status === "Complete" && !synthesis.length && (
          <p className="agora-notice">
            This debate is complete. A synthesis has not been published.
          </p>
        )}
        <Link href="/debates" className="agora-text-link">
          Explore another debate →
        </Link>
      </main>
    </AgoraShell>
  );
}
