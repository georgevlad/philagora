"use client";

import { useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  FEED_CONTENT_TABS,
  getPhilosopherChipLabel,
  normalizeFeedContentType,
  type FeedContentType,
} from "@/lib/feed-utils";
import type { Philosopher } from "@/lib/types";

function buildFeedUrl(
  pathname: string,
  currentSearchParams: string,
  nextType: FeedContentType,
  nextPhilosopherId?: string
) {
  const params = new URLSearchParams(currentSearchParams);

  if (nextType === "all") {
    params.delete("type");
  } else {
    params.set("type", nextType);
  }

  if (nextPhilosopherId) {
    params.set("philosopher", nextPhilosopherId);
  } else {
    params.delete("philosopher");
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function FeedTabs({ philosophers }: { philosophers: Philosopher[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const activeType = normalizeFeedContentType(searchParams.get("type"));
  const activePhilosopherId = searchParams.get("philosopher") || undefined;
  const sortedPhilosophers = useMemo(
    () => [...philosophers].sort((left, right) => left.name.localeCompare(right.name)),
    [philosophers]
  );

  const pushFilters = (nextType: FeedContentType, nextPhilosopherId?: string) => {
    const nextUrl = buildFeedUrl(
      pathname,
      searchParams.toString(),
      nextType,
      nextPhilosopherId
    );

    startTransition(() => {
      router.push(nextUrl, { scroll: false });
    });
  };

  const handlePhilosopherToggle = (philosopherId?: string) => {
    pushFilters(
      activeType,
      philosopherId && philosopherId === activePhilosopherId ? undefined : philosopherId
    );
  };

  return (
    <div className="sticky top-14 lg:top-0 z-10 bg-parchment/92 supports-[backdrop-filter]:backdrop-blur-md border-b border-border-light/90 shadow-[0_6px_16px_rgba(42,36,31,0.035)]">
      <div className="flex px-2 sm:px-4">
        {FEED_CONTENT_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => pushFilters(tab.key, activePhilosopherId)}
            aria-pressed={activeType === tab.key}
            className={`flex-1 px-2 sm:px-4 py-4 transition-colors duration-200 relative ${
              activeType === tab.key
                ? "text-ink font-serif font-medium text-[15px]"
                : "text-ink-lighter font-body text-sm hover:text-ink-light"
            }`}
          >
            <span className="relative inline-block">
              {tab.label}
              {activeType === tab.key && (
                <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-9 h-[3px] bg-athenian rounded-full shadow-[0_0_0_1px_rgba(176,138,73,0.14)]" />
              )}
            </span>
          </button>
        ))}
      </div>

      <div className="border-t border-border-light/70">
        <div className="no-scrollbar overflow-x-auto [-webkit-overflow-scrolling:touch] px-2 sm:px-4 py-2">
          <div className={`flex items-center gap-2 min-w-max ${isPending ? "opacity-85" : ""}`}>
            <button
              onClick={() => handlePhilosopherToggle(undefined)}
              aria-pressed={!activePhilosopherId}
              className={`shrink-0 rounded-full px-3 py-1.5 border text-xs sm:text-[13px] transition-all duration-200 ${
                !activePhilosopherId
                  ? "border-2 border-gold text-athenian font-medium bg-[linear-gradient(180deg,rgba(248,243,234,0.98),rgba(238,230,216,0.95))]"
                  : "border-border-light text-ink-lighter bg-parchment-tint/70 hover:text-ink-light"
              }`}
            >
              <span className="font-body">All</span>
            </button>

            {sortedPhilosophers.map((philosopher) => {
              const isActive = activePhilosopherId === philosopher.id;

              return (
                <button
                  key={philosopher.id}
                  onClick={() => handlePhilosopherToggle(philosopher.id)}
                  aria-pressed={isActive}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs sm:text-[13px] transition-all duration-200 border ${
                    isActive
                      ? "border-2 font-medium bg-[linear-gradient(180deg,rgba(248,243,234,0.98),rgba(238,230,216,0.92))]"
                      : "border border-border-light text-ink-lighter bg-parchment-tint/70 hover:text-ink-light"
                  }`}
                  style={
                    isActive
                      ? {
                          borderColor: philosopher.color,
                          color: philosopher.color,
                        }
                      : undefined
                  }
                >
                  <span className="sm:hidden font-mono tracking-[0.12em] uppercase">
                    {philosopher.initials}
                  </span>
                  <span className="hidden sm:inline font-body">
                    {getPhilosopherChipLabel(philosopher.name)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
