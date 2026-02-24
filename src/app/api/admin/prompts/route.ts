import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const philosopherId = searchParams.get("philosopher_id");

    if (!philosopherId) {
      return NextResponse.json(
        { error: "philosopher_id query parameter is required" },
        { status: 400 }
      );
    }

    const prompts = db
      .prepare(
        `SELECT * FROM system_prompts
         WHERE philosopher_id = ?
         ORDER BY prompt_version DESC`
      )
      .all(philosopherId);

    return NextResponse.json(prompts);
  } catch (error) {
    console.error("Failed to fetch prompts:", error);
    return NextResponse.json(
      { error: "Failed to fetch prompts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { philosopher_id, system_prompt_text } = body;

    if (!philosopher_id || !system_prompt_text) {
      return NextResponse.json(
        { error: "philosopher_id and system_prompt_text are required" },
        { status: 400 }
      );
    }

    const existing = db
      .prepare("SELECT id FROM philosophers WHERE id = ?")
      .get(philosopher_id);
    if (!existing) {
      return NextResponse.json(
        { error: "Philosopher not found" },
        { status: 404 }
      );
    }

    const maxVersion = db
      .prepare(
        "SELECT MAX(prompt_version) as max_ver FROM system_prompts WHERE philosopher_id = ?"
      )
      .get(philosopher_id) as { max_ver: number | null };

    const nextVersion = (maxVersion.max_ver ?? 0) + 1;

    const result = db
      .prepare(
        `INSERT INTO system_prompts (philosopher_id, prompt_version, system_prompt_text, is_active)
         VALUES (?, ?, ?, 0)`
      )
      .run(philosopher_id, nextVersion, system_prompt_text);

    const created = db
      .prepare("SELECT * FROM system_prompts WHERE id = ?")
      .get(result.lastInsertRowid);

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to create prompt:", error);
    return NextResponse.json(
      { error: "Failed to create prompt" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { id, action } = body;

    if (!id || action !== "set_active") {
      return NextResponse.json(
        { error: "id and action ('set_active') are required" },
        { status: 400 }
      );
    }

    const prompt = db
      .prepare("SELECT * FROM system_prompts WHERE id = ?")
      .get(id) as { id: number; philosopher_id: string } | undefined;

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt not found" },
        { status: 404 }
      );
    }

    const setActive = db.transaction(() => {
      db.prepare(
        "UPDATE system_prompts SET is_active = 0 WHERE philosopher_id = ?"
      ).run(prompt.philosopher_id);

      db.prepare(
        "UPDATE system_prompts SET is_active = 1 WHERE id = ?"
      ).run(id);
    });

    setActive();

    const updated = db
      .prepare("SELECT * FROM system_prompts WHERE id = ?")
      .get(id);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to set active prompt:", error);
    return NextResponse.json(
      { error: "Failed to set active prompt" },
      { status: 500 }
    );
  }
}
