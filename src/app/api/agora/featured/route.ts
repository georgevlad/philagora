import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

interface ThreadRow {
  id: string;
  question: string;
  asked_by: string;
  question_type: string;
  article_source: string | null;
  created_at: string;
  has_follow_up: number;
}

interface PhilosopherRow {
  id: string;
  name: string;
  initials: string;
  color: string;
  tradition: string;
}

/** GET /api/agora/featured — Last 10 completed agora threads for the landing page */
export async function GET() {
  try {
    const db = getDb();

    const threads = db
      .prepare(
        `SELECT t.id, t.question, t.asked_by, t.question_type, t.article_source, t.created_at,
                EXISTS(SELECT 1 FROM agora_threads child WHERE child.follow_up_to = t.id) as has_follow_up
         FROM agora_threads t
         WHERE t.status = 'complete'
           AND t.visibility = 'public'
           AND t.hidden_from_feed = 0
           AND t.follow_up_to IS NULL
         ORDER BY t.created_at DESC
         LIMIT 10`
      )
      .all() as ThreadRow[];

    const getPhilosophers = db.prepare(
      `SELECT p.id, p.name, p.initials, p.color, p.tradition
       FROM philosophers p
       JOIN agora_thread_philosophers atp ON p.id = atp.philosopher_id
       WHERE atp.thread_id = ?`
    );

    const result = threads.map((thread) => ({
      ...thread,
      has_follow_up: thread.has_follow_up === 1,
      philosophers: getPhilosophers.all(thread.id) as PhilosopherRow[],
    }));

    return NextResponse.json({ threads: result });
  } catch (error) {
    console.error("Failed to fetch featured agora threads:", error);
    return NextResponse.json(
      { error: "Failed to fetch featured threads" },
      { status: 500 }
    );
  }
}
