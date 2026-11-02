/**
 * Generation service — calls the Anthropic Claude API to generate
 * philosophical content based on a philosopher's persona and a content template.
 */

import { getDb } from "@/lib/db";
import { agoraModelCall } from "@/lib/agora-model-call";
import { getLengthViolation } from "@/lib/content-lengths";
import { PHILOSOPHER_GENERATION_RULES, EDITORIAL_EVIDENCE_RULES, SYNTHESIS_FIDELITY_RULES } from "@/lib/generation-policy";
import { safeJsonParse } from "@/lib/json-utils";
import {
  createMessage,
  getAnthropicClient,
  parseJsonResponse,
  ModelResponseError,
} from "@/lib/anthropic-utils";
import {
  getActiveHouseRules,
  getActiveTemplate,
  getSynthesisTemplateForType,
  getLengthGuidance,
  type ContentTypeKey,
  type TargetLength,
} from "@/lib/content-templates";
import {
  DEFAULT_GENERATION_MODEL,
  DEFAULT_SCORING_MODEL,
  parseGenerationModel,
  parseScoringModel,
} from "@/lib/scoring-config";
import type {
  ArticleCandidateRow,
  PhilosopherRow,
  PromptRow,
} from "@/lib/db-types";
import type { MoodResult } from "@/lib/mood-service";
import { resolveMoodForContentType } from "@/lib/mood-service";
import type { AgoraQuestionType, Stance } from "@/lib/types";

// ── Configuration ────────────────────────────────────────────────────

const DEFAULT_MAX_TOKENS = 1024;
const TEMPERATURE = 0.8; // Tunable — higher = more creative variation

const SYNTHESIS_TEMPERATURE = 0.4; // Lower for precision and consistency
const SYNTHESIS_MAX_TOKENS = 2048; // Synthesis output is longer

function getGenerationModels(): {
  scoringModel: string;
  generationModel: string;
  synthesisModel: string;
} {
  const db = getDb();
  const getConfig = (
    key: string,
    fallback: string,
    parser: (raw: string | undefined) => string
  ): string => {
    const row = db
      .prepare("SELECT value FROM scoring_config WHERE key = ?")
      .get(key) as { value: string } | undefined;

    return parser(row?.value ?? JSON.stringify(fallback));
  };

  return {
    scoringModel: getConfig("scoring_model", DEFAULT_SCORING_MODEL, parseScoringModel),
    generationModel: getConfig("generation_model", DEFAULT_GENERATION_MODEL, parseGenerationModel),
    synthesisModel: getConfig("synthesis_model", DEFAULT_GENERATION_MODEL, parseGenerationModel),
  };
}

// ── Types ────────────────────────────────────────────────────────────

export interface GenerationResult {
  success: true;
  data: Record<string, unknown>;
  rawOutput: string;
  systemPromptId: number | null;
}

export interface GenerationError {
  success: false;
  error: string;
  errorCode?: ModelResponseError["code"];
  rawOutput: string;
  systemPromptId: number | null;
}

export type GenerationOutcome = GenerationResult | GenerationError;

export type DailyItemType =
  | "news_reaction"
  | "cross_reply"
  | "timeless_reflection"
  | "quip"
  | "cultural_recommendation"
  | "art_commentary"
  | "everyday_scenario";

interface GeneratedPostPayload {
  content: string;
  thesis: string;
  stance: Stance;
  tag: string;
  recommendation_title?: string;
  recommendation_author?: string;
  recommendation_medium?: string;
}

export interface DailyGeneratedItem {
  type: DailyItemType;
  post_id: string;
  generation_log_id: number;
  philosopher_id: string;
  philosopher_name: string;
  content: string;
  thesis: string;
  stance: Stance;
  tag: string;
  length: TargetLength;
  article_candidate_id?: string;
  article_title?: string;
  reply_to_post_id?: string;
  reply_to_philosopher?: string;
  prompt_seed?: string;
  recommendation_title?: string;
  recommendation_author?: string;
  recommendation_medium?: string;
  mood_register?: string;
}

