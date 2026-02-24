import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateContent } from "@/lib/generation-service";
import { resolveContentTypeKey } from "@/lib/content-templates";

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const philosopherId = searchParams.get("philosopher_id");

    if (!philosopherId) {
      return NextResponse.json(
        { error: "philosopher_id query parameter is required" },
        { status: 400 }
      );
    }

    const entries = db
      .prepare(
        `SELECT gl.*, sp.prompt_version
         FROM generation_log gl
         LEFT JOIN system_prompts sp ON gl.system_prompt_id = sp.id
         WHERE gl.philosopher_id = ?
         ORDER BY gl.created_at DESC
         LIMIT 50`
      )
      .all(philosopherId);

    return NextResponse.json(entries);
  } catch (error) {
    console.error("Failed to fetch generation log:", error);
    return NextResponse.json(
      { error: "Failed to fetch generation log" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const db = getDb();

  try {
    const body = await request.json();
    const { philosopher_id, content_type, user_input, content_label } = body;

    if (!philosopher_id || !content_type) {
      return NextResponse.json(
        { error: "philosopher_id and content_type are required" },
        { status: 400 }
      );
    }

    const validContentTypes = [
      "post",
      "debate_opening",
      "debate_rebuttal",
      "agora_response",
      "reflection",
    ];
    if (!validContentTypes.includes(content_type)) {
      return NextResponse.json(
        {
          error: `Invalid content_type. Must be one of: ${validContentTypes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (!user_input?.trim()) {
      return NextResponse.json(
        { error: "user_input (source material) is required" },
        { status: 400 }
      );
    }

    // Resolve the content type key (news_reaction vs cross_philosopher_reply, etc.)
    const contentTypeKey = resolveContentTypeKey(content_type, content_label);

    // Call the generation service
    const outcome = await generateContent(
      philosopher_id,
      contentTypeKey,
      user_input.trim()
    );

    // Save to generation_log regardless of success/failure
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
        content_type,
        outcome.systemPromptId,
        user_input.trim(),
        rawOutput,
        status
      );

    const logEntry = db
      .prepare("SELECT * FROM generation_log WHERE id = ?")
      .get(result.lastInsertRowid);

    if (!outcome.success) {
      return NextResponse.json(
        {
          error: outcome.error,
          log_entry: logEntry,
          raw_output: outcome.rawOutput,
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        generated: outcome.data,
        log_entry: logEntry,
        raw_output: outcome.rawOutput,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Content generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}

/** PATCH — update a generation_log entry status (approve/reject) */
export async function PATCH(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: "id and status are required" },
        { status: 400 }
      );
    }

    const validStatuses = [
      "generated",
      "approved",
      "rejected",
      "published",
      "pending",
    ];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    db.prepare("UPDATE generation_log SET status = ? WHERE id = ?").run(
      status,
      id
    );

    const updated = db
      .prepare("SELECT * FROM generation_log WHERE id = ?")
      .get(id);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update generation log:", error);
    return NextResponse.json(
      { error: "Failed to update generation log entry" },
      { status: 500 }
    );
  }
}
