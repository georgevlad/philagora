import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  buildAgoraFollowUpResponseSourceMaterial,
  buildAgoraFollowUpSynthesisSourceMaterial,
  getAgoraSynthesisForThread,
  sanitizeAgoraQuestion,
  type AgoraFollowUpContextResponseRow,
} from "@/lib/agora";
import { runAgoraGeneration } from "@/lib/agora-generation";
import { getIdentityFromHeaders, hasUnlimitedAgoraAccess } from "@/lib/auth";
import { agoraQuotaError, AgoraQuotaError } from "@/lib/agora-quota";
import { getDb } from "@/lib/db";
import { canReadAgoraThread } from "@/lib/agora-access";
import type { AgoraQuestionType, AgoraThreadVisibility } from "@/lib/types";

interface AgoraThreadRow {
  id: string;
  question: string;
  asked_by: string;
  status: string;
  question_type?: AgoraQuestionType | null;
  recommendations_enabled?: number;
  visibility?: AgoraThreadVisibility | null;
  user_id?: string | null;
  follow_up_to?: string | null;
  article_url?: string | null;
  article_title?: string | null;
  article_source?: string | null;
  article_excerpt?: string | null;
}

interface ParentResponseRow extends AgoraFollowUpContextResponseRow {
  philosopher_id: string;
}

interface ThreadPhilosopherRow {
  philosopher_id: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  try {
    const db = getDb();
    const { threadId: parentId } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body.question !== "string") {
      return NextResponse.json({ error: "Invalid follow-up" }, { status: 400 });
    }
    const followUpQuestion = (body.question ?? "").trim();

    if (followUpQuestion.length < 10 || followUpQuestion.length > 500) {
      return NextResponse.json(
        { error: "Follow-up must be between 10 and 500 characters" },
        { status: 400 },
      );
    }

    const sanitizedQuestion = sanitizeAgoraQuestion(followUpQuestion);
    if (sanitizedQuestion.length < 10)
      return NextResponse.json(
        { error: "Follow-up must contain at least 10 characters" },
        { status: 400 },
      );
    const identity = await getIdentityFromHeaders(request);
    const userId = identity.type === "user" ? identity.id : null;
    const hasUnlimitedAccess = hasUnlimitedAgoraAccess(identity);

    const parent = db
      .prepare(
        `SELECT id, question, asked_by, status, question_type, recommendations_enabled,
              visibility, user_id, follow_up_to,
              article_url, article_title, article_source, article_excerpt
       FROM agora_threads
       WHERE id = ?`,
      )
      .get(parentId) as AgoraThreadRow | undefined;

    if (!parent) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    if (
      !canReadAgoraThread(
        { visibility: parent.visibility, userId: parent.user_id },
        identity,
      )
    ) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    if (parent.status !== "complete") {
      return NextResponse.json(
        { error: "Cannot follow up on a thread that is still generating" },
        { status: 400 },
      );
    }

    if (parent.follow_up_to) {
      return NextResponse.json(
        { error: "Cannot add a follow-up to a follow-up" },
        { status: 400 },
      );
    }

    // Only the thread owner (registered user) can submit a follow-up.
    // Anonymous threads (no user_id) don't get follow-ups.
    if (!parent.user_id) {
      return NextResponse.json(
        { error: "Follow-ups are available for registered users" },
        { status: 403 },
      );
    }

    if (identity.type !== "admin" && userId !== parent.user_id) {
      return NextResponse.json(
        { error: "Only the person who asked this question can follow up" },
        { status: 403 },
      );
    }

    const existingFollowUp = db
      .prepare(
        "SELECT id, question FROM agora_threads WHERE follow_up_to = ? LIMIT 1",
      )
      .get(parentId) as { id: string; question: string } | undefined;
    if (existingFollowUp) {
      return existingFollowUp.question === sanitizedQuestion
        ? NextResponse.json({ threadId: existingFollowUp.id })
        : NextResponse.json(
            { error: "This conversation already has its one follow-up" },
            { status: 409 },
          );
    }

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";

    const quotaError = agoraQuotaError(
      db,
      userId,
      clientIp,
      hasUnlimitedAccess,
    );
    if (quotaError)
      return NextResponse.json({ error: quotaError }, { status: 429 });

