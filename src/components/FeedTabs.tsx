import Link from "next/link";
import { FEED_CONTENT_TABS, type FeedContentType } from "@/lib/feed-utils";
export type FeedSearchParams = Record<string, string | string[] | undefined>;
function buildFeedUrl(
  searchParams: FeedSearchParams,
  nextType: FeedContentType,
  basePath: string,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value))
      for (const item of value) params.append(key, item);
    else if (value !== undefined) params.set(key, value);
  }
  if (nextType === "all") params.delete("type");
  else params.set("type", nextType);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
export function FeedTabs({
  activeType,
  searchParams,
  basePath = "/feed",
}: {
  activeType: FeedContentType;
  searchParams: FeedSearchParams;
  basePath?: string;
}) {
  return (
    <nav className="public-tabs" aria-label="Filter posts">
      {FEED_CONTENT_TABS.map((tab) => (
        <Link
          key={tab.key}
          href={buildFeedUrl(searchParams, tab.key, basePath)}
          scroll={false}
          aria-current={activeType === tab.key ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
