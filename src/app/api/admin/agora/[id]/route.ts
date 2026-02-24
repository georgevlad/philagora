import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/** GET — Fetch full agora thread detail */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;

    const thread = db
      .prepare("SELECT * FROM agora_threads WHERE id = ?")
      .get(id);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const philosophers = db
      .prepare(
        `SELECT p.id, p.name, p.tradition, p.color, p.initials, p.bio, p.era
         FROM philosophers p
         JOIN agora_thread_philosophers atp ON p.id = atp.philosopher_id
         WHERE atp.thread_id = ?`
      )
      .all(id);

    const responses = db
      .prepare(
        `SELECT ar.*, p.name as philosopher_name, p.color as philosopher_color,
                p.initials as philosopher_initials, p.tradition as philosopher_tradition
         FROM agora_responses ar
         JOIN philosophers p ON ar.philosopher_id = p.id
         WHERE ar.thread_id = ?
         ORDER BY ar.sort_order`
      )
      .all(id);

    const synthesis = db
      .prepare("SELECT * FROM agora_synthesis WHERE thread_id = ?")
      .get(id);

    return NextResponse.json({ thread, philosophers, responses, synthesis });
  } catch (error) {
    console.error("Failed to fetch agora thread:", error);
    return NextResponse.json(
      { error: "Failed to fetch agora thread" },
      { status: 500 }
    );
  }
}

/** PATCH — Update thread status */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const body = await request.json();

    const thread = db
      .prepare("SELECT id FROM agora_threads WHERE id = ?")
      .get(id);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    if (body.status) {
      db.prepare("UPDATE agora_threads SET status = ? WHERE id = ?").run(
        body.status,
        id
      );
    }

    const updated = db
      .prepare("SELECT * FROM agora_threads WHERE id = ?")
      .get(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update agora thread:", error);
    return NextResponse.json(
      { error: "Failed to update agora thread" },
      { status: 500 }
    );
  }
}
