import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AgoraShell } from "@/components/agora/AgoraShell";
import { AgoraWelcome } from "@/components/agora/AgoraWelcome";
import { RecentConversations } from "@/components/agora/RecentConversations";
import { PhilosopherAvatar } from "@/components/PhilosopherAvatar";
import { FocusFeature } from "@/components/in-focus/FocusFeature";
import { getFeaturedFocusEdition } from "@/lib/in-focus-published";
import { getIdentityFromCookies } from "@/lib/auth";
import {
  getAllPhilosophers,
  getRecentAgoraThreads,
  getAgoraThreadById,
} from "@/lib/data";
import { isPublicAgoraThread } from "@/lib/agora-access";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "Philagora — Ask the great philosophers" },
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
  return (
    <AgoraShell>
      <main id="main" className="agora-page agora-homepage">
        <RecentConversations viewerKey={viewerKey} />
        <AgoraWelcome philosophers={philosophers} viewerKey={viewerKey} />
        <section
          id="agora"
          className="agora-conversation-preview"
          aria-labelledby="conversation-preview-title"
        >
          <div className="agora-section-heading">
            <h2 id="conversation-preview-title">
              One question. Different perspectives.
            </h2>
            <Link href="/agora">From the Agora →</Link>
          </div>
          {featured ? (
            <article>
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
                        size="lg"
                      />
                      <span>{r.philosopherName}</span>
                    </Link>
                    <p>
                      {r.posts[0]?.trim().split(/\s+/).length > 35
                        ? r.posts[0]
                          .trim()
                          .split(/\s+/)
                          .slice(0, 35)
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
        <div className="agora-feature-grid agora-home-discover">
          <FocusFeature edition={getFeaturedFocusEdition()} />
          <section>
            <div className="agora-section-heading">
              <h2>More conversations</h2>
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
        </div>
      </main>
    </AgoraShell>
  );
}
