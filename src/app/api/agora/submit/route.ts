import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  buildAgoraClassificationInput,
  buildAgoraResponseSourceMaterial,
  buildAgoraSynthesisSourceMaterial,
  sanitizeAgoraQuestion,
  type AgoraGenerationArticle,
} from "@/lib/agora";
import { runAgoraGeneration } from "@/lib/agora-generation";
import {
  extractArticle,
  getArticleSourceFromUrl,
  normalizeArticleUrl,
  type ExtractedArticle,
} from "@/lib/article-extractor";
import { getIdentityFromHeaders } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  classifyAgoraQuestion,
  type QuestionClassification,
} from "@/lib/generation-service";
import type { AgoraQuestionType, AgoraThreadVisibility } from "@/lib/types";

interface CountRow {
  count: number;
}

interface PhilosopherCheck {
  id: string;
}

function normalizeVisibility(value: unknown): AgoraThreadVisibility {
  return value === "private" ? "private" : "public";
}

function isAgoraQuestionType(value: unknown): value is AgoraQuestionType {
  return value === "advice" || value === "conceptual" || value === "debate";
}

/** POST /api/agora/submit — Submit a question to the Agora */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    let question = (body.question ?? "").trim();
    const askedBy = (body.asked_by ?? "")
      .replace(/<[^>]*>/g, "")
      .replace(/[^a-zA-Z0-9\s\-_.]/g, "")
      .slice(0, 40)
      .trim() || "Anonymous";
    const clientClassification = body.classification as {
      questionType?: string;
      recommendationsAppropriate?: boolean;
      recommendationHint?: string | null;
    } | undefined;
    const philosopherIds: unknown = body.philosopher_ids;
    const rawArticleUrl = typeof body.article_url === "string" ? body.article_url.trim() : "";
    const hasArticleUrl =
      typeof body.article_url === "string" && body.article_url.trim().length > 0;
    const requestedVisibility = normalizeVisibility(body.visibility);

    if (!hasArticleUrl && (question.length < 10 || question.length > 500)) {
      return NextResponse.json(
        { error: "Question must be between 10 and 500 characters" },
        { status: 400 }
      );
    }

    if (hasArticleUrl && question.length > 500) {
      return NextResponse.json(
        { error: "Question must be 500 characters or fewer" },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(philosopherIds)
      || philosopherIds.length < 2
      || philosopherIds.length > 4
    ) {
      return NextResponse.json(
        { error: "Must include 2 to 4 philosopher IDs" },
        { status: 400 }
      );
    }

    const checkPhilosopher = db.prepare("SELECT id FROM philosophers WHERE id = ?");
    for (const philosopherId of philosopherIds) {
      if (typeof philosopherId !== "string") {
        return NextResponse.json(
          { error: "Each philosopher_id must be a string" },
          { status: 400 }
        );
      }

      const found = checkPhilosopher.get(philosopherId) as PhilosopherCheck | undefined;
      if (!found) {
        return NextResponse.json(
          { error: `Philosopher not found: ${philosopherId}` },
          { status: 400 }
        );
      }
    }

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? "unknown";

    // ── Rate limit ────────────────────────────────────────────────────
    const identity = await getIdentityFromHeaders(request);
    const userId = identity.type === "user" ? identity.id : null;
    const visibility = identity.type === "user" ? requestedVisibility : "public";
    const isOwner =
      identity.type === "user" && identity.email === "george.vlad.utcn@gmail.com";

    if (!isOwner) {
      // Per-user or per-IP limit
      if (userId) {
        const userCount = db
          .prepare(
            "SELECT COUNT(*) as count FROM agora_threads WHERE user_id = ? AND created_at >= date('now')"
          )
          .get(userId) as CountRow;

        if (userCount.count >= 5) {
          return NextResponse.json(
            { error: "You've reached your daily question limit. Check back tomorrow." },
            { status: 429 }
          );
        }
      } else {
        const ipCount = db
          .prepare(
            "SELECT COUNT(*) as count FROM agora_threads WHERE ip_address = ? AND created_at >= date('now')"
          )
          .get(clientIp) as CountRow;

        if (ipCount.count >= 3) {
          return NextResponse.json(
            { error: "The philosophers are resting. Check back tomorrow." },
            { status: 429 }
          );
        }
      }

      // Global daily cap
      const todayCount = db
        .prepare("SELECT COUNT(*) as count FROM agora_threads WHERE created_at >= date('now')")
        .get() as CountRow;

      if (todayCount.count >= 50) {
        return NextResponse.json(
          { error: "The philosophers are resting. Check back tomorrow." },
          { status: 429 }
        );
      }
    }

    const normalizedArticleUrl = normalizeArticleUrl(rawArticleUrl);
    let articleData: ExtractedArticle | null = null;
    let articleWarning: string | null = null;

    if (rawArticleUrl) {
      if (!normalizedArticleUrl) {
        articleWarning =
          "We couldn't read that link as a valid article URL. The philosophers will respond to your question without article context.";
      } else {
        const extraction = await extractArticle(normalizedArticleUrl);
        if (extraction.success) {
          articleData = extraction;
        } else {
          articleWarning = extraction.error;
          console.warn(
            `Agora: article extraction failed for ${normalizedArticleUrl}: ${extraction.error}`
          );
        }
      }
    }

    if (!question && articleData?.title) {
      question = articleData.title;
    } else if (!question) {
      question = "What should we make of this?";
    }

    const sanitizedQuestion = sanitizeAgoraQuestion(question);

    const articleSource = articleData?.source ?? getArticleSourceFromUrl(normalizedArticleUrl);
    const classificationInput = buildAgoraClassificationInput(
      sanitizedQuestion,
      articleData && normalizedArticleUrl
        ? {
            url: normalizedArticleUrl,
            title: articleData.title,
            source: articleData.source,
            excerpt: articleData.excerpt,
          }
        : null
    );
    const classification: QuestionClassification = isAgoraQuestionType(
      clientClassification?.questionType
    )
      ? {
          questionType: clientClassification.questionType,
          recommendationsAppropriate: Boolean(
            clientClassification.recommendationsAppropriate
          ),
          recommendationHint:
            typeof clientClassification.recommendationHint === "string"
            && clientClassification.recommendationHint.trim().length > 0
              ? clientClassification.recommendationHint.trim()
              : null,
        }
      : await classifyAgoraQuestion(classificationInput);
    const threadId = crypto.randomUUID();
    const validPids = philosopherIds as string[];

    db.transaction(() => {
      db.prepare(
        `INSERT INTO agora_threads (
           id,
           question,
           asked_by,
           status,
           ip_address,
           question_type,
           recommendations_enabled,
           visibility,
           user_id,
           article_url,
           article_title,
           article_source,
           article_excerpt
         )
         VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        threadId,
        sanitizedQuestion,
        askedBy,
        clientIp,
        classification.questionType,
        classification.recommendationsAppropriate ? 1 : 0,
        visibility,
        userId,
        normalizedArticleUrl,
        articleData?.title ?? null,
        articleSource,
        articleData?.excerpt ?? null
      );

      const insertPhilosopher = db.prepare(
        "INSERT INTO agora_thread_philosophers (thread_id, philosopher_id) VALUES (?, ?)"
      );

      for (const philosopherId of validPids) {
        insertPhilosopher.run(threadId, philosopherId);
      }
    })();

    const article: AgoraGenerationArticle | null =
      articleData && normalizedArticleUrl
        ? {
            url: normalizedArticleUrl,
            title: articleData.title,
            source: articleData.source,
            excerpt: articleData.excerpt,
            content: articleData.content,
          }
        : null;

    void runAgoraGeneration({
      threadId,
      philosopherIds: validPids,
      questionType: classification.questionType,
      recommendationsEnabled: classification.recommendationsAppropriate,
      recommendationHint: classification.recommendationHint,
      buildResponseSourceMaterial: ({ alreadyRecommended }) =>
        buildAgoraResponseSourceMaterial({
          question: sanitizedQuestion,
          askedBy,
          questionType: classification.questionType,
          recommendationsAppropriate: classification.recommendationsAppropriate,
          recommendationHint: classification.recommendationHint,
          alreadyRecommended,
          article,
        }),
      buildSynthesisSourceMaterial: ({ responses, recommendations }) =>
        buildAgoraSynthesisSourceMaterial({
          question: sanitizedQuestion,
          askedBy,
          questionType: classification.questionType,
          responses,
          recommendations,
          article: article
            ? {
                url: article.url,
                title: article.title,
                source: article.source,
                excerpt: article.excerpt,
              }
            : null,
        }),
    });

    return NextResponse.json(
      {
        threadId,
        articleWarning: articleWarning ?? undefined,
      },
      { status: 201 }
    );
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
