import { parseAdminJsonObject } from "@/lib/admin-request";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { bustFeedCache } from "@/lib/feed-cache";
import { POST_STATUSES } from "@/lib/constants";

/**
 * PATCH — Bulk update post statuses.
 * Body: { from_status: string, to_status: string }
 * Transitions all posts matching from_status to to_status.
 */
export async function PATCH(request: NextRequest) {
  try {
    const db = getDb();
    const body = await parseAdminJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: "A valid JSON object is required" }, { status: 400 });
    }
    const { from_status, to_status } = body;

    if (!POST_STATUSES.some((status) => status === from_status) || !POST_STATUSES.some((status) => status === to_status)) {
      return NextResponse.json(
        { error: "Invalid status values" },
        { status: 400 }
      );
    }

    const result = db.prepare(
      "UPDATE posts SET status = ?, updated_at = datetime('now') WHERE status = ?"
    ).run(to_status, from_status);

    bustFeedCache();
    revalidatePath("/");

    return NextResponse.json({ updated: result.changes });
  } catch (error) {
    console.error("Failed to bulk update posts:", error);
    return NextResponse.json(
      { error: "Failed to bulk update" },
      { status: 500 }
    );
  }
}
