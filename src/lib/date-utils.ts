/** Format an ISO date string into a short display format (e.g. "Jan 5, 2025"). */
export function formatDate(iso: string): string {
  try {
    const d = new Date(iso.includes("Z") ? iso : iso + "Z");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

/** Format an ISO date string into a short display format with time (e.g. "Jan 5, 2025, 3:45 PM"). */
export function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso.includes("Z") ? iso : iso + "Z");
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Convert an ISO date string to a relative timestamp (e.g. "2h ago"). */
export function timeAgo(iso: string): string {
  try {
    const date = new Date(iso.includes("Z") ? iso : iso + "Z");
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
  } catch {
    return iso;
  }
}
