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
import { getIdentityFromHeaders } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { AgoraQuestionType, AgoraThreadVisibility } from "@/lib/types";

interface CountRow {
  count: number;
}

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
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const db = getDb();
    const { threadId: parentId } = await params;
    const body = await request.json();
    const followUpQuestion = (body.question ?? "").trim();

    if (followUpQuestion.length < 10 || followUpQuestion.length > 500) {
      return NextResponse.json(
        { error: "Follow-up must be between 10 and 500 characters" },
        { status: 400 }
      );
    }

    const sanitizedQuestion = sanitizeAgoraQuestion(followUpQuestion);
    const identity = await getIdentityFromHeaders(request);
    const userId = identity.type === "user" ? identity.id : null;
    const isOwner =
      identity.type === "user" && identity.email === "george.vlad.utcn@gmail.com";

    const parent = db.prepare(
      `SELECT id, question, asked_by, status, question_type, recommendations_enabled,
              visibility, user_id, follow_up_to,
              article_url, article_title, article_source, article_excerpt
       FROM agora_threads
       WHERE id = ?`
    ).get(parentId) as AgoraThreadRow | undefined;

    if (!parent) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    if (
      parent.visibility === "private"
      && identity.type !== "admin"
      && parent.user_id !== userId
    ) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    if (parent.status !== "complete") {
      return NextResponse.json(
        { error: "Cannot follow up on a thread that is still generating" },
        { status: 400 }
      );
    }

    if (parent.follow_up_to) {
      return NextResponse.json(
        { error: "Cannot add a follow-up to a follow-up" },
        { status: 400 }
      );
    }

    const existingFollowUp = db
      .prepare("SELECT id FROM agora_threads WHERE follow_up_to = ? LIMIT 1")
      .get(parentId) as { id: string } | undefined;

    if (existingFollowUp) {
      return NextResponse.json(
        { error: "This thread already has a follow-up" },
        { status: 400 }
      );
    }

    // Only the thread owner (registered user) can submit a follow-up.
    // Anonymous threads (no user_id) don't get follow-ups.
    if (!parent.user_id) {
      return NextResponse.json(
        { error: "Follow-ups are available for registered users" },
        { status: 403 }
      );
    }

    if (identity.type !== "admin" && userId !== parent.user_id) {
      return NextResponse.json(
        { error: "Only the person who asked this question can follow up" },
        { status: 403 }
      );
    }

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? "unknown";

    if (!isOwner) {
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
    }

    const parentResponses = db.prepare(
      `SELECT ar.philosopher_id, ar.posts, ar.recommendation,
              p.name as philosopher_name, p.tradition as philosopher_tradition
       FROM agora_responses ar
       JOIN philosophers p ON ar.philosopher_id = p.id
       WHERE ar.thread_id = ?
       ORDER BY ar.sort_order`
    ).all(parentId) as ParentResponseRow[];
    const parentPhilosophers = db
      .prepare("SELECT philosopher_id FROM agora_thread_philosophers WHERE thread_id = ?")
      .all(parentId) as ThreadPhilosopherRow[];
    const philosopherIds = [
      ...parentResponses.map((response) => response.philosopher_id),
      ...parentPhilosophers
        .map((row) => row.philosopher_id)
        .filter((philosopherId, index, all) => all.indexOf(philosopherId) === index)
        .filter((philosopherId) =>
          !parentResponses.some((response) => response.philosopher_id === philosopherId)
        ),
    ];

    if (philosopherIds.length === 0) {
      return NextResponse.json(
        { error: "This thread has no philosophers to continue the dialogue" },
        { status: 400 }
      );
    }

    const questionType = parent.question_type ?? "advice";
    const recommendationsEnabled = (parent.recommendations_enabled ?? 0) === 1;
    const followUpId = crypto.randomUUID();

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
           follow_up_to,
           article_url,
           article_title,
           article_source,
           article_excerpt
         )
         VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        followUpId,
        sanitizedQuestion,
        parent.asked_by,
        clientIp,
        questionType,
        recommendationsEnabled ? 1 : 0,
        parent.visibility ?? "public",
        userId,
        parentId,
        parent.article_url ?? null,
        parent.article_title ?? null,
        parent.article_source ?? null,
        parent.article_excerpt ?? null
      );

      const insertPhilosopher = db.prepare(
        "INSERT INTO agora_thread_philosophers (thread_id, philosopher_id) VALUES (?, ?)"
      );

      for (const philosopherId of philosopherIds) {
        insertPhilosopher.run(followUpId, philosopherId);
      }
    })();

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
    console.error("Follow-up submission failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to submit follow-up",
      },
      { status: 500 }
    );
  }
}
