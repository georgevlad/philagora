import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { NewsSource } from "@/lib/news-scout-service";

interface SourceWithCount extends NewsSource {
  article_count: number;
}

const VALID_CATEGORIES = [
  "world",
  "politics",
  "science",
  "ideas",
  "opinion",
  "entertainment",
  "sports",
  "tech",
  "culture",
];

/**
 * GET - List all sources with article counts.
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
 * POST - Add a new RSS source.
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

    const cat = VALID_CATEGORIES.includes(category) ? category : "world";

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
 * PATCH - Update source category and/or active state.
 * Body: { id, is_active?, category? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { id, is_active, category } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    if (is_active === undefined && category === undefined) {
      return NextResponse.json(
        { error: "Provide is_active and/or category" },
        { status: 400 }
      );
    }

    const fields: string[] = [];
    const values: Array<string | number> = [];

    if (is_active !== undefined) {
      fields.push("is_active = ?");
      values.push(is_active ? 1 : 0);
    }

    if (category !== undefined) {
      if (!VALID_CATEGORIES.includes(category)) {
        return NextResponse.json(
          { error: "Invalid category" },
          { status: 400 }
        );
      }

      fields.push("category = ?");
      values.push(category);
    }

    db.prepare(`UPDATE news_sources SET ${fields.join(", ")} WHERE id = ?`).run(
      ...values,
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
 * DELETE - Remove a source.
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
