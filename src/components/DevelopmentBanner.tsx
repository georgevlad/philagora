"use client";

import { useState } from "react";

export default function DevelopmentBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="relative border-b border-border-light/70 bg-parchment-dark/55 px-10 py-2 text-center text-xs text-ink-light shadow-[inset_0_-1px_0_rgba(255,255,255,0.25)]">
      <p className="mx-auto max-w-3xl">
        <span aria-hidden="true" className="mr-1.5">🏗️</span>
        Philagora is currently in development. Content and features are a work in progress.
      </p>
      <button
        type="button"
        aria-label="Dismiss development notice"
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-lighter transition-colors hover:text-ink"
      >
        ×
      </button>
    </div>
  );
}
