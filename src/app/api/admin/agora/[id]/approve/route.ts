import { agoraEditorialConflict, reconcileAgoraEditorialCompletion } from "@/lib/agora-jobs";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/** POST — Approve and save a philosopher's agora response */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id: threadId } = await params;
    const body = await request.json();
    const { philosopher_id, posts, generation_log_id, recommendation } = body;

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

    const conflict = agoraEditorialConflict(db, threadId, philosopher_id);
    if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });

    // Compute sort_order
    const selected = db.prepare("SELECT philosopher_id FROM agora_thread_philosophers WHERE thread_id = ? ORDER BY rowid").all(threadId) as { philosopher_id: string }[];
    const sortOrder = selected.findIndex((p) => p.philosopher_id === philosopher_id);
    if (sortOrder < 0) return NextResponse.json({ error: "Philosopher is not in this conversation" }, { status: 400 });
    if (db.prepare("SELECT 1 FROM agora_responses WHERE thread_id = ? AND philosopher_id = ?").get(threadId, philosopher_id))
      return NextResponse.json({ error: "This philosopher already has a saved response" }, { status: 409 });

    const responseId = `ar-${threadId}-${philosopher_id}-${Date.now()}`;

    const saved = db.transaction(() => {
      const conflict = agoraEditorialConflict(db, threadId, philosopher_id);
      if (conflict || db.prepare("SELECT 1 FROM agora_responses WHERE thread_id = ? AND philosopher_id = ?").get(threadId, philosopher_id)) return false;
      db.prepare(
        `INSERT INTO agora_responses (
           id,
           thread_id,
           philosopher_id,
           posts,
           sort_order,
           recommendation
         )
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        responseId,
        threadId,
        philosopher_id,
        JSON.stringify(posts),
        sortOrder,
        recommendation ? JSON.stringify(recommendation) : null
      );

      reconcileAgoraEditorialCompletion(db, threadId);
      if (generation_log_id) {
        db.prepare("UPDATE generation_log SET status = 'approved' WHERE id = ?").run(
          generation_log_id
        );
      }
      return true;
    }).immediate();
    if (!saved) return NextResponse.json({ error: "This work has already been saved or is controlled by recovery" }, { status: 409 });

    const created = db
      .prepare("SELECT * FROM agora_responses WHERE id = ?")
      .get(responseId);

    return NextResponse.json(created, { status: 201 });
  } catch {
    console.error("Failed to approve agora response");
    return NextResponse.json(
      { error: "Failed to approve" },
      { status: 500 }
    );
  }
}
