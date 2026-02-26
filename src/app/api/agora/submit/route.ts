import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateContent, generateSynthesis } from "@/lib/generation-service";
import crypto from "crypto";

interface CountRow {
  count: number;
}

interface PhilosopherCheck {
  id: string;
}

interface ResponseRow {
  posts: string; // JSON string
  name: string;
  tradition: string;
}

/** POST /api/agora/submit — Submit a question to the Agora */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    const question = (body.question ?? "").trim();
    const askedBy = (body.asked_by ?? "").trim() || "Anonymous";
    const philosopherIds: unknown = body.philosopher_ids;

    // ── Validation ────────────────────────────────────────────────────

    if (question.length < 10 || question.length > 500) {
      return NextResponse.json(
        { error: "Question must be between 10 and 500 characters" },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(philosopherIds) ||
      philosopherIds.length < 2 ||
      philosopherIds.length > 4
    ) {
      return NextResponse.json(
        { error: "Must include 2 to 4 philosopher IDs" },
        { status: 400 }
      );
    }

    // Verify each philosopher ID exists
    const checkPhilosopher = db.prepare(
      "SELECT id FROM philosophers WHERE id = ?"
    );
    for (const pid of philosopherIds) {
      if (typeof pid !== "string") {
        return NextResponse.json(
          { error: "Each philosopher_id must be a string" },
          { status: 400 }
        );
      }
      const found = checkPhilosopher.get(pid) as PhilosopherCheck | undefined;
      if (!found) {
        return NextResponse.json(
          { error: `Philosopher not found: ${pid}` },
          { status: 400 }
        );
      }
    }

    // ── Rate limit ────────────────────────────────────────────────────

    const todayCount = db
      .prepare(
        "SELECT COUNT(*) as count FROM agora_threads WHERE created_at >= date('now')"
      )
      .get() as CountRow;

    if (todayCount.count >= 10) {
      return NextResponse.json(
        { error: "The philosophers are resting. Check back tomorrow." },
        { status: 429 }
      );
    }

    // ── Create thread ─────────────────────────────────────────────────

    const threadId = crypto.randomUUID();
    const validPids = philosopherIds as string[];

    db.transaction(() => {
      db.prepare(
        `INSERT INTO agora_threads (id, question, asked_by, status)
         VALUES (?, ?, ?, 'in_progress')`
      ).run(threadId, question, askedBy);

      const insertPhilosopher = db.prepare(
        "INSERT INTO agora_thread_philosophers (thread_id, philosopher_id) VALUES (?, ?)"
      );
      for (const pid of validPids) {
        insertPhilosopher.run(threadId, pid);
      }
    })();

    // ── Fire-and-forget generation ────────────────────────────────────

    runGeneration(threadId, question, askedBy, validPids);

    return NextResponse.json({ threadId }, { status: 201 });
  } catch (error) {
    console.error("Failed to submit agora question:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to submit question",
      },
      { status: 500 }
    );
  }
}

// ── Background generation (not awaited) ───────────────────────────────

