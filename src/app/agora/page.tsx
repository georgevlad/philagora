import type { Metadata } from "next";
import Link from "next/link";
import { getAllPhilosophers, getRecentAgoraThreads } from "@/lib/data";
import { getIdentityFromCookies } from "@/lib/auth";
import { AgoraShell } from "@/components/agora/AgoraShell";
import { AgoraWelcome } from "@/components/agora/AgoraWelcome";
import { RecentConversations } from "@/components/agora/RecentConversations";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "The Agora",
  description:
    "Questions about life and the world, answered by philosopher personas.",
  alternates: { canonical: "/agora" },
};
export default async function AgoraPage() {
  const identity = await getIdentityFromCookies();
  const viewerKey =
    identity.type === "user"
      ? identity.id
      : identity.type === "admin"
        ? "admin"
        : "guest";
  const threads = getRecentAgoraThreads(30);
  return (
    <AgoraShell>
      <main id="main" className="agora-page">
        <RecentConversations viewerKey={viewerKey} />
        <AgoraWelcome philosophers={getAllPhilosophers()} viewerKey={viewerKey} />
        <section className="agora-more">
          <div className="agora-section-heading">
            <h2>Public conversations</h2>
            <Link href="/feed">Explore the feed →</Link>
          </div>
          <div className="agora-question-list">
            {threads.map((t) => (
              <Link key={t.id} href={`/agora/${t.id}`}>
                <h3>{t.question}</h3>
                <p className="agora-meta">
                  {t.philosophers.map((p) => p.name).join(" · ")}
                </p>
                <p className="agora-meta">Asked by {t.asked_by}</p>
              </Link>
            ))}
          </div>
          {!threads.length && (
            <p className="agora-empty">
              Public conversations will appear here as they become available.
            </p>
          )}
        </section>
      </main>
    </AgoraShell>
  );
}
