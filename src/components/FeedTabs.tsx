import Link from "next/link";
import {
  FEED_CONTENT_TABS,
  type FeedContentType,
} from "@/lib/feed-utils";

export type FeedSearchParams = Record<string, string | string[] | undefined>;

function buildFeedUrl(searchParams: FeedSearchParams, nextType: FeedContentType) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }

  if (nextType === "all") {
    params.delete("type");
  } else {
    params.set("type", nextType);
  }

  const query = params.toString();
  return query ? `/feed?${query}` : "/feed";
}

export function FeedTabs({
  activeType,
  searchParams,
}: {
  activeType: FeedContentType;
  searchParams: FeedSearchParams;
}) {
  return (
    <div className="border-b border-border-light/90 bg-parchment lg:sticky lg:top-0 lg:z-10 lg:bg-parchment/92 lg:shadow-[0_6px_16px_rgba(42,36,31,0.035)] lg:supports-[backdrop-filter]:backdrop-blur-md">
      <div className="flex items-center px-2 py-1.5 sm:gap-1 sm:px-4 sm:py-2.5">
        {FEED_CONTENT_TABS.map((tab) => {
          const isActive = activeType === tab.key;

          return (
            <Link
              key={tab.key}
              href={buildFeedUrl(searchParams, tab.key)}
              scroll={false}
              aria-current={isActive ? "page" : undefined}
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
            </Link>
          );
        })}
      </div>
    </div>
  );
}
