import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { parseAdminJsonObject } from "@/lib/admin-request";
import { generateContent } from "@/lib/generation-service";
import { resolveContentTypeKey } from "@/lib/content-templates";

const GENERATION_STATUSES = ["generated", "approved", "rejected", "published", "pending"];

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
  try {
    const db = getDb();
    const body = await parseAdminJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: "A valid JSON object is required" }, { status: 400 });
    }
    const { philosopher_id, content_type, user_input, content_label } = body;

    if (typeof philosopher_id !== "string" || !philosopher_id.trim() || typeof content_type !== "string" || !content_type) {
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
      "recommendation",
    ];
    if (!validContentTypes.includes(content_type)) {
      return NextResponse.json(
        {
          error: `Invalid content_type. Must be one of: ${validContentTypes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (typeof user_input !== "string" || !user_input.trim()) {
      return NextResponse.json(
        { error: "user_input (source material) is required" },
        { status: 400 }
      );
    }

    // Resolve the content type key (news_reaction vs cross_philosopher_reply, etc.)
    if (content_label != null && typeof content_label !== "string") {
      return NextResponse.json({ error: "Invalid content_label" }, { status: 400 });
    }
    const contentTypeKey = resolveContentTypeKey(content_type, content_label ?? undefined);

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
      { error: "Content generation failed" },
      { status: 500 }
    );
  }
}

/** PATCH — update a generation_log entry status (approve/reject) */
export async function PATCH(request: NextRequest) {
  try {
    const db = getDb();
    const body = await parseAdminJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: "A valid JSON object is required" }, { status: 400 });
    }
    const { id, status } = body;

    if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1 || typeof status !== "string") {
      return NextResponse.json(
        { error: "id and status are required" },
        { status: 400 }
      );
    }

    if (!GENERATION_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${GENERATION_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const result = db.prepare("UPDATE generation_log SET status = ? WHERE id = ?").run(
      status,
      id
    );

    if (result.changes === 0) {
      return NextResponse.json({ error: "Generation log entry not found" }, { status: 404 });
    }

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

/**
 * DELETE — Bulk cleanup of old generation log entries.
 * Body: { action: "cleanup", older_than_days?: number, status_filter?: string }
 * Defaults: 30 days, status_filter = "rejected"
 */
export async function DELETE(request: NextRequest) {
  try {
    const db = getDb();
    const body = await parseAdminJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: "A valid JSON object is required" }, { status: 400 });
    }

    if (body.action !== "cleanup") {
      return NextResponse.json(
        { error: 'action must be "cleanup"' },
        { status: 400 }
      );
    }

    const days = body.older_than_days ?? 30;
    const statusFilter = body.status_filter ?? "rejected";

    if (typeof days !== "number" || !Number.isSafeInteger(days) || days < 1) {
      return NextResponse.json({ error: "older_than_days must be a positive integer" }, { status: 400 });
    }
    if (typeof statusFilter !== "string" || !GENERATION_STATUSES.includes(statusFilter)) {
      return NextResponse.json({ error: "Invalid status_filter" }, { status: 400 });
    }

    const result = db
      .prepare(
        `DELETE FROM generation_log
         WHERE status = ?
           AND created_at < datetime('now', '-' || ? || ' days')`
      )
      .run(statusFilter, days);

    return NextResponse.json({ deleted: result.changes });
  } catch (error) {
    console.error("Failed to clean up generation log:", error);
    return NextResponse.json(
      { error: "Failed to clean up generation log" },
      { status: 500 }
    );
  }
}
