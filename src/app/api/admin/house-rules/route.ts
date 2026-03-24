import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

interface HouseRulesRow {
  id: number;
  version: number;
  rules_text: string;
  is_active: number;
  created_at: string;
  notes: string;
}

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const db = getDb();
    const versions = db
      .prepare(
        `SELECT * FROM house_rules
         ORDER BY version DESC, created_at DESC`
      )
      .all() as HouseRulesRow[];

    return NextResponse.json({
      active_rules: versions.find((row) => row.is_active === 1) ?? null,
      versions,
    });
  } catch (error) {
    console.error("Failed to fetch house rules:", error);
    return NextResponse.json(
      { error: "Failed to fetch house rules" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const db = getDb();
    const body = await request.json();
    const { rules_text, notes } = body as {
      rules_text?: string;
      notes?: string;
    };

    if (!rules_text?.trim()) {
      return NextResponse.json(
        { error: "rules_text is required" },
        { status: 400 }
      );
    }

    const versionRow = db
      .prepare("SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM house_rules")
      .get() as { next_version: number };

    const result = db
      .prepare(
        `INSERT INTO house_rules (version, rules_text, is_active, notes)
         VALUES (?, ?, 0, ?)`
      )
      .run(versionRow.next_version, rules_text.trim(), notes?.trim() ?? "");

    const created = db
      .prepare("SELECT * FROM house_rules WHERE id = ?")
      .get(result.lastInsertRowid);

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to create house rules version:", error);
    return NextResponse.json(
      { error: "Failed to create house rules version" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const db = getDb();
    const body = await request.json();
    const { id, action } = body as { id?: number; action?: string };

    if (!id || !["set_active", "deactivate"].includes(action ?? "")) {
      return NextResponse.json(
        { error: "id and action ('set_active' or 'deactivate') are required" },
        { status: 400 }
      );
    }

    const existing = db
      .prepare("SELECT * FROM house_rules WHERE id = ?")
      .get(id) as HouseRulesRow | undefined;

    if (!existing) {
      return NextResponse.json(
        { error: "House rules version not found" },
        { status: 404 }
      );
    }

    if (action === "set_active") {
      const setActive = db.transaction(() => {
        db.prepare("UPDATE house_rules SET is_active = 0 WHERE is_active = 1").run();
        db.prepare("UPDATE house_rules SET is_active = 1 WHERE id = ?").run(id);
      });

      setActive();
    } else {
      db.prepare("UPDATE house_rules SET is_active = 0 WHERE id = ?").run(id);
    }

    const updated = db
      .prepare("SELECT * FROM house_rules WHERE id = ?")
      .get(id);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update house rules:", error);
    return NextResponse.json(
      { error: "Failed to update house rules" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const db = getDb();
    const body = await request.json();
    const { id } = body as { id?: number };

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const existing = db
      .prepare("SELECT id, is_active FROM house_rules WHERE id = ?")
      .get(id) as { id: number; is_active: number } | undefined;

    if (!existing) {
      return NextResponse.json(
        { error: "House rules version not found" },
        { status: 404 }
      );
    }

    if (existing.is_active === 1) {
      return NextResponse.json(
        {
          error:
            "Cannot delete the active house rules. Deactivate them or activate another version first.",
        },
        { status: 400 }
      );
    }

    db.prepare("DELETE FROM house_rules WHERE id = ?").run(id);

    return NextResponse.json({ deleted: id });
  } catch (error) {
    console.error("Failed to delete house rules:", error);
    return NextResponse.json(
      { error: "Failed to delete house rules" },
      { status: 500 }
    );
  }
}
