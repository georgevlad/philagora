import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { revalidatePath } from "next/cache";

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

    const validStatuses = ["draft", "approved", "published", "archived"];
    if (!validStatuses.includes(from_status) || !validStatuses.includes(to_status)) {
      return NextResponse.json(
        { error: "Invalid status values" },
        { status: 400 }
      );
    }

    const result = db.prepare(
      "UPDATE posts SET status = ?, updated_at = datetime('now') WHERE status = ?"
    ).run(to_status, from_status);

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
