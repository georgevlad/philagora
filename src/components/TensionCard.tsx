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
    <div ref={ref} className="animate-fade-in-up px-4 sm:px-5 py-3 my-1.5">
      <div className="rounded-2xl border border-burgundy/14 bg-[linear-gradient(180deg,rgba(122,62,58,0.045),rgba(248,243,234,0.7))] px-4 py-3 shadow-[0_10px_24px_rgba(122,62,58,0.04)]">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-burgundy/18 to-transparent" />
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-burgundy">Tension</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-burgundy/18 to-transparent" />
        </div>

        <div className="flex items-center justify-center gap-2 text-center flex-wrap">
          <span className="font-serif font-semibold text-[13px]" style={{ color: philosopherA.color }}>
            {philosopherA.name}
          </span>
          <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-ink-faint">{philosopherA.stance}</span>
          <span className="text-burgundy text-[11px]">vs</span>
          <span className="font-serif font-semibold text-[13px]" style={{ color: philosopherB.color }}>
            {philosopherB.name}
          </span>
          <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-ink-faint">{philosopherB.stance}</span>
        </div>

        {articleTitle && (
          <p className="mt-2 text-center text-[12px] text-ink-light line-clamp-1">
            {articleTitle}
          </p>
        )}
      </div>
    </div>
  );
}
