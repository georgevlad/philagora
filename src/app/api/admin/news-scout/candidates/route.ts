import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { ArticleCandidate } from "@/lib/news-scout-service";

/**
 * GET — Return scored candidates with optional filters.
 * Query params: status (default 'scored'), category, min_score, limit (default 30)
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status") || "scored";
    const category = searchParams.get("category");
    const minScore = searchParams.get("min_score");
    const limit = parseInt(searchParams.get("limit") || "30", 10);

    let query = `
      SELECT ac.*, ns.name as source_name, ns.category as source_category, ns.logo_url as source_logo_url
      FROM article_candidates ac
      JOIN news_sources ns ON ac.source_id = ns.id
    `;
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (status && status !== "all") {
      conditions.push("ac.status = ?");
      params.push(status);
    }

    if (category && category !== "all") {
      conditions.push("ns.category = ?");
      params.push(category);
    }

    if (minScore) {
      conditions.push("ac.score >= ?");
      params.push(parseInt(minScore, 10));
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY ac.score DESC, ac.fetched_at DESC LIMIT ?";
    params.push(limit);

    const candidates = db.prepare(query).all(...params) as ArticleCandidate[];

    return NextResponse.json(candidates);
  } catch (error) {
    console.error("Failed to fetch candidates:", error);
    return NextResponse.json(
      { error: "Failed to fetch candidates" },
      { status: 500 }
    );
  }
}

/**
 * PATCH — Update candidate status (approve/dismiss).
 * Body: { id: string, status: 'approved' | 'dismissed' }
 */
export async function PATCH(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: "id and status are required" },
        { status: 400 }
      );
    }

    const validStatuses = ["approved", "dismissed", "scored", "used"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    db.prepare("UPDATE article_candidates SET status = ? WHERE id = ?").run(
      status,
      id
    );

    const updated = db
      .prepare(
        `SELECT ac.*, ns.name as source_name, ns.category as source_category, ns.logo_url as source_logo_url
         FROM article_candidates ac
         JOIN news_sources ns ON ac.source_id = ns.id
         WHERE ac.id = ?`
      )
      .get(id) as ArticleCandidate | undefined;

    if (!updated) {
      return NextResponse.json(
        { error: "Candidate not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update candidate:", error);
    return NextResponse.json(
      { error: "Failed to update candidate" },
      { status: 500 }
    );
  }
}
