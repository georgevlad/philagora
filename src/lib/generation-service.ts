/**
 * Generation service — calls the Anthropic Claude API to generate
 * philosophical content based on a philosopher's persona and a content template.
 */

import { getDb } from "@/lib/db";
import {
  createMessage,
  getAnthropicClient,
  parseJsonResponse,
} from "@/lib/anthropic-utils";
import {
  getActiveHouseRules,
  getActiveTemplate,
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
import type { PhilosopherRow, PromptRow } from "@/lib/db-types";
import type { AgoraQuestionType } from "@/lib/types";

// ── Configuration ────────────────────────────────────────────────────

const DEFAULT_MAX_TOKENS = 1024;
const TEMPERATURE = 0.8; // Tunable — higher = more creative variation

/** Hard-cap tokens by target length to enforce brevity at the API level. */
const LENGTH_MAX_TOKENS: Record<string, number> = {
  short: 384,
  medium: 1024,
  long: 1536,
};

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
  rawOutput: string;
  systemPromptId: number | null;
}

export type GenerationOutcome = GenerationResult | GenerationError;

export interface QuestionClassification {
  questionType: AgoraQuestionType;
  recommendationsAppropriate: boolean;
  recommendationHint: string | null;
}

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

2. recommendations_appropriate: boolean - would a book/film/essay recommendation genuinely enrich the response to this question? Be selective - roughly 30-40% of questions warrant recommendations. Good signals: existential themes, questions about meaning/suffering/identity/creativity, philosophical traditions. Bad signals: very specific practical decisions, time-sensitive dilemmas, narrow tactical questions.

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
      recommendationsAppropriate: Boolean(parsed.recommendationsAppropriate),
      recommendationHint:
        typeof parsed.recommendationHint === "string" && parsed.recommendationHint.trim().length > 0
          ? parsed.recommendationHint.trim()
          : null,
    };
  } catch (err) {
    console.error("Question classification failed, defaulting to advice:", err);
    return DEFAULT_QUESTION_CLASSIFICATION;
  }
}

// ── Philosopher content generation ───────────────────────────────────

