import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateContent } from "@/lib/generation-service";
import type { HistoricalEventRow } from "@/lib/db-types";
import type { TargetLength } from "@/lib/content-templates";
import type { Stance } from "@/lib/types";
import { buildHistoricalEventSourceMaterial } from "@/lib/historical-events";
import { STANCE_CONFIG } from "@/lib/constants";

interface GeneratedPostPayload {
  content: string;
  thesis: string;
  stance: Stance;
  tag: string;
}

function normalizeGeneratedPost(data: Record<string, unknown>): GeneratedPostPayload | null {
  const content = typeof data.content === "string" ? data.content.trim() : "";
  if (!content) return null;

  const thesis =
    typeof data.thesis === "string" && data.thesis.trim()
      ? data.thesis.trim()
      : content.split("\n")[0]?.trim().slice(0, 140) ?? "";
  const stance =
    typeof data.stance === "string" && data.stance in STANCE_CONFIG
      ? (data.stance as Stance)
      : "observes";
  const tag =
    typeof data.tag === "string" && data.tag.trim() ? data.tag.trim() : "Historical Reaction";

  return {
    content,
    thesis,
    stance,
    tag,
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      philosopher_id?: string;
      target_length?: TargetLength;
    };

    if (!body.philosopher_id) {
      return NextResponse.json({ error: "philosopher_id is required" }, { status: 400 });
    }

    const targetLength = body.target_length ?? "medium";
    if (!["short", "medium", "long"].includes(targetLength)) {
      return NextResponse.json(
        { error: "target_length must be short, medium, or long" },
        { status: 400 }
      );
    }

    const db = getDb();
    const event = db
      .prepare("SELECT * FROM historical_events WHERE id = ?")
      .get(id) as HistoricalEventRow | undefined;

    if (!event) {
      return NextResponse.json({ error: "Historical event not found" }, { status: 404 });
    }

    const philosopher = db
      .prepare("SELECT id, name FROM philosophers WHERE id = ?")
      .get(body.philosopher_id) as { id: string; name: string } | undefined;

    if (!philosopher) {
      return NextResponse.json({ error: "Philosopher not found" }, { status: 404 });
    }

    const sourceMaterial = buildHistoricalEventSourceMaterial(event);
    const outcome = await generateContent(
      philosopher.id,
      "historical_reaction",
      sourceMaterial,
      targetLength
    );

    const insertLog = db.prepare(
      `INSERT INTO generation_log (philosopher_id, content_type, system_prompt_id, user_input, raw_output, status)
       VALUES (?, 'post', ?, ?, ?, ?)`
    );

    if (!outcome.success) {
      const result = insertLog.run(
        philosopher.id,
        outcome.systemPromptId,
        sourceMaterial,
        outcome.rawOutput || outcome.error,
        "rejected"
      );

      return NextResponse.json(
        {
          error: outcome.error,
          generation_log_id: Number(result.lastInsertRowid),
          raw_output: outcome.rawOutput,
        },
        { status: 422 }
      );
    }

    const normalized = normalizeGeneratedPost(outcome.data);
    if (!normalized) {
      const result = insertLog.run(
        philosopher.id,
        outcome.systemPromptId,
        sourceMaterial,
        JSON.stringify(outcome.data, null, 2),
        "rejected"
      );

      return NextResponse.json(
        {
          error: "Generation returned malformed content.",
          generation_log_id: Number(result.lastInsertRowid),
          raw_output: outcome.rawOutput,
        },
        { status: 422 }
      );
    }

    const postId = `post-gen-${crypto.randomUUID()}`;
    const logId = db.transaction(() => {
      const logResult = insertLog.run(
        philosopher.id,
        outcome.systemPromptId,
        sourceMaterial,
        JSON.stringify(outcome.data, null, 2),
        "generated"
      );

      db.prepare(
        `INSERT INTO posts (
          id, philosopher_id, content, thesis, stance, tag, source_type, historical_event_id,
          citation_title, citation_source, citation_url, citation_image_url,
          reply_to, likes, replies, bookmarks, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'historical_event', ?, ?, ?, NULL, NULL, NULL, 0, 0, 0, 'draft', datetime('now'), datetime('now'))`
      ).run(
        postId,
        philosopher.id,
        normalized.content,
        normalized.thesis,
        normalized.stance,
        normalized.tag,
        event.id,
        event.title,
        `Today in History, ${event.display_date}`
      );

      if (event.status === "ready") {
        db.prepare(
          "UPDATE historical_events SET status = 'used', updated_at = datetime('now') WHERE id = ?"
        ).run(event.id);
      }

      return Number(logResult.lastInsertRowid);
    })();

    return NextResponse.json(
      {
        generated: normalized,
        post_id: postId,
        generation_log_id: logId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to generate historical reaction:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate historical reaction",
      },
      { status: 500 }
    );
  }
}
