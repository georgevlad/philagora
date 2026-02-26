import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { NewsSource } from "@/lib/news-scout-service";

interface SourceWithCount extends NewsSource {
  article_count: number;
}

/**
 * GET — List all sources with article counts.
 */
export async function GET() {
  try {
    const db = getDb();

    const sources = db
      .prepare(
        `SELECT ns.*,
                COUNT(ac.id) as article_count
         FROM news_sources ns
         LEFT JOIN article_candidates ac ON ns.id = ac.source_id
         GROUP BY ns.id
         ORDER BY ns.category, ns.name`
      )
      .all() as SourceWithCount[];

    return NextResponse.json(sources);
  } catch (error) {
    console.error("Failed to fetch sources:", error);
    return NextResponse.json(
      { error: "Failed to fetch sources" },
      { status: 500 }
    );
  }
}

/**
 * POST — Add a new RSS source.
 * Body: { id, name, feed_url, category }
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { id, name, feed_url, category } = body;

    if (!id || !name || !feed_url) {
      return NextResponse.json(
        { error: "id, name, and feed_url are required" },
        { status: 400 }
      );
    }

    const validCategories = [
      "world",
      "opinion",
      "entertainment",
      "sports",
      "tech",
      "culture",
    ];
    const cat = validCategories.includes(category) ? category : "world";

    db.prepare(
      "INSERT INTO news_sources (id, name, feed_url, category) VALUES (?, ?, ?, ?)"
    ).run(id, name, feed_url, cat);

    const created = db
      .prepare("SELECT * FROM news_sources WHERE id = ?")
      .get(id) as NewsSource;

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to add source:", error);
    const msg = error instanceof Error ? error.message : "Failed to add source";
    // Handle UNIQUE constraint on feed_url
    if (msg.includes("UNIQUE")) {
      return NextResponse.json(
        { error: "A source with this feed URL already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * PATCH — Toggle source active/inactive.
 * Body: { id, is_active }
 */
export async function PATCH(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { id, is_active } = body;

    if (!id || is_active === undefined) {
      return NextResponse.json(
        { error: "id and is_active are required" },
        { status: 400 }
      );
    }

    db.prepare("UPDATE news_sources SET is_active = ? WHERE id = ?").run(
      is_active ? 1 : 0,
      id
    );

    const updated = db
      .prepare("SELECT * FROM news_sources WHERE id = ?")
      .get(id) as NewsSource | undefined;

    if (!updated) {
      return NextResponse.json(
        { error: "Source not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update source:", error);
    return NextResponse.json(
      { error: "Failed to update source" },
      { status: 500 }
    );
  }
}

/**
 * DELETE — Remove a source.
 * Body: { id }
 */
export async function DELETE(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    // Delete associated candidates first (no ON DELETE CASCADE on this FK)
    db.prepare("DELETE FROM article_candidates WHERE source_id = ?").run(id);
    db.prepare("DELETE FROM news_sources WHERE id = ?").run(id);

    return NextResponse.json({ deleted: id });
  } catch (error) {
    console.error("Failed to delete source:", error);
    return NextResponse.json(
      { error: "Failed to delete source" },
      { status: 500 }
    );
  }
}
