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
      className="animate-fade-in-up px-4 py-3 my-1"
    >
      {/* Decorative divider line with centered icon */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border-light" />
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className="shrink-0 text-ink-faint"
        >
          {/* Two small chevrons pointing inward — ›‹ */}
          <path
            d="M3 4L6 7L3 10"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M11 4L8 7L11 10"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="flex-1 h-px bg-border-light" />
      </div>

      {/* Stance text */}
      <p className="text-center text-xs leading-snug mt-1.5">
        <span className="font-serif font-semibold" style={{ color: philosopherA.color }}>
          {philosopherA.name}
        </span>
        {" "}
        <span className="font-mono text-ink-lighter">{philosopherA.stance}s</span>
        <span className="text-ink-faint">{" · "}</span>
        <span className="font-serif font-semibold" style={{ color: philosopherB.color }}>
          {philosopherB.name}
        </span>
        {" "}
        <span className="font-mono text-ink-lighter">{philosopherB.stance}s</span>
      </p>

      {/* Article title */}
      <p className="text-center text-[10px] font-mono text-ink-faint truncate mt-0.5 max-w-[80%] mx-auto">
        {articleTitle}
      </p>
    </div>
  );
}
