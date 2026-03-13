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

    // Batch-fetch post usage data for returned candidates
    const urls = candidates.map((c) => c.url).filter(Boolean);
    let usageMap: Record<
      string,
      Array<{ philosopher_id: string; status: string; post_id: string }>
    > = {};

    if (urls.length > 0) {
      const placeholders = urls.map(() => "?").join(",");
      const posts = db
        .prepare(
          `SELECT citation_url, philosopher_id, status, id as post_id
           FROM posts
           WHERE citation_url IN (${placeholders})
             AND status IN ('draft', 'approved', 'published')`
        )
        .all(...urls) as Array<{
        citation_url: string;
        philosopher_id: string;
        status: string;
        post_id: string;
      }>;

      for (const post of posts) {
        if (!usageMap[post.citation_url]) usageMap[post.citation_url] = [];
        usageMap[post.citation_url].push(post);
      }
    }

    const enriched = candidates.map((c) => ({
      ...c,
      published_posts: usageMap[c.url] || [],
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("Failed to fetch candidates:", error);
    return NextResponse.json(
      { error: "Failed to fetch candidates" },
      { status: 500 }
    );
  }
}

/**
 * PATCH — Update candidate status (single or bulk).
 * Body: { id: string, status: 'approved' | 'dismissed' | 'scored' | 'used' }
 *    or { ids: string[], status: 'approved' | 'dismissed' | 'scored' | 'used' }
 */
export async function PATCH(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { id, ids, status } = body as {
      id?: string;
      ids?: string[];
      status?: string;
    };

    const targetIds = Array.isArray(ids)
      ? ids.filter((candidateId): candidateId is string => typeof candidateId === "string" && candidateId.length > 0)
      : id
      ? [id]
      : [];

    if (targetIds.length === 0 || !status) {
      return NextResponse.json(
        { error: "id or ids, plus status, are required" },
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

    if (targetIds.length > 1) {
      const placeholders = targetIds.map(() => "?").join(",");
      db.prepare(
        `UPDATE article_candidates
         SET status = ?
         WHERE id IN (${placeholders})`
      ).run(status, ...targetIds);

      return NextResponse.json({ updated: targetIds.length, ids: targetIds, status });
    }

    db.prepare("UPDATE article_candidates SET status = ? WHERE id = ?").run(
      status,
      targetIds[0]
    );

    const updated = db
      .prepare(
        `SELECT ac.*, ns.name as source_name, ns.category as source_category, ns.logo_url as source_logo_url
         FROM article_candidates ac
         JOIN news_sources ns ON ac.source_id = ns.id
         WHERE ac.id = ?`
      )
      .get(targetIds[0]) as ArticleCandidate | undefined;

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

/**
 * DELETE — Remove article candidates.
 * Single: { id } — delete one candidate by id
 * Bulk:   { action: "cleanup", older_than_days?: number } — delete dismissed/new candidates older than N days
 */
export async function DELETE(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    if (body.action === "cleanup") {
      const days = body.older_than_days ?? 30;
      const result = db
        .prepare(
          `DELETE FROM article_candidates
           WHERE status IN ('dismissed', 'new')
             AND fetched_at < datetime('now', '-' || ? || ' days')`
        )
        .run(days);

      return NextResponse.json({ deleted: result.changes });
    }

    if (body.action === "clear_all") {
      const result = db
        .prepare("DELETE FROM article_candidates")
        .run();

      return NextResponse.json({ deleted: result.changes });
    }

    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const existing = db
      .prepare("SELECT id FROM article_candidates WHERE id = ?")
      .get(id);

    if (!existing) {
      return NextResponse.json(
        { error: "Candidate not found" },
        { status: 404 }
      );
    }

    db.prepare("DELETE FROM article_candidates WHERE id = ?").run(id);

    return NextResponse.json({ deleted: id });
  } catch (error) {
    console.error("Failed to delete candidate:", error);
    return NextResponse.json(
      { error: "Failed to delete candidate" },
      { status: 500 }
    );
  }
}
