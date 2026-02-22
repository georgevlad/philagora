"use client";

import { useScrollReveal } from "@/hooks/useScrollReveal";

interface SynthesisProps {
  tensions: string[];
  agreements: string[];
  questionsOrTakeaways: string[];
  questionsLabel?: string;
}

export function SynthesisCard({
  tensions,
  agreements,
  questionsOrTakeaways,
  questionsLabel = "Questions for Further Reflection",
}: SynthesisProps) {
  const ref = useScrollReveal();

  return (
    <div
      ref={ref}
      className="animate-fade-in-up mx-5 my-6 rounded-lg border border-athenian/20 bg-gradient-to-br from-parchment-dark to-parchment overflow-hidden shadow-sm"
    >
      {/* Header */}
      <div className="px-5 py-3 bg-athenian/5 border-b border-athenian/10 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-athenian/10 flex items-center justify-center">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-athenian"
          >
            <path d="M8 1L10 6H15L11 9.5L12.5 15L8 11.5L3.5 15L5 9.5L1 6H6L8 1Z" />
          </svg>
        </div>
        <div>
          <h3 className="font-serif font-bold text-athenian text-sm">
            Synthesis
          </h3>
          <p className="text-[11px] font-mono text-ink-lighter tracking-wide uppercase">
            Synthesis Agent
          </p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Key Tensions */}
        <div>
          <h4 className="text-xs font-mono tracking-wider uppercase text-ink-lighter mb-3">
            Key Tensions
          </h4>
          <div className="space-y-3">
            {tensions.map((tension, i) => (
              <div key={i} className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-terracotta/10 text-terracotta text-[11px] font-mono flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed text-ink-light">
                  {tension}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Points of Agreement */}
        <div>
          <h4 className="text-xs font-mono tracking-wider uppercase text-ink-lighter mb-3">
            Points of Agreement
          </h4>
          <div className="space-y-2">
            {agreements.map((agreement, i) => (
              <div key={i} className="flex gap-3">
                <span className="shrink-0 mt-1.5">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    className="text-stoic"
                  >
                    <circle cx="6" cy="6" r="5" fill="currentColor" opacity="0.2" />
                    <path
                      d="M4 6L5.5 7.5L8 4.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <p className="text-sm leading-relaxed text-ink-light">
                  {agreement}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Questions / Takeaways */}
        <div className="pt-3 border-t border-border-light">
          <h4 className="text-xs font-mono tracking-wider uppercase text-ink-lighter mb-3">
            {questionsLabel}
          </h4>
          <ul className="space-y-2">
            {questionsOrTakeaways.map((item, i) => (
              <li
                key={i}
                className="text-sm leading-relaxed text-ink-light pl-4 relative before:content-['—'] before:absolute before:left-0 before:text-ink-lighter"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
