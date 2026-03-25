import { NextRequest, NextResponse } from "next/server";
import { parseAgoraRecommendation } from "@/lib/agora";
import { getAgoraResponseTemplate } from "@/lib/content-templates";
import { getDb } from "@/lib/db";
import { generateContent } from "@/lib/generation-service";

interface ThreadRow {
  id: string;
  question: string;
  asked_by: string;
  question_type?: "advice" | "conceptual" | "debate";
  recommendations_enabled?: number;
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
      .prepare(
        `SELECT id, question, asked_by, question_type, recommendations_enabled
         FROM agora_threads
         WHERE id = ?`
      )
      .get(threadId) as ThreadRow | undefined;

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const questionType = thread.question_type ?? "advice";
    const recommendationsEnabled = thread.recommendations_enabled === 1;
    const existingRecs = recommendationsEnabled
      ? (db
          .prepare(
            `SELECT ar.recommendation, p.name
             FROM agora_responses ar
             JOIN philosophers p ON ar.philosopher_id = p.id
             WHERE ar.thread_id = ? AND ar.recommendation IS NOT NULL`
          )
          .all(threadId) as Array<{ recommendation: string; name: string }>)
      : [];
    const alreadyRecommended = existingRecs.flatMap((row) => {
      const recommendation = parseAgoraRecommendation(row.recommendation);
      if (!recommendation) {
        return [];
      }

      return [`"${recommendation.title}" (${recommendation.medium}) - recommended by ${row.name}`];
    });
    const template = getAgoraResponseTemplate(
      questionType,
      recommendationsEnabled,
      undefined,
      alreadyRecommended
    );
    const sourceMaterial = `USER QUESTION:\n${thread.question}

Asked by: ${thread.asked_by}

CLASSIFICATION:
- Question type: ${questionType}
- Recommendations appropriate: ${recommendationsEnabled ? "yes" : "no"}
- Recommendation hint: none

Respond to this person's situation through your philosophical framework.`;

    const outcome = await generateContent(
      philosopher_id,
      "agora_response",
      sourceMaterial,
      undefined,
      template
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
