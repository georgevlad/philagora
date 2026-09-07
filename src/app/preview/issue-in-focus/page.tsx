import Link from "next/link";
import { AgoraShell } from "@/components/agora/AgoraShell";
import { IssueQuestionPreview } from "@/components/agora/IssuePreview";
export const metadata = {
  title: "An issue in focus · Sample preview",
  robots: { index: false, follow: false },
};
export default function IssuePreviewPage() {
  return (
    <AgoraShell>
      <main id="main" className="agora-reading">
        <Link className="agora-text-link" href="/#world">
          ← Back to the Agora
        </Link>
        <p className="agora-eyebrow">
          An issue in focus{" "}
          <span className="agora-badge">Sample · Coming later</span>
        </p>
        <h1>When a city overheats, who gets protected first?</h1>
        <p className="agora-deck">
          A shared problem. A limited budget. Different ideas of what we owe
          each other.
        </p>
        <p className="agora-notice">
          This entire feature is mocked: the hypothetical city, briefing,
          proposals, synthesis and contextual questions. These are illustrative
          interpretations, not historical quotations or policy recommendations.
        </p>
        <nav className="agora-round-nav" aria-label="Sample briefing">
          <a href="#situation">The situation</a>
          <a href="#proposals">Possible responses</a>
          <a href="#sources">Sources</a>
          <a href="#ask-preview">Question preview</a>
        </nav>
        <section id="situation">
          <p className="agora-eyebrow">01 / The situation · Sample</p>
          <h2>The heat is shared. The exposure is not.</h2>
          <p>
            Imagine a city with a limited adaptation budget. It could open
            cooling spaces immediately, protect people working outdoors, or
            improve housing for future summers. How should it decide?
          </p>
          <p>
            A real briefing would need dated local reporting, neighbourhood
            temperatures, housing conditions, costs, service access and
            residents’ priorities.
          </p>
        </section>
        <section id="proposals">
          <p className="agora-eyebrow">02 / Possible responses · Sample</p>
          <h2>Three proposals. Three tests.</h2>
          {[
            [
              "Marcus Aurelius",
              "Begin with those most exposed.",
              "Prioritise immediate protection for people least able to escape the heat. Does concentrating on the urgent leave the city unprepared for next summer?",
            ],
            [
              "Hannah Arendt",
              "Make protection a public responsibility.",
              "Give affected residents and workers a real role in the decision. How can deliberation include people without delaying immediate help?",
            ],
            [
              "Bertrand Russell",
              "Ask which measures will actually work.",
              "Compare the likely effects of each intervention and publish the assumptions. Which needs disappear because they are difficult to measure?",
            ],
          ].map(([name, title, text]) => (
            <article className="agora-answer" key={name}>
              <p className="agora-meta">{name} · Illustrative proposal</p>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </section>
        <section className="agora-synthesis">
          <p className="agora-eyebrow">03 / Sample synthesis</p>
          <h2>Who sets the priorities—and what counts as success?</h2>
          <p>
            Urgency, participation and evidence can support each other. A
            limited budget still forces choices between them.
          </p>
        </section>
        <IssueQuestionPreview />
        <section id="sources">
          <h2>Background reading</h2>
          <p className="agora-meta">
            Background sources from the design study; not reporting on this
            hypothetical city.
          </p>
          <p>
            <a
              className="agora-text-link"
              href="https://www.who.int/news-room/fact-sheets/detail/climate-change-heat-and-health"
              rel="noreferrer"
              target="_blank"
            >
              WHO · Heat and health ↗
            </a>
          </p>
          <p>
            <a
              className="agora-text-link"
              href="https://www.ipcc.ch/report/ar6/syr/"
              rel="noreferrer"
              target="_blank"
            >
              IPCC · AR6 Synthesis Report ↗
            </a>
          </p>
        </section>
        <Link className="agora-text-link" href="/#ask">
          Ask an ordinary Agora question →
        </Link>
      </main>
    </AgoraShell>
  );
}
