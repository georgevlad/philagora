import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

interface ThreadRow {
  id: string;
  question: string;
  asked_by: string;
  created_at: string;
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
        `SELECT id, question, asked_by, created_at
         FROM agora_threads
         WHERE status = 'complete'
         ORDER BY created_at DESC
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
