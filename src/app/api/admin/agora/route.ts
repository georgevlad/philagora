import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { buildAgoraClassificationInput } from "@/lib/agora";
import {
  extractArticle,
  getArticleSourceFromUrl,
  normalizeArticleUrl,
  type ExtractedArticle,
} from "@/lib/article-extractor";
import { getDb } from "@/lib/db";
import { parseGroupConcat } from "@/lib/db-utils";
import {
  classifyAgoraQuestion,
  type QuestionClassification,
} from "@/lib/generation-service";
import type { AgoraQuestionType } from "@/lib/types";

interface ThreadRow {
  id: string;
  question: string;
  asked_by: string;
  status: string;
  question_type?: AgoraQuestionType;
  recommendations_enabled?: number;
  article_url?: string | null;
  article_title?: string | null;
  article_source?: string | null;
  article_excerpt?: string | null;
  created_at: string;
  philosopher_ids: string;
  philosopher_names: string;
}

function isAgoraQuestionType(value: unknown): value is AgoraQuestionType {
  return value === "advice" || value === "conceptual" || value === "debate";
}

function normalizeRecommendationsEnabled(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;
  return null;
}

/** POST — Create a new agora thread */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const {
      question,
      asked_by,
      philosopher_ids,
      question_type,
      recommendations_enabled,
      article_url,
    } = body;

    if (!question?.trim()) {
      return NextResponse.json(
        { error: "question is required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(philosopher_ids) || philosopher_ids.length < 2) {
      return NextResponse.json(
        { error: "At least 2 philosopher_ids are required" },
        { status: 400 }
      );
    }

    if (question_type !== undefined && !isAgoraQuestionType(question_type)) {
      return NextResponse.json(
        { error: "question_type must be advice, conceptual, or debate" },
        { status: 400 }
      );
    }

    const normalizedRecommendations = normalizeRecommendationsEnabled(
      recommendations_enabled
    );

    if (recommendations_enabled !== undefined && normalizedRecommendations === null) {
      return NextResponse.json(
        { error: "recommendations_enabled must be true/false or 1/0" },
        { status: 400 }
      );
    }

    const rawArticleUrl = typeof article_url === "string" ? article_url.trim() : "";
    const normalizedArticleUrl = normalizeArticleUrl(rawArticleUrl);
    let articleWarning: string | null = null;
    let articleData: ExtractedArticle | null = null;

    if (rawArticleUrl) {
      if (!normalizedArticleUrl) {
        articleWarning =
          "We couldn't read that link as a valid article URL. The thread was created without article context.";
      } else {
        const extraction = await extractArticle(normalizedArticleUrl);
        if (extraction.success) {
          articleData = extraction;
        } else {
          articleWarning = extraction.error;
          console.warn(
            `Admin Agora: article extraction failed for ${normalizedArticleUrl}: ${extraction.error}`
          );
        }
      }
    }

    const classificationInput = buildAgoraClassificationInput(
      question.trim(),
      articleData && normalizedArticleUrl
        ? {
            url: normalizedArticleUrl,
            title: articleData.title,
            source: articleData.source,
            excerpt: articleData.excerpt,
          }
        : null
    );
    const threadId = `agora-${Date.now()}`;
    const classification: QuestionClassification =
      question_type !== undefined && normalizedRecommendations !== null
        ? {
            questionType: question_type,
            recommendationsAppropriate: normalizedRecommendations,
            recommendationHint: null,
          }
        : await classifyAgoraQuestion(classificationInput);
    const finalQuestionType = question_type ?? classification.questionType;
    const finalRecommendationsEnabled =
      normalizedRecommendations ?? classification.recommendationsAppropriate;
    const articleSource = articleData?.source ?? getArticleSourceFromUrl(normalizedArticleUrl);

    db.transaction(() => {
      db.prepare(
        `INSERT INTO agora_threads (
           id,
           question,
           asked_by,
           status,
           question_type,
           recommendations_enabled,
           article_url,
           article_title,
           article_source,
           article_excerpt
         )
         VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`
      ).run(
        threadId,
        question.trim(),
        asked_by || "Anonymous User",
        finalQuestionType,
        finalRecommendationsEnabled ? 1 : 0,
        normalizedArticleUrl,
        articleData?.title ?? null,
        articleSource,
        articleData?.excerpt ?? null
      );

      const insertPhilosopher = db.prepare(
        "INSERT INTO agora_thread_philosophers (thread_id, philosopher_id) VALUES (?, ?)"
      );
      for (const pid of philosopher_ids) {
        insertPhilosopher.run(threadId, pid);
      }
    })();

    const thread = db
      .prepare("SELECT * FROM agora_threads WHERE id = ?")
      .get(threadId) as
      | {
          id: string;
          question: string;
          asked_by: string;
          status: string;
          question_type?: AgoraQuestionType;
          recommendations_enabled?: number;
          article_url?: string | null;
          article_title?: string | null;
          article_source?: string | null;
          article_excerpt?: string | null;
          created_at: string;
        }
      | undefined;

    const philosophers = db
      .prepare(
        `SELECT p.id, p.name, p.tradition, p.color, p.initials
         FROM philosophers p
         JOIN agora_thread_philosophers atp ON p.id = atp.philosopher_id
         WHERE atp.thread_id = ?`
      )
      .all(threadId);

    return NextResponse.json(
      {
        thread: thread && {
          ...thread,
          article: thread.article_url
            ? {
                url: thread.article_url,
                title: thread.article_title ?? null,
                source: thread.article_source ?? null,
                excerpt: thread.article_excerpt ?? null,
              }
            : null,
        },
        philosophers,
        articleWarning: articleWarning ?? undefined,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create agora thread:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create thread" },
      { status: 500 }
    );
  }
}

/** GET — List all agora threads */
export async function GET() {
  try {
    const db = getDb();

    const rows = db
      .prepare(
        `SELECT t.*,
           GROUP_CONCAT(atp.philosopher_id) as philosopher_ids,
           GROUP_CONCAT(p.name) as philosopher_names
         FROM agora_threads t
         LEFT JOIN agora_thread_philosophers atp ON t.id = atp.thread_id
         LEFT JOIN philosophers p ON atp.philosopher_id = p.id
         GROUP BY t.id
         ORDER BY t.created_at DESC`
      )
     .all() as ThreadRow[];

    const threads = rows.map((row) => ({
      ...row,
      philosopher_ids: parseGroupConcat(row.philosopher_ids),
      philosopher_names: parseGroupConcat(row.philosopher_names),
      article_source: row.article_source ?? null,
    }));

    return NextResponse.json(threads);
  } catch (error) {
    console.error("Failed to fetch agora threads:", error);
    return NextResponse.json(
      { error: "Failed to fetch agora threads" },
      { status: 500 }
    );
  }
}

/** DELETE — permanently remove an agora thread */
export async function DELETE(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const existing = db
      .prepare("SELECT id FROM agora_threads WHERE id = ?")
      .get(id);

    if (!existing) {
      return NextResponse.json(
        { error: "Thread not found" },
        { status: 404 }
      );
    }

    db.prepare("DELETE FROM agora_threads WHERE id = ?").run(id);

    revalidatePath("/agora");

    return NextResponse.json({ deleted: id });
  } catch (error) {
    console.error("Failed to delete agora thread:", error);
    return NextResponse.json(
      { error: "Failed to delete agora thread" },
      { status: 500 }
    );
  }
}
