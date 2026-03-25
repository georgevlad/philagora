import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  buildAgoraClassificationInput,
  buildAgoraResponseSourceMaterial,
  buildAgoraSynthesisSourceMaterial,
} from "@/lib/agora";
import {
  extractArticle,
  getArticleSourceFromUrl,
  normalizeArticleUrl,
  type ExtractedArticle,
} from "@/lib/article-extractor";
import { getSynthesisTemplateForType, getAgoraResponseTemplate } from "@/lib/content-templates";
import { getDb } from "@/lib/db";
import {
  classifyAgoraQuestion,
  generateContent,
  generateSynthesis,
  type QuestionClassification,
} from "@/lib/generation-service";

interface CountRow {
  count: number;
}

interface PhilosopherCheck {
  id: string;
}

interface ResponseRow {
  posts: string;
  philosopher_name: string;
  philosopher_tradition: string;
}

interface RecommendationRow {
  recommendation: string;
  philosopher_name: string;
}

type RuntimeArticleContext = {
  url: string;
  title: string;
  source: string;
  excerpt: string;
  content: string;
};

/** POST /api/agora/submit — Submit a question to the Agora */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    const question = (body.question ?? "").trim();
    const askedBy = (body.asked_by ?? "")
      .replace(/<[^>]*>/g, "")
      .replace(/[^a-zA-Z0-9\s\-_.]/g, "")
      .slice(0, 40)
      .trim() || "Anonymous";
    const philosopherIds: unknown = body.philosopher_ids;
    const rawArticleUrl = typeof body.article_url === "string" ? body.article_url.trim() : "";

    if (question.length < 10 || question.length > 500) {
      return NextResponse.json(
        { error: "Question must be between 10 and 500 characters" },
        { status: 400 }
      );
    }

    const sanitizedQuestion = question
      .replace(/\[INST\]/gi, "")
      .replace(/<\/?system>/gi, "")
      .replace(/<\/?assistant>/gi, "")
      .replace(/<\/?human>/gi, "")
      .replace(/<\/?user>/gi, "")
      .replace(/^(system|assistant|human|user)\s*:/gim, "")
      .trim();

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

    const todayCount = db
      .prepare(
        "SELECT COUNT(*) as count FROM agora_threads WHERE ip_address IS NOT NULL AND created_at >= date('now')"
      )
      .get() as CountRow;

    if (todayCount.count >= 10) {
      return NextResponse.json(
        { error: "The philosophers are resting. Check back tomorrow." },
        { status: 429 }
      );
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
    const classification = await classifyAgoraQuestion(classificationInput);
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
           article_url,
           article_title,
           article_source,
           article_excerpt
         )
         VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        threadId,
        sanitizedQuestion,
        askedBy,
        clientIp,
        classification.questionType,
        classification.recommendationsAppropriate ? 1 : 0,
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

    runGeneration(
      threadId,
      sanitizedQuestion,
      askedBy,
      validPids,
      classification,
      articleData && normalizedArticleUrl
        ? {
            url: normalizedArticleUrl,
            title: articleData.title,
            source: articleData.source,
            excerpt: articleData.excerpt,
            content: articleData.content,
          }
        : null
    );

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