async function runGeneration(
  threadId: string,
  question: string,
  askedBy: string,
  philosopherIds: string[]
): Promise<void> {
  try {
    const db = getDb();

    // 1. Generate each philosopher's response sequentially (with one retry)
    for (let i = 0; i < philosopherIds.length; i++) {
      const pid = philosopherIds[i];
      const sourceMaterial = `USER QUESTION:\n${question}\n\nAsked by: ${askedBy}\n\nRespond to this person's situation through your philosophical framework.`;
      const maxAttempts = 2;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const outcome = await generateContent(
            pid,
            "agora_response",
            sourceMaterial
          );

          // Log to generation_log
          const logStatus = outcome.success ? "generated" : "rejected";
          const rawOutput = outcome.success
            ? JSON.stringify(outcome.data, null, 2)
            : outcome.rawOutput || outcome.error;

          db.prepare(
            `INSERT INTO generation_log (philosopher_id, content_type, system_prompt_id, user_input, raw_output, status)
             VALUES (?, 'agora_response', ?, ?, ?, ?)`
          ).run(pid, outcome.systemPromptId, sourceMaterial, rawOutput, logStatus);

          if (outcome.success) {
            const responseId = crypto.randomUUID();
            const posts = (outcome.data as { posts: string[] }).posts;

            db.prepare(
              `INSERT INTO agora_responses (id, thread_id, philosopher_id, posts, sort_order)
               VALUES (?, ?, ?, ?, ?)`
            ).run(
              responseId,
              threadId,
              pid,
              JSON.stringify(posts),
              i
            );
            break; // Success — move to next philosopher
          }

          // Failed — retry if we have attempts left
          if (attempt < maxAttempts) {
            console.warn(
              `Agora: retrying ${pid} (attempt ${attempt} failed)`
            );
            continue;
          }
          // Exhausted retries — move to next philosopher
        } catch (err) {
          console.error(
            `Agora generation failed for philosopher ${pid} (attempt ${attempt}):`,
            err
          );
          if (attempt >= maxAttempts) break; // Exhausted retries
        }
      }
    }

    // 2. Generate synthesis from all completed responses
    try {
      const responses = db
        .prepare(
          `SELECT ar.posts, p.name, p.tradition
           FROM agora_responses ar
           JOIN philosophers p ON ar.philosopher_id = p.id
           WHERE ar.thread_id = ?
           ORDER BY ar.sort_order`
        )
        .all(threadId) as ResponseRow[];

      if (responses.length > 0) {
        let sourceMaterial = `USER QUESTION: ${question}\n`;
        sourceMaterial += `Asked by: ${askedBy}\n\n`;
        sourceMaterial += "=== PHILOSOPHER RESPONSES ===\n\n";

        for (const resp of responses) {
          const posts = JSON.parse(resp.posts) as string[];
          sourceMaterial += `### ${resp.name} (${resp.tradition}):\n`;
          posts.forEach((post, idx) => {
            if (posts.length > 1) {
              sourceMaterial += `Response ${idx + 1}: ${post}\n\n`;
            } else {
              sourceMaterial += `${post}\n\n`;
            }
          });
        }

        sourceMaterial +=
          "Analyze the tensions, agreements, and practical takeaways.";

        const outcome = await generateSynthesis(
          "agora_synthesis",
          sourceMaterial
        );

        // Log synthesis to generation_log
        const status = outcome.success ? "generated" : "rejected";
        const rawOutput = outcome.success
          ? JSON.stringify(outcome.data, null, 2)
          : outcome.rawOutput || outcome.error;

        db.prepare(
          `INSERT INTO generation_log (philosopher_id, content_type, system_prompt_id, user_input, raw_output, status)
           VALUES (?, 'synthesis', ?, ?, ?, ?)`
        ).run(null, null, sourceMaterial, rawOutput, status);

        if (outcome.success) {
          const data = outcome.data as {
            tensions?: string[];
            agreements?: string[];
            practicalTakeaways?: string[];
          };

          db.prepare(
            `INSERT INTO agora_synthesis (thread_id, tensions, agreements, practical_takeaways)
             VALUES (?, ?, ?, ?)`
          ).run(
            threadId,
            JSON.stringify(data.tensions ?? []),
            JSON.stringify(data.agreements ?? []),
            JSON.stringify(data.practicalTakeaways ?? [])
          );
        }
      }
    } catch (err) {
      console.error("Agora synthesis generation failed:", err);
    }

    // 3. Always mark the thread as complete
    db.prepare(
      "UPDATE agora_threads SET status = 'complete' WHERE id = ?"
    ).run(threadId);
  } catch (err) {
    console.error("Agora background generation crashed:", err);
    // Still try to mark as complete so the thread isn't stuck
    try {
      const db = getDb();
      db.prepare(
        "UPDATE agora_threads SET status = 'complete' WHERE id = ?"
      ).run(threadId);
    } catch {
      // Nothing more we can do
    }
  }
}
