import type Database from "better-sqlite3";

export function agoraQuotaError(
  db: Database.Database,
  userId: string | null,
  clientIp: string,
  unlimited: boolean,
): string | null {
  if (unlimited) return null;
  const count = userId
    ? db
        .prepare(
          "SELECT COUNT(*) AS count FROM agora_threads WHERE user_id = ? AND created_at >= date('now')",
        )
        .get(userId)
    : db
        .prepare(
          "SELECT COUNT(*) AS count FROM agora_threads WHERE ip_address = ? AND created_at >= date('now')",
        )
        .get(clientIp);
  if ((count as { count: number }).count >= (userId ? 5 : 3))
    return userId
      ? "You've reached your daily question limit. Check back tomorrow."
      : "The philosophers are resting. Check back tomorrow.";
  const total = db
    .prepare(
      "SELECT COUNT(*) AS count FROM agora_threads WHERE created_at >= date('now')",
    )
    .get() as { count: number };
  return total.count >= 50
    ? "The philosophers are resting. Check back tomorrow."
    : null;
}
export class AgoraQuotaError extends Error {}
