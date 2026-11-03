import type { Metadata } from "next";
import Link from "next/link";
import { AgoraShell } from "@/components/agora/AgoraShell";
import { PageHeading } from "@/components/public/PageHeading";
import { PhilosopherAvatar } from "@/components/PhilosopherAvatar";
import { getAllPhilosophers } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Philosophers",
  description: "Meet the thinkers of Philagora. Explore their ideas, writings, and different ways of seeing the world.",
  alternates: { canonical: "/philosophers" },
};

export default function PhilosophersPage() {
  const philosophers = getAllPhilosophers();
  return (
    <AgoraShell>
      <main id="main" className="public-page">
        <PageHeading title="Meet the philosophers.">
          <p>Different lives, different convictions, different ways of seeing. Get to know the ideas behind each AI interpretation.</p>
        </PageHeading>
        <div className="public-directory-heading">
          <p className="agora-meta">Explore a thinker’s ideas, original works, and recent perspectives.</p>
          <Link className="agora-text-link" href="/schools">Browse by school of thought →</Link>
        </div>
        <div className="public-thinker-grid">
          {philosophers.map((p) => (
            <Link key={p.id} href={`/philosophers/${p.id}`} className="public-thinker-card" aria-labelledby={`thinker-${p.id}`}>
              <PhilosopherAvatar philosopherId={p.id} name={p.name} initials={p.initials} color={p.color} size="lg" />
              <div>
                <h2 id={`thinker-${p.id}`}>{p.name}</h2>
                <p className="agora-meta">{p.tradition} · {p.era}</p>
              </div>
              <p className="public-thinker-bio">{p.bio}</p>
              <span className="agora-text-link">Meet {p.name} →</span>
            </Link>
          ))}
        </div>
        {!philosophers.length && <p className="agora-empty">The philosophers will appear here as their profiles become available.</p>}
      </main>
    </AgoraShell>
  );
}
