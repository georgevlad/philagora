import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { parseGroupConcat } from "@/lib/db-utils";

interface ThreadRow {
  id: string;
  question: string;
  asked_by: string;
  status: string;
  created_at: string;
  philosopher_ids: string;
  philosopher_names: string;
}

/** POST — Create a new agora thread */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { question, asked_by, philosopher_ids } = body;

    if (!question?.trim()) {
      return NextResponse.json(
        { error: "question is required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(philosopher_ids) || philosopher_ids.length < 2) {
      return NextResponse.json(
        { error: "At least 2 philosopher_ids are required" },
        { status: 400 }
      );
    }

    const threadId = `agora-${Date.now()}`;

    db.transaction(() => {
      db.prepare(
        `INSERT INTO agora_threads (id, question, asked_by, status)
         VALUES (?, ?, ?, 'pending')`
      ).run(threadId, question.trim(), asked_by || "Anonymous User");

      const insertPhilosopher = db.prepare(
        "INSERT INTO agora_thread_philosophers (thread_id, philosopher_id) VALUES (?, ?)"
      );
      for (const pid of philosopher_ids) {
        insertPhilosopher.run(threadId, pid);
      }
    })();

    const thread = db
      .prepare("SELECT * FROM agora_threads WHERE id = ?")
      .get(threadId);

    const philosophers = db
      .prepare(
        `SELECT p.id, p.name, p.tradition, p.color, p.initials
         FROM philosophers p
         JOIN agora_thread_philosophers atp ON p.id = atp.philosopher_id
         WHERE atp.thread_id = ?`
      )
      .all(threadId);

    return NextResponse.json({ thread, philosophers }, { status: 201 });
  } catch (error) {
    console.error("Failed to create agora thread:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create thread" },
      { status: 500 }
    );
  }
}

/** GET — List all agora threads */
export async function GET() {
  try {
    const db = getDb();

    const rows = db
      .prepare(
        `SELECT t.*,
           GROUP_CONCAT(atp.philosopher_id) as philosopher_ids,
           GROUP_CONCAT(p.name) as philosopher_names
         FROM agora_threads t
         LEFT JOIN agora_thread_philosophers atp ON t.id = atp.thread_id
         LEFT JOIN philosophers p ON atp.philosopher_id = p.id
         GROUP BY t.id
         ORDER BY t.created_at DESC`
      )
      .all() as ThreadRow[];

    const threads = rows.map((row) => ({
      ...row,
      philosopher_ids: parseGroupConcat(row.philosopher_ids),
      philosopher_names: parseGroupConcat(row.philosopher_names),
    }));

    return NextResponse.json(threads);
  } catch (error) {
    console.error("Failed to fetch agora threads:", error);
    return NextResponse.json(
      { error: "Failed to fetch agora threads" },
      { status: 500 }
    );
  }
}

/** DELETE — permanently remove an agora thread */
export async function DELETE(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const existing = db
      .prepare("SELECT id FROM agora_threads WHERE id = ?")
      .get(id);

    if (!existing) {
      return NextResponse.json(
        { error: "Thread not found" },
        { status: 404 }
      );
    }

    db.prepare("DELETE FROM agora_threads WHERE id = ?").run(id);

    revalidatePath("/agora");

    return NextResponse.json({ deleted: id });
  } catch (error) {
    console.error("Failed to delete agora thread:", error);
    return NextResponse.json(
      { error: "Failed to delete agora thread" },
      { status: 500 }
    );
  }
}
