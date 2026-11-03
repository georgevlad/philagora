import type { Metadata } from "next";
import Link from "next/link";
import { AgoraShell } from "@/components/agora/AgoraShell";
import { PageHeading } from "@/components/public/PageHeading";
import { getPublishedFocusEditions } from "@/lib/in-focus-published";
import { focusEditionPath, focusReadingMinutes } from "@/lib/in-focus-publication";
import { formatDate } from "@/lib/date-utils";

export const metadata: Metadata = {
  title: "In Focus",
  description: "An editorial briefing, competing philosophical perspectives, and the questions that remain unresolved.",
  alternates: { canonical: "/in-focus" },
};

export default function InFocusPage() {
  return (
    <AgoraShell>
      <main id="main" className="public-page public-reading">
        <PageHeading title="In Focus">
          <p>Understand the context. Follow the argument. Consider what remains unresolved.</p>
        </PageHeading>
        <div className="public-focus-list">
          {getPublishedFocusEditions().map((edition) => (
            <article key={edition.slug}>
              <p className="agora-eyebrow">{edition.story}</p>
              <h2><Link href={focusEditionPath(edition)}>{edition.title}</Link></h2>
              <p>{edition.description}</p>
              <p className="agora-meta">{focusReadingMinutes(edition)} min read · Research as of <time dateTime={edition.asOf}>{formatDate(`${edition.asOf}T12:00:00Z`)}</time></p>
              <Link className="agora-text-link" href={focusEditionPath(edition)}>Read the briefing & exchange →</Link>
            </article>
          ))}
        </div>
      </main>
    </AgoraShell>
  );
}
