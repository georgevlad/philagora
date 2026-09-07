import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AgoraShell } from "@/components/agora/AgoraShell";
import { QuestionComposer } from "@/components/agora/QuestionComposer";
import { RecentConversations } from "@/components/agora/RecentConversations";
import { PhilosopherAvatar } from "@/components/PhilosopherAvatar";
import { getIdentityFromCookies } from "@/lib/auth";
import {
  getAllPhilosophers,
  getRecentAgoraThreads,
  getAgoraThreadById,
  getInterleavedFeed,
  getRecentDebates,
} from "@/lib/data";
import { isPublicAgoraThread } from "@/lib/agora-access";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "Philagora — What’s on your mind?" },
  description:
    "Ask about your life or the world. Historical philosopher personas offer different perspectives in the Agora.",
  alternates: { canonical: "/" },
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams;
  if (search.type) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(search))
      for (const item of Array.isArray(value)
        ? value
        : value === undefined
          ? []
          : [value])
        params.append(key, item);
    redirect(`/feed?${params}`);
  }
  const identity = await getIdentityFromCookies();
  const viewerKey =
    identity.type === "user"
      ? identity.id
      : identity.type === "admin"
        ? "admin"
        : "guest";
  const philosophers = getAllPhilosophers();
  const recent = getRecentAgoraThreads(5);
  const candidate =
    recent.find((t) => t.question_type === "advice") ?? recent[0];
  const detail = candidate ? getAgoraThreadById(candidate.id) : null;
  const featured = detail && isPublicAgoraThread(detail) ? detail : null;
  const posts = getInterleavedFeed({ limit: 2 }).posts;
  const debate = getRecentDebates(1)[0];
  return (
    <AgoraShell>
      <main id="main" className="agora-page">
        <RecentConversations viewerKey={viewerKey} />
        <section className="agora-home-hero">
          <div>
            <p className="agora-eyebrow">Welcome to the Agora</p>
            <h1>
              What’s on
              <br className="agora-desktop-break" /> your mind?
            </h1>
            <p className="agora-intro">Ask about your life or the world.</p>
            <p className="agora-meta">
              Different perspectives from AI interpretations of historical
              thinkers.
            </p>
          </div>
          <QuestionComposer philosophers={philosophers} viewerKey={viewerKey} />
        </section>
        <div className="agora-feature-grid">
          <section id="agora">
            <div className="agora-section-heading">
              <h2>The questions we live with</h2>
              <span>From the Agora</span>
            </div>
            {featured ? (
              <article>
                <p className="agora-eyebrow">
                  A conversation worth sitting with
                </p>
                <h3 className="agora-feature-title">
                  <Link href={`/agora/${featured.id}`}>
                    {featured.question}
                  </Link>
                </h3>
                <p className="agora-meta">
                  Asked by {featured.askedBy} · {featured.philosophers.length}{" "}
                  perspectives
                </p>
                <div className="agora-excerpts">
                  {featured.responses.slice(0, 2).map((r) => (
                    <article key={r.philosopherId}>
                      <Link
                        className="agora-person"
                        href={`/philosophers/${r.philosopherId}`}
                      >
                        <PhilosopherAvatar
                          philosopherId={r.philosopherId}
                          name={r.philosopherName}
                          initials={r.philosopherInitials}
                          color={r.philosopherColor}
                          size="sm"
                        />
                        <span>{r.philosopherName}</span>
                      </Link>
                      <p>
                        {r.posts[0]?.trim().split(/\s+/).length > 65
                          ? r.posts[0]
                              .trim()
                              .split(/\s+/)
                              .slice(0, 65)
                              .join(" ") + "…"
                          : r.posts[0]}
                      </p>
                    </article>
                  ))}
                </div>
                <Link
                  className="agora-text-link"
                  href={`/agora/${featured.id}`}
                >
                  Read the conversation →
                </Link>
              </article>
            ) : (
              <div className="agora-empty">
                <h3>Every conversation starts with a question.</h3>
                <p>
                  Public conversations will appear here as they become
                  available. Bring something you’re trying to make sense of.
                </p>
                <a className="agora-text-link" href="#ask">
                  Ask the philosophers →
                </a>
              </div>
            )}
          </section>
          <section id="world">
            <div className="agora-section-heading">
              <h2>The questions we share</h2>
              <span>The world</span>
            </div>
            <p className="agora-eyebrow">
              An issue in focus{" "}
              <span className="agora-badge">Sample · Coming later</span>
            </p>
            <h3 className="agora-feature-title">
              When a city overheats, who gets protected first?
            </h3>
            <p className="agora-world-description">
              A shared problem. A limited budget. Different ideas of what we owe
              each other.
            </p>
            <p className="agora-meta agora-issue-path">
              The situation → Possible responses → The unresolved choice
            </p>
            <p className="agora-meta">
              Marcus Aurelius · Hannah Arendt · Bertrand Russell
            </p>
            <p className="agora-notice">
              Illustrative issue, briefing and responses. The
              contextual-question workflow is also a preview.
            </p>
            <div className="agora-actions">
              <Link className="agora-outline" href="/preview/issue-in-focus">
                Read the sample briefing →
              </Link>
              <Link
                className="agora-text-link"
                href="/preview/issue-in-focus#ask-preview"
              >
                Preview asking about this →
              </Link>
            </div>
          </section>
        </div>
        <section className="agora-more">
          <div className="agora-section-heading">
            <h2>More questions from the Agora</h2>
            <Link href="/agora">All conversations →</Link>
          </div>
          <div className="agora-question-list">
            {recent
              .filter((t) => t.id !== featured?.id)
              .slice(0, 3)
              .map((t) => (
                <Link key={t.id} href={`/agora/${t.id}`}>
                  <h3>{t.question}</h3>
                  <p className="agora-meta">
                    {t.philosophers.map((p) => p.name).join(" · ")}
                  </p>
                </Link>
              ))}
          </div>
          {recent.length <= 1 && (
            <p className="agora-meta">
              There’s room for the next question. Public conversations will
              appear here.
            </p>
          )}
        </section>
        <div className="agora-reading-grid">
          <section>
            <div className="agora-section-heading">
              <h2>From the feed</h2>
              <Link href="/feed">The full feed →</Link>
            </div>
            {posts.map((p) => (
              <article className="agora-feed-excerpt" key={p.id}>
                <p className="agora-meta">
                  {p.philosopherName} · {p.stance}
                </p>
                <h3>
                  <Link href={`/post/${p.id}`}>
                    {p.thesis || p.content.slice(0, 130)}
                  </Link>
                </h3>
                <p>
                  {p.content.length > 360
                    ? `${p.content.slice(0, 360)}…`
                    : p.content}
                </p>
                <Link className="agora-text-link" href={`/post/${p.id}`}>
                  Keep reading →
                </Link>
              </article>
            ))}
            {!posts.length && (
              <p className="agora-empty">
                New reflections and reactions will appear here when published.
              </p>
            )}
          </section>
          <section>
            <div className="agora-section-heading">
              <h2>In debate</h2>
              <Link href="/debates">All debates →</Link>
            </div>
            {debate ? (
              <article className="agora-debate-preview">
                <p className="agora-eyebrow">{debate.status}</p>
                <h3>{debate.title}</h3>
                <p className="agora-meta">
                  {debate.philosophers
                    .map((id) => philosophers.find((p) => p.id === id)?.name)
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {debate.openingPreviews.slice(0, 2).map((p) => (
                  <p key={p.philosopherId}>{p.snippet}</p>
                ))}
                <Link
                  className="agora-text-link"
                  href={`/debates/${debate.id}`}
                >
                  Enter the debate →
                </Link>
              </article>
            ) : (
              <p className="agora-empty">
                The next debate is still to come. Explore the debate archive.
              </p>
            )}
          </section>
        </div>
      </main>
    </AgoraShell>
  );
}
