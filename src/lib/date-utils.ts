function parseDateString(value: string): Date | null {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const withTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`;
  const date = new Date(withTimezone);

  return Number.isNaN(date.getTime()) ? null : date;
}

/** Format an ISO date string into a short display format (e.g. "Jan 5, 2025"). */
export function formatDate(iso: string): string {
  const date = parseDateString(iso);
  if (!date) return iso;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Format an ISO date string into a short display format with time (e.g. "Jan 5, 2025, 3:45 PM"). */
export function formatDateTime(iso: string): string {
  const date = parseDateString(iso);
  if (!date) return iso;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Convert an ISO date string to a relative timestamp (e.g. "2h ago"). */
export function timeAgo(iso: string): string {
  const date = parseDateString(iso);
  if (!date) return iso;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(iso);
}

export function formatRelativeTime(isoDate: string): string {
  const date = parseDateString(isoDate);
  if (!date) return isoDate;

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 30) return `${diffDays}d`;
  return `${Math.floor(diffDays / 30)}mo`;
}
