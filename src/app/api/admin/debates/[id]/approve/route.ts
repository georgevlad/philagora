import { parseAdminJsonObject } from "@/lib/admin-request";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

interface CountRow {
  count: number;
}

interface DebatePostRow {
  id: string;
}

/** POST — Approve and save generated content to debate_posts */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id: debateId } = await params;
    const body = await parseAdminJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
    }
    const { philosopher_id, phase, content, generation_log_id, target_philosopher_id } = body;

    if (typeof philosopher_id !== "string" || !philosopher_id.trim() || typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "philosopher_id, phase, and content are required" },
        { status: 400 }
      );
    }

    if (phase !== "opening" && phase !== "rebuttal") {
      return NextResponse.json({ error: "phase must be 'opening' or 'rebuttal'" }, { status: 400 });
    }

    // Verify debate exists
    const debate = db.prepare("SELECT id FROM debates WHERE id = ?").get(debateId);
    if (!debate) {
      return NextResponse.json({ error: "Debate not found" }, { status: 404 });
    }

    if (!db.prepare("SELECT 1 FROM debate_philosophers WHERE debate_id = ? AND philosopher_id = ?").get(debateId, philosopher_id)) {
      return NextResponse.json({ error: "Philosopher is not in this debate" }, { status: 400 });
    }

    // Compute sort_order
    const existing = db
      .prepare(
        "SELECT COUNT(*) as count FROM debate_posts WHERE debate_id = ? AND phase = ?"
      )
      .get(debateId, phase) as CountRow;
    const sortOrder = existing.count;

    // For rebuttals, find the target philosopher's opening post for reply_to
    let replyTo: string | null = null;
    if (phase === "rebuttal") {
      if (typeof target_philosopher_id !== "string" || !target_philosopher_id.trim()) {
        return NextResponse.json({ error: "target_philosopher_id is required for rebuttals" }, { status: 400 });
      }
      const targetPost = db
        .prepare(
          "SELECT id FROM debate_posts WHERE debate_id = ? AND philosopher_id = ? AND phase = 'opening' LIMIT 1"
        )
        .get(debateId, target_philosopher_id) as DebatePostRow | undefined;
      if (!targetPost) {
        return NextResponse.json({ error: "Target philosopher's opening statement not found" }, { status: 404 });
      }
      replyTo = targetPost.id;
    }

    const postId = `dp-${debateId}-${philosopher_id}-${phase}-${Date.now()}`;

    db.transaction(() => {
      db.prepare(
        `INSERT INTO debate_posts (id, debate_id, philosopher_id, content, phase, reply_to, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(postId, debateId, philosopher_id, content, phase, replyTo, sortOrder);

      // Update generation_log entry status
      if (generation_log_id) {
        db.prepare("UPDATE generation_log SET status = 'approved' WHERE id = ?").run(
          generation_log_id
        );
      }
    })();

    const created = db
      .prepare("SELECT * FROM debate_posts WHERE id = ?")
      .get(postId);

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to approve debate post:", error);
    return NextResponse.json(
      { error: "Failed to approve" },
      { status: 500 }
    );
  }
}
