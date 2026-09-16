import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getMoodConfig, loadPalette, resolveMoodFromPalette } from "@/lib/mood-service";
import { parseAdminJsonObject } from "@/lib/admin-request";
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

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const body = await parseAdminJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
    }

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

    const palette = loadPalette(philosopherId);

    if (!palette) {
      return NextResponse.json({
        result: null,
        reason: "No mood palette found for this philosopher.",
      });
    }

    if (!palette.isActive) {
      return NextResponse.json({
        result: null,
        reason: "This philosopher's palette is inactive.",
      });
    }

    const registers = palette.registers;
    if (registers.length === 0) {
      return NextResponse.json({
        result: null,
        reason: "This philosopher's palette has no valid registers.",
      });
    }

    const result = resolveMoodFromPalette(
      registers,
      normalizeStringArray(body.tensions),
      normalizeNullableStance(body.stance),
      normalizeNullableString(body.topic_cluster),
      true
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
