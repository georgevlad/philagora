import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { parseGroupConcat } from "@/lib/db-utils";

interface DebateRow {
  id: string;
  title: string;
  trigger_article_title: string;
  trigger_article_source: string;
  trigger_article_url: string | null;
  status: string;
  debate_date: string;
  philosopher_ids: string;
  philosopher_names: string;
}

/** POST — Create a new debate */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const {
      title,
      trigger_article_title,
      trigger_article_source,
      trigger_article_url,
      philosopher_ids,
    } = body;

    if (!title || !trigger_article_title || !trigger_article_source) {
      return NextResponse.json(
        { error: "title, trigger_article_title, and trigger_article_source are required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(philosopher_ids) || philosopher_ids.length < 2) {
      return NextResponse.json(
        { error: "At least 2 philosopher_ids are required" },
        { status: 400 }
      );
    }

    const debateId = `debate-${Date.now()}`;

    db.transaction(() => {
      db.prepare(
        `INSERT INTO debates (id, title, trigger_article_title, trigger_article_source, trigger_article_url, status, debate_date)
         VALUES (?, ?, ?, ?, ?, 'scheduled', datetime('now'))`
      ).run(
        debateId,
        title,
        trigger_article_title,
        trigger_article_source,
        trigger_article_url || null
      );

      const insertPhilosopher = db.prepare(
        "INSERT INTO debate_philosophers (debate_id, philosopher_id) VALUES (?, ?)"
      );
      for (const pid of philosopher_ids) {
        insertPhilosopher.run(debateId, pid);
      }
    })();

    // Fetch the created debate with philosopher info
    const debate = db
      .prepare("SELECT * FROM debates WHERE id = ?")
      .get(debateId);

    const philosophers = db
      .prepare(
        `SELECT p.id, p.name, p.tradition, p.color, p.initials
         FROM philosophers p
         JOIN debate_philosophers dp ON p.id = dp.philosopher_id
         WHERE dp.debate_id = ?`
      )
      .all(debateId);

    return NextResponse.json({ debate, philosophers }, { status: 201 });
  } catch (error) {
    console.error("Failed to create debate:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create debate" },
      { status: 500 }
    );
  }
}

/** GET — List all debates */
export async function GET() {
  try {
    const db = getDb();

    const rows = db
      .prepare(
        `SELECT d.*,
           GROUP_CONCAT(dp.philosopher_id) as philosopher_ids,
           GROUP_CONCAT(p.name) as philosopher_names
         FROM debates d
         LEFT JOIN debate_philosophers dp ON d.id = dp.debate_id
         LEFT JOIN philosophers p ON dp.philosopher_id = p.id
         GROUP BY d.id
         ORDER BY d.debate_date DESC`
      )
      .all() as DebateRow[];

    const debates = rows.map((row) => ({
      ...row,
      philosopher_ids: parseGroupConcat(row.philosopher_ids),
      philosopher_names: parseGroupConcat(row.philosopher_names),
    }));

    return NextResponse.json(debates);
  } catch (error) {
    console.error("Failed to fetch debates:", error);
    return NextResponse.json(
      { error: "Failed to fetch debates" },
      { status: 500 }
    );
  }
}
