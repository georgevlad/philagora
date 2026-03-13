import type { Stance } from "@/lib/types";

export type ScoringConfigKey = "score_tiers" | "tension_vocabulary" | "stance_guidance";
export type ScoreTierKey = "reject" | "low" | "decent" | "good" | "excellent";

export interface ScoreTierDefinition {
  min?: number;
  max?: number;
  label: string;
  description: string;
}

export type ScoreTierMap = Record<ScoreTierKey, ScoreTierDefinition>;

export interface TensionVocabularyItem {
  id: string;
  label: string;
  description: string;
}

export interface StanceGuidanceConfig {
  preferred_friction_pairs: [Stance, Stance][];
  deprioritize: Stance[];
  guidance_text: string;
}

export const SCORING_CONFIG_KEYS: ScoringConfigKey[] = [
  "score_tiers",
  "tension_vocabulary",
  "stance_guidance",
];

export const DEFAULT_SCORE_TIERS: ScoreTierMap = {
  reject: {
    max: 0,
    label: "Reject",
    description: "Not worth reacting to",
  },
  low: {
    min: 1,
    max: 39,
    label: "Low",
    description: "Weak philosophical potential",
  },
  decent: {
    min: 40,
    max: 59,
    label: "Decent",
    description: "Some angle, but limited framework collision",
  },
  good: {
    min: 60,
    max: 79,
    label: "Good",
    description: "Clear tensions, 2-3 distinct philosopher takes possible",
  },
  excellent: {
    min: 80,
    max: 100,
    label: "Excellent",
    description: "Deep ambiguity, 3+ opposed frameworks, rich concrete details",
  },
};

export const DEFAULT_TENSION_VOCABULARY: TensionVocabularyItem[] = [
  {
    id: "freedom_vs_order",
    label: "Freedom vs Order",
    description: "Individual liberty against social/institutional control",
  },
  {
    id: "truth_vs_power",
    label: "Truth vs Power",
    description: "Honest inquiry against political or institutional interest",
  },
  {
    id: "individual_vs_collective",
    label: "Individual vs Collective",
    description: "Personal autonomy against communal responsibility",
  },
  {
    id: "duty_vs_desire",
    label: "Duty vs Desire",
    description: "Moral obligation against personal fulfillment or happiness",
  },
  {
    id: "progress_vs_tradition",
    label: "Progress vs Tradition",
    description: "Innovation and change against continuity and inherited wisdom",
  },
  {
    id: "justice_vs_mercy",
    label: "Justice vs Mercy",
    description: "Strict accountability against compassion and forgiveness",
  },
  {
    id: "reason_vs_faith",
    label: "Reason vs Faith",
    description: "Empirical/rational inquiry against belief, intuition, or revelation",
  },
  {
    id: "nature_vs_artifice",
    label: "Nature vs Artifice",
    description: "The natural/authentic against the constructed/technological",
  },
  {
    id: "means_vs_ends",
    label: "Means vs Ends",
    description: "Whether outcomes justify methods, or methods constrain outcomes",
  },
  {
    id: "knowledge_vs_wisdom",
    label: "Knowledge vs Wisdom",
    description: "Information accumulation against deeper understanding and judgment",
  },
];

export const DEFAULT_STANCE_GUIDANCE: StanceGuidanceConfig = {
  preferred_friction_pairs: [
    ["challenges", "defends"],
    ["challenges", "reframes"],
    ["defends", "questions"],
  ],
  deprioritize: ["warns", "observes"],
  guidance_text:
    "Prefer stances that create genuine friction between philosophers. 'challenges' vs 'defends' on the same article is far more valuable than three philosophers who all 'warns' from different angles. Use 'warns' and 'observes' sparingly — only when a philosopher's framework genuinely leads there, not as a safe default.",
};

export const DEFAULT_SCORING_CONFIG_VALUES: Record<ScoringConfigKey, string> = {
  score_tiers: JSON.stringify(DEFAULT_SCORE_TIERS),
  tension_vocabulary: JSON.stringify(DEFAULT_TENSION_VOCABULARY),
  stance_guidance: JSON.stringify(DEFAULT_STANCE_GUIDANCE),
};

function safeParseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function parseScoreTiers(raw: string | undefined): ScoreTierMap {
  const parsed = safeParseJson<Partial<Record<ScoreTierKey, Partial<ScoreTierDefinition>>>>(raw, {});

  return {
    reject: { ...DEFAULT_SCORE_TIERS.reject, ...parsed.reject },
    low: { ...DEFAULT_SCORE_TIERS.low, ...parsed.low },
    decent: { ...DEFAULT_SCORE_TIERS.decent, ...parsed.decent },
    good: { ...DEFAULT_SCORE_TIERS.good, ...parsed.good },
    excellent: { ...DEFAULT_SCORE_TIERS.excellent, ...parsed.excellent },
  };
}

export function slugifyTensionLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function parseTensionVocabulary(raw: string | undefined): TensionVocabularyItem[] {
  const parsed = safeParseJson<Partial<TensionVocabularyItem>[]>(raw, DEFAULT_TENSION_VOCABULARY);

  if (!Array.isArray(parsed)) {
    return DEFAULT_TENSION_VOCABULARY;
  }

  const normalized = parsed
    .map((item) => {
      const label = item.label?.trim() ?? "";
      const id = slugifyTensionLabel(label || item.id || "");

      return {
        id,
        label,
        description: item.description?.trim() ?? "",
      };
    })
    .filter((item) => item.id && item.label);

  return normalized.length > 0 ? normalized : DEFAULT_TENSION_VOCABULARY;
}

export function parseStanceGuidance(raw: string | undefined): StanceGuidanceConfig {
  const parsed = safeParseJson<Partial<StanceGuidanceConfig>>(raw, DEFAULT_STANCE_GUIDANCE);

  return {
    preferred_friction_pairs: Array.isArray(parsed.preferred_friction_pairs)
      ? parsed.preferred_friction_pairs
          .filter((pair): pair is [Stance, Stance] => Array.isArray(pair) && pair.length === 2)
          .map((pair) => [pair[0], pair[1]])
      : DEFAULT_STANCE_GUIDANCE.preferred_friction_pairs,
    deprioritize: Array.isArray(parsed.deprioritize)
      ? parsed.deprioritize
      : DEFAULT_STANCE_GUIDANCE.deprioritize,
    guidance_text: parsed.guidance_text?.trim() || DEFAULT_STANCE_GUIDANCE.guidance_text,
  };
}
