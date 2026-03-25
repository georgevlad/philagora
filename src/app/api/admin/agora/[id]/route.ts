import { NextRequest, NextResponse } from "next/server";
import {
  getAgoraSynthesisForThread,
  parseAgoraRecommendation,
} from "@/lib/agora";
import { getDb } from "@/lib/db";
import type { AgoraSynthesisSections } from "@/lib/types";

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
      .get(id) as
      | {
          id: string;
          question: string;
          asked_by: string;
          status: string;
          question_type?: string;
          recommendations_enabled?: number;
          created_at: string;
        }
      | undefined;
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

    const responses = (db
      .prepare(
        `SELECT ar.*, p.name as philosopher_name, p.color as philosopher_color,
                p.initials as philosopher_initials, p.tradition as philosopher_tradition
         FROM agora_responses ar
         JOIN philosophers p ON ar.philosopher_id = p.id
         WHERE ar.thread_id = ?
         ORDER BY ar.sort_order`
      )
      .all(id) as Array<{
      id: string;
      thread_id: string;
      philosopher_id: string;
      posts: string;
      recommendation?: string | null;
      sort_order: number;
      philosopher_name: string;
      philosopher_color: string;
      philosopher_initials: string;
      philosopher_tradition: string;
    }>).map((response) => ({
      ...response,
      posts: JSON.parse(response.posts) as string[],
      recommendation: parseAgoraRecommendation(response.recommendation) ?? null,
    }));

    const parsedSynthesis = getAgoraSynthesisForThread(db, id);
    const synthesis = parsedSynthesis
      ? (() => {
          const sections = parsedSynthesis.sections as AgoraSynthesisSections;

          return {
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
        question_type: thread.question_type ?? "advice",
        recommendations_enabled: thread.recommendations_enabled ?? 0,
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