export interface QuestionClassification {
  questionType: AgoraQuestionType;
  recommendationsAppropriate: boolean;
  recommendationHint: string | null;
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

const DEFAULT_QUESTION_CLASSIFICATION: QuestionClassification = {
  questionType: "advice",
  recommendationsAppropriate: false,
  recommendationHint: null,
};

function isQuestionType(value: unknown): value is AgoraQuestionType {
  return value === "advice" || value === "conceptual" || value === "debate";
}

export async function classifyAgoraQuestion(
  question: string
): Promise<QuestionClassification> {
  const client = getAnthropicClient();
  if (!client) {
    return DEFAULT_QUESTION_CLASSIFICATION;
  }

  const { scoringModel } = getGenerationModels();

  const systemPrompt = `You classify questions submitted to a philosophy forum. Determine:

1. question_type: one of "advice", "conceptual", or "debate"
   - "advice": personal dilemmas, practical decisions, "should I...", "how do I cope with...", requests for guidance on a specific life situation
   - "conceptual": big ideas, definitions, meaning, "what is...", "why does...", "how do X and Y relate", explorations of abstract concepts
   - "debate": contested issues with clear sides, policy questions, ethical dilemmas about society, "is it right to...", "should society..."

2. recommendations_appropriate: boolean - would a book/film/essay recommendation genuinely enrich the response to this question? Judge this question on its merits, without a target percentage. An explicit request for a cultural recommendation warrants a recommendation. Good signals: existential themes, questions about meaning/suffering/identity/creativity, philosophical traditions. Bad signals: very specific practical decisions, time-sensitive dilemmas, narrow tactical questions.

3. recommendation_hint: if recommendations_appropriate is true, a brief hint about what kind of works would fit (e.g. "existential literature, absurdist film", "Stoic texts, mindfulness guides"). null if not appropriate.

RESPOND WITH VALID JSON ONLY:
{"questionType":"advice|conceptual|debate","recommendationsAppropriate":true,"recommendationHint":"string or null"}`;

  try {
    const response = await createMessage(
      client,
      {
        model: scoringModel,
        max_tokens: 256,
        temperature: 0.2,
        system: systemPrompt,
        messages: [{ role: "user", content: question }],
      },
      "classification"
    );

    const rawOutput = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");

    const parsed = parseJsonResponse(rawOutput) as Partial<QuestionClassification>;

    return {
      questionType: isQuestionType(parsed.questionType)
        ? parsed.questionType
        : DEFAULT_QUESTION_CLASSIFICATION.questionType,
      recommendationsAppropriate: parsed.recommendationsAppropriate === true,
      recommendationHint:
        typeof parsed.recommendationHint === "string" && parsed.recommendationHint.trim().length > 0
          ? parsed.recommendationHint.trim()
          : null,
    };
  } catch {
    console.error("Question classification failed, defaulting to advice");
    return DEFAULT_QUESTION_CLASSIFICATION;
  }
}

// ── Philosopher content generation ───────────────────────────────────

type OutputValidator = (data: Record<string, unknown>) => void;

function parseWorkshopResponse(rawOutput: string, stopReason: string | null, validateOutput?: OutputValidator) {
  if (stopReason === "max_tokens") {
    throw new ModelResponseError("truncated", "The model response was cut off before it finished. Try a narrower request.");
  }
  let data: Record<string, unknown>;
  try { data = parseJsonResponse(rawOutput); }
  catch { throw new ModelResponseError("invalid_json", "The model returned text in an unreadable JSON format. Try generating again."); }
  validateOutput?.(data);
  return data;
}

/** Normalize harmless shape slips without rewriting or truncating any prose. */
function normalizeContentShape(key: ContentTypeKey, data: Record<string, unknown>): Record<string, unknown> {
  if (key === "agora_response" && typeof data.posts === "string") {
    return { ...data, posts: [data.posts] };
  }
  const feedTypes: ContentTypeKey[] = ["news_reaction", "quip", "cross_philosopher_reply", "timeless_reflection", "historical_reaction", "everyday_reaction", "cultural_recommendation", "art_commentary"];
  if (feedTypes.includes(key) && typeof data.stance === "string" && !VALID_STANCES.has(data.stance as Stance)) {
    return { ...data, stance: key === "cultural_recommendation" ? "recommends" : key === "quip" ? "quips" : "observes" };
  }
  return data;
}

export async function generateContent(
  philosopherId: string,
  contentTypeKey: ContentTypeKey,
  sourceMaterial: string,
  targetLength?: TargetLength,
  templateOverride?: string,
  validateOutput?: OutputValidator,
): Promise<GenerationOutcome> {
  const db = getDb();
  const { generationModel } = getGenerationModels();

  // 1. Fetch the philosopher's metadata
  const philosopher = db
    .prepare(
      "SELECT id, name, tradition, color, initials, bio, era, core_principles FROM philosophers WHERE id = ?"
    )
    .get(philosopherId) as PhilosopherRow | undefined;

  if (!philosopher) {
    return {
      success: false,
      error: `Philosopher "${philosopherId}" not found`,
      rawOutput: "",
      systemPromptId: null,
    };
  }

  // 2. Fetch the active system prompt
  const activePrompt = db
    .prepare(
      "SELECT id, system_prompt_text, prompt_version FROM system_prompts WHERE philosopher_id = ? AND is_active = 1 ORDER BY prompt_version DESC, id DESC LIMIT 1"
    )
    .get(philosopherId) as PromptRow | undefined;

  if (!activePrompt) {
    return {
      success: false,
      error: `No active system prompt for ${philosopher.name}. Create one in the Prompts section first.`,
      rawOutput: "",
      systemPromptId: null,
    };
  }

  // 3. Get the content template (DB-first, code fallback)
  const templateInstructions = templateOverride ?? getActiveTemplate(contentTypeKey);

  // The reviewed persona owns doctrine; public profile summaries are not injected
  // a second time. Old template source placeholders refer to user data only.
  const lengthGuidance = getLengthGuidance(contentTypeKey, targetLength);
  const instructions = templateInstructions
    .replaceAll("{LENGTH_GUIDANCE}", lengthGuidance)
    .replaceAll("{SOURCE_MATERIAL}", "See source_material in the user message.");
  const houseRules = getActiveHouseRules();
  const systemMessage = [
    PHILOSOPHER_GENERATION_RULES,
    activePrompt.system_prompt_text,
    `PHILOSOPHER METADATA: ${philosopher.name}; ${philosopher.tradition}; ${philosopher.era ?? ""}`,
    houseRules,
    instructions,
    lengthGuidance,
  ].filter(Boolean).join("\n\n---\n\n");

  // Feed history is bounded and contains only post data, never private Agora text.
  const feedTypes: ContentTypeKey[] = ["news_reaction", "quip", "cross_philosopher_reply", "timeless_reflection", "historical_reaction", "everyday_reaction", "cultural_recommendation", "art_commentary"];
  const recentWriting = feedTypes.includes(contentTypeKey)
    ? db.prepare(`SELECT substr(content, 1, 420) AS excerpt, thesis, recommendation_title
        FROM posts WHERE philosopher_id = ? AND status IN ('draft', 'published')
        ORDER BY created_at DESC, id DESC LIMIT ?`).all(philosopherId, 4)
    : [];
  const userMessage = JSON.stringify({
    source_material: sourceMaterial,
    ...(recentWriting.length ? { recent_writing_for_variety_only: recentWriting } : {}),
  });

  // 7. Call the Anthropic API
  const client = getAnthropicClient();
  if (!client) {
    return {
      success: false,
      error:
        "ANTHROPIC_API_KEY is not configured. Set it in .env.local to enable AI generation.",
      rawOutput: "",
      systemPromptId: activePrompt.id,
    };
  }

  // Token capacity includes JSON and metadata; word limits are checked separately.
  const maxTokens = contentTypeKey === "in_focus_perspective" ? 4096
    : contentTypeKey === "agora_response" ? 1536
    : contentTypeKey === "quip" ? 384 : DEFAULT_MAX_TOKENS;
  const caller = contentTypeKey === "in_focus_perspective" ? "in_focus" : "generation";
  const messages: { role: "user" | "assistant"; content: string }[] = [{ role: "user", content: userMessage }];
  // Durable Agora owns a persisted three-call budget. It retries invalid output
  // as another recorded job attempt; never spend an uncounted repair call here.
  const attempts = agoraModelCall.getStore() === "durable" || contentTypeKey === "in_focus_perspective" ? 1 : 2;
  let rawOutput = "";
  for (let attempt = 0; attempt < attempts; attempt++) {
    let lengthViolation: string | null = null;
    let parsed: Record<string, unknown> | undefined;
    try {
      const response = await createMessage(client, {
        model: generationModel, max_tokens: maxTokens, temperature: TEMPERATURE,
        system: systemMessage, messages,
      }, caller, (message) => {
        rawOutput = message.content.filter(b => b.type === "text").map(b => b.type === "text" ? b.text : "").join("");
        parsed = normalizeContentShape(contentTypeKey, parseWorkshopResponse(rawOutput, message.stop_reason, validateOutput));
        lengthViolation = getLengthViolation(contentTypeKey, parsed, targetLength);
        if (lengthViolation) throw new ModelResponseError("invalid_content", lengthViolation);
      });
      // Also support callers/tests that substitute the logged provider wrapper.
      rawOutput = response.content.filter(b => b.type === "text").map(b => b.type === "text" ? b.text : "").join("");
      parsed ??= normalizeContentShape(contentTypeKey, parseWorkshopResponse(rawOutput, response.stop_reason, validateOutput));
      lengthViolation = getLengthViolation(contentTypeKey, parsed, targetLength);
      if (lengthViolation) throw new ModelResponseError("invalid_content", lengthViolation);
      return { success: true, data: parsed, rawOutput, systemPromptId: activePrompt.id };
    } catch (error) {
      if (lengthViolation && attempt + 1 < attempts) {
        messages.push({ role: "assistant", content: rawOutput }, { role: "user", content:
          `Revise the previous JSON response. ${lengthViolation} ${lengthGuidance} Preserve the central argument, philosophical voice, factual qualifications, required fields, and valid JSON. Remove repetition and secondary points. Return only the complete revised JSON; do not clip a sentence or add new facts.` });
        continue;
      }
      if (error instanceof ModelResponseError) {
        return { success: false, error: error.message, errorCode: error.code, rawOutput, systemPromptId: activePrompt.id };
      }
      return { success: false, error: "Could not generate content. Try again.", rawOutput, systemPromptId: activePrompt.id };
    }
  }
  return { success: false, error: "Could not generate content within its length limit.", rawOutput, systemPromptId: activePrompt.id };

}

// ── Daily draft generation helpers ───────────────────────────────────

export function resolveSourceType(type: DailyItemType): string {
  switch (type) {
    case "news_reaction":
    case "cross_reply":
    case "quip":
      return "news";
    case "timeless_reflection":
    case "cultural_recommendation":
      return "reflection";
    case "art_commentary":
      return "art_commentary";
    case "everyday_scenario":
      return "everyday";
    default:
      return "news";
  }
}

export async function generateDailyDraft(args: {
  philosopher: PhilosopherRow;
  type: DailyItemType;
  dbContentType: "post" | "reflection" | "recommendation" | "art_commentary";
  sourceMaterial: string;
  moodRegister?: string | null;
  targetLength: TargetLength;
  citation?: {
    title: string | null;
    source: string | null;
    url: string | null;
    imageUrl: string | null;
  };
  replyTo?: string;
  replyToPhilosopher?: string;
  promptSeed?: string;
  articleCandidateId?: string;
  articleTitle?: string;
}): Promise<{ success: true; data: DailyGeneratedItem } | { success: false; error: string }> {
  const outcome = await generateContent(
    args.philosopher.id,
    args.type === "quip"
      ? "quip"
      : args.type === "news_reaction"
      ? "news_reaction"
      : args.type === "cross_reply"
      ? "cross_philosopher_reply"
      : args.type === "cultural_recommendation"
      ? "cultural_recommendation"
      : args.type === "art_commentary"
      ? "art_commentary"
      : args.type === "everyday_scenario"
      ? "everyday_reaction"
      : "timeless_reflection",
    args.sourceMaterial,
    args.targetLength
  );

  if (!outcome.success) {
    return { success: false, error: outcome.error };
  }

  const normalized = normalizeGeneratedPost(args.type, outcome.data);
  if (!normalized) {
    return { success: false, error: "Generation returned malformed content." };
  }

  const db = getDb();
  const postId = `post-gen-${crypto.randomUUID()}`;
  const insertLog = db.prepare(
    `INSERT INTO generation_log (philosopher_id, content_type, system_prompt_id, user_input, raw_output, status, mood_register)
     VALUES (?, ?, ?, ?, ?, 'generated', ?)`
  );
  const insertPost = db.prepare(
    `INSERT INTO posts (
      id, philosopher_id, content, thesis, stance, tag,
      recommendation_title, recommendation_author, recommendation_medium,
      source_type,
      citation_title, citation_source, citation_url, citation_image_url,
      reply_to, likes, replies, bookmarks, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 'draft', datetime('now'), datetime('now'))`
  );
  const logId = db.transaction(() => {
    const logResult = insertLog.run(
      args.philosopher.id,
      args.dbContentType,
      outcome.systemPromptId,
      args.sourceMaterial,
      JSON.stringify(outcome.data, null, 2),
      args.moodRegister ?? null
    );

    insertPost.run(
      postId,
      args.philosopher.id,
      normalized.content,
      normalized.thesis,
      normalized.stance,
      normalized.tag,
      normalized.recommendation_title ?? null,
      normalized.recommendation_author ?? null,
      normalized.recommendation_medium ?? null,
      resolveSourceType(args.type),
      args.citation?.title ?? null,
      args.citation?.source ?? null,
      args.citation?.url ?? null,
      args.citation?.imageUrl ?? null,
      args.replyTo ?? null
    );

    return Number(logResult.lastInsertRowid);
  })();

  return {
    success: true,
    data: {
      type: args.type,
      post_id: postId,
      generation_log_id: logId,
      philosopher_id: args.philosopher.id,
      philosopher_name: args.philosopher.name,
      content: normalized.content,
      thesis: normalized.thesis,
      stance: normalized.stance,
      tag: normalized.tag,
      length: args.targetLength,
      article_candidate_id: args.articleCandidateId,
      article_title: args.articleTitle,
      reply_to_post_id: args.replyTo,
      reply_to_philosopher: args.replyToPhilosopher,
      prompt_seed: args.promptSeed,
      recommendation_title: normalized.recommendation_title,
      recommendation_author: normalized.recommendation_author,
      recommendation_medium: normalized.recommendation_medium,
      mood_register: args.moodRegister ?? undefined,
    },
  };
}

export function normalizeGeneratedPost(
  type: DailyItemType,
  data: Record<string, unknown>
): GeneratedPostPayload | null {
  const content = typeof data.content === "string" ? data.content.trim() : "";
  if (!content) return null;

  const thesis =
    typeof data.thesis === "string" && data.thesis.trim()
      ? data.thesis.trim()
      : content.split("\n")[0].trim().slice(0, 140);
  const tagCandidate = typeof data.tag === "string" ? data.tag.trim() : "";

  if (type === "cultural_recommendation") {
    return {
      content,
      thesis,
      stance: normalizeStance(
        typeof data.stance === "string" ? data.stance : "recommends",
        "recommends"
      ),
      tag: tagCandidate || "Recommends",
      recommendation_title: normalizeOptionalString(data.recommendation_title),
      recommendation_author: normalizeOptionalString(data.recommendation_author),
      recommendation_medium: normalizeOptionalString(data.recommendation_medium)?.toLowerCase(),
    };
  }

  return {
    content,
    thesis,
    stance: normalizeStance(typeof data.stance === "string" ? data.stance : "observes"),
    tag: tagCandidate || defaultTagForType(type),
  };
}

function defaultTagForType(type: DailyItemType): string {
  switch (type) {
    case "cross_reply":
      return "Cross-Philosopher Reply";
    case "timeless_reflection":
      return "Timeless Wisdom";
    case "quip":
      return "Glint";
    case "cultural_recommendation":
      return "Recommends";
    case "art_commentary":
      return "Art Commentary";
    case "everyday_scenario":
      return "Examined Life";
    default:
      return "Ethical Analysis";
  }
}

function normalizeStance(value: string, fallback: Stance = "observes"): Stance {
  return VALID_STANCES.has(value as Stance) ? (value as Stance) : fallback;
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function buildArticleSourceMaterial(
  article: ArticleCandidateRow,
  philosopherId?: string
): string {
  return buildArticleSourceMaterialParts(article, philosopherId).sourceMaterial;
}

export function buildArticleSourceMaterialParts(
  article: ArticleCandidateRow,
  philosopherId?: string
): { sourceMaterial: string; moodResult: MoodResult | null } {
  const parsedStances = safeJsonParse<unknown>(article.suggested_stances, {});
  const suggestedStances: Record<string, string> = parsedStances !== null
    && typeof parsedStances === "object" && !Array.isArray(parsedStances)
    ? Object.fromEntries(Object.entries(parsedStances).filter((entry): entry is [string, string] =>
        typeof entry[1] === "string"))
    : {};
  const suggestedStanceText = Object.entries(suggestedStances)
    .map(([philosopherId, stance]) => `${philosopherId}: ${stance}`)
    .join(", ");
  const parsedTensions = safeJsonParse<unknown>(article.primary_tensions, []);
  const tensions = Array.isArray(parsedTensions)
    ? parsedTensions.filter((value): value is string => typeof value === "string")
    : [];
  const moodResult = philosopherId
    ? resolveMoodForContentType({
        philosopherId,
        contentType: "news_reaction",
        tensions,
        stance: suggestedStances[philosopherId] ?? null,
        topicCluster: article.topic_cluster,
      })
    : null;

  const sourceMaterial = [
    `ARTICLE TITLE: ${article.title}`,
    `SOURCE: ${article.source_name}`,
    `URL: ${article.url}`,
    article.description ? `DESCRIPTION:\n${article.description}` : "",
    article.philosophical_entry_point
      ? `PHILOSOPHICAL ENTRY POINT:\n${article.philosophical_entry_point}`
      : "",
    suggestedStanceText ? `SUGGESTED STANCES: ${suggestedStanceText}` : "",
    moodResult?.line ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { sourceMaterial, moodResult };
}

// ── Synthesis generation (no philosopher persona) ────────────────────

/** Private editorial preparation, using the same model settings and API logger. */
export async function generateEditorialContent(
  contentType: "in_focus_briefing" | "in_focus_questions" | "in_focus_voices",
  sourceMaterial: string,
  templateOverride?: string,
  validateOutput?: OutputValidator,
): Promise<GenerationOutcome> {
  const client = getAnthropicClient();
  if (!client) return { success: false, error: "AI generation is not configured.", rawOutput: "", systemPromptId: null };
  const { synthesisModel } = getGenerationModels();
  let rawOutput = "";
  let data: Record<string, unknown> | undefined;
  try {
    const response = await createMessage(client, {
      model: synthesisModel,
      max_tokens: 4096,
      temperature: SYNTHESIS_TEMPERATURE,
      system: `${EDITORIAL_EVIDENCE_RULES}\n\n${getActiveHouseRules()}\n\n${templateOverride ?? getActiveTemplate(contentType)}`,
      messages: [{ role: "user", content: sourceMaterial }],
    }, "in_focus", (message) => {
      rawOutput = message.content.filter((block) => block.type === "text")
        .map((block) => block.type === "text" ? block.text : "").join("");
      data = parseWorkshopResponse(rawOutput, message.stop_reason, validateOutput);
    });
    rawOutput = response.content.filter((block) => block.type === "text")
      .map((block) => block.type === "text" ? block.text : "").join("");
    if (response.stop_reason === "max_tokens") {
      return { success: false, error: "The response was truncated. Try a narrower request.", rawOutput, systemPromptId: null };
    }
    return { success: true, data: data ?? parseWorkshopResponse(rawOutput, response.stop_reason, validateOutput), rawOutput, systemPromptId: null };
  } catch (error) {
    if (error instanceof ModelResponseError) {
      return { success: false, error: error.message, errorCode: error.code, rawOutput, systemPromptId: null };
    }
    return { success: false, error: "Could not generate valid editorial content. Try again.", rawOutput, systemPromptId: null };
  }
}

export async function generateSynthesis(
  synthesisType: "debate_synthesis" | "agora_synthesis",
  sourceMaterial: string,
  templateOverride?: string,
  previousRejectedOutput?: string,
): Promise<GenerationOutcome> {
  const client = getAnthropicClient();
  if (!client) return { success: false, error: "AI generation is not configured.", rawOutput: "", systemPromptId: null };
  const { synthesisModel } = getGenerationModels();
  const lengthGuidance = getLengthGuidance(synthesisType);
  const systemMessage = [
    EDITORIAL_EVIDENCE_RULES,
    getActiveHouseRules(),
    templateOverride ?? (synthesisType === "agora_synthesis" ? getSynthesisTemplateForType("advice") : getActiveTemplate(synthesisType)),
    SYNTHESIS_FIDELITY_RULES,
    lengthGuidance,
  ].filter(Boolean).join("\n\n");
  const messages: { role: "user" | "assistant"; content: string }[] = [{ role: "user", content: sourceMaterial }];
  const requestRevision = (draft: string, violation: string) => {
    messages.push({ role: "assistant", content: draft }, { role: "user", content:
      `Revise the complete JSON synthesis. ${violation} ${lengthGuidance} Keep each speaker's conditions, exceptions, attribution, and uncertainty. Do not broaden agreement to save words. Remove recap and repeated points across fields. Empty optional sections are valid. Do not add new facts or clip sentences.` });
  };
  if (previousRejectedOutput) {
    // Recompute feedback locally; never replay provider errors as instructions.
    try {
      const violation = getLengthViolation(synthesisType, parseJsonResponse(previousRejectedOutput));
      if (violation) requestRevision(previousRejectedOutput, violation);
    } catch { /* An unusable saved draft must not prevent a fresh attempt. */ }
  }
  // Durable Agora owns every retry; ordinary editorial generation may revise once.
  const attempts = agoraModelCall.getStore() === "durable" ? 1 : 2;
  let rawOutput = "";
  for (let attempt = 0; attempt < attempts; attempt++) {
    let violation: string | null = null;
    let data: Record<string, unknown> | undefined;
    const validate: OutputValidator = (parsed) => {
      violation = getLengthViolation(synthesisType, parsed);
      if (violation) throw new ModelResponseError("invalid_content", violation);
    };
    try {
      const response = await createMessage(client, {
        model: synthesisModel, max_tokens: SYNTHESIS_MAX_TOKENS,
        temperature: SYNTHESIS_TEMPERATURE, system: systemMessage, messages,
      }, "synthesis", (message) => {
        rawOutput = message.content.filter(b => b.type === "text").map(b => b.type === "text" ? b.text : "").join("");
        data = parseWorkshopResponse(rawOutput, message.stop_reason, validate);
      });
      rawOutput = response.content.filter(b => b.type === "text").map(b => b.type === "text" ? b.text : "").join("");
      data ??= parseWorkshopResponse(rawOutput, response.stop_reason, validate);
      return { success: true, data, rawOutput, systemPromptId: null };
    } catch (error) {
      if (violation && attempt + 1 < attempts) {
        requestRevision(rawOutput, violation);
        continue;
      }
      if (error instanceof ModelResponseError) return { success: false, error: error.message, errorCode: error.code, rawOutput, systemPromptId: null };
      return { success: false, error: "Could not generate synthesis. Try again.", rawOutput, systemPromptId: null };
    }
  }
  return { success: false, error: "Could not generate synthesis within its length limit.", rawOutput, systemPromptId: null };
}
