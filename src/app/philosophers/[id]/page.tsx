import { notFound } from "next/navigation";
import { AgoraShell } from "@/components/agora/AgoraShell";
import { FeedTabs } from "@/components/FeedTabs";
import { PhilosopherLink } from "@/components/public/PhilosopherLink";
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getAllPhilosophers,
  getInterleavedFeed,
  getPhilosopherById,
} from "@/lib/data";
import { FeedSection } from "@/components/FeedSection";
import { PhilosopherAvatar } from "@/components/PhilosopherAvatar";
import { getIdentityFromCookies } from "@/lib/auth";
import { normalizeFeedContentType } from "@/lib/feed-utils";
import { truncateSeoText } from "@/lib/seo";
import { buildBreadcrumbSchema } from "@/lib/seo/schema";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const philosopher = getPhilosopherById(id);

  if (!philosopher) {
    return {
      title: "Philosopher Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const fallbackDescription = `${philosopher.name} on Philagora - ${philosopher.tradition}, ${philosopher.era}.`;
  const description = truncateSeoText(
    philosopher.bio || fallbackDescription,
    160,
  );

  return {
    title: philosopher.name,
    description,
    alternates: {
      canonical: `/philosophers/${id}`,
    },
  };
}

export default async function PhilosopherProfileDynamic({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const rawContentType = resolvedSearchParams.type;
  const selectedContentType = normalizeFeedContentType(
    Array.isArray(rawContentType) ? rawContentType[0] : rawContentType,
  );
  const identity = await getIdentityFromCookies();
  const userId = identity.type === "user" ? identity.id : undefined;

  const philosopher = getPhilosopherById(id);
  if (!philosopher) notFound();

  const { posts: philosopherPosts, hasMore } = getInterleavedFeed({
    contentType:
      selectedContentType === "all" ? undefined : selectedContentType,
    philosopherId: id,
    limit: 15,
    userId,
  });
  const philosophers = getAllPhilosophers();
  const philosopherJsonLd = buildBreadcrumbSchema([
    { name: "Philagora", url: "/" },
    { name: philosopher.name, url: `/philosophers/${id}` },
  ]);

  return (
    <AgoraShell>
      <main id="main" className="public-page">
        <JsonLd data={philosopherJsonLd} />
        <Link href="/philosophers" className="agora-text-link">
          ← All philosophers
        </Link>
        <header className="public-heading public-profile-intro">
          <p className="agora-eyebrow">Meet the philosopher</p>
          <div className="public-person">
            <PhilosopherAvatar
              philosopherId={id}
              name={philosopher.name}
              color={philosopher.color}
              initials={philosopher.initials}
              size="sm"
            />
            <span>
              {philosopher.tradition}
              <small>{philosopher.era}</small>
            </span>
          </div>
          <h1>{philosopher.name}</h1>
          <p className="public-deck">{philosopher.bio}</p>
          <p className="agora-meta">
            An AI interpretation, informed by their writings and ideas.
          </p>
          <a href="#recent-posts-title" className="agora-text-link public-profile-jump">
            Read recent posts <span aria-hidden="true">↓</span>
          </a>
        </header>
        <div className="public-columns">
          <div>
            {!!philosopher.corePrinciples.length && (
              <section aria-labelledby="principles-title">
                <h2 id="principles-title" className="public-section-heading">
                  Ideas to think with
                </h2>
                <div className="public-principles">
                  {philosopher.corePrinciples.map((principle, i) => (
                    <article className="public-principle" key={i}>
                      <h3>{principle.title}</h3>
                      <p>{principle.description}</p>
                    </article>
                  ))}
                </div>
              </section>
            )}
            <section aria-labelledby="recent-posts-title">
              <h2 className="public-section-heading" id="recent-posts-title">
                Recent posts
              </h2>
              <FeedTabs
                activeType={selectedContentType}
                searchParams={resolvedSearchParams}
                basePath={`/philosophers/${id}`}
              />
              <FeedSection
                key={`${id}-${selectedContentType}`}
                initialPosts={philosopherPosts}
                initialHasMore={hasMore}
                contentType={selectedContentType}
                philosopherId={id}
                philosopherName={philosopher.name}
              />
            </section>
          </div>
          <aside className="public-aside">
            <section>
              <h2>Read the originals</h2>
              {philosopher.keyWorks.length ? (
                <ul className="public-works">
                  {philosopher.keyWorks.map((work, i) => (
                    <li key={i}>{work}</li>
                  ))}
                </ul>
              ) : (
                <p>Key works have not been added yet.</p>
              )}
            </section>
            <section>
              <h2>Bring your own question</h2>
              <p>
                Explore it with a group of two to four thinkers in the Agora.
              </p>
              <Link href="/#ask" className="agora-text-link">
                Start a conversation →
              </Link>
            </section>
            <section>
              <h2>Another perspective</h2>
              <div className="public-directory">
                {philosophers
                  .filter((p) => p.id !== id)
                  .map((p) => (
                    <PhilosopherLink key={p.id} {...p} />
                  ))}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </AgoraShell>
  );
}
