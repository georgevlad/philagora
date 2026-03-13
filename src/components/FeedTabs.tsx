"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  FEED_CONTENT_TABS,
  normalizeFeedContentType,
  type FeedContentType,
} from "@/lib/feed-utils";

function buildFeedUrl(pathname: string, currentSearchParams: string, nextType: FeedContentType) {
  const params = new URLSearchParams(currentSearchParams);

  if (nextType === "all") {
    params.delete("type");
  } else {
    params.set("type", nextType);
  }

  params.delete("philosopher");

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function FeedTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const activeType = normalizeFeedContentType(searchParams.get("type"));
  const pushFilters = (nextType: FeedContentType) => {
    const nextUrl = buildFeedUrl(pathname, searchParams.toString(), nextType);

    startTransition(() => {
      router.push(nextUrl, { scroll: false });
    });
  };

  return (
    <div
      className={`sticky top-14 lg:top-0 z-10 bg-parchment/92 supports-[backdrop-filter]:backdrop-blur-md border-b border-border-light/90 shadow-[0_6px_16px_rgba(42,36,31,0.035)] transition-opacity duration-200 ${
        isPending ? "opacity-85" : ""
      }`}
    >
      <div className="flex px-2 sm:px-4">
        {FEED_CONTENT_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => pushFilters(tab.key)}
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
    </div>
  );
}