export async function generateContent(
  philosopherId: string,
  contentTypeKey: ContentTypeKey,
  sourceMaterial: string,
  targetLength?: TargetLength,
  templateOverride?: string
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
      "SELECT id, system_prompt_text, prompt_version FROM system_prompts WHERE philosopher_id = ? AND is_active = 1 LIMIT 1"
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

  // 4. Parse core principles for context
  let principlesText = "";
  try {
    const principles = JSON.parse(philosopher.core_principles!) as {
      title: string;
      description: string;
    }[];
    principlesText = principles
      .map((p) => `- ${p.title}: ${p.description}`)
      .join("\n");
  } catch {
    principlesText = "(no principles available)";
  }

  // 5. Compose the system message: persona prompt + metadata + template
  //    Substitute {LENGTH_GUIDANCE} if the template uses variable lengths
  const lengthGuidance = getLengthGuidance(contentTypeKey, targetLength);
  const instructions = templateInstructions
    .replace("{LENGTH_GUIDANCE}", lengthGuidance)
    .replace("{SOURCE_MATERIAL}", sourceMaterial);
  const houseRules = getActiveHouseRules();
  const houseRulesBlock = houseRules ? `\n---\n\n${houseRules}\n` : "";

  const systemMessage = `${activePrompt.system_prompt_text}

---

PHILOSOPHER METADATA:
Name: ${philosopher.name}
Tradition: ${philosopher.tradition}
Era: ${philosopher.era!}
Core Principles:
${principlesText}
${houseRulesBlock}

---

${instructions}`;

  // 6. Compose the user message
  let userMessage = `SOURCE MATERIAL:\n${sourceMaterial}`;

  // For cross-replies and rebuttals, the source material should already
  // contain the other philosopher's info, but we'll add structure if the
  // content type warrants it
  if (
    contentTypeKey === "cross_philosopher_reply" ||
    contentTypeKey === "debate_rebuttal"
  ) {
    userMessage = `YOU ARE REPLYING TO THE FOLLOWING:\n\n${sourceMaterial}`;
  }

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

  let maxTokens = targetLength
    ? (LENGTH_MAX_TOKENS[targetLength] ?? DEFAULT_MAX_TOKENS)
    : DEFAULT_MAX_TOKENS;

  // Hard cap for quips - they should never need more than a few tokens
  if (contentTypeKey === "quip") {
    maxTokens = 192;
  }

  // Agora responses need more headroom, especially follow-ups which include
  // full parent context (all previous responses + synthesis + article)
  if (contentTypeKey === "agora_response") {
    maxTokens = 2048;
  }

  let rawOutput = "";
  let response: Awaited<ReturnType<typeof createMessage>> | null = null;

  try {
    response = await createMessage(
      client,
      {
        model: generationModel,
        max_tokens: maxTokens,
        temperature: TEMPERATURE,
        system: systemMessage,
        messages: [{ role: "user", content: userMessage }],
      },
      "generation"
    );

    // Extract text from the response
    rawOutput = response.content
      .filter((block) => block.type === "text")
      .map((block) => {
        if (block.type === "text") return block.text;
        return "";
      })
      .join("");
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown API error";
    return {
      success: false,
      error: `Anthropic API error: ${message}`,
      rawOutput: rawOutput || String(err),
      systemPromptId: activePrompt.id,
    };
  }

  // 7b. Detect output truncation - the model hit max_tokens before finishing
  if (response && response.stop_reason === "max_tokens") {
    return {
      success: false,
      error: `Response truncated (hit ${maxTokens} token output limit). The model did not finish generating valid JSON.`,
      rawOutput,
      systemPromptId: activePrompt.id,
    };
  }

  // 8. Parse the JSON response
  try {
    const parsed = parseJsonResponse(rawOutput);
    return {
      success: true,
      data: parsed,
      rawOutput,
      systemPromptId: activePrompt.id,
    };
  } catch {
    return {
      success: false,
      error: `Failed to parse AI response as JSON. The raw output is preserved in the generation log.`,
      rawOutput,
      systemPromptId: activePrompt.id,
    };
  }
}

// ── Synthesis generation (no philosopher persona) ────────────────────

export async function generateSynthesis(
  synthesisType: "debate_synthesis" | "agora_synthesis",
  sourceMaterial: string,
  templateOverride?: string
): Promise<GenerationOutcome> {
  const { synthesisModel } = getGenerationModels();

  // 1. Get the synthesis template (DB-first, code fallback)
  const systemMessage = templateOverride ?? getActiveTemplate(synthesisType);

  // 3. Call the Anthropic API with lower temperature
  const client = getAnthropicClient();
  if (!client) {
    return {
      success: false,
      error:
        "ANTHROPIC_API_KEY is not configured. Set it in .env.local to enable AI generation.",
      rawOutput: "",
      systemPromptId: null,
    };
  }

  let rawOutput = "";

  try {
    const response = await createMessage(
      client,
      {
        model: synthesisModel,
        max_tokens: SYNTHESIS_MAX_TOKENS,
        temperature: SYNTHESIS_TEMPERATURE,
        system: systemMessage,
        messages: [{ role: "user", content: sourceMaterial }],
      },
      "synthesis"
    );

    rawOutput = response.content
      .filter((block) => block.type === "text")
      .map((block) => {
        if (block.type === "text") return block.text;
        return "";
      })
      .join("");
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown API error";
    return {
      success: false,
      error: `Anthropic API error: ${message}`,
      rawOutput: rawOutput || String(err),
      systemPromptId: null,
    };
  }

  // 4. Parse the JSON response
  try {
    const parsed = parseJsonResponse(rawOutput);
    return {
      success: true,
      data: parsed,
      rawOutput,
      systemPromptId: null,
    };
  } catch {
    return {
      success: false,
      error: `Failed to parse synthesis response as JSON. The raw output is preserved in the generation log.`,
      rawOutput,
      systemPromptId: null,
    };
  }
}
