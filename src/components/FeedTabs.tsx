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

export function FeedTabs({ mobileIntegrated = false }: { mobileIntegrated?: boolean }) {
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
      className={`${
        mobileIntegrated
          ? "border-b border-border-light/90"
          : "sticky top-[61px] lg:top-0 z-10 bg-parchment/92 supports-[backdrop-filter]:backdrop-blur-md border-b border-border-light/90 shadow-[0_6px_16px_rgba(42,36,31,0.035)]"
      } transition-opacity duration-200 ${isPending ? "opacity-85" : ""}`}
    >
      <div className="flex items-center px-2 py-2 sm:gap-1 sm:px-4 sm:py-2.5">
        {FEED_CONTENT_TABS.map((tab) => {
          const isActive = activeType === tab.key;

          return (
            <button
              key={tab.key}
              onClick={() => pushFilters(tab.key)}
              aria-pressed={isActive}
              className={`
                flex-1 sm:flex-initial
                cursor-pointer rounded-full px-2.5 py-1.5 sm:px-4 sm:py-2
                text-center font-body text-[12px] sm:text-[13px]
                tracking-wide
                transition-all duration-200 ease-out
                ${
                  isActive
                    ? "bg-parchment-dark/70 text-ink font-medium shadow-[inset_0_0_0_1px_rgba(42,36,31,0.08),0_1px_2px_rgba(42,36,31,0.06)]"
                    : "text-ink-lighter hover:bg-parchment-dark/30 hover:text-ink-light"
                }
              `}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
