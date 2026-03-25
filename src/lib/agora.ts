import type Database from "better-sqlite3";
import { safeJsonParse } from "@/lib/json-utils";
import type {
  AdviceSynthesis,
  AgoraQuestionType,
  AgoraThreadArticle,
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

export type AgoraGenerationArticle = AgoraThreadArticle & {
  content?: string | null;
};

export interface AgoraGenerationResponseRow {
  posts: string;
  philosopher_name: string;
  philosopher_tradition: string;
}

export interface AgoraGenerationRecommendationRow {
  recommendation: string;
  philosopher_name: string;
}

export interface AgoraFollowUpContextResponseRow extends AgoraGenerationResponseRow {
  recommendation?: string | null;
}

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

export function buildAgoraClassificationInput(
  question: string,
  article?: AgoraThreadArticle | null
): string {
  if (!article || (!article.title && !article.source && !article.excerpt)) {
    return question;
  }

  const articleLabelParts = [article.title, article.source].filter(Boolean);
  let classificationInput = question;

  classificationInput += "\n\n[The user shared an article";
  if (articleLabelParts.length > 0) {
    classificationInput += `: ${articleLabelParts.join(" from ")}`;
  }
  classificationInput += "]";

  if (article.excerpt) {
    classificationInput += `\n\nExcerpt: ${article.excerpt}`;
  }

  return classificationInput;
}

export function sanitizeAgoraQuestion(question: string): string {
  return question
    .replace(/\[INST\]/gi, "")
    .replace(/<\/?system>/gi, "")
    .replace(/<\/?assistant>/gi, "")
    .replace(/<\/?human>/gi, "")
    .replace(/<\/?user>/gi, "")
    .replace(/^(system|assistant|human|user)\s*:/gim, "")
    .trim();
}

export function buildAgoraResponseSourceMaterial(args: {
  question: string;
  askedBy: string;
  questionType: AgoraQuestionType;
  recommendationsAppropriate: boolean;
  recommendationHint: string | null;
  alreadyRecommended?: string[];
  article?: AgoraGenerationArticle | null;
}): string {
  const alreadyRecommended = args.alreadyRecommended ?? [];
  const hasArticleContent = Boolean(args.article?.content);
  const recommendationContext = args.recommendationsAppropriate
    ? `Recommendations may be appropriate for this question. If useful, keep in mind this recommendation direction: ${args.recommendationHint ?? "philosophically resonant works"}.`
    : "Do not force cultural recommendations; the main task is philosophical response.";

  let sourceMaterial = "";

  if (hasArticleContent) {
    sourceMaterial += "=== ARTICLE SHARED BY USER ===\n";
    if (args.article?.title) {
      sourceMaterial += `Title: ${args.article.title}\n`;
    }
    if (args.article?.source) {
      sourceMaterial += `Source: ${args.article.source}\n`;
    }
    sourceMaterial += `\n${args.article?.content?.trim()}\n\n=== END ARTICLE ===\n\n`;
  }

  sourceMaterial += `USER QUESTION:\n${args.question}\n\n`;
  sourceMaterial += `Asked by: ${args.askedBy}\n\n`;
  sourceMaterial += "CLASSIFICATION:\n";
  sourceMaterial += `- Question type: ${args.questionType}\n`;
  sourceMaterial += `- Recommendations appropriate: ${args.recommendationsAppropriate ? "yes" : "no"}\n`;
  sourceMaterial += `- Recommendation hint: ${args.recommendationHint ?? "none"}\n\n`;
  sourceMaterial += `${recommendationContext}\n\n`;
  sourceMaterial += hasArticleContent
    ? "Respond to this person's question about the article through your philosophical framework. Reference specific points from the article when helpful."
    : "Respond to this person's situation through your philosophical framework.";

  if (args.recommendationsAppropriate && alreadyRecommended.length > 0) {
    sourceMaterial += `\n\nALREADY RECOMMENDED by other philosophers (do NOT recommend these):\n${alreadyRecommended.map((item) => `- ${item}`).join("\n")}`;
  }

  return sourceMaterial;
}

export function buildAgoraSynthesisSourceMaterial(args: {
  question: string;
  askedBy: string;
  questionType: AgoraQuestionType;
  responses: AgoraGenerationResponseRow[];
  recommendations: AgoraGenerationRecommendationRow[];
  article?: AgoraThreadArticle | null;
}): string {
  let sourceMaterial = `USER QUESTION: ${args.question}\n`;
  sourceMaterial += `Asked by: ${args.askedBy}\n`;
  sourceMaterial += `Question type: ${args.questionType}\n\n`;

  if (args.article?.url) {
    sourceMaterial += "=== USER-SHARED ARTICLE ===\n";
    if (args.article.title) {
      sourceMaterial += `Title: ${args.article.title}\n`;
    }
    if (args.article.source) {
      sourceMaterial += `Source: ${args.article.source}\n`;
    }
    if (args.article.excerpt) {
      sourceMaterial += `Excerpt: ${args.article.excerpt}\n`;
    }
    sourceMaterial += "\n";
  }

  sourceMaterial += "=== PHILOSOPHER RESPONSES ===\n\n";

  for (const response of args.responses) {
    const posts = JSON.parse(response.posts) as string[];
    sourceMaterial += `### ${response.philosopher_name} (${response.philosopher_tradition}):\n`;
    posts.forEach((post, index) => {
      if (posts.length > 1) {
        sourceMaterial += `Response ${index + 1}: ${post}\n\n`;
      } else {
        sourceMaterial += `${post}\n\n`;
      }
    });
  }

  if (args.recommendations.length > 0) {
    sourceMaterial += "\n=== PHILOSOPHER RECOMMENDATIONS ===\n\n";

    for (const recommendation of args.recommendations) {
      const parsed = parseAgoraRecommendation(recommendation.recommendation);
      if (!parsed) continue;

      sourceMaterial += `${recommendation.philosopher_name} recommends: "${parsed.title}" (${parsed.medium}) - ${parsed.reason}\n`;
    }
  }

  return sourceMaterial;
}

function buildAgoraFollowUpContextPrefix(args: {
  parentQuestion: string;
  askedBy: string;
  parentResponses: AgoraFollowUpContextResponseRow[];
  parentSynthesis: AgoraSynthesis | null;
  article?: AgoraThreadArticle | null;
}): string {
  let sourceMaterial = "";

  if (args.article && (args.article.title || args.article.source || args.article.excerpt)) {
    sourceMaterial += "=== ORIGINAL ARTICLE CONTEXT ===\n";
    if (args.article.title) {
      sourceMaterial += `Title: ${args.article.title}\n`;
    }
    if (args.article.source) {
      sourceMaterial += `Source: ${args.article.source}\n`;
    }
    if (args.article.excerpt) {
      sourceMaterial += `Excerpt: ${args.article.excerpt}\n`;
    }
    sourceMaterial += "\n";
  }

  sourceMaterial += "=== ORIGINAL QUESTION ===\n";
  sourceMaterial += `${args.parentQuestion}\n`;
  sourceMaterial += `Asked by: ${args.askedBy}\n\n`;

  if (args.parentResponses.length > 0) {
    sourceMaterial += "=== PREVIOUS PHILOSOPHER RESPONSES ===\n\n";

    for (const response of args.parentResponses) {
      const posts = safeJsonParse<string[]>(response.posts, []);
      sourceMaterial += `${response.philosopher_name} (${response.philosopher_tradition}) said:\n`;

      for (const post of posts) {
        sourceMaterial += `${post}\n\n`;
      }

      const recommendation = parseAgoraRecommendation(response.recommendation);
      if (recommendation) {
        sourceMaterial += `Recommendation: "${recommendation.title}" (${recommendation.medium}) - ${recommendation.reason}\n\n`;
      }
    }
  }

  if (args.parentSynthesis) {
    sourceMaterial += "=== ORIGINAL EDITORIAL SYNTHESIS ===\n";
    sourceMaterial += `Type: ${args.parentSynthesis.type}\n`;
    sourceMaterial += `${JSON.stringify(args.parentSynthesis.sections, null, 2)}\n\n`;
  }

  return sourceMaterial;
}

export function buildAgoraFollowUpResponseSourceMaterial(args: {
  parentQuestion: string;
  askedBy: string;
  parentResponses: AgoraFollowUpContextResponseRow[];
  parentSynthesis: AgoraSynthesis | null;
  followUpQuestion: string;
  questionType: AgoraQuestionType;
  recommendationsAppropriate: boolean;
  recommendationHint: string | null;
  alreadyRecommended?: string[];
  article?: AgoraThreadArticle | null;
}): string {
  const originalContext = buildAgoraFollowUpContextPrefix({
    parentQuestion: args.parentQuestion,
    askedBy: args.askedBy,
    parentResponses: args.parentResponses,
    parentSynthesis: args.parentSynthesis,
    article: args.article,
  });
  const followUpPrompt = buildAgoraResponseSourceMaterial({
    question: args.followUpQuestion,
    askedBy: args.askedBy,
    questionType: args.questionType,
    recommendationsAppropriate: args.recommendationsAppropriate,
    recommendationHint: args.recommendationHint,
    alreadyRecommended: args.alreadyRecommended,
    article: null,
  });

  return `${originalContext}=== FOLLOW-UP QUESTION ===\n${followUpPrompt}\n\nThe user has already read the earlier responses and synthesis. Address the follow-up directly, deepen the conversation, and avoid simply repeating your earlier answer.`;
}

export function buildAgoraFollowUpSynthesisSourceMaterial(args: {
  parentQuestion: string;
  askedBy: string;
  parentResponses: AgoraFollowUpContextResponseRow[];
  parentSynthesis: AgoraSynthesis | null;
  followUpQuestion: string;
  questionType: AgoraQuestionType;
  responses: AgoraGenerationResponseRow[];
  recommendations: AgoraGenerationRecommendationRow[];
  article?: AgoraThreadArticle | null;
}): string {
  const originalContext = buildAgoraFollowUpContextPrefix({
    parentQuestion: args.parentQuestion,
    askedBy: args.askedBy,
    parentResponses: args.parentResponses,
    parentSynthesis: args.parentSynthesis,
    article: args.article,
  });
  const followUpExchange = buildAgoraSynthesisSourceMaterial({
    question: args.followUpQuestion,
    askedBy: args.askedBy,
    questionType: args.questionType,
    responses: args.responses,
    recommendations: args.recommendations,
    article: null,
  });

  return `${originalContext}=== FOLLOW-UP EXCHANGE ===\n${followUpExchange}\nSynthesize the follow-up exchange as a continuation of the original dialogue, focusing on what deepened, shifted, or remained unresolved.`;
}
