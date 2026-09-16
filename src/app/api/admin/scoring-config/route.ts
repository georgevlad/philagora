import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { parseAdminJsonObject } from "@/lib/admin-request";
import {
  DEFAULT_GENERATION_MODEL,
  DEFAULT_IMAGE_GENERATION_MODEL,
  DEFAULT_SCORING_MODEL,
  DEFAULT_SCORING_CONFIG_VALUES,
  parseMoodContentTypes,
  parseMoodEnabled,
  parseGenerationModel,
  parseImageGenerationModel,
  parseScoringModel,
  parseScoreTiers,
  parseStanceGuidance,
  parseTensionVocabulary,
  SCORING_CONFIG_KEYS,
  type ScoringConfigKey,
  type StanceGuidanceConfig,
} from "@/lib/scoring-config";

function isAllowedKey(value: string): value is ScoringConfigKey {
  return (SCORING_CONFIG_KEYS as string[]).includes(value);
}

function readConfig() {
  const db = getDb();
  const rows = db
    .prepare("SELECT key, value FROM scoring_config")
    .all() as Array<{ key: string; value: string }>;

  const byKey = new Map(rows.map((row) => [row.key, row.value]));

  return {
    scoring_model: parseScoringModel(
      byKey.get("scoring_model") ?? DEFAULT_SCORING_CONFIG_VALUES.scoring_model
    ),
    generation_model: parseGenerationModel(
      byKey.get("generation_model") ??
        DEFAULT_SCORING_CONFIG_VALUES.generation_model
    ),
    synthesis_model: parseGenerationModel(
      byKey.get("synthesis_model") ??
        DEFAULT_SCORING_CONFIG_VALUES.synthesis_model
    ),
    image_generation_model: parseImageGenerationModel(
      byKey.get("image_generation_model") ??
        DEFAULT_SCORING_CONFIG_VALUES.image_generation_model
    ),
    score_tiers: parseScoreTiers(
      byKey.get("score_tiers") ?? DEFAULT_SCORING_CONFIG_VALUES.score_tiers
    ),
    tension_vocabulary: parseTensionVocabulary(
      byKey.get("tension_vocabulary") ?? DEFAULT_SCORING_CONFIG_VALUES.tension_vocabulary
    ),
    stance_guidance: parseStanceGuidance(
      byKey.get("stance_guidance") ?? DEFAULT_SCORING_CONFIG_VALUES.stance_guidance
    ),
    mood_enabled: parseMoodEnabled(
      byKey.get("mood_enabled") ?? DEFAULT_SCORING_CONFIG_VALUES.mood_enabled
    ),
    mood_content_types: parseMoodContentTypes(
      byKey.get("mood_content_types") ?? DEFAULT_SCORING_CONFIG_VALUES.mood_content_types
    ),
  };
}

function normalizeValue(key: ScoringConfigKey, value: unknown) {
  if (key === "scoring_model") {
    return parseScoringModel(JSON.stringify(value ?? DEFAULT_SCORING_MODEL));
  }

  if (key === "generation_model" || key === "synthesis_model") {
    return parseGenerationModel(
      JSON.stringify(value ?? DEFAULT_GENERATION_MODEL)
    );
  }

  if (key === "image_generation_model") {
    return parseImageGenerationModel(
      JSON.stringify(value ?? DEFAULT_IMAGE_GENERATION_MODEL)
    );
  }

  if (key === "score_tiers") {
    return parseScoreTiers(JSON.stringify(value));
  }

  if (key === "tension_vocabulary") {
    return parseTensionVocabulary(JSON.stringify(value));
  }

  if (key === "mood_enabled") {
    return parseMoodEnabled(JSON.stringify(value));
  }

  if (key === "mood_content_types") {
    return parseMoodContentTypes(JSON.stringify(value));
  }

  const typed = (value ?? {}) as Partial<StanceGuidanceConfig>;
  return parseStanceGuidance(
    JSON.stringify({
      guidance_text: typed.guidance_text ?? "",
      preferred_friction_pairs: typed.preferred_friction_pairs ?? [],
      deprioritize: typed.deprioritize ?? [],
    })
  );
}

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    return NextResponse.json(readConfig());
  } catch (error) {
    console.error("Failed to fetch scoring config:", error);
    return NextResponse.json(
      { error: "Failed to fetch scoring config" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const body = await parseAdminJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: "A valid JSON object is required" }, { status: 400 });
    }
    const { key, value } = body as { key?: string; value?: unknown };

    if (!key || !isAllowedKey(key)) {
      return NextResponse.json(
        { error: "Invalid config key" },
        { status: 400 }
      );
    }

    const normalizedValue = normalizeValue(key, value);
    const db = getDb();

    db.prepare(
      `INSERT INTO scoring_config (key, value, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = datetime('now')`
    ).run(key, JSON.stringify(normalizedValue));

    return NextResponse.json(readConfig());
  } catch (error) {
    console.error("Failed to update scoring config:", error);
    return NextResponse.json(
      { error: "Failed to update scoring config" },
      { status: 500 }
    );
  }
}
