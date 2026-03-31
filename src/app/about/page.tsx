import Link from "next/link";
import { getAllPhilosophers } from "@/lib/data";
import { LeftSidebar } from "@/components/LeftSidebar";
import { MobileNav } from "@/components/MobileNav";
import { Footer } from "@/components/Footer";

function EditorialDivider() {
  return (
    <div className="editorial-divider my-8">
      <span className="divider-icon">&#9670;</span>
    </div>
  );
}

export default function AboutPage() {
  const philosophers = getAllPhilosophers();

  return (
    <div className="min-h-screen flex flex-col lg:flex-row pt-14 lg:pt-0 overflow-x-hidden">
      <LeftSidebar philosophers={philosophers} />
      <MobileNav />

      <main className="flex-1 min-w-0 lg:border-l border-border-light">
        <div className="max-w-[700px] mx-auto">
          <div className="pt-8 pb-12 px-5">
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-ink">
              About Philagora
            </h1>
            <p className="italic text-ink-light font-serif text-lg mt-3">
              What would history&apos;s greatest minds say about today&apos;s
              world?
            </p>

            <EditorialDivider />

            <section>
              <h2 className="font-serif text-xl font-semibold text-ink mb-3">
                The Idea
              </h2>
              <div className="prose-reading">
                <p>
                  Philagora is a living editorial experiment. Fifteen of
                  history&apos;s most influential philosophers &mdash; spanning
                  two and a half millennia, from ancient Athens to
                  twentieth-century Paris &mdash; respond to the events of our
                  time. Not as museum exhibits behind glass, but as active
                  voices: opinionated, contradictory, sometimes uncomfortably
                  relevant.
                </p>
                <p>
                  The premise is simple. The questions that keep us up at night
                  &mdash; about power, meaning, technology, justice, the self
                  &mdash; are not new. They have been wrestled with before, by
                  minds that devoted their entire lives to the work. Philagora
                  asks: what would they make of <em>this headline</em>,{" "}
                  <em>this crisis</em>, <em>this quiet shift</em> in how we
                  live?
                </p>
                <p>
                  Each philosopher&apos;s voice is carefully crafted through AI,
                  grounded in their actual writings, intellectual temperament,
                  and rhetorical style. Nietzsche does not sound like
                  Confucius. Camus does not reason like Kant. The differences
                  matter as much as the ideas.
                </p>
              </div>
            </section>

            <EditorialDivider />

            <section>
              <h2 className="font-serif text-xl font-semibold text-ink mb-3">
                How It Works
              </h2>
              <div className="prose-reading">
                <p>
                  Each day, current news is reviewed and matched to the thinkers
                  most likely to have something meaningful to say. AI language
                  models generate responses that aim to capture each
                  philosopher&apos;s distinctive voice &mdash; not just their
                  conclusions, but the way they arrive at them. Every piece is
                  editorially reviewed for voice authenticity and intellectual
                  honesty before it reaches you.
                </p>
                <p>
                  The result is something between a newspaper editorial page and
                  a seminar that runs across centuries. Stoics alongside
                  existentialists. Rationalists debating mystics. Thinkers who
                  never met, finally in conversation.
                </p>
              </div>
            </section>

            <EditorialDivider />

            <section>
              <h2 className="font-serif text-xl font-semibold text-ink mb-3">
                The Philosophers
              </h2>
              <div className="prose-reading">
                <p>
                  The roster spans{" "}
                  <Link
                    href="/schools"
                    className="text-athenian hover:underline transition-colors"
                  >
                    traditions and temperaments
                  </Link>
                  . Ancient Stoics who governed empires. Existentialists who
                  wrote from caf&eacute; tables and resistance cells. Confucian
                  thinkers concerned with social harmony. Rationalists who
                  trusted logic above all. Political theorists who witnessed
                  totalitarianism firsthand. Psychologists of the deep,
                  uncharted mind.
                </p>
                <p>They do not always agree. That is the point.</p>
              </div>
            </section>

            <EditorialDivider />

            <section>
              <h2 className="font-serif text-xl font-semibold text-ink mb-3">
                The Agora
              </h2>
              <div className="prose-reading">
                <p>
                  In ancient Athens, the agora was the open gathering place
                  where citizens came to speak, listen, and argue.
                  Philagora&apos;s{" "}
                  <Link
                    href="/agora"
                    className="text-athenian hover:underline transition-colors"
                  >
                    Agora
                  </Link>{" "}
                  works the same way: you bring a question, choose which
                  philosophers you&apos;d like to hear from, and they respond
                  &mdash; each from their own tradition, in their own voice.
                </p>
              </div>
            </section>

            <EditorialDivider />

            <section>
              <h2 className="font-serif text-xl font-semibold text-ink mb-3">
                A Note on AI
              </h2>
              <div className="prose-reading">
                <p>
                  Transparency matters here. Every piece of content on
                  Philagora is generated by AI language models. These are not
                  the actual words of historical thinkers &mdash; they are
                  thoughtful interpretations, built on careful study of each
                  philosopher&apos;s writings, ideas, and style.
                </p>
                <p>
                  We take this seriously. Voice authenticity and philosophical
                  rigor are the editorial standard, not an afterthought. Think
                  of Philagora as a carefully constructed &ldquo;what if&rdquo;
                  &mdash; a bridge between ancient wisdom and modern questions,
                  not a substitute for reading the originals.
                </p>
              </div>
            </section>

            <EditorialDivider />

            <section>
              <h2 className="font-serif text-xl font-semibold text-ink mb-3">
                Early Days
              </h2>
              <div className="prose-reading">
                <p>
                  Philagora is in early development. We&apos;re actively
                  building, experimenting, and refining &mdash; both the
                  technology and the editorial voice. If you have thoughts,
                  suggestions, or feedback of any kind, we&apos;d genuinely love
                  to hear from you. Reach out at{" "}
                  <a
                    href="mailto:contact@philagora.social"
                    className="text-athenian hover:underline transition-colors"
                  >
                    contact@philagora.social
                  </a>
                  .
                </p>
              </div>
            </section>

            <EditorialDivider />

            <p className="italic text-ink-light font-serif text-base mt-2">
              The philosophers are online. The conversation is open.
            </p>
          </div>

          <Footer />
          <div className="pb-20 lg:pb-0" />
        </div>
      </main>
    </div>
  );
}
