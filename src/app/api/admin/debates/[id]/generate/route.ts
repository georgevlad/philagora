import { parseAdminJsonObject } from "@/lib/admin-request";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateContent } from "@/lib/generation-service";

interface DebateRow {
  id: string;
  title: string;
  trigger_article_title: string | null;
  trigger_article_source: string | null;
  trigger_article_url: string | null;
  editorial_context: string | null;
}

interface DebatePostRow {
  id: string;
  content: string;
  philosopher_id: string;
}

interface PhilosopherRow {
  name: string;
}

/** POST — Generate debate content for a philosopher + phase */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const body = await parseAdminJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
    }
    const { philosopher_id, phase, target_philosopher_id } = body;

    if (typeof philosopher_id !== "string" || !philosopher_id.trim() || !phase) {
      return NextResponse.json(
        { error: "philosopher_id and phase are required" },
        { status: 400 }
      );
    }

    if (phase !== "opening" && phase !== "rebuttal") {
      return NextResponse.json(
        { error: "phase must be 'opening' or 'rebuttal'" },
        { status: 400 }
      );
    }

    // Fetch debate
    const debate = db
      .prepare(
        `SELECT id, title, trigger_article_title, trigger_article_source,
                trigger_article_url, editorial_context
         FROM debates
         WHERE id = ?`
      )
      .get(id) as DebateRow | undefined;

    if (!debate) {
      return NextResponse.json({ error: "Debate not found" }, { status: 404 });
    }

    if (!db.prepare("SELECT 1 FROM debate_philosophers WHERE debate_id = ? AND philosopher_id = ?").get(id, philosopher_id)) {
      return NextResponse.json({ error: "Philosopher is not in this debate" }, { status: 400 });
    }

    let sourceMaterial: string;
    let contentTypeKey: "debate_opening" | "debate_rebuttal";

    const participants = db.prepare(`SELECT p.name FROM debate_philosophers dp
      JOIN philosophers p ON p.id = dp.philosopher_id WHERE dp.debate_id = ? ORDER BY p.name`)
      .all(id) as { name: string }[];
    const debateContext = [
      `DEBATE TOPIC: ${debate.title}`,
      `PARTICIPANTS: ${participants.map(p => p.name).join(", ")}`,
      debate.editorial_context?.trim() ? `EDITORIAL CONTEXT:\n${debate.editorial_context.trim()}` : "",
      debate.trigger_article_title ? `TRIGGER ARTICLE TITLE: ${debate.trigger_article_title}` : "",
      debate.trigger_article_source ? `TRIGGER SOURCE: ${debate.trigger_article_source}` : "",
      debate.trigger_article_url ? `TRIGGER URL (not retrieved): ${debate.trigger_article_url}` : "",
    ].filter(Boolean).join("\n\n");

    if (phase === "opening") {
      contentTypeKey = "debate_opening";
      sourceMaterial = `${debateContext}\n\nPresent your opening position.`;
    } else {
      // rebuttal
      contentTypeKey = "debate_rebuttal";

      if (typeof target_philosopher_id !== "string" || !target_philosopher_id.trim()) {
        return NextResponse.json(
          { error: "target_philosopher_id is required for rebuttals" },
          { status: 400 }
        );
      }

      // Fetch target philosopher's opening
      const targetOpening = db
        .prepare(
          "SELECT id, content, philosopher_id FROM debate_posts WHERE debate_id = ? AND philosopher_id = ? AND phase = 'opening' LIMIT 1"
        )
        .get(id, target_philosopher_id) as DebatePostRow | undefined;

      if (!targetOpening) {
        return NextResponse.json(
          { error: "Target philosopher's opening statement not found" },
          { status: 404 }
        );
      }

      const targetPhilosopher = db
        .prepare("SELECT name FROM philosophers WHERE id = ?")
        .get(target_philosopher_id) as PhilosopherRow | undefined;

      const ownOpening = db.prepare("SELECT content FROM debate_posts WHERE debate_id = ? AND philosopher_id = ? AND phase = 'opening' ORDER BY sort_order LIMIT 1")
        .get(id, philosopher_id) as { content: string } | undefined;
      const exchange = db.prepare(`SELECT p.name, dp.content FROM debate_posts dp
        JOIN philosophers p ON p.id = dp.philosopher_id
        WHERE dp.debate_id = ? AND dp.phase = 'rebuttal' ORDER BY dp.sort_order DESC LIMIT ?`)
        .all(id, 4) as { name: string; content: string }[];
      sourceMaterial = [debateContext,
        ownOpening ? `YOUR OWN OPENING:\n${ownOpening.content}` : "YOUR OWN OPENING: none supplied; do not invent a prior position.",
        `YOU ARE REBUTTING:\nPhilosopher: ${targetPhilosopher?.name ?? target_philosopher_id}\nTheir opening statement:\n${targetOpening.content}`,
        exchange.length ? `RECENT EXCHANGE (reference material):\n${JSON.stringify(exchange.reverse())}` : "",
        "Respond to their specific claims and advance the exchange.",
      ].filter(Boolean).join("\n\n");
    }

    // Generate content
    const outcome = await generateContent(
      philosopher_id,
      contentTypeKey,
      sourceMaterial
    );

    // Log to generation_log
    const status = outcome.success ? "generated" : "rejected";
    const rawOutput = outcome.success
      ? JSON.stringify(outcome.data, null, 2)
      : outcome.rawOutput || outcome.error;

    const result = db
      .prepare(
        `INSERT INTO generation_log (philosopher_id, content_type, system_prompt_id, user_input, raw_output, status)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        philosopher_id,
        contentTypeKey,
        outcome.systemPromptId,
        sourceMaterial,
        rawOutput,
        status
      );

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
  } catch (error) {
    console.error("Debate generation failed:", error);
    return NextResponse.json(
      { error: "Generation failed" },
      { status: 500 }
    );
  }
}
