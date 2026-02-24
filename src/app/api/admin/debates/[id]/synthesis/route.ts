import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateSynthesis } from "@/lib/generation-service";

interface DebateRow {
  id: string;
  title: string;
  trigger_article_title: string;
  trigger_article_source: string;
}

interface DebatePostRow {
  content: string;
  phase: string;
  philosopher_name: string;
  philosopher_tradition: string;
  reply_to: string | null;
}

interface ReplyTargetRow {
  philosopher_name: string;
}

/** POST — Generate or save debate synthesis */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id: debateId } = await params;
    const body = await request.json();
    const { action, data } = body;

    if (!action || !["generate", "save"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'generate' or 'save'" },
        { status: 400 }
      );
    }

    const debate = db
      .prepare("SELECT id, title, trigger_article_title, trigger_article_source FROM debates WHERE id = ?")
      .get(debateId) as DebateRow | undefined;

    if (!debate) {
      return NextResponse.json({ error: "Debate not found" }, { status: 404 });
    }

    if (action === "generate") {
      // Fetch all debate posts with philosopher info
      const posts = db
        .prepare(
          `SELECT dp.content, dp.phase, dp.reply_to,
                  p.name as philosopher_name, p.tradition as philosopher_tradition
           FROM debate_posts dp
           JOIN philosophers p ON dp.philosopher_id = p.id
           WHERE dp.debate_id = ?
           ORDER BY dp.phase, dp.sort_order`
        )
        .all(debateId) as DebatePostRow[];

      const openings = posts.filter((p) => p.phase === "opening");
      const rebuttals = posts.filter((p) => p.phase === "rebuttal");

      // Compose source material
      let sourceMaterial = `DEBATE TOPIC: ${debate.title}\n`;
      sourceMaterial += `TRIGGER ARTICLE: ${debate.trigger_article_title} (${debate.trigger_article_source})\n\n`;

      sourceMaterial += "=== OPENING STATEMENTS ===\n\n";
      for (const post of openings) {
        sourceMaterial += `### ${post.philosopher_name} (${post.philosopher_tradition}):\n${post.content}\n\n`;
      }

      if (rebuttals.length > 0) {
        sourceMaterial += "=== REBUTTALS ===\n\n";
        for (const post of rebuttals) {
          // Find who they're rebutting
          let targetName = "";
          if (post.reply_to) {
            const target = db
              .prepare(
                `SELECT p.name as philosopher_name FROM debate_posts dp
                 JOIN philosophers p ON dp.philosopher_id = p.id
                 WHERE dp.id = ?`
              )
              .get(post.reply_to) as ReplyTargetRow | undefined;
            targetName = target ? ` (rebutting ${target.philosopher_name})` : "";
          }
          sourceMaterial += `### ${post.philosopher_name}${targetName}:\n${post.content}\n\n`;
        }
      }

      sourceMaterial += "Analyze the tensions, agreements, and unresolved questions.";

      // Generate synthesis
      const outcome = await generateSynthesis("debate_synthesis", sourceMaterial);

      // Log to generation_log with null philosopher_id
      const status = outcome.success ? "generated" : "rejected";
      const rawOutput = outcome.success
        ? JSON.stringify(outcome.data, null, 2)
        : outcome.rawOutput || outcome.error;

      const result = db
        .prepare(
          `INSERT INTO generation_log (philosopher_id, content_type, system_prompt_id, user_input, raw_output, status)
           VALUES (?, 'synthesis', ?, ?, ?, ?)`
        )
        .run(null, null, sourceMaterial, rawOutput, status);

      const logEntry = db
        .prepare("SELECT * FROM generation_log WHERE id = ?")
        .get(result.lastInsertRowid);

      if (!outcome.success) {
        return NextResponse.json(
          { error: outcome.error, log_entry: logEntry, raw_output: outcome.rawOutput },
          { status: 422 }
        );
      }

      return NextResponse.json(
        { generated: outcome.data, log_entry: logEntry, raw_output: outcome.rawOutput },
        { status: 201 }
      );
    }

    // action === "save"
    if (!data) {
      return NextResponse.json(
        { error: "data is required for save action" },
        { status: 400 }
      );
    }

    db.prepare(
      `UPDATE debates SET
        synthesis_tensions = ?,
        synthesis_agreements = ?,
        synthesis_questions = ?,
        synthesis_summary_agree = ?,
        synthesis_summary_diverge = ?,
        synthesis_summary_unresolved = ?,
        status = 'complete'
      WHERE id = ?`
    ).run(
      JSON.stringify(data.tensions || []),
      JSON.stringify(data.agreements || []),
      JSON.stringify(data.questionsForReflection || []),
      data.synthesisSummary?.agree || "",
      data.synthesisSummary?.diverge || "",
      data.synthesisSummary?.unresolvedQuestion || "",
      debateId
    );

    // Update generation_log entry if provided
    if (data.generation_log_id) {
      db.prepare("UPDATE generation_log SET status = 'approved' WHERE id = ?").run(
        data.generation_log_id
      );
    }

    const updated = db.prepare("SELECT * FROM debates WHERE id = ?").get(debateId);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Debate synthesis failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Synthesis failed" },
      { status: 500 }
    );
  }
}
