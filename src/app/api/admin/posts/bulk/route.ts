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
    const body = await request.json();
    const { from_status, to_status } = body;

    if (!POST_STATUSES.includes(from_status) || !POST_STATUSES.includes(to_status)) {
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
