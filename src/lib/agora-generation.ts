import crypto from "crypto";
import {
  getAgoraResponseTemplate,
  getSynthesisTemplateForType,
} from "@/lib/content-templates";
import { getDb } from "@/lib/db";
import {
  generateContent,
  generateSynthesis,
} from "@/lib/generation-service";
import type {
  AgoraGenerationRecommendationRow,
  AgoraGenerationResponseRow,
} from "@/lib/agora";
import type { AgoraQuestionType } from "@/lib/types";

export interface RunAgoraGenerationOptions {
  threadId: string;
  philosopherIds: string[];
  questionType: AgoraQuestionType;
  recommendationsEnabled: boolean;
  recommendationHint: string | null;
  buildResponseSourceMaterial: (args: { alreadyRecommended: string[] }) => string;
  buildSynthesisSourceMaterial: (args: {
    responses: AgoraGenerationResponseRow[];
    recommendations: AgoraGenerationRecommendationRow[];
  }) => string;
}

export async function runAgoraGeneration(
  options: RunAgoraGenerationOptions
): Promise<void> {
  try {
    const db = getDb();
    let successCount = 0;
    const alreadyRecommended: string[] = [];

    db.prepare("UPDATE agora_threads SET status = 'in_progress' WHERE id = ?").run(options.threadId);

    for (let index = 0; index < options.philosopherIds.length; index += 1) {
      const philosopherId = options.philosopherIds[index];
      const responseTemplate = getAgoraResponseTemplate(
        options.questionType,
        options.recommendationsEnabled,
        options.recommendationHint,
        alreadyRecommended
      );
      const sourceMaterial = options.buildResponseSourceMaterial({
        alreadyRecommended: [...alreadyRecommended],
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
            const data = outcome.data as {
              posts?: unknown;
              recommendation?: {
                title?: string;
                medium?: string;
                reason?: string;
              };
            };
            const posts = Array.isArray(data.posts)
              ? data.posts.filter((post): post is string => typeof post === "string")
              : [];
            const recommendation = data.recommendation
              ? JSON.stringify(data.recommendation)
              : null;

            if (data.recommendation?.title && data.recommendation?.medium) {
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
              crypto.randomUUID(),
              options.threadId,
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
      db.prepare("UPDATE agora_threads SET status = 'failed' WHERE id = ?").run(options.threadId);
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
        .all(options.threadId) as AgoraGenerationResponseRow[];

      if (responses.length > 0) {
        const recommendations = options.recommendationsEnabled
          ? (db
              .prepare(
                `SELECT ar.recommendation, p.name as philosopher_name
                 FROM agora_responses ar
                 JOIN philosophers p ON ar.philosopher_id = p.id
                 WHERE ar.thread_id = ? AND ar.recommendation IS NOT NULL`
              )
              .all(options.threadId) as AgoraGenerationRecommendationRow[])
          : [];
        const sourceMaterial = options.buildSynthesisSourceMaterial({
          responses,
          recommendations,
        });
        const synthesisTemplate = getSynthesisTemplateForType(options.questionType);
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
            options.threadId,
            options.questionType,
            JSON.stringify(outcome.data)
          );
        }
      }
    } catch (error) {
      console.error("Agora synthesis generation failed:", error);
    }

    db.prepare("UPDATE agora_threads SET status = 'complete' WHERE id = ?").run(options.threadId);
  } catch (error) {
    console.error("Agora background generation crashed:", error);
    try {
      const db = getDb();
      db.prepare("UPDATE agora_threads SET status = 'failed' WHERE id = ?").run(options.threadId);
    } catch {
      // Nothing more we can do here.
    }
  }
}
