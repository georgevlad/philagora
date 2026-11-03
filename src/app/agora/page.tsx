import type { Metadata } from "next";
import Link from "next/link";
import { getRecentAgoraThreads } from "@/lib/data";
import { getIdentityFromCookies } from "@/lib/auth";
import { AgoraShell } from "@/components/agora/AgoraShell";
import { PageHeading } from "@/components/public/PageHeading";
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
      <main id="main" className="public-page">
        <PageHeading title="The Agora">
          <p>Public questions about life and the world. Read how different thinkers approach the same question.</p>
        </PageHeading>
        <RecentConversations viewerKey={viewerKey} />
        <section className="public-conversation-browse" aria-labelledby="public-conversations-title">
          <div className="agora-section-heading">
            <h2 id="public-conversations-title">Recent conversations</h2>
            <Link className="agora-outline" href="/#ask">Ask a question →</Link>
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
              No public conversations yet. Bring a question of your own to start one.
            </p>
          )}
        </section>
      </main>
    </AgoraShell>
  );
}
