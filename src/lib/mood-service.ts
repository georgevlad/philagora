import type { ContentTypeKey } from "@/lib/content-templates";
import { getDb } from "@/lib/db";
import { safeJsonParse } from "@/lib/json-utils";
import type { MoodRegister } from "@/lib/mood-data";
import type { Stance } from "@/lib/types";
import {
  DEFAULT_SCORING_CONFIG_VALUES,
  parseMoodContentTypes,
  parseMoodEnabled,
} from "@/lib/scoring-config";

export interface MoodResult {
  register: string;
  directive: string;
  line: string;
  pass: number;
}

interface MoodPaletteState {
  registers: MoodRegister[];
  isActive: boolean;
}

interface ArticleMoodRow {
  primary_tensions: string;
  topic_cluster: string | null;
}

const COUNTER_STANCES: Record<string, string[]> = {
  challenges: ["defends", "reframes"],
  defends: ["challenges", "questions"],
  reframes: ["challenges", "questions"],
  provokes: ["challenges", "reframes"],
  warns: ["questions", "reframes"],
  mocks: ["challenges", "defends"],
  observes: ["reframes", "questions"],
  diagnoses: ["challenges", "reframes"],
  laments: ["defends", "reframes"],
  quips: ["challenges", "mocks"],
  recommends: ["questions", "reframes"],
};

export function getMoodConfig(): { enabled: boolean; contentTypes: string[] } {
  const db = getDb();
  const readConfig = db.prepare("SELECT value FROM scoring_config WHERE key = ?");

  const enabledRow = readConfig.get("mood_enabled") as { value: string } | undefined;
  const contentTypesRow = readConfig.get("mood_content_types") as { value: string } | undefined;

  return {
    enabled: parseMoodEnabled(
      enabledRow?.value ?? DEFAULT_SCORING_CONFIG_VALUES.mood_enabled
    ),
    contentTypes: parseMoodContentTypes(
      contentTypesRow?.value ?? DEFAULT_SCORING_CONFIG_VALUES.mood_content_types
    ),
  };
}

export function loadPalette(philosopherId: string): MoodPaletteState | null {
  const db = getDb();
  const row = db
    .prepare("SELECT registers, is_active FROM mood_palettes WHERE philosopher_id = ?")
    .get(philosopherId) as { registers: string; is_active: number } | undefined;

  if (!row) return null;

  const rawRegisters = safeJsonParse<unknown[]>(row.registers, []);
  const registers = Array.isArray(rawRegisters)
    ? rawRegisters
        .map(normalizeRegister)
        .filter((register): register is MoodRegister => register !== null)
    : [];

  return {
    registers,
    isActive: row.is_active === 1,
  };
}

export function resolveMood(
  philosopherId: string,
  tensions: string[],
  stance: string | null,
  topicCluster: string | null
): MoodResult | null {
  const config = getMoodConfig();
  if (!config.enabled) return null;

  const palette = loadPalette(philosopherId);
  if (!palette || !palette.isActive) return null;

  return resolveMoodFromPalette(palette.registers, tensions, stance, topicCluster, true);
}

export function resolveMoodForContentType(args: {
  philosopherId: string;
  contentType: ContentTypeKey;
  tensions?: string[];
  stance?: string | null;
  topicCluster?: string | null;
}): MoodResult | null {
  const config = getMoodConfig();

  if (!config.enabled || !config.contentTypes.includes(args.contentType)) {
    return null;
  }

  return resolveMood(
    args.philosopherId,
    args.tensions ?? [],
    args.stance ?? null,
    args.topicCluster ?? null
  );
}

export function resolveMoodForCrossReply(
  replyingPhilosopherId: string,
  sourcePost: { citation_url?: string | null; stance: string }
): MoodResult | null {
  const config = getMoodConfig();

  if (!config.enabled || !config.contentTypes.includes("cross_philosopher_reply")) {
    return null;
  }

  const citationUrl = sourcePost.citation_url?.trim();
  if (!citationUrl) return null;

  const db = getDb();
  const article = db
    .prepare(
      `SELECT primary_tensions, topic_cluster
       FROM article_candidates
       WHERE url = ?
       LIMIT 1`
    )
    .get(citationUrl) as ArticleMoodRow | undefined;

  if (!article) return null;

  const palette = loadPalette(replyingPhilosopherId);
  if (!palette || !palette.isActive) return null;

  const tensions = normalizeStringArray(
    safeJsonParse<unknown[]>(article.primary_tensions, [])
  );
  const counterStances = COUNTER_STANCES[sourcePost.stance?.trim()] ?? [];

  for (const counterStance of counterStances.slice(0, 2)) {
    const result = resolveMoodFromPalette(
      palette.registers,
      tensions,
      counterStance,
      article.topic_cluster,
      false
    );

    if (result) {
      return result;
    }
  }

  return resolveMoodFromPalette(
    palette.registers,
    tensions,
    null,
    article.topic_cluster,
    true
  );
}

function resolveMoodFromPalette(
  registers: MoodRegister[],
  tensions: string[],
  stance: string | null,
  topicCluster: string | null,
  includeDefault: boolean
): MoodResult | null {
  if (registers.length === 0) return null;

  const normalizedTensions = normalizeStringArray(tensions);
  const normalizedStance = normalizeNullableString(stance);
  const normalizedCluster = normalizeNullableString(topicCluster);

  for (const register of registers) {
    if (
      hasIntersection(register.tensions, normalizedTensions) &&
      includesValue(register.stances, normalizedStance)
    ) {
      return buildMoodResult(register, 1);
    }
  }

  for (const register of registers) {
    if (hasIntersection(register.tensions, normalizedTensions)) {
      return buildMoodResult(register, 2);
    }
  }

  for (const register of registers) {
    if (
      includesValue(register.stances, normalizedStance) &&
      includesValue(register.clusters, normalizedCluster)
    ) {
      return buildMoodResult(register, 3);
    }
  }

  for (const register of registers) {
    if (includesValue(register.stances, normalizedStance)) {
      return buildMoodResult(register, 4);
    }
  }

  for (const register of registers) {
    if (includesValue(register.clusters, normalizedCluster)) {
      return buildMoodResult(register, 5);
    }
  }

  if (!includeDefault) {
    return null;
  }

  return registers[0] ? buildMoodResult(registers[0], 6) : null;
}

function buildMoodResult(register: MoodRegister, pass: number): MoodResult {
  return {
    register: register.name,
    directive: register.directive,
    line: `EMOTIONAL REGISTER: ${register.name} — ${register.directive}`,
    pass,
  };
}

function normalizeRegister(value: unknown): MoodRegister | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<MoodRegister>;
  const name = normalizeNullableString(candidate.name);
  const directive = normalizeNullableString(candidate.directive);

  if (!name || !directive) {
    return null;
  }

  return {
    name,
    directive,
    tensions: normalizeOptionalArray(candidate.tensions),
    stances: normalizeOptionalStanceArray(candidate.stances),
    clusters: normalizeOptionalArray(candidate.clusters),
  };
}

function normalizeOptionalArray(values: unknown): string[] | undefined {
  const normalized = normalizeStringArray(values);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionalStanceArray(values: unknown): Stance[] | undefined {
  const normalized = normalizeStringArray(values) as Stance[];
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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
