"use client";

import { useScrollReveal } from "@/hooks/useScrollReveal";

interface TensionPhilosopher {
  name: string;
  id: string;
  color: string;
  initials: string;
  stance: string;
}

interface TensionCardProps {
  philosopherA: TensionPhilosopher;
  philosopherB: TensionPhilosopher;
  articleTitle: string;
}

export function TensionCard({
  philosopherA,
  philosopherB,
  articleTitle,
}: TensionCardProps) {
  const ref = useScrollReveal();

  return (
    <div
      ref={ref}
      className="animate-fade-in-up px-6 py-1.5 my-0.5"
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border-light to-transparent" />
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-serif font-semibold text-[12px]" style={{ color: philosopherA.color }}>
            {philosopherA.name}
          </span>
          <span className="text-[10px] font-mono text-ink-faint">{philosopherA.stance}s</span>
          <span className="text-ink-faint text-[10px]">&middot;</span>
          <span className="font-serif font-semibold text-[12px]" style={{ color: philosopherB.color }}>
            {philosopherB.name}
          </span>
          <span className="text-[10px] font-mono text-ink-faint">{philosopherB.stance}s</span>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border-light to-transparent" />
      </div>
    </div>
  );
}
