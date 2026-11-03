import Link from "next/link";
import { Fragment } from "react";
import { PhilosopherAvatar } from "@/components/PhilosopherAvatar";
import { formatDate } from "@/lib/date-utils";
import { focusReadingMinutes, type FocusEdition, type FocusEditionSource } from "@/lib/in-focus-publication";

function CitedText({ text, sources }: { text: string; sources: FocusEditionSource[] }) {
  return <>{text.split(/(\[S\d+\])/g).map((part, index) => {
    const source = sources.find((item) => `[${item.id}]` === part);
    return source ? <sup className="in-focus-citation" key={index}>
      <a href={`#focus-source-${source.id}`} aria-label={`Source ${source.id.slice(1)}: ${source.title}`} title={source.publisher}>[{source.id.slice(1)}]</a>
    </sup> : <Fragment key={index}>{part}</Fragment>;
  })}</>;
}

/** Shared by the public route and the admin's published-edition preview. */
export function FocusArticle({ edition }: { edition: FocusEdition }) {
  const names = [...new Set(edition.exchange.map((part) => part.philosopher.name))].join(" and ");
  const paragraphs = (items: string[]) => items.map((text, index) => <p key={index}><CitedText text={text} sources={edition.sources} /></p>);
  return <article className="in-focus-article">
    <header className="in-focus-hero">
      <p className="agora-eyebrow"><span className="in-focus-label">In focus</span><span>{edition.story}</span></p>
      <h1>{edition.title}</h1>
      <p className="in-focus-deck">{edition.description}</p>
      <div className="in-focus-byline">
        <span>Research as of <time dateTime={edition.asOf}>{formatDate(`${edition.asOf}T12:00:00Z`)}</time></span>
        <span>{focusReadingMinutes(edition)} min read</span>
        <a href="#focus-sources">{edition.sources.length} sources</a>
      </div>
      <p className="in-focus-disclosure">An editorial briefing, followed by AI interpretations of {names}. Reviewed and edited; not historical quotations.</p>
    </header>

    <div className="in-focus-layout">
      <aside className="in-focus-guide">
        <nav aria-label="In this question">
          <p className="agora-eyebrow">In this question</p>
          <a href="#focus-briefing"><span>01</span> The context</a>
          <a href="#focus-question"><span>02</span> The question</a>
          <a href="#focus-exchange"><span>03</span> The exchange</a>
          <a href="#focus-unresolved"><span>04</span> What remains</a>
          <a href="#focus-sources">Sources & reading ↗</a>
        </nav>
      </aside>

      <div className="in-focus-body">
        <section id="focus-briefing" aria-labelledby="focus-briefing-title" className="in-focus-section">
          <p className="agora-eyebrow">01 / The context</p>
          <h2 id="focus-briefing-title">What you need to know</h2>
          <div className="in-focus-prose">{paragraphs(edition.briefing)}</div>
          <details className="in-focus-background">
            <summary>Go a little deeper <span>Background & diplomacy</span></summary>
            <div>{edition.background.map((item) => <section key={item.heading}>
              <h3>{item.heading}</h3><div className="in-focus-prose">{paragraphs(item.paragraphs)}</div>
            </section>)}</div>
          </details>
          <aside className="in-focus-uncertainty"><h3>What this evidence doesn’t settle</h3><p>{edition.uncertainty}</p></aside>
        </section>

        <section id="focus-question" aria-labelledby="focus-question-title" className="in-focus-question">
          <p className="agora-eyebrow">02 / The question</p>
          <h2 id="focus-question-title">{edition.question}</h2>
          <p>{edition.questionNote}</p>
        </section>

        <section id="focus-exchange" aria-labelledby="focus-exchange-title" className="in-focus-section">
          <p className="agora-eyebrow">03 / The exchange</p>
          <h2 id="focus-exchange-title">Two thinkers. A competing duty.</h2>
          <p className="in-focus-section-intro">An argument, a challenge, and a reply that leaves room to reconsider.</p>
          {edition.exchange.map((part, index) => <section key={part.id} className="in-focus-contribution" aria-labelledby={`focus-${part.id}-title`}>
            <div className="in-focus-voice">
              <Link href={`/philosophers/${part.philosopher.id}`} aria-label={`About ${part.philosopher.name}`}>
                <PhilosopherAvatar philosopherId={part.philosopher.id} name={part.philosopher.name} initials={part.philosopher.initials} color={part.philosopher.color} size="lg" />
              </Link>
              <div><p className="in-focus-role">{part.role} <span aria-hidden="true">/ {String(index + 1).padStart(2, "0")}</span></p>
                <Link href={`/philosophers/${part.philosopher.id}`} className="in-focus-voice-name">{part.philosopher.name}</Link>
                <p className="in-focus-tradition">{part.philosopher.tradition}</p>
              </div>
            </div>
            <h3 id={`focus-${part.id}-title`}>{part.heading}</h3>
            <div className="in-focus-prose">{paragraphs(part.paragraphs)}</div>
          </section>)}
        </section>

        <section id="focus-unresolved" aria-labelledby="focus-unresolved-title" className="in-focus-unresolved">
          <p className="agora-eyebrow">04 / What remains unresolved</p>
          <h2 id="focus-unresolved-title">{edition.unresolved.heading}</h2>
          <div className="in-focus-prose">{paragraphs(edition.unresolved.paragraphs)}</div>
          <ul>{edition.unresolved.questions.map((question) => <li key={question}>{question}</li>)}</ul>
        </section>

        <section id="focus-sources" aria-labelledby="focus-sources-title" className="in-focus-sources">
          <p className="agora-eyebrow">The reading behind the question</p>
          <h2 id="focus-sources-title">Sources & context</h2>
          <p className="in-focus-section-intro">Reporting, monitoring and analysis serve different purposes. Official claims are attributed; the philosophical judgments are interpretations.</p>
          <ol>{edition.sources.map((source) => <li key={source.id} id={`focus-source-${source.id}`} tabIndex={-1}>
            <span className="in-focus-source-number" aria-hidden="true">{source.id.slice(1).padStart(2, "0")}</span>
            <div><p className="in-focus-source-meta">{source.publisher}{source.date && <> · <time dateTime={source.date}>{formatDate(`${source.date}T12:00:00Z`)}</time></>}</p>
              <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<span aria-hidden="true"> ↗</span><span className="sr-only"> (opens in a new tab)</span></a>
              <p className="in-focus-source-note">{source.note}</p>
            </div>
          </li>)}</ol>
        </section>
        <div className="in-focus-end"><span>Old minds. Open questions.</span><Link href="/in-focus">More from In Focus →</Link></div>
      </div>
    </div>
  </article>;
}
