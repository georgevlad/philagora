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
      className={`sticky top-[61px] lg:top-0 z-10 bg-parchment/92 supports-[backdrop-filter]:backdrop-blur-md border-b border-border-light/90 shadow-[0_6px_16px_rgba(42,36,31,0.035)] transition-opacity duration-200 ${
        isPending ? "opacity-85" : ""
      }`}
    >
      <div className="flex px-3 sm:px-4">
        {FEED_CONTENT_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => pushFilters(tab.key)}
            aria-pressed={activeType === tab.key}
            className={`relative flex-1 px-1.5 py-3.5 sm:px-4 sm:py-4 transition-colors duration-200 ${
              activeType === tab.key
                ? "font-serif text-[15px] font-medium text-ink sm:text-[16px]"
                : "font-body text-[13px] text-ink-lighter hover:text-ink-light sm:text-sm"
            }`}
          >
            <span className="relative inline-block leading-[1.15]">
              {tab.label}
              {activeType === tab.key && (
                <span className="absolute -bottom-3.5 left-1/2 h-[3px] w-9 -translate-x-1/2 rounded-full bg-athenian shadow-[0_0_0_1px_rgba(176,138,73,0.14)]" />
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
