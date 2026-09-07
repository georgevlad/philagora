import type { Philosopher } from "@/lib/types";
import { AgoraShell } from "@/components/agora/AgoraShell";
import { PageHeading } from "@/components/public/PageHeading";
import { PhilosopherLink } from "@/components/public/PhilosopherLink";
import { EmptyState } from "@/components/public/PageState";

const schools = [
  {
    name: "Stoicism",
    color: "#2D6B30",
    description:
      "The art of living well through virtue, self-discipline, and acceptance of what lies beyond our control. Two voices, two eras, one discipline.",
    philosophers: [
      { id: "marcus-aurelius", name: "Marcus Aurelius" },
      { id: "seneca", name: "Seneca" },
    ],
  },
  {
    name: "Existentialism",
    color: "#8B3A4A",
    description:
      "Existence precedes essence \u2014 we create meaning through our choices, actions, and authentic engagement with the world.",
    philosophers: [
      { id: "nietzsche", name: "Nietzsche" },
      { id: "kierkegaard", name: "Kierkegaard" },
    ],
  },
  {
    name: "Classical Greek Idealism",
    color: "#3B6E8A",
    description:
      "Beyond appearances lies a higher reality of eternal Forms. True knowledge is knowledge of the unchanging, and justice requires wisdom at the helm.",
    philosophers: [{ id: "plato", name: "Plato" }],
  },
  {
    name: "Analytical Psychology",
    color: "#7A4A8E",
    description:
      "The psyche has its own reality. Archetypes, the collective unconscious, and the shadow \u2014 integration of what we deny is the path to wholeness.",
    philosophers: [{ id: "jung", name: "Carl Jung" }],
  },
  {
    name: "Deontological Ethics",
    color: "#2E4A7A",
    description:
      "Morality grounded in duty, universal principles, and the categorical imperative \u2014 act as you would have all act.",
    philosophers: [{ id: "kant", name: "Immanuel Kant" }],
  },
  {
    name: "Confucianism",
    color: "#C89515",
    description:
      "Social harmony through right relationships, ritual propriety, education, and the cultivation of virtue.",
    philosophers: [{ id: "confucius", name: "Confucius" }],
  },
  {
    name: "Absurdism",
    color: "#B07D3A",
    description:
      "The world is indifferent and meaning is absent \u2014 yet we revolt, we create, and we must imagine Sisyphus happy.",
    philosophers: [{ id: "camus", name: "Camus" }],
  },
  {
    name: "Literary Philosophy",
    color: "#6B4035",
    description:
      "Philosophy through character, narrative, and the darkest corners of the human soul. Not arguments but lived contradictions.",
    philosophers: [{ id: "dostoevsky", name: "Dostoevsky" }],
  },
  {
    name: "Analytic Philosophy",
    color: "#2A6B5A",
    description:
      "Clear thinking as the antidote to confusion. Decompose problems, question authority, and let reason guide ethics.",
    philosophers: [{ id: "russell", name: "Bertrand Russell" }],
  },
  {
    name: "Roman Republicanism",
    color: "#7A4020",
    description:
      "Government by law, not by men. The republic endures through institutional design, civic duty, and the orator who speaks truth to power.",
    philosophers: [{ id: "cicero", name: "Cicero" }],
  },
];

export function SchoolsPageClient({
  philosophersMap,
  philosophers,
}: {
  philosophersMap: Record<string, Philosopher>;
  philosophers: Philosopher[];
}) {
  const listedIds = new Set(
    schools.flatMap((s) => s.philosophers.map((p) => p.id)),
  );
  const additional = philosophers.filter((p) => !listedIds.has(p.id));
  const groups = [
    ...schools.map((s) => ({
      name: s.name,
      description: s.description,
      people: s.philosophers.map((p) => philosophersMap[p.id]).filter(Boolean),
    })),
    ...Array.from(new Set(additional.map((p) => p.tradition))).map(
      (tradition) => ({
        name: tradition,
        description: "",
        people: additional.filter((p) => p.tradition === tradition),
      }),
    ),
  ].filter((s) => s.people.length);
  return (
    <AgoraShell>
      <main id="main" className="public-page">
        <PageHeading
          eyebrow="Different ways of seeing"
          title="Schools of Thought"
        >
          <p>
            Explore the traditions behind the voices. These are starting points:
            a thinker’s work often crosses the boundaries of a single school.
          </p>
        </PageHeading>
        {groups.length ? (
          <div className="public-school-list">
            {groups.map((school) => (
              <section className="public-school" key={school.name}>
                <h2>{school.name}</h2>
                {school.description && <p>{school.description}</p>}
                <div className="public-people">
                  {school.people.map((p) => (
                    <PhilosopherLink key={p.id} {...p} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState
            title="The thinkers will be here soon."
            href="/"
            action="Back to the Agora"
          >
            Philosopher profiles will appear here when available.
          </EmptyState>
        )}
      </main>
    </AgoraShell>
  );
}
