import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const philosopher = db
        .prepare(
          `SELECT p.*,
                  (SELECT sp.id FROM system_prompts sp
                   WHERE sp.philosopher_id = p.id AND sp.is_active = 1
                   LIMIT 1) as active_prompt_id
           FROM philosophers p
           WHERE p.id = ?`
        )
        .get(id);

      if (!philosopher) {
        return NextResponse.json(
          { error: "Philosopher not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(philosopher);
    }

    const philosophers = db
      .prepare(
        `SELECT p.*,
                (SELECT sp.id FROM system_prompts sp
                 WHERE sp.philosopher_id = p.id AND sp.is_active = 1
                 LIMIT 1) as active_prompt_id
         FROM philosophers p
         ORDER BY p.name ASC`
      )
      .all();

    return NextResponse.json(philosophers);
  } catch (error) {
    console.error("Failed to fetch philosophers:", error);
    return NextResponse.json(
      { error: "Failed to fetch philosophers" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { id, name, tradition, color, initials, bio, era, key_works, core_principles } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Philosopher id is required" },
        { status: 400 }
      );
    }

    const existing = db.prepare("SELECT id FROM philosophers WHERE id = ?").get(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Philosopher not found" },
        { status: 404 }
      );
    }

    const stmt = db.prepare(
      `UPDATE philosophers
       SET name = ?, tradition = ?, color = ?, initials = ?, bio = ?, era = ?,
           key_works = ?, core_principles = ?
       WHERE id = ?`
    );

    stmt.run(
      name,
      tradition,
      color,
      initials,
      bio,
      era,
      JSON.stringify(key_works ?? []),
      JSON.stringify(core_principles ?? []),
      id
    );

    const updated = db.prepare("SELECT * FROM philosophers WHERE id = ?").get(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update philosopher:", error);
    return NextResponse.json(
      { error: "Failed to update philosopher" },
      { status: 500 }
    );
  }
}
