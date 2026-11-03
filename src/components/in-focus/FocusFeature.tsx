import Link from "next/link";
import { PhilosopherAvatar } from "@/components/PhilosopherAvatar";
import { formatDate } from "@/lib/date-utils";
import { focusEditionPath, focusReadingMinutes, type FocusEdition } from "@/lib/in-focus-publication";

export function FocusFeature({ edition }: { edition: FocusEdition }) {
  const voices = edition.exchange.filter((part, index, all) => all.findIndex((item) => item.philosopher.id === part.philosopher.id) === index);
  return <section id="world" aria-labelledby="world-title">
    <div className="agora-section-heading"><h2 id="world-title">The questions we share</h2></div>
    <article className="in-focus-feature">
      <p className="agora-eyebrow"><span className="in-focus-label">In focus</span> {edition.story}</p>
      <h3 className="agora-feature-title"><Link href={focusEditionPath(edition)}>{edition.title}</Link></h3>
      <p className="agora-world-description">{edition.description}</p>
      <div className="in-focus-feature-voices">
        <div className="in-focus-avatar-pair" aria-hidden="true">{voices.map(({ philosopher: p }) => <PhilosopherAvatar key={p.id} philosopherId={p.id} name={p.name} initials={p.initials} color={p.color} size="sm" />)}</div>
        <p>{voices.map(({ philosopher: p }) => p.name).join(" · ")}</p>
      </div>
      <div className="in-focus-feature-footer"><Link className="agora-outline" href={focusEditionPath(edition)}>Explore the question →</Link><span>{focusReadingMinutes(edition)} min read</span></div>
      <p className="in-focus-feature-date">Research as of <time dateTime={edition.asOf}>{formatDate(`${edition.asOf}T12:00:00Z`)}</time></p>
    </article>
  </section>;
}
