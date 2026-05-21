import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { parseGroupConcat } from "@/lib/db-utils";

interface DebateRow {
  id: string;
  title: string;
  trigger_article_title: string | null;
  trigger_article_source: string | null;
  trigger_article_url: string | null;
  editorial_context: string | null;
  status: string;
  debate_date: string;
  philosopher_ids: string | null;
  philosopher_names: string | null;
}

const MINIMAL_SOURCE_MATERIAL_WARNING =
  "No editorial context or trigger article provided - generation will have minimal source material.";

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
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
      editorial_context,
      philosopher_ids,
    } = body;

    const cleanTitle = optionalText(title);
    const cleanTriggerTitle = optionalText(trigger_article_title);
    const cleanTriggerSource = optionalText(trigger_article_source);
    const cleanTriggerUrl = optionalText(trigger_article_url);
    const cleanEditorialContext = optionalText(editorial_context);

    if (!cleanTitle) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(philosopher_ids) || philosopher_ids.length < 2) {
      return NextResponse.json(
        { error: "At least 2 philosopher_ids are required" },
        { status: 400 }
      );
    }

    const warnings =
      !cleanEditorialContext && !cleanTriggerTitle ? [MINIMAL_SOURCE_MATERIAL_WARNING] : [];

    const debateId = `debate-${Date.now()}`;

    db.transaction(() => {
      db.prepare(
        `INSERT INTO debates (
          id, title, trigger_article_title, trigger_article_source, trigger_article_url,
          editorial_context, status, debate_date
        )
         VALUES (?, ?, ?, ?, ?, ?, 'scheduled', datetime('now'))`
      ).run(
        debateId,
        cleanTitle,
        cleanTriggerTitle,
        cleanTriggerSource,
        cleanTriggerUrl,
        cleanEditorialContext
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

    return NextResponse.json({ debate, philosophers, warnings }, { status: 201 });
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

/** DELETE — permanently remove a debate */
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
      .prepare("SELECT id FROM debates WHERE id = ?")
      .get(id);

    if (!existing) {
      return NextResponse.json(
        { error: "Debate not found" },
        { status: 404 }
      );
    }

    db.prepare("DELETE FROM debates WHERE id = ?").run(id);

    revalidatePath("/debates");

    return NextResponse.json({ deleted: id });
  } catch (error) {
    console.error("Failed to delete debate:", error);
    return NextResponse.json(
      { error: "Failed to delete debate" },
      { status: 500 }
    );
  }
}
