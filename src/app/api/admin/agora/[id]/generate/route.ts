import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateContent } from "@/lib/generation-service";

interface ThreadRow {
  id: string;
  question: string;
  asked_by: string;
}

/** POST — Generate an agora response for a philosopher */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id: threadId } = await params;
    const body = await request.json();
    const { philosopher_id } = body;

    if (!philosopher_id) {
      return NextResponse.json(
        { error: "philosopher_id is required" },
        { status: 400 }
      );
    }

    const thread = db
      .prepare("SELECT id, question, asked_by FROM agora_threads WHERE id = ?")
      .get(threadId) as ThreadRow | undefined;

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const sourceMaterial = `USER QUESTION:\n${thread.question}\n\nAsked by: ${thread.asked_by}\n\nRespond to this person's situation through your philosophical framework.`;

    const outcome = await generateContent(
      philosopher_id,
      "agora_response",
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
         VALUES (?, 'agora_response', ?, ?, ?, ?)`
      )
      .run(
        philosopher_id,
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
    console.error("Agora generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
