import type { Metadata } from "next";
import Link from "next/link";
import { AgoraShell } from "@/components/agora/AgoraShell";
import { PageHeading } from "@/components/public/PageHeading";
import { FocusFeature } from "@/components/in-focus/FocusFeature";
import { getFeaturedFocusEdition } from "@/lib/in-focus-published";
import { getRecentAgoraThreads } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Explore",
  description: "Find a question worth staying with. Explore conversations, philosophical perspectives, debates, and In Focus briefings.",
  alternates: { canonical: "/explore" },
};

export default function ExplorePage() {
  const conversations = getRecentAgoraThreads(3);
  return (
    <AgoraShell>
      <main id="main" className="public-page">
        <PageHeading title="Find a question worth staying with.">
          <p>Different ways into philosophy: a personal question, a story in the news, or an argument that opens something up.</p>
        </PageHeading>
        <div className="public-explore-features">
          <FocusFeature edition={getFeaturedFocusEdition()} />
          <section aria-labelledby="explore-conversations-title">
            <div className="agora-section-heading">
              <h2 id="explore-conversations-title">From the Agora</h2>
              <Link href="/agora">All conversations →</Link>
            </div>
            <div className="agora-question-list">
              {conversations.map((thread) => (
                <Link key={thread.id} href={`/agora/${thread.id}`}>
                  <h3>{thread.question}</h3>
                  <p className="agora-meta">{thread.philosophers.map((p) => p.name).join(" · ")}</p>
                </Link>
              ))}
            </div>
            {!conversations.length && <p className="agora-meta">The next conversation could begin with your question. <Link href="/#ask">Ask the philosophers →</Link></p>}
          </section>
        </div>
        <section className="public-explore-paths" aria-label="Ways to explore">
          {[
            { href: "/agora", title: "Conversations", description: "Questions from the community, considered by a small group of thinkers.", action: "Visit the Agora" },
            { href: "/feed", title: "The feed", description: "Fresh perspectives on news, culture, and the choices of everyday life.", action: "Read the feed" },
            { href: "/debates", title: "Debates", description: "Follow an argument through opening positions, challenges, and replies.", action: "Explore debates" },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              <span className="agora-text-link">{item.action} →</span>
            </Link>
          ))}
        </section>
      </main>
    </AgoraShell>
  );
}
