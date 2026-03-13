import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

interface PhilosopherUsageRow {
  philosopher_id: string;
  count?: number;
  last_post_at?: string | null;
}

interface PhilosopherUsageStats {
  posts_7d: number;
  last_post_at: string | null;
  days_since_last: number | null;
}

export async function GET() {
  try {
    const db = getDb();
    const now = Date.now();

    const activePhilosophers = db
      .prepare("SELECT id FROM philosophers WHERE is_active = 1")
      .all() as Array<{ id: string }>;

    const postsLast7Days = db
      .prepare(
        `SELECT philosopher_id, COUNT(*) as count
         FROM posts
         WHERE status IN ('published', 'draft', 'approved')
           AND created_at >= datetime('now', '-7 days')
         GROUP BY philosopher_id`
      )
      .all() as PhilosopherUsageRow[];

    const lastPostDates = db
      .prepare(
        `SELECT philosopher_id, MAX(created_at) as last_post_at
         FROM posts
         WHERE status IN ('published', 'draft', 'approved')
         GROUP BY philosopher_id`
      )
      .all() as PhilosopherUsageRow[];

    const usage: Record<string, PhilosopherUsageStats> = {};

    for (const philosopher of activePhilosophers) {
      usage[philosopher.id] = {
        posts_7d: 0,
        last_post_at: null,
        days_since_last: null,
      };
    }

    for (const row of postsLast7Days) {
      if (usage[row.philosopher_id]) {
        usage[row.philosopher_id].posts_7d = row.count ?? 0;
      }
    }

    for (const row of lastPostDates) {
      if (!usage[row.philosopher_id]) continue;

      const lastPostAt = row.last_post_at ?? null;
      const normalizedLastPostAt = lastPostAt
        ? new Date(lastPostAt.replace(" ", "T") + "Z").toISOString()
        : null;
      const daysSinceLast = normalizedLastPostAt
        ? Math.floor((now - new Date(normalizedLastPostAt).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      usage[row.philosopher_id] = {
        ...usage[row.philosopher_id],
        last_post_at: normalizedLastPostAt,
        days_since_last: daysSinceLast,
      };
    }

    return NextResponse.json({ usage });
  } catch (error) {
    console.error("Failed to fetch philosopher usage:", error);
    return NextResponse.json(
      { error: "Failed to fetch philosopher usage" },
      { status: 500 }
    );
  }
}
