import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { fetchAllFeeds, scoreUnscored } from "@/lib/news-scout-service";
import type { NewsSource } from "@/lib/news-scout-service";

/**
 * GET — Return news sources and candidate stats.
 */
export async function GET() {
  try {
    const db = getDb();

    const sources = db
      .prepare("SELECT * FROM news_sources ORDER BY category, name")
      .all() as NewsSource[];

    const stats = db
      .prepare(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new,
           SUM(CASE WHEN status = 'scored' THEN 1 ELSE 0 END) as scored,
           SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
           SUM(CASE WHEN status = 'dismissed' THEN 1 ELSE 0 END) as dismissed,
           SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) as used
         FROM article_candidates`
      )
      .get() as Record<string, number>;

    return NextResponse.json({ sources, stats });
  } catch (error) {
    console.error("Failed to fetch news scout data:", error);
    return NextResponse.json(
      { error: "Failed to fetch news scout data" },
      { status: 500 }
    );
  }
}

/**
 * POST — Trigger fetch and/or score pipeline.
 * Body: { action: 'fetch' | 'score' | 'fetch_and_score' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (!action || !["fetch", "score", "fetch_and_score"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'fetch', 'score', or 'fetch_and_score'" },
        { status: 400 }
      );
    }

    let fetchResult = undefined;
    let scoreResult = undefined;

    if (action === "fetch" || action === "fetch_and_score") {
      fetchResult = await fetchAllFeeds();
    }

    if (action === "score" || action === "fetch_and_score") {
      scoreResult = await scoreUnscored();
    }

    return NextResponse.json({ fetchResult, scoreResult }, { status: 200 });
  } catch (error) {
    console.error("News scout pipeline failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Pipeline failed" },
      { status: 500 }
    );
  }
}
