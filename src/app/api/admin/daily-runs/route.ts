import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { safeJsonParse } from "@/lib/json-utils";
import type { ReviewItem } from "@/app/admin/daily/types";

interface Run {
  id: string;
  status: string;
  config_json: string;
  article_ids_json: string;
  items_json: string;
  summary_json: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const id = request.nextUrl.searchParams.get("id");
    if (!id)
      return NextResponse.json(
        db
          .prepare(
            "SELECT id, status, created_at, updated_at FROM admin_generation_runs ORDER BY created_at DESC LIMIT 50",
          )
          .all(),
      );
    const run = db
      .prepare("SELECT * FROM admin_generation_runs WHERE id = ?")
      .get(id) as Run | undefined;
    if (!run)
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    const lookup = db.prepare(
      "SELECT content, thesis, stance, tag, status, recommendation_title, recommendation_author, recommendation_medium FROM posts WHERE id = ?",
    );
    const items = safeJsonParse<ReviewItem[]>(run.items_json, []).map(
      (item) => {
        const post = lookup.get(item.post_id) as
          | Partial<ReviewItem>
          | undefined;
        return { ...item, ...(post ?? { status: "deleted" }) };
      },
    );
    return NextResponse.json({
      id: run.id,
      status: run.status,
      config: safeJsonParse(run.config_json, {}),
      article_ids: safeJsonParse(run.article_ids_json, []),
      items,
      summary: safeJsonParse(run.summary_json, null),
      error: run.error,
      created_at: run.created_at,
      updated_at: run.updated_at,
      stalled:
        run.status === "running" &&
        Date.now() - Date.parse(run.updated_at) > 30 * 60 * 1000,
    });
  } catch (error) {
    console.error("Could not load daily runs:", error);
    return NextResponse.json(
      { error: "Could not load saved runs" },
      { status: 500 },
    );
  }
}
