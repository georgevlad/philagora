"use client";

import type { FormEvent, KeyboardEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

const AGORA_HERO_CHIPS = [
  "What do I do with my anger?",
  "How do I know what I actually want?",
  "When is it right to lie?",
  "Should I care about politics?",
] as const;

function buildAgoraUrl(question: string): string {
  return `/agora?q=${encodeURIComponent(question)}`;
}

export function AgoraHero() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const trimmedQuestion = question.trim();

  function navigateToAgora(nextQuestion: string) {
    const normalizedQuestion = nextQuestion.trim();

    if (normalizedQuestion.length === 0) {
      return;
    }

    router.push(buildAgoraUrl(normalizedQuestion));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigateToAgora(question);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setQuestion("");
    }
  }

  return (
    <div className="px-2 pb-2.5 pt-3 sm:px-4 sm:pb-3 sm:pt-4">
      <section className="animate-fade-in-up visible relative overflow-hidden rounded-xl border border-border-light bg-parchment-tint shadow-[0_12px_28px_rgba(42,36,31,0.04)]">
        <div
          className="absolute bottom-0 left-0 top-0 w-1"
          style={{
            background:
              "linear-gradient(to bottom, var(--color-terracotta), var(--color-gold))",
          }}
        />

        <div className="px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex items-start gap-3">
            <span className="select-none text-lg text-gold/70" aria-hidden="true">
              ✦
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-[22px] tracking-[0.01em] text-ink sm:text-2xl">
                What troubles your mind today?
              </h2>
              <p className="font-body text-[14px] leading-[1.55] text-ink-light sm:text-[15px]">
                The philosophers are listening.
              </p>
            </div>
          </div>

          <div className="mb-4 mt-3 h-px w-16 bg-gradient-to-r from-gold/40 to-transparent" />

          <form onSubmit={handleSubmit} className="space-y-4">
            <label htmlFor="agora-hero-question" className="sr-only">
              Ask your question in the Agora
            </label>

            <div className="relative">
              <input
                id="agora-hero-question"
                type="text"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask your question…"
                className="w-full rounded-[18px] border border-border-light/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(244,239,230,0.95))] px-4 py-4 pr-16 text-[15px] font-body text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.38)] transition-colors duration-200 placeholder:text-ink-lighter/70 focus:border-terracotta/45 focus:outline-none focus:ring-4 focus:ring-terracotta/10 sm:text-base"
              />

              <button
                type="submit"
                aria-label="Go to the Agora with this question"
                disabled={trimmedQuestion.length === 0}
                className="absolute right-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border-light/80 bg-white/72 text-ink-lighter transition-all duration-200 hover:border-terracotta/25 hover:bg-white hover:text-terracotta disabled:cursor-default disabled:opacity-55"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <path d="M3 8H13" strokeLinecap="round" />
                  <path d="M8.5 3.5L13 8L8.5 12.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {AGORA_HERO_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => navigateToAgora(chip)}
                  className="rounded-full border border-border-light/90 bg-parchment-dark/45 px-4 py-2.5 text-left text-[13px] font-body text-ink-light transition-colors duration-200 hover:border-gold/30 hover:bg-parchment-dark/75 hover:text-ink sm:text-[14px]"
                >
                  {chip}
                </button>
              ))}
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