    const parentResponses = db
      .prepare(
        `SELECT ar.philosopher_id, ar.posts, ar.recommendation,
              p.name as philosopher_name, p.tradition as philosopher_tradition
       FROM agora_responses ar
       JOIN philosophers p ON ar.philosopher_id = p.id
       WHERE ar.thread_id = ?
       ORDER BY ar.sort_order`,
      )
      .all(parentId) as ParentResponseRow[];
    const parentPhilosophers = db
      .prepare(
        "SELECT philosopher_id FROM agora_thread_philosophers WHERE thread_id = ?",
      )
      .all(parentId) as ThreadPhilosopherRow[];
    const philosopherIds = [
      ...parentResponses.map((response) => response.philosopher_id),
      ...parentPhilosophers
        .map((row) => row.philosopher_id)
        .filter(
          (philosopherId, index, all) => all.indexOf(philosopherId) === index,
        )
        .filter(
          (philosopherId) =>
            !parentResponses.some(
              (response) => response.philosopher_id === philosopherId,
            ),
        ),
    ];

    if (philosopherIds.length === 0) {
      return NextResponse.json(
        { error: "This thread has no philosophers to continue the dialogue" },
        { status: 400 },
      );
    }

    const questionType = parent.question_type ?? "advice";
    const recommendationsEnabled = (parent.recommendations_enabled ?? 0) === 1;
    const followUpId = crypto.randomUUID();

    const created = db.transaction(() => {
      if (
        db
          .prepare(
            "SELECT id FROM agora_threads WHERE follow_up_to = ? LIMIT 1",
          )
          .get(parentId)
      )
        return false;
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
           follow_up_to,
           article_url,
           article_title,
           article_source,
           article_excerpt
         )
         VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        followUpId,
        sanitizedQuestion,
        parent.asked_by,
        clientIp,
        questionType,
        recommendationsEnabled ? 1 : 0,
        parent.visibility ?? "public",
        parent.user_id,
        parentId,
        parent.article_url ?? null,
        parent.article_title ?? null,
        parent.article_source ?? null,
        parent.article_excerpt ?? null,
      );

      const insertPhilosopher = db.prepare(
        "INSERT INTO agora_thread_philosophers (thread_id, philosopher_id) VALUES (?, ?)",
      );

      for (const philosopherId of philosopherIds) {
        insertPhilosopher.run(followUpId, philosopherId);
      }
      return true;
    })();
    if (!created)
      return NextResponse.json(
        { error: "This conversation already has its one follow-up" },
        { status: 409 },
      );

    const parentSynthesis = getAgoraSynthesisForThread(db, parentId);
    const article = parent.article_url
      ? {
          url: parent.article_url,
          title: parent.article_title ?? null,
          source: parent.article_source ?? null,
          excerpt: parent.article_excerpt ?? null,
        }
      : null;

    void runAgoraGeneration({
      threadId: followUpId,
      philosopherIds,
      questionType,
      recommendationsEnabled,
      recommendationHint: null,
      buildResponseSourceMaterial: ({ alreadyRecommended }) =>
        buildAgoraFollowUpResponseSourceMaterial({
          parentQuestion: parent.question,
          askedBy: parent.asked_by,
          parentResponses,
          parentSynthesis,
          followUpQuestion: sanitizedQuestion,
          questionType,
          recommendationsAppropriate: recommendationsEnabled,
          recommendationHint: null,
          alreadyRecommended,
          article,
        }),
      buildSynthesisSourceMaterial: ({ responses, recommendations }) =>
        buildAgoraFollowUpSynthesisSourceMaterial({
          parentQuestion: parent.question,
          askedBy: parent.asked_by,
          parentResponses,
          parentSynthesis,
          followUpQuestion: sanitizedQuestion,
          questionType,
          responses,
          recommendations,
          article,
        }),
    });

    return NextResponse.json({ threadId: followUpId }, { status: 201 });
  } catch (error) {
    if (error instanceof AgoraQuotaError)
      return NextResponse.json({ error: error.message }, { status: 429 });
    console.error(
      "Follow-up submission failed:",
      error instanceof Error ? error.name : "Unknown error",
    );
    return NextResponse.json(
      {
        error:
          "We could not confirm your follow-up. Check the conversation before trying again.",
      },
      { status: 500 },
    );
  }
}
