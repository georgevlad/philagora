import { NextRequest, NextResponse } from "next/server";
import {
  getAgoraSynthesisForThread,
  parseAgoraRecommendation,
} from "@/lib/agora";
import { getDb } from "@/lib/db";
import type { AgoraSynthesisSections } from "@/lib/types";

interface ThreadRow {
  id: string;
  question: string;
  asked_by: string;
  status: string;
  question_type?: string;
  recommendations_enabled?: number;
  visibility?: "public" | "private";
  user_id?: string | null;
  article_url?: string | null;
  article_title?: string | null;
  article_source?: string | null;
  article_excerpt?: string | null;
  created_at: string;
}

interface PhilosopherRow {
  id: string;
  name: string;
  initials: string;
  color: string;
  tradition: string;
}

interface ResponseRow {
  id: string;
  thread_id: string;
  philosopher_id: string;
  posts: string; // JSON string
  recommendation?: string | null;
  sort_order: number;
  philosopher_name: string;
  philosopher_initials: string;
  philosopher_color: string;
  philosopher_tradition: string;
}

/** GET /api/agora/[threadId] — Full thread state for polling UI and display */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const db = getDb();
    const { threadId } = await params;

    const thread = db
      .prepare(
        `SELECT id, question, asked_by, status, question_type, recommendations_enabled,
                visibility, user_id,
                article_url, article_title, article_source, article_excerpt, created_at
         FROM agora_threads
         WHERE id = ?`
      )
      .get(threadId) as ThreadRow | undefined;

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const philosophers = db
      .prepare(
        `SELECT p.id, p.name, p.initials, p.color, p.tradition
         FROM philosophers p
         JOIN agora_thread_philosophers atp ON p.id = atp.philosopher_id
         WHERE atp.thread_id = ?`
      )
      .all(threadId) as PhilosopherRow[];

    const rawResponses = db
      .prepare(
        `SELECT ar.id, ar.thread_id, ar.philosopher_id, ar.posts, ar.recommendation, ar.sort_order,
                p.name as philosopher_name, p.initials as philosopher_initials,
                p.color as philosopher_color, p.tradition as philosopher_tradition
         FROM agora_responses ar
         JOIN philosophers p ON ar.philosopher_id = p.id
         WHERE ar.thread_id = ?
         ORDER BY ar.sort_order`
      )
      .all(threadId) as ResponseRow[];

    // Parse JSON posts in each response
    const responses = rawResponses.map((r) => ({
      ...r,
      posts: JSON.parse(r.posts) as string[],
      recommendation: parseAgoraRecommendation(r.recommendation) ?? null,
    }));

    const parsedSynthesis = getAgoraSynthesisForThread(db, threadId);
    const synthesis = parsedSynthesis
      ? (() => {
          const sections = parsedSynthesis.sections as AgoraSynthesisSections;

          return {
            thread_id: threadId,
            type: parsedSynthesis.type,
            ...sections,
            synthesis_type: parsedSynthesis.type,
            sections,
          };
        })()
      : null;

    return NextResponse.json({
      thread: {
        ...thread,
        recommendations_enabled: thread.recommendations_enabled ?? 0,
        question_type: thread.question_type ?? "advice",
        visibility: thread.visibility ?? "public",
        user_id: thread.user_id ?? null,
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
      responses,
      synthesis,
    });
  } catch (error) {
    console.error("Failed to fetch agora thread:", error);
    return NextResponse.json(
      { error: "Failed to fetch agora thread" },
      { status: 500 }
    );
  }
}
