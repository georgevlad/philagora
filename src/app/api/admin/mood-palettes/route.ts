import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { safeJsonParse } from "@/lib/json-utils";
import type { MoodRegister } from "@/lib/mood-data";
import type { Stance } from "@/lib/types";

interface MoodPaletteRow {
  philosopher_id: string;
  philosopher_name: string;
  registers: string;
  is_active: number;
}

const VALID_STANCES = new Set<Stance>([
  "challenges",
  "defends",
  "reframes",
  "questions",
  "warns",
  "observes",
  "diagnoses",
  "provokes",
  "laments",
  "quips",
  "mocks",
  "recommends",
]);

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseStoredRegister(value: unknown): MoodRegister | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<MoodRegister>;
  const name = readString(candidate.name);
  const directive = readString(candidate.directive);

  if (!name || !directive) {
    return null;
  }

  const tensions = normalizeStringArray(candidate.tensions);
  const stances = normalizeStringArray(candidate.stances).filter(
    (stance): stance is Stance => VALID_STANCES.has(stance as Stance)
  );
  const clusters = normalizeStringArray(candidate.clusters);

  return {
    name,
    directive,
    ...(tensions.length > 0 ? { tensions } : {}),
    ...(stances.length > 0 ? { stances } : {}),
    ...(clusters.length > 0 ? { clusters } : {}),
  };
}

function parseStoredRegisters(raw: string): MoodRegister[] {
  const parsed = safeJsonParse<unknown[]>(raw, []);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((value) => parseStoredRegister(value))
    .filter((value): value is MoodRegister => value !== null);
}

function validateRegisters(value: unknown):
  | { ok: true; registers: MoodRegister[] }
  | { ok: false; error: string } {
  if (!Array.isArray(value)) {
    return { ok: false, error: "registers must be an array" };
  }

  const registers: MoodRegister[] = [];

  for (const [index, rawRegister] of value.entries()) {
    if (!rawRegister || typeof rawRegister !== "object") {
      return { ok: false, error: `Register ${index + 1} is invalid.` };
    }

    const candidate = rawRegister as Partial<MoodRegister>;
    const name = readString(candidate.name);
    const directive = readString(candidate.directive);

    if (!name) {
      return { ok: false, error: `Register ${index + 1} needs a name.` };
    }

    if (!directive) {
      return { ok: false, error: `Register ${index + 1} needs a directive.` };
    }

    const tensions = normalizeStringArray(candidate.tensions);
    const rawStances = normalizeStringArray(candidate.stances);
    const invalidStances = rawStances.filter(
      (stance) => !VALID_STANCES.has(stance as Stance)
    );

    if (invalidStances.length > 0) {
      return {
        ok: false,
        error: `Register ${index + 1} has invalid stances: ${invalidStances.join(", ")}.`,
      };
    }

    const stances = rawStances as Stance[];
    const clusters = normalizeStringArray(candidate.clusters);

    registers.push({
      name,
      directive,
      ...(tensions.length > 0 ? { tensions } : {}),
      ...(stances.length > 0 ? { stances } : {}),
      ...(clusters.length > 0 ? { clusters } : {}),
    });
  }

  return { ok: true, registers };
}

function serializePalette(row: MoodPaletteRow) {
  return {
    philosopher_id: row.philosopher_id,
    philosopher_name: row.philosopher_name,
    registers: parseStoredRegisters(row.registers),
    is_active: row.is_active === 1,
  };
}

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT mp.philosopher_id,
                p.name AS philosopher_name,
                mp.registers,
                mp.is_active
         FROM mood_palettes mp
         JOIN philosophers p ON p.id = mp.philosopher_id
         ORDER BY p.name ASC`
      )
      .all() as MoodPaletteRow[];

    return NextResponse.json(rows.map(serializePalette));
  } catch (error) {
    console.error("Failed to fetch mood palettes:", error);
    return NextResponse.json(
      { error: "Failed to fetch mood palettes" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const body = (await request.json()) as {
      philosopher_id?: unknown;
      registers?: unknown;
      is_active?: unknown;
    };

    const philosopherId = readString(body.philosopher_id);
    if (!philosopherId) {
      return NextResponse.json(
        { error: "philosopher_id is required" },
        { status: 400 }
      );
    }

    const validation = validateRegisters(body.registers ?? []);
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const db = getDb();
    const philosopher = db
      .prepare("SELECT id, name FROM philosophers WHERE id = ? LIMIT 1")
      .get(philosopherId) as { id: string; name: string } | undefined;

    if (!philosopher) {
      return NextResponse.json(
        { error: "Philosopher not found" },
        { status: 404 }
      );
    }

    db.prepare(
      `INSERT INTO mood_palettes (philosopher_id, registers, is_active, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(philosopher_id) DO UPDATE SET
         registers = excluded.registers,
         is_active = excluded.is_active,
         updated_at = datetime('now')`
    ).run(
      philosopherId,
      JSON.stringify(validation.registers),
      body.is_active ? 1 : 0
    );

    const row = db
      .prepare(
        `SELECT mp.philosopher_id,
                p.name AS philosopher_name,
                mp.registers,
                mp.is_active
         FROM mood_palettes mp
         JOIN philosophers p ON p.id = mp.philosopher_id
         WHERE mp.philosopher_id = ?
         LIMIT 1`
      )
      .get(philosopherId) as MoodPaletteRow | undefined;

    return NextResponse.json(row ? serializePalette(row) : null);
  } catch (error) {
    console.error("Failed to update mood palette:", error);
    return NextResponse.json(
      { error: "Failed to update mood palette" },
      { status: 500 }
    );
  }
}
