"use client";

import Link from "next/link";
import { LeftSidebar } from "@/components/LeftSidebar";
import { MobileNav } from "@/components/MobileNav";
import { Footer } from "@/components/Footer";
import { PhilosopherAvatar } from "@/components/PhilosopherAvatar";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const schools = [
  {
    name: "Stoicism",
    color: "#3D7A35",
    description:
      "The art of living well through virtue, self-discipline, and acceptance of what lies beyond our control. Two voices, two eras, one discipline.",
    philosophers: [
      { id: "marcus-aurelius", name: "Marcus Aurelius" },
      { id: "seneca", name: "Seneca" },
    ],
  },
  {
    name: "Existentialism",
    color: "#A52F0F",
    description:
      "Existence precedes essence \u2014 we create meaning through our choices, actions, and authentic engagement with the world.",
    philosophers: [
      { id: "nietzsche", name: "Nietzsche" },
      { id: "kierkegaard", name: "Kierkegaard" },
    ],
  },
  {
    name: "Classical Greek Idealism",
    color: "#4A80B8",
    description:
      "Beyond appearances lies a higher reality of eternal Forms. True knowledge is knowledge of the unchanging, and justice requires wisdom at the helm.",
    philosophers: [{ id: "plato", name: "Plato" }],
  },
  {
    name: "Analytical Psychology",
    color: "#8E4DA6",
    description:
      "The psyche has its own reality. Archetypes, the collective unconscious, and the shadow \u2014 integration of what we deny is the path to wholeness.",
    philosophers: [{ id: "jung", name: "Carl Jung" }],
  },
  {
    name: "Deontological Ethics",
    color: "#2E5BA8",
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
    color: "#D49248",
    description:
      "The world is indifferent and meaning is absent \u2014 yet we revolt, we create, and we must imagine Sisyphus happy.",
    philosophers: [{ id: "camus", name: "Camus" }],
  },
  {
    name: "Literary Philosophy",
    color: "#7D4A38",
    description:
      "Philosophy through character, narrative, and the darkest corners of the human soul. Not arguments but lived contradictions.",
    philosophers: [{ id: "dostoevsky", name: "Dostoevsky" }],
  },
  {
    name: "Analytic Philosophy",
    color: "#2D7E68",
    description:
      "Clear thinking as the antidote to confusion. Decompose problems, question authority, and let reason guide ethics.",
    philosophers: [{ id: "russell", name: "Bertrand Russell" }],
  },
];

function SchoolCard({
  school,
  index,
}: {
  school: (typeof schools)[0];
  index: number;
}) {
  const ref = useScrollReveal(index);

  return (
    <div
      ref={ref}
      className="animate-fade-in-up rounded-lg border border-border-light overflow-hidden hover:border-border transition-all duration-200"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      <div
        className="h-1.5"
        style={{ backgroundColor: school.color }}
      />
      <div className="p-5">
        <h3 className="font-serif text-lg font-bold text-ink mb-2">
          {school.name}
        </h3>
        <p className="text-sm text-ink-light leading-relaxed mb-4">
          {school.description}
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          {school.philosophers.map((p) => (
            <Link
              key={p.id}
              href={`/philosophers/${p.id}`}
              className="flex items-center gap-2 group"
            >
              <PhilosopherAvatar philosopherId={p.id} size="sm" />
              <span className="text-sm text-ink-light group-hover:text-athenian transition-colors duration-200">
                {p.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SchoolsPage() {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row pt-14 lg:pt-0">
      <LeftSidebar />
      <MobileNav />

      <main className="flex-1 min-w-0 lg:border-l border-border-light">
        <div className="max-w-[700px] mx-auto">
          <div className="px-5 pt-8 pb-6 border-b border-border-light">
            <h1 className="font-serif text-2xl lg:text-3xl font-bold text-ink leading-tight mb-3">
              Schools of Thought
            </h1>
            <p className="text-[15px] text-ink-light leading-relaxed">
              Explore philosophical traditions and the thinkers who shaped them.
            </p>
          </div>

          <div className="px-5 py-6 space-y-4">
            {schools.map((school, i) => (
              <SchoolCard key={school.name} school={school} index={i} />
            ))}
          </div>

          <Footer />
          <div className="pb-20 lg:pb-0" />
        </div>
      </main>
    </div>
  );
}
