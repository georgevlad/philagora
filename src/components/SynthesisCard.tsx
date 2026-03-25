"use client";

import { useScrollReveal } from "@/hooks/useScrollReveal";
import type {
  AdviceSynthesis,
  AgoraQuestionType,
  AgoraSynthesisSections,
  ConceptualSynthesis,
  DebateSynthesis,
} from "@/lib/types";

interface SynthesisProps {
  type: AgoraQuestionType;
  sections: AgoraSynthesisSections;
}

function renderAdvice(sections: AdviceSynthesis) {
  return (
    <div className="p-5 space-y-5">
      <div>
        <h4 className="text-xs font-mono tracking-wider uppercase text-ink-lighter mb-3">
          Key Tensions
        </h4>
        <div className="space-y-3">
          {sections.tensions.map((tension, index) => (
            <div key={index} className="flex gap-3">
              <span className="shrink-0 w-5 h-5 rounded-full bg-terracotta/10 text-terracotta text-[11px] font-mono flex items-center justify-center mt-0.5">
                {index + 1}
              </span>
              <p className="text-sm leading-relaxed text-ink-light">{tension}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-xs font-mono tracking-wider uppercase text-ink-lighter mb-3">
          Points of Agreement
        </h4>
        <div className="space-y-2">
          {sections.agreements.map((agreement, index) => (
            <div key={index} className="flex gap-3">
              <span className="shrink-0 mt-1.5">
                <svg width="12" height="12" viewBox="0 0 12 12" className="text-stoic">
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
              <p className="text-sm leading-relaxed text-ink-light">{agreement}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-3 border-t border-border-light">
        <h4 className="text-xs font-mono tracking-wider uppercase text-ink-lighter mb-3">
          Practical Takeaways
        </h4>
        <ul className="space-y-2">
          {sections.practicalTakeaways.map((item, index) => (
            <li
              key={index}
              className="text-sm leading-relaxed text-ink-light pl-4 relative before:content-['-'] before:absolute before:left-0 before:text-ink-lighter"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function renderConceptual(sections: ConceptualSynthesis) {
  return (
    <div className="p-5 space-y-5">
      <div className="rounded-2xl border border-gold/20 bg-gold/5 px-5 py-4">
        <div className="text-[10px] font-mono tracking-[0.18em] uppercase text-gold mb-2">
          Key Insight
        </div>
        <p className="font-serif italic text-[18px] leading-[1.65] text-ink">
          {sections.keyInsight}
        </p>
      </div>

      <div>
        <h4 className="text-xs font-mono tracking-wider uppercase text-ink-lighter mb-3">
          Framework Comparison
        </h4>
        <ol className="space-y-3">
          {sections.frameworkComparison.map((item, index) => (
            <li key={index} className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-athenian/10 text-athenian text-[11px] font-mono flex items-center justify-center mt-0.5">
                {index + 1}
              </span>
              <p className="text-sm leading-relaxed text-ink-light">{item}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="pt-3 border-t border-border-light">
        <h4 className="text-xs font-mono tracking-wider uppercase text-ink-lighter mb-3">
          Deeper Questions
        </h4>
        <ul className="space-y-2">
          {sections.deeperQuestions.map((item, index) => (
            <li
              key={index}
              className="text-sm leading-relaxed text-ink-light pl-5 relative before:content-['-'] before:absolute before:left-0 before:text-athenian"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function renderDebate(sections: DebateSynthesis) {
  return (
    <div className="p-5 space-y-5">
      <div className="rounded-2xl border border-terracotta/20 bg-terracotta/5 px-5 py-4">
        <div className="text-[10px] font-mono tracking-[0.18em] uppercase text-terracotta mb-2">
          Central Fault Line
        </div>
        <p className="font-serif font-semibold text-[18px] leading-[1.55] text-ink">
          {sections.centralFaultLine}
        </p>
      </div>

      <div>
        <h4 className="text-xs font-mono tracking-wider uppercase text-ink-lighter mb-3">
          Points of Tension
        </h4>
        <div className="space-y-3">
          {sections.tensions.map((item, index) => (
            <div key={index} className="flex gap-3">
              <span className="shrink-0 w-5 h-5 rounded-full bg-terracotta/10 text-terracotta text-[11px] font-mono flex items-center justify-center mt-0.5">
                {index + 1}
              </span>
              <p className="text-sm leading-relaxed text-ink-light">{item}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-xs font-mono tracking-wider uppercase text-ink-lighter mb-3">
          Common Ground
        </h4>
        <div className="space-y-2">
          {sections.commonGround.map((item, index) => (
            <div key={index} className="flex gap-3">
              <span className="shrink-0 mt-1.5">
                <svg width="12" height="12" viewBox="0 0 12 12" className="text-stoic">
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
              <p className="text-sm leading-relaxed text-ink-light">{item}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-stoic/20 bg-stoic/5 px-5 py-4">
        <div className="text-[10px] font-mono tracking-[0.18em] uppercase text-stoic mb-2">
          What Is At Stake
        </div>
        <p className="text-sm leading-relaxed text-ink-light">{sections.whatIsAtStake}</p>
      </div>
    </div>
  );
}

export function SynthesisCard({ type, sections }: SynthesisProps) {
  const ref = useScrollReveal();

  const accentClass =
    type === "conceptual"
      ? "border-gold/20 bg-gradient-to-br from-parchment-dark to-gold/5"
      : type === "debate"
        ? "border-terracotta/20 bg-gradient-to-br from-parchment-dark to-terracotta/5"
        : "border-athenian/20 bg-gradient-to-br from-parchment-dark to-parchment";
  const headerClass =
    type === "conceptual"
      ? "bg-gold/6 border-gold/10"
      : type === "debate"
        ? "bg-terracotta/6 border-terracotta/10"
        : "bg-athenian/5 border-athenian/10";
  const titleClass =
    type === "conceptual"
      ? "text-gold"
      : type === "debate"
        ? "text-terracotta"
        : "text-athenian";
  const iconColorClass = titleClass;

  return (
    <div
      ref={ref}
      className={`animate-fade-in-up mx-3 sm:mx-5 my-6 rounded-lg border overflow-hidden shadow-sm ${accentClass}`}
    >
      <div className={`px-5 py-3 border-b flex items-center gap-3 ${headerClass}`}>
        <div className="w-8 h-8 rounded-full bg-white/55 flex items-center justify-center">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className={iconColorClass}
          >
            <path d="M8 1L10 6H15L11 9.5L12.5 15L8 11.5L3.5 15L5 9.5L1 6H6L8 1Z" />
          </svg>
        </div>
        <div>
          <h3 className={`font-serif font-bold text-sm ${titleClass}`}>Synthesis</h3>
          <p className="text-[11px] font-mono text-ink-lighter tracking-wide uppercase">
            Synthesis Agent
          </p>
        </div>
      </div>

      {type === "conceptual"
        ? renderConceptual(sections as ConceptualSynthesis)
        : type === "debate"
          ? renderDebate(sections as DebateSynthesis)
          : renderAdvice(sections as AdviceSynthesis)}
    </div>
  );
}
