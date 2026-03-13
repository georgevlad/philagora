import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const PHILOSOPHER_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { id, name, tradition, color, initials, bio, era, key_works, core_principles, followers } = body;

    if (!id || !name || !tradition || !era) {
      return NextResponse.json(
        { error: "id, name, tradition, and era are required" },
        { status: 400 }
      );
    }

    if (!PHILOSOPHER_ID_PATTERN.test(String(id))) {
      return NextResponse.json(
        { error: "id must contain only lowercase letters, numbers, and hyphens" },
        { status: 400 }
      );
    }

    const existing = db.prepare("SELECT id FROM philosophers WHERE id = ?").get(id);
    if (existing) {
      return NextResponse.json(
        { error: `Philosopher with id "${id}" already exists` },
        { status: 409 }
      );
    }

    const normalizedFollowers = Number.isFinite(Number(followers)) ? Number(followers) : 0;

    const stmt = db.prepare(
      `INSERT INTO philosophers (id, name, tradition, color, initials, bio, era, key_works, core_principles, followers, posts_count, debates_count, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1)`
    );

    stmt.run(
      id,
      name,
      tradition,
      color || "#6B7280",
      initials || name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase(),
      bio || "",
      era,
      JSON.stringify(key_works ?? []),
      JSON.stringify(core_principles ?? []),
      normalizedFollowers
    );

    const created = db.prepare("SELECT * FROM philosophers WHERE id = ?").get(id);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to create philosopher:", error);
    return NextResponse.json(
      { error: "Failed to create philosopher" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { id, name, tradition, color, initials, bio, era, key_works, core_principles, followers, is_active } = body;

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
           key_works = ?, core_principles = ?, followers = COALESCE(?, followers), is_active = COALESCE(?, is_active)
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
      followers ?? null,
      is_active ?? null,
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
