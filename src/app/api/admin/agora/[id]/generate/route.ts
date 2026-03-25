import { NextRequest, NextResponse } from "next/server";
import { buildAgoraResponseSourceMaterial, parseAgoraRecommendation } from "@/lib/agora";
import { extractArticle } from "@/lib/article-extractor";
import { getAgoraResponseTemplate } from "@/lib/content-templates";
import { getDb } from "@/lib/db";
import { generateContent } from "@/lib/generation-service";

interface ThreadRow {
  id: string;
  question: string;
  asked_by: string;
  question_type?: "advice" | "conceptual" | "debate";
  recommendations_enabled?: number;
  article_url?: string | null;
  article_title?: string | null;
  article_source?: string | null;
  article_excerpt?: string | null;
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
    let articleWarning: string | null = null;
    let article:
      | {
          url: string;
          title: string;
          source: string;
          excerpt: string;
          content: string;
        }
      | null = null;

    if (thread.article_url) {
      const extraction = await extractArticle(thread.article_url);
      if (extraction.success) {
        article = {
          url: thread.article_url,
          title: extraction.title,
          source: extraction.source,
          excerpt: extraction.excerpt,
          content: extraction.content,
        };
      } else {
        articleWarning = extraction.error;
        console.warn(
          `Admin Agora: article extraction failed for ${thread.article_url}: ${extraction.error}`
        );
      }
    }
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
    const sourceMaterial = buildAgoraResponseSourceMaterial({
      question: thread.question,
      askedBy: thread.asked_by,
      questionType,
      recommendationsAppropriate: recommendationsEnabled,
      recommendationHint: null,
      alreadyRecommended,
      article,
    });

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
      {
        generated: outcome.data,
        log_entry: logEntry,
        raw_output: outcome.rawOutput,
        articleWarning: articleWarning ?? undefined,
      },
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