async function runGeneration(
  threadId: string,
  question: string,
  askedBy: string,
  philosopherIds: string[],
  classification: QuestionClassification,
  article: RuntimeArticleContext | null
): Promise<void> {
  try {
    const db = getDb();
    let successCount = 0;
    const alreadyRecommended: string[] = [];

    db.prepare("UPDATE agora_threads SET status = 'in_progress' WHERE id = ?").run(threadId);

    for (let index = 0; index < philosopherIds.length; index += 1) {
      const philosopherId = philosopherIds[index];
      const responseTemplate = getAgoraResponseTemplate(
        classification.questionType,
        classification.recommendationsAppropriate,
        classification.recommendationHint,
        alreadyRecommended
      );
      const sourceMaterial = buildAgoraResponseSourceMaterial({
        question,
        askedBy,
        questionType: classification.questionType,
        recommendationsAppropriate: classification.recommendationsAppropriate,
        recommendationHint: classification.recommendationHint,
        alreadyRecommended,
        article,
      });
      const maxAttempts = 2;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const outcome = await generateContent(
            philosopherId,
            "agora_response",
            sourceMaterial,
            undefined,
            responseTemplate
          );

          const logStatus = outcome.success ? "generated" : "rejected";
          const rawOutput = outcome.success
            ? JSON.stringify(outcome.data, null, 2)
            : outcome.rawOutput || outcome.error;

          db.prepare(
            `INSERT INTO generation_log (philosopher_id, content_type, system_prompt_id, user_input, raw_output, status)
             VALUES (?, 'agora_response', ?, ?, ?, ?)`
          ).run(philosopherId, outcome.systemPromptId, sourceMaterial, rawOutput, logStatus);

          if (outcome.success) {
            const responseId = crypto.randomUUID();
            const data = outcome.data as {
              posts: string[];
              recommendation?: {
                title: string;
                medium: string;
                reason: string;
              };
            };
            const posts = Array.isArray(data.posts) ? data.posts : [];
            const recommendation = data.recommendation
              ? JSON.stringify(data.recommendation)
              : null;

            if (data.recommendation?.title) {
              alreadyRecommended.push(
                `"${data.recommendation.title}" (${data.recommendation.medium})`
              );
            }

            db.prepare(
              `INSERT INTO agora_responses (
                 id,
                 thread_id,
                 philosopher_id,
                 posts,
                 sort_order,
                 recommendation
               )
               VALUES (?, ?, ?, ?, ?, ?)`
            ).run(
              responseId,
              threadId,
              philosopherId,
              JSON.stringify(posts),
              index,
              recommendation
            );
            successCount += 1;
            break;
          }

          if (attempt < maxAttempts) {
            console.warn(`Agora: retrying ${philosopherId} (attempt ${attempt} failed)`);
            continue;
          }
        } catch (error) {
          console.error(
            `Agora generation failed for philosopher ${philosopherId} (attempt ${attempt}):`,
            error
          );

          if (attempt >= maxAttempts) {
            break;
          }
        }
      }
    }

    if (successCount === 0) {
      db.prepare("UPDATE agora_threads SET status = 'failed' WHERE id = ?").run(threadId);
      return;
    }

    try {
      const responses = db
        .prepare(
          `SELECT ar.posts, p.name as philosopher_name, p.tradition as philosopher_tradition
           FROM agora_responses ar
           JOIN philosophers p ON ar.philosopher_id = p.id
           WHERE ar.thread_id = ?
           ORDER BY ar.sort_order`
        )
        .all(threadId) as ResponseRow[];

      if (responses.length > 0) {
        const recommendations = classification.recommendationsAppropriate
          ? (db
              .prepare(
                `SELECT ar.recommendation, p.name as philosopher_name
                 FROM agora_responses ar
                 JOIN philosophers p ON ar.philosopher_id = p.id
                 WHERE ar.thread_id = ? AND ar.recommendation IS NOT NULL`
              )
              .all(threadId) as RecommendationRow[])
          : [];
        const sourceMaterial = buildAgoraSynthesisSourceMaterial({
          question,
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
        });
        const synthesisTemplate = getSynthesisTemplateForType(classification.questionType);

        const outcome = await generateSynthesis(
          "agora_synthesis",
          sourceMaterial,
          synthesisTemplate
        );

        const status = outcome.success ? "generated" : "rejected";
        const rawOutput = outcome.success
          ? JSON.stringify(outcome.data, null, 2)
          : outcome.rawOutput || outcome.error;

        db.prepare(
          `INSERT INTO generation_log (philosopher_id, content_type, system_prompt_id, user_input, raw_output, status)
           VALUES (?, 'synthesis', ?, ?, ?, ?)`
        ).run(null, null, sourceMaterial, rawOutput, status);

        if (outcome.success) {
          db.prepare(
            `INSERT INTO agora_synthesis_v2 (thread_id, synthesis_type, sections)
             VALUES (?, ?, ?)`
          ).run(
            threadId,
            classification.questionType,
            JSON.stringify(outcome.data)
          );
        }
      }
    } catch (error) {
      console.error("Agora synthesis generation failed:", error);
    }

    db.prepare("UPDATE agora_threads SET status = 'complete' WHERE id = ?").run(threadId);
  } catch (error) {
    console.error("Agora background generation crashed:", error);
    try {
      const db = getDb();
      db.prepare("UPDATE agora_threads SET status = 'failed' WHERE id = ?").run(threadId);
    } catch {
      // Nothing more we can do here.
    }
  }
}
