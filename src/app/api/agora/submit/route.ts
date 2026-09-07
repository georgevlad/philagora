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
import { getIdentityFromHeaders, hasUnlimitedAgoraAccess } from "@/lib/auth";
import { agoraQuotaError, AgoraQuotaError } from "@/lib/agora-quota";
import { getDb } from "@/lib/db";
import {
  classifyAgoraQuestion,
  type QuestionClassification,
} from "@/lib/generation-service";
import type { AgoraQuestionType, AgoraThreadVisibility } from "@/lib/types";

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
    const body = await request.json().catch(() => null);
    if (
      !body ||
      typeof body !== "object" ||
      (body.question !== undefined && typeof body.question !== "string") ||
      (body.asked_by !== undefined && typeof body.asked_by !== "string")
    ) {
      return NextResponse.json(
        { error: "Invalid question submission" },
        { status: 400 },
      );
    }
    const requestId = body.request_id;
    if (
      requestId !== undefined &&
      (typeof requestId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          requestId,
        ))
    ) {
      return NextResponse.json(
        { error: "Invalid submission ID" },
        { status: 400 },
      );
    }

    let question = (body.question ?? "").trim();
    const askedBy =
      (body.asked_by ?? "")
        .replace(/<[^>]*>/g, "")
        .replace(/[^a-zA-Z0-9\s\-_.]/g, "")
        .slice(0, 40)
        .trim() || "Anonymous";
    const clientClassification = body.classification as
      | {
          questionType?: string;
          recommendationsAppropriate?: boolean;
          recommendationHint?: string | null;
        }
      | undefined;
    const philosopherIds: unknown = body.philosopher_ids;
    const rawArticleUrl =
      typeof body.article_url === "string" ? body.article_url.trim() : "";
    const hasArticleUrl =
      typeof body.article_url === "string" &&
      body.article_url.trim().length > 0;
    if (
      body.visibility !== undefined &&
      body.visibility !== "public" &&
      body.visibility !== "private"
    )
      return NextResponse.json(
        { error: "Choose public or private visibility" },
        { status: 400 },
      );
    const requestedVisibility = normalizeVisibility(body.visibility);

    if (!hasArticleUrl && (question.length < 10 || question.length > 500)) {
      return NextResponse.json(
        { error: "Question must be between 10 and 500 characters" },
        { status: 400 },
      );
    }

    if (hasArticleUrl && question.length > 500) {
      return NextResponse.json(
        { error: "Question must be 500 characters or fewer" },
        { status: 400 },
      );
    }

    if (
      !Array.isArray(philosopherIds) ||
      philosopherIds.length < 2 ||
      philosopherIds.length > 4 ||
      new Set(philosopherIds).size !== philosopherIds.length
    ) {
      return NextResponse.json(
        { error: "Must include 2 to 4 philosopher IDs" },
        { status: 400 },
      );
    }

    const checkPhilosopher = db.prepare(
      "SELECT id FROM philosophers WHERE id = ?",
    );
    for (const philosopherId of philosopherIds) {
      if (typeof philosopherId !== "string") {
        return NextResponse.json(
          { error: "Each philosopher_id must be a string" },
          { status: 400 },
        );
      }

      const found = checkPhilosopher.get(philosopherId) as
        | PhilosopherCheck
        | undefined;
      if (!found) {
        return NextResponse.json(
          { error: `Philosopher not found: ${philosopherId}` },
          { status: 400 },
        );
      }
    }

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";

    // ── Rate limit ────────────────────────────────────────────────────
    const identity = await getIdentityFromHeaders(request);
    const userId = identity.type === "user" ? identity.id : null;
    if (requestedVisibility === "private" && identity.type !== "user") {
      return NextResponse.json(
        {
          error: "Sign in to ask privately. Your draft has not been published.",
        },
        { status: 401 },
      );
    }
    const visibility = requestedVisibility;
    const hasUnlimitedAccess = hasUnlimitedAgoraAccess(identity);

    // An opaque client-generated UUID makes an ambiguous network retry safe.
    // Replays never restart generation or consume a second quota allowance.
    const replay = () => {
      if (!requestId) return null;
      const existing = db
        .prepare(
          "SELECT id, user_id, follow_up_to, visibility FROM agora_threads WHERE id = ?",
        )
        .get(requestId) as
        | {
            id: string;
            user_id: string | null;
            follow_up_to: string | null;
            visibility: AgoraThreadVisibility;
          }
        | undefined;
      if (!existing) return null;
      // A signed-in retry can reconcile an earlier public guest submission,
      // but never claims ownership of it. Private threads still require an owner match.
      const publicGuest =
        existing.user_id === null && existing.visibility === "public";
      if (
        (!publicGuest &&
          (existing.user_id === null || existing.user_id !== userId)) ||
        existing.follow_up_to
      ) {
        return NextResponse.json(
          { error: "Submission ID unavailable" },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { threadId: existing.id },
        { headers: { "Cache-Control": "no-store" } },
      );
    };
    const existingSubmission = replay();
    if (existingSubmission) return existingSubmission;

    const quotaError = agoraQuotaError(
      db,
      userId,
      clientIp,
      hasUnlimitedAccess,
    );
    if (quotaError)
      return NextResponse.json({ error: quotaError }, { status: 429 });

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
        }
      }
    }

    if (!question && articleData?.title) {
      question = articleData.title;
    } else if (!question) {
      question = "What should we make of this?";
    }

    const sanitizedQuestion = sanitizeAgoraQuestion(question);
    if (!hasArticleUrl && sanitizedQuestion.length < 10)
      return NextResponse.json(
        { error: "Question must contain at least 10 characters" },
        { status: 400 },
      );

    const articleSource =
      articleData?.source ?? getArticleSourceFromUrl(normalizedArticleUrl);
    const classificationInput = buildAgoraClassificationInput(
      sanitizedQuestion,
      articleData && normalizedArticleUrl
        ? {
            url: normalizedArticleUrl,
            title: articleData.title,
            source: articleData.source,
            excerpt: articleData.excerpt,
          }
        : null,
    );
    const classification: QuestionClassification = isAgoraQuestionType(
      clientClassification?.questionType,
    )
      ? {
          questionType: clientClassification.questionType,
          recommendationsAppropriate: Boolean(
            clientClassification.recommendationsAppropriate,
          ),
          recommendationHint:
            typeof clientClassification.recommendationHint === "string" &&
            clientClassification.recommendationHint.trim().length > 0
              ? clientClassification.recommendationHint.trim()
              : null,
        }
      : await classifyAgoraQuestion(classificationInput);
    // Classification/extraction above may have yielded to another request.
    const concurrentSubmission = replay();
    if (concurrentSubmission) return concurrentSubmission;
    const threadId = requestId ?? crypto.randomUUID();
    const validPids = philosopherIds as string[];

    db.transaction(() => {
      const limitError = agoraQuotaError(
        db,
        userId,
        clientIp,
        hasUnlimitedAccess,
      );
      if (limitError) throw new AgoraQuotaError(limitError);
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
         VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        articleData?.excerpt ?? null,
      );

      const insertPhilosopher = db.prepare(
        "INSERT INTO agora_thread_philosophers (thread_id, philosopher_id) VALUES (?, ?)",
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
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AgoraQuotaError)
      return NextResponse.json({ error: error.message }, { status: 429 });
    console.error(
      "Failed to submit agora question:",
      error instanceof Error ? error.name : "Unknown error",
    );
    return NextResponse.json(
      {
        error:
          "We could not confirm this submission. Check again using the same draft.",
      },
      { status: 500 },
    );
  }
}
