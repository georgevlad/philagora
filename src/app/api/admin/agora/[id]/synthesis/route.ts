import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateSynthesis } from "@/lib/generation-service";

interface ThreadRow {
  id: string;
  question: string;
  asked_by: string;
}

interface ResponseRow {
  posts: string; // JSON array
  philosopher_name: string;
  philosopher_tradition: string;
}

/** POST — Generate or save agora synthesis */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id: threadId } = await params;
    const body = await request.json();
    const { action, data } = body;

    if (!action || !["generate", "save"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'generate' or 'save'" },
        { status: 400 }
      );
    }

    const thread = db
      .prepare("SELECT id, question, asked_by FROM agora_threads WHERE id = ?")
      .get(threadId) as ThreadRow | undefined;

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    if (action === "generate") {
      // Fetch all responses with philosopher info
      const responses = db
        .prepare(
          `SELECT ar.posts, p.name as philosopher_name, p.tradition as philosopher_tradition
           FROM agora_responses ar
           JOIN philosophers p ON ar.philosopher_id = p.id
           WHERE ar.thread_id = ?
           ORDER BY ar.sort_order`
        )
        .all(threadId) as ResponseRow[];

      // Compose source material
      let sourceMaterial = `USER QUESTION: ${thread.question}\n`;
      sourceMaterial += `Asked by: ${thread.asked_by}\n\n`;
      sourceMaterial += "=== PHILOSOPHER RESPONSES ===\n\n";

      for (const resp of responses) {
        const posts = JSON.parse(resp.posts) as string[];
        sourceMaterial += `### ${resp.philosopher_name} (${resp.philosopher_tradition}):\n`;
        posts.forEach((post, i) => {
          if (posts.length > 1) {
            sourceMaterial += `Response ${i + 1}: ${post}\n\n`;
          } else {
            sourceMaterial += `${post}\n\n`;
          }
        });
      }

      sourceMaterial += "Analyze the tensions, agreements, and practical takeaways.";

      // Generate synthesis
      const outcome = await generateSynthesis("agora_synthesis", sourceMaterial);

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

    db.transaction(() => {
      // Upsert agora_synthesis
      db.prepare(
        `INSERT INTO agora_synthesis (thread_id, tensions, agreements, practical_takeaways)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(thread_id) DO UPDATE SET
           tensions = excluded.tensions,
           agreements = excluded.agreements,
           practical_takeaways = excluded.practical_takeaways`
      ).run(
        threadId,
        JSON.stringify(data.tensions || []),
        JSON.stringify(data.agreements || []),
        JSON.stringify(data.practicalTakeaways || [])
      );

      // Mark thread as complete
      db.prepare("UPDATE agora_threads SET status = 'complete' WHERE id = ?").run(
        threadId
      );

      // Update generation_log entry if provided
      if (data.generation_log_id) {
        db.prepare("UPDATE generation_log SET status = 'approved' WHERE id = ?").run(
          data.generation_log_id
        );
      }
    })();

    const updated = db
      .prepare("SELECT * FROM agora_threads WHERE id = ?")
      .get(threadId);
    const synthesis = db
      .prepare("SELECT * FROM agora_synthesis WHERE thread_id = ?")
      .get(threadId);

    return NextResponse.json({ thread: updated, synthesis });
  } catch (error) {
    console.error("Agora synthesis failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Synthesis failed" },
      { status: 500 }
    );
  }
}
