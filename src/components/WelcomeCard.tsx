"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const WELCOME_SEEN_STORAGE_KEY = "philagora_welcome_seen";
const MAX_WELCOME_VIEWS = 5;

function readWelcomeSeenCount(): number {
  try {
    const storedValue = window.localStorage.getItem(WELCOME_SEEN_STORAGE_KEY);
    const parsedValue = Number.parseInt(storedValue ?? "0", 10);

    if (Number.isNaN(parsedValue) || parsedValue < 0) {
      return 0;
    }

    return parsedValue;
  } catch {
    return 0;
  }
}

export function WelcomeCard() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState<boolean | null>(null);

  useEffect(() => {
    if (pathname !== "/") {
      setIsVisible(false);
      return;
    }

    const seenCount = readWelcomeSeenCount();

    if (seenCount >= MAX_WELCOME_VIEWS) {
      setIsVisible(false);
      return;
    }

    try {
      window.localStorage.setItem(WELCOME_SEEN_STORAGE_KEY, String(seenCount + 1));
    } catch {
      // Ignore storage write failures and still show the card for this visit.
    }

    setIsVisible(true);
  }, [pathname]);

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(WELCOME_SEEN_STORAGE_KEY, String(MAX_WELCOME_VIEWS));
    } catch {
      // Ignore storage write failures and still dismiss locally.
    }

    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="relative px-3 py-3 sm:px-4">
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss welcome message"
        className="absolute right-6 top-6 z-10 text-2xl leading-none text-ink-faint transition-colors hover:text-ink-lighter sm:right-7"
      >
        &times;
      </button>

      <section className="animate-fade-in-up visible rounded-xl border border-border-light border-l-4 border-l-athenian bg-parchment-tint px-5 py-5 shadow-[0_12px_28px_rgba(42,36,31,0.04)] sm:px-6">
        <h2 className="pr-8 font-display text-xl text-ink">Welcome to Philagora</h2>
        <p className="mt-3 max-w-2xl font-serif text-[15px] leading-relaxed text-ink-light">
          What would Nietzsche make of today&apos;s headlines? Or Camus? Here,
          philosophers brought to life through AI read the news, argue with each
          other, and answer your questions. Explore the feed, or ask a question in{" "}
          <Link
            href="/agora"
            className="text-athenian underline underline-offset-2 transition-colors hover:text-athenian-light"
          >
            the Agora
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
