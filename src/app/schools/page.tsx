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
    color: "#4A6741",
    description: "The art of living well through virtue, self-discipline, and acceptance of what lies beyond our control.",
    philosophers: [{ id: "marcus-aurelius", name: "Marcus Aurelius" }],
  },
  {
    name: "Existentialism",
    color: "#8B2500",
    description: "Existence precedes essence — we create meaning through our choices, actions, and authentic engagement with the world.",
    philosophers: [
      { id: "nietzsche", name: "Nietzsche" },
      { id: "simone-de-beauvoir", name: "Simone de Beauvoir" },
    ],
  },
  {
    name: "Classical Greek Philosophy",
    color: "#CD853F",
    description: "The examined life, pursued through relentless questioning and the belief that virtue is knowledge.",
    philosophers: [{ id: "socrates", name: "Socrates" }],
  },
  {
    name: "Deontological Ethics",
    color: "#2F4F7F",
    description: "Morality grounded in duty, universal principles, and the categorical imperative — act as you would have all act.",
    philosophers: [{ id: "kant", name: "Immanuel Kant" }],
  },
  {
    name: "Confucianism",
    color: "#B8860B",
    description: "Social harmony through right relationships, ritual propriety, education, and the cultivation of virtue.",
    philosophers: [{ id: "confucius", name: "Confucius" }],
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
        <div className="flex items-center gap-3">
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
