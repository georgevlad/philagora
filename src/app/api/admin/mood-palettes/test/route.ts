import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { safeJsonParse } from "@/lib/json-utils";
import { getMoodConfig, type MoodResult } from "@/lib/mood-service";
import type { MoodRegister } from "@/lib/mood-data";
import type { Stance } from "@/lib/types";

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

function normalizeNullableStance(value: unknown): Stance | null {
  const stance = readString(value);
  if (!stance) return null;
  return VALID_STANCES.has(stance as Stance) ? (stance as Stance) : null;
}

function normalizeNullableString(value: unknown): string | null {
  const normalized = readString(value);
  return normalized || null;
}

function parseStoredRegisters(raw: string): MoodRegister[] {
  const parsed = safeJsonParse<unknown[]>(raw, []);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((value) => {
      if (!value || typeof value !== "object") return null;

      const candidate = value as Partial<MoodRegister>;
      const name = readString(candidate.name);
      const directive = readString(candidate.directive);

      if (!name || !directive) return null;

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
      } satisfies MoodRegister;
    })
    .filter((value): value is MoodRegister => value !== null);
}

function hasIntersection(left: string[] | undefined, right: string[]): boolean {
  if (!left?.length || right.length === 0) return false;

  const rightSet = new Set(right);
  return left.some((value) => rightSet.has(value));
}

function includesValue(values: string[] | undefined, value: string | null): boolean {
  if (!values?.length || !value) return false;
  return values.includes(value);
}

function buildMoodResult(register: MoodRegister, pass: number): MoodResult {
  return {
    register: register.name,
    directive: register.directive,
    line: `EMOTIONAL REGISTER: ${register.name} \u2014 ${register.directive}`,
    pass,
  };
}

function previewResolveMood(
  registers: MoodRegister[],
  tensions: string[],
  stance: Stance | null,
  topicCluster: string | null
): MoodResult | null {
  if (registers.length === 0) return null;

  for (const register of registers) {
    if (
      hasIntersection(register.tensions, tensions) &&
      includesValue(register.stances, stance)
    ) {
      return buildMoodResult(register, 1);
    }
  }

  for (const register of registers) {
    if (hasIntersection(register.tensions, tensions)) {
      return buildMoodResult(register, 2);
    }
  }

  for (const register of registers) {
    if (
      includesValue(register.stances, stance) &&
      includesValue(register.clusters, topicCluster)
    ) {
      return buildMoodResult(register, 3);
    }
  }

  for (const register of registers) {
    if (includesValue(register.stances, stance)) {
      return buildMoodResult(register, 4);
    }
  }

  for (const register of registers) {
    if (includesValue(register.clusters, topicCluster)) {
      return buildMoodResult(register, 5);
    }
  }

  return buildMoodResult(registers[0], 6);
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const body = (await request.json()) as {
      philosopher_id?: unknown;
      tensions?: unknown;
      stance?: unknown;
      topic_cluster?: unknown;
    };

    const philosopherId = readString(body.philosopher_id);
    if (!philosopherId) {
      return NextResponse.json(
        { error: "philosopher_id is required" },
        { status: 400 }
      );
    }

    const rawStance = readString(body.stance);
    if (rawStance && !VALID_STANCES.has(rawStance as Stance)) {
      return NextResponse.json(
        { error: "Invalid stance" },
        { status: 400 }
      );
    }

    const db = getDb();
    const row = db
      .prepare(
        `SELECT registers, is_active
         FROM mood_palettes
         WHERE philosopher_id = ?
         LIMIT 1`
      )
      .get(philosopherId) as { registers: string; is_active: number } | undefined;

    if (!row) {
      return NextResponse.json({
        result: null,
        reason: "No mood palette found for this philosopher.",
      });
    }

    if (row.is_active !== 1) {
      return NextResponse.json({
        result: null,
        reason: "This philosopher's palette is inactive.",
      });
    }

    const registers = parseStoredRegisters(row.registers);
    if (registers.length === 0) {
      return NextResponse.json({
        result: null,
        reason: "This philosopher's palette has no valid registers.",
      });
    }

    const result = previewResolveMood(
      registers,
      normalizeStringArray(body.tensions),
      normalizeNullableStance(body.stance),
      normalizeNullableString(body.topic_cluster)
    );

    const config = getMoodConfig();
    const notes: string[] = [];

    if (!config.enabled) {
      notes.push("Preview ignores the global toggle. Mood system is currently disabled.");
    }

    if (result) {
      return NextResponse.json({
        result,
        ...(notes.length > 0 ? { reason: notes.join(" ") } : {}),
      });
    }

    notes.push("No register matches this combination.");

    return NextResponse.json({
      result: null,
      reason: notes.join(" "),
    });
  } catch (error) {
    console.error("Failed to test mood palette:", error);
    return NextResponse.json(
      { error: "Failed to test mood palette" },
      { status: 500 }
    );
  }
}
