import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/lib/admin-auth";
import {
  DEFAULT_GENERATION_MODEL,
  DEFAULT_IMAGE_GENERATION_MODEL,
  DEFAULT_SCORING_MODEL,
  DEFAULT_SCORING_CONFIG_VALUES,
  parseGenerationModel,
  parseImageGenerationModel,
  parseScoringModel,
  parseScoreTiers,
  parseStanceGuidance,
  parseTensionVocabulary,
  SCORING_CONFIG_KEYS,
  slugifyTensionLabel,
  type ScoringConfigKey,
  type StanceGuidanceConfig,
  type TensionVocabularyItem,
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
    const normalized = Array.isArray(value)
      ? value.map((item) => {
          const typed = item as Partial<TensionVocabularyItem>;
          const label = typed.label?.trim() ?? "";

          return {
            id: slugifyTensionLabel(label || typed.id || ""),
            label,
            description: typed.description?.trim() ?? "",
          };
        })
      : [];

    return parseTensionVocabulary(JSON.stringify(normalized));
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

function ensureAdmin(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminToken(token);
}

export async function GET(request: NextRequest) {
  if (!ensureAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  if (!ensureAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
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
