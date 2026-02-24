import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateContent } from "@/lib/generation-service";

interface DebateRow {
  id: string;
  title: string;
  trigger_article_title: string;
  trigger_article_source: string;
  trigger_article_url: string | null;
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
    const body = await request.json();
    const { philosopher_id, phase, target_philosopher_id } = body;

    if (!philosopher_id || !phase) {
      return NextResponse.json(
        { error: "philosopher_id and phase are required" },
        { status: 400 }
      );
    }

    if (!["opening", "rebuttal"].includes(phase)) {
      return NextResponse.json(
        { error: "phase must be 'opening' or 'rebuttal'" },
        { status: 400 }
      );
    }

    // Fetch debate
    const debate = db
      .prepare("SELECT id, title, trigger_article_title, trigger_article_source, trigger_article_url FROM debates WHERE id = ?")
      .get(id) as DebateRow | undefined;

    if (!debate) {
      return NextResponse.json({ error: "Debate not found" }, { status: 404 });
    }

    let sourceMaterial: string;
    let contentTypeKey: "debate_opening" | "debate_rebuttal";

    if (phase === "opening") {
      contentTypeKey = "debate_opening";
      sourceMaterial = `DEBATE TOPIC: ${debate.title}\n\nTRIGGER ARTICLE:\nTitle: ${debate.trigger_article_title}\nSource: ${debate.trigger_article_source}`;
      if (debate.trigger_article_url) {
        sourceMaterial += `\nURL: ${debate.trigger_article_url}`;
      }
      sourceMaterial += "\n\nPresent your opening position.";
    } else {
      // rebuttal
      contentTypeKey = "debate_rebuttal";

      if (!target_philosopher_id) {
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

      sourceMaterial = `DEBATE TOPIC: ${debate.title}\n\nYOU ARE REBUTTING:\nPhilosopher: ${targetPhilosopher?.name ?? target_philosopher_id}\nTheir opening statement:\n${targetOpening.content}\n\nRespond to their specific claims.`;
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
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
