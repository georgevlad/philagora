import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

interface CountRow {
  count: number;
}

/** POST — Approve and save a philosopher's agora response */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id: threadId } = await params;
    const body = await request.json();
    const { philosopher_id, posts, generation_log_id } = body;

    if (!philosopher_id || !Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json(
        { error: "philosopher_id and posts (array) are required" },
        { status: 400 }
      );
    }

    // Verify thread exists
    const thread = db
      .prepare("SELECT id FROM agora_threads WHERE id = ?")
      .get(threadId);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // Compute sort_order
    const existing = db
      .prepare(
        "SELECT COUNT(*) as count FROM agora_responses WHERE thread_id = ?"
      )
      .get(threadId) as CountRow;
    const sortOrder = existing.count;

    const responseId = `ar-${threadId}-${philosopher_id}-${Date.now()}`;

    db.transaction(() => {
      db.prepare(
        `INSERT INTO agora_responses (id, thread_id, philosopher_id, posts, sort_order)
         VALUES (?, ?, ?, ?, ?)`
      ).run(responseId, threadId, philosopher_id, JSON.stringify(posts), sortOrder);

      if (generation_log_id) {
        db.prepare("UPDATE generation_log SET status = 'approved' WHERE id = ?").run(
          generation_log_id
        );
      }
    })();

    const created = db
      .prepare("SELECT * FROM agora_responses WHERE id = ?")
      .get(responseId);

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to approve agora response:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to approve" },
      { status: 500 }
    );
  }
}
