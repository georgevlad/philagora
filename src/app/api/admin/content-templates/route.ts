import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/lib/admin-auth";
import type { ContentTemplateRow } from "@/lib/db-types";
import {
  CONTENT_TEMPLATES,
  type ContentTypeKey,
} from "@/lib/content-templates";

const TEMPLATE_LABELS: Record<ContentTypeKey, string> = {
  news_reaction: "News Reaction",
  quip: "Quip",
  timeless_reflection: "Timeless Reflection",
  cross_philosopher_reply: "Cross-Philosopher Reply",
  historical_reaction: "Historical Reaction",
  debate_opening: "Debate Opening",
  debate_rebuttal: "Debate Rebuttal",
  agora_response: "Agora Response",
  debate_synthesis: "Debate Synthesis",
  agora_synthesis: "Agora Synthesis",
};

const TEMPLATE_KEYS = Object.keys(CONTENT_TEMPLATES) as ContentTypeKey[];

function ensureAdmin(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminToken(token);
}

function isTemplateKey(value: string | null): value is ContentTypeKey {
  return Boolean(value && TEMPLATE_KEYS.includes(value as ContentTypeKey));
}

export async function GET(request: NextRequest) {
  if (!ensureAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");
    const includeDefault = searchParams.get("include_default") === "true";

    if (key) {
      if (!isTemplateKey(key)) {
        return NextResponse.json(
          { error: "Invalid template key" },
          { status: 400 }
        );
      }

      const versions = db
        .prepare(
          `SELECT * FROM content_templates
           WHERE template_key = ?
           ORDER BY version DESC, created_at DESC`
        )
        .all(key) as ContentTemplateRow[];

      const activeTemplate = versions.find((row) => row.is_active === 1) ?? null;

      return NextResponse.json({
        template_key: key,
        label: TEMPLATE_LABELS[key],
        active_template: activeTemplate,
        versions,
        code_default: includeDefault ? CONTENT_TEMPLATES[key].instructions : undefined,
      });
    }

    const activeRows = db
      .prepare(
        `SELECT * FROM content_templates
         WHERE is_active = 1
         ORDER BY template_key ASC, version DESC`
      )
      .all() as ContentTemplateRow[];

    const activeByKey = new Map(
      activeRows.map((row) => [row.template_key, row] as const)
    );

    return NextResponse.json({
      templates: TEMPLATE_KEYS.map((templateKey) => ({
        template_key: templateKey,
        label: TEMPLATE_LABELS[templateKey],
        active_template: activeByKey.get(templateKey) ?? null,
        code_default: CONTENT_TEMPLATES[templateKey].instructions,
        using_code_default: !activeByKey.has(templateKey),
      })),
    });
  } catch (error) {
    console.error("Failed to fetch content templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch content templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!ensureAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const body = await request.json();
    const {
      template_key,
      instructions,
      notes,
    } = body as {
      template_key?: string;
      instructions?: string;
      notes?: string;
    };

    if (!isTemplateKey(template_key ?? null) || !instructions?.trim()) {
      return NextResponse.json(
        { error: "template_key and instructions are required" },
        { status: 400 }
      );
    }

    const versionRow = db
      .prepare(
        `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
         FROM content_templates
         WHERE template_key = ?`
      )
      .get(template_key) as { next_version: number };

    const result = db
      .prepare(
        `INSERT INTO content_templates (template_key, version, instructions, is_active, notes)
         VALUES (?, ?, ?, 0, ?)`
      )
      .run(template_key, versionRow.next_version, instructions.trim(), notes?.trim() ?? "");

    const created = db
      .prepare("SELECT * FROM content_templates WHERE id = ?")
      .get(result.lastInsertRowid);

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to create content template:", error);
    return NextResponse.json(
      { error: "Failed to create content template" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!ensureAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

    const template = db
      .prepare("SELECT * FROM content_templates WHERE id = ?")
      .get(id) as ContentTemplateRow | undefined;

    if (!template) {
      return NextResponse.json(
        { error: "Template version not found" },
        { status: 404 }
      );
    }

    if (action === "set_active") {
      const setActive = db.transaction(() => {
        db.prepare(
          "UPDATE content_templates SET is_active = 0 WHERE template_key = ? AND is_active = 1"
        ).run(template.template_key);

        db.prepare("UPDATE content_templates SET is_active = 1 WHERE id = ?").run(
          id
        );
      });

      setActive();
    } else {
      db.prepare("UPDATE content_templates SET is_active = 0 WHERE id = ?").run(id);
    }

    const updated = db
      .prepare("SELECT * FROM content_templates WHERE id = ?")
      .get(id);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update content template:", error);
    return NextResponse.json(
      { error: "Failed to update content template" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!ensureAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const body = await request.json();
    const { id } = body as { id?: number };

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const existing = db
      .prepare("SELECT id, is_active FROM content_templates WHERE id = ?")
      .get(id) as { id: number; is_active: number } | undefined;

    if (!existing) {
      return NextResponse.json(
        { error: "Template version not found" },
        { status: 404 }
      );
    }

    if (existing.is_active === 1) {
      return NextResponse.json(
        {
          error:
            "Cannot delete the active template. Deactivate it or activate another version first.",
        },
        { status: 400 }
      );
    }

    db.prepare("DELETE FROM content_templates WHERE id = ?").run(id);

    return NextResponse.json({ deleted: id });
  } catch (error) {
    console.error("Failed to delete content template:", error);
    return NextResponse.json(
      { error: "Failed to delete content template" },
      { status: 500 }
    );
  }
}
