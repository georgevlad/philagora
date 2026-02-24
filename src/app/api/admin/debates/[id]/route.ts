import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

interface DebatePostRow {
  id: string;
  debate_id: string;
  philosopher_id: string;
  content: string;
  phase: string;
  reply_to: string | null;
  sort_order: number;
  philosopher_name: string;
  philosopher_color: string;
  philosopher_initials: string;
  philosopher_tradition: string;
}

/** GET — Fetch full debate detail */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;

    const debate = db.prepare("SELECT * FROM debates WHERE id = ?").get(id);
    if (!debate) {
      return NextResponse.json({ error: "Debate not found" }, { status: 404 });
    }

    const philosophers = db
      .prepare(
        `SELECT p.id, p.name, p.tradition, p.color, p.initials, p.bio, p.era
         FROM philosophers p
         JOIN debate_philosophers dp ON p.id = dp.philosopher_id
         WHERE dp.debate_id = ?`
      )
      .all(id);

    const posts = db
      .prepare(
        `SELECT dp.*, p.name as philosopher_name, p.color as philosopher_color,
                p.initials as philosopher_initials, p.tradition as philosopher_tradition
         FROM debate_posts dp
         JOIN philosophers p ON dp.philosopher_id = p.id
         WHERE dp.debate_id = ?
         ORDER BY dp.phase, dp.sort_order`
      )
      .all(id) as DebatePostRow[];

    // Group posts by phase
    const openings = posts.filter((p) => p.phase === "opening");
    const rebuttals = posts.filter((p) => p.phase === "rebuttal");

    return NextResponse.json({
      debate,
      philosophers,
      posts: { openings, rebuttals },
    });
  } catch (error) {
    console.error("Failed to fetch debate:", error);
    return NextResponse.json(
      { error: "Failed to fetch debate" },
      { status: 500 }
    );
  }
}

/** PATCH — Update debate status or synthesis data */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const body = await request.json();

    const debate = db.prepare("SELECT * FROM debates WHERE id = ?").get(id);
    if (!debate) {
      return NextResponse.json({ error: "Debate not found" }, { status: 404 });
    }

    // Build dynamic update
    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.status) {
      updates.push("status = ?");
      values.push(body.status);
    }
    if (body.synthesis_tensions !== undefined) {
      updates.push("synthesis_tensions = ?");
      values.push(JSON.stringify(body.synthesis_tensions));
    }
    if (body.synthesis_agreements !== undefined) {
      updates.push("synthesis_agreements = ?");
      values.push(JSON.stringify(body.synthesis_agreements));
    }
    if (body.synthesis_questions !== undefined) {
      updates.push("synthesis_questions = ?");
      values.push(JSON.stringify(body.synthesis_questions));
    }
    if (body.synthesis_summary_agree !== undefined) {
      updates.push("synthesis_summary_agree = ?");
      values.push(body.synthesis_summary_agree);
    }
    if (body.synthesis_summary_diverge !== undefined) {
      updates.push("synthesis_summary_diverge = ?");
      values.push(body.synthesis_summary_diverge);
    }
    if (body.synthesis_summary_unresolved !== undefined) {
      updates.push("synthesis_summary_unresolved = ?");
      values.push(body.synthesis_summary_unresolved);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    values.push(id);
    db.prepare(`UPDATE debates SET ${updates.join(", ")} WHERE id = ?`).run(
      ...values
    );

    const updated = db.prepare("SELECT * FROM debates WHERE id = ?").get(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update debate:", error);
    return NextResponse.json(
      { error: "Failed to update debate" },
      { status: 500 }
    );
  }
}
