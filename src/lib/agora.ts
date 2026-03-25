import type Database from "better-sqlite3";
import { safeJsonParse } from "@/lib/json-utils";
import type {
  AdviceSynthesis,
  AgoraQuestionType,
  AgoraRecommendationMedium,
  AgoraRecommendation,
  AgoraSynthesis,
  ConceptualSynthesis,
  DebateSynthesis,
} from "@/lib/types";

type JsonObject = Record<string, unknown>;
type LegacyAgoraSynthesisRow = {
  thread_id: string;
  tensions: string | null;
  agreements: string | null;
  practical_takeaways: string | null;
};

const AGORA_QUESTION_TYPES: AgoraQuestionType[] = ["advice", "conceptual", "debate"];
const AGORA_RECOMMENDATION_MEDIA: AgoraRecommendationMedium[] = [
  "book",
  "film",
  "essay",
  "album",
  "poem",
  "play",
  "podcast",
  "speech",
];

function isAgoraQuestionType(value: unknown): value is AgoraQuestionType {
  return typeof value === "string" && AGORA_QUESTION_TYPES.includes(value as AgoraQuestionType);
}

function isAgoraRecommendationMedium(value: unknown): value is AgoraRecommendationMedium {
  return (
    typeof value === "string"
    && AGORA_RECOMMENDATION_MEDIA.includes(value as AgoraRecommendationMedium)
  );
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function normalizeAdviceSections(input: JsonObject): Pick<
  AdviceSynthesis,
  "tensions" | "agreements" | "practicalTakeaways"
> {
  return {
    tensions: asStringArray(input.tensions),
    agreements: asStringArray(input.agreements),
    practicalTakeaways: asStringArray(
      input.practicalTakeaways ?? input.practical_takeaways
    ),
  };
}

function normalizeConceptualSections(input: JsonObject): ConceptualSynthesis {
  return {
    keyInsight: asString(input.keyInsight) ?? "",
    frameworkComparison: asStringArray(input.frameworkComparison),
    deeperQuestions: asStringArray(input.deeperQuestions),
  };
}

function normalizeDebateSections(input: JsonObject): DebateSynthesis {
  return {
    centralFaultLine: asString(input.centralFaultLine) ?? "",
    tensions: asStringArray(input.tensions),
    commonGround: asStringArray(input.commonGround),
    whatIsAtStake: asString(input.whatIsAtStake) ?? "",
  };
}

export function parseAgoraRecommendation(
  json: string | null | undefined
): AgoraRecommendation | undefined {
  const parsed = safeJsonParse<JsonObject | null>(json, null);
  if (!parsed || typeof parsed !== "object") return undefined;

  const title = asString(parsed.title);
  const medium = parsed.medium;
  const reason = asString(parsed.reason);

  if (!title || !isAgoraRecommendationMedium(medium) || !reason) return undefined;

  return { title, medium, reason };
}

export function buildAdviceSectionsJson(input: {
  tensions?: unknown;
  agreements?: unknown;
  practicalTakeaways?: unknown;
  practical_takeaways?: unknown;
}): string {
  const sections = normalizeAdviceSections(input as JsonObject);
  return JSON.stringify(sections);
}

export function parseAgoraSynthesis(args: {
  synthesisType: string | null | undefined;
  sections: string | null | undefined;
}): AgoraSynthesis {
  const synthesisType = isAgoraQuestionType(args.synthesisType) ? args.synthesisType : "advice";
  const parsedSections = safeJsonParse<JsonObject>(args.sections, {});
  let sections: AdviceSynthesis | ConceptualSynthesis | DebateSynthesis;

  switch (synthesisType) {
    case "conceptual":
      sections = normalizeConceptualSections(parsedSections);
      break;
    case "debate":
      sections = normalizeDebateSections(parsedSections);
      break;
    case "advice":
    default:
      sections = normalizeAdviceSections(parsedSections);
      break;
  }

  return {
    type: synthesisType,
    sections,
  };
}

function hasTable(db: Database.Database, tableName: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as Record<string, number> | undefined;

  return Boolean(row);
}

export function getAgoraSynthesisForThread(
  db: Database.Database,
  threadId: string
): AgoraSynthesis | null {
  const synthesisRow = db
    .prepare("SELECT synthesis_type, sections FROM agora_synthesis_v2 WHERE thread_id = ?")
    .get(threadId) as
    | {
        synthesis_type: string | null;
        sections: string | null;
      }
    | undefined;

  if (synthesisRow) {
    return parseAgoraSynthesis({
      synthesisType: synthesisRow.synthesis_type,
      sections: synthesisRow.sections,
    });
  }

  if (!hasTable(db, "agora_synthesis")) {
    return null;
  }

  const legacyRow = db
    .prepare(
      "SELECT thread_id, tensions, agreements, practical_takeaways FROM agora_synthesis WHERE thread_id = ?"
    )
    .get(threadId) as LegacyAgoraSynthesisRow | undefined;

  if (!legacyRow) {
    return null;
  }

  return parseAgoraSynthesis({
    synthesisType: "advice",
    sections: buildAdviceSectionsJson({
      tensions: safeJsonParse<string[]>(legacyRow.tensions, []),
      agreements: safeJsonParse<string[]>(legacyRow.agreements, []),
      practical_takeaways: safeJsonParse<string[]>(legacyRow.practical_takeaways, []),
    }),
  });
}

export function toLegacyAgoraSynthesisRow(synthesis: AgoraSynthesis | null) {
  if (!synthesis) return null;

  const advice = synthesis.type === "advice"
    ? synthesis.sections as AdviceSynthesis
    : { tensions: [], agreements: [], practicalTakeaways: [] };

  return {
    synthesis_type: synthesis.type,
    sections: JSON.stringify(synthesis.sections),
    tensions: JSON.stringify(advice.tensions),
    agreements: JSON.stringify(advice.agreements),
    practical_takeaways: JSON.stringify(advice.practicalTakeaways),
  };
}

export function getQuestionTypeLabel(questionType: AgoraQuestionType): string {
  switch (questionType) {
    case "conceptual":
      return "Exploring a concept";
    case "debate":
      return "A contested question";
    case "advice":
    default:
      return "Seeking advice";
  }
}
