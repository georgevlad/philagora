import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

interface ThreadRow {
  id: string;
  question: string;
  asked_by: string;
  status: string;
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
  sort_order: number;
  philosopher_name: string;
  philosopher_initials: string;
  philosopher_color: string;
  philosopher_tradition: string;
}

interface SynthesisRow {
  thread_id: string;
  tensions: string; // JSON string
  agreements: string; // JSON string
  practical_takeaways: string; // JSON string
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
        "SELECT id, question, asked_by, status, created_at FROM agora_threads WHERE id = ?"
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
        `SELECT ar.id, ar.thread_id, ar.philosopher_id, ar.posts, ar.sort_order,
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
    }));

    const rawSynthesis = db
      .prepare("SELECT * FROM agora_synthesis WHERE thread_id = ?")
      .get(threadId) as SynthesisRow | undefined;

    // Parse JSON fields in synthesis
    const synthesis = rawSynthesis
      ? {
          thread_id: rawSynthesis.thread_id,
          tensions: JSON.parse(rawSynthesis.tensions) as string[],
          agreements: JSON.parse(rawSynthesis.agreements) as string[],
          practical_takeaways: JSON.parse(rawSynthesis.practical_takeaways) as string[],
        }
      : null;

    return NextResponse.json({ thread, philosophers, responses, synthesis });
  } catch (error) {
    console.error("Failed to fetch agora thread:", error);
    return NextResponse.json(
      { error: "Failed to fetch agora thread" },
      { status: 500 }
    );
  }
}
