/**
 * Generation service — calls the Anthropic Claude API to generate
 * philosophical content based on a philosopher's persona and a content template.
 */

import { getDb } from "@/lib/db";
import { getAnthropicClient, parseJsonResponse } from "@/lib/anthropic-utils";
import {
  getActiveHouseRules,
  getActiveTemplate,
  getLengthGuidance,
  type ContentTypeKey,
  type TargetLength,
} from "@/lib/content-templates";
import {
  DEFAULT_GENERATION_MODEL,
  parseGenerationModel,
} from "@/lib/scoring-config";
import type { PhilosopherRow, PromptRow } from "@/lib/db-types";

// ── Configuration ────────────────────────────────────────────────────

const DEFAULT_MAX_TOKENS = 1024;
const TEMPERATURE = 0.8; // Tunable — higher = more creative variation

/** Hard-cap tokens by target length to enforce brevity at the API level. */
const LENGTH_MAX_TOKENS: Record<string, number> = {
  short: 256,
  medium: 1024,
  long: 1536,
};

const SYNTHESIS_TEMPERATURE = 0.4; // Lower for precision and consistency
const SYNTHESIS_MAX_TOKENS = 2048; // Synthesis output is longer

function getGenerationModels(): {
  generationModel: string;
  synthesisModel: string;
} {
  const db = getDb();
  const getConfig = (key: string, fallback: string): string => {
    const row = db
      .prepare("SELECT value FROM scoring_config WHERE key = ?")
      .get(key) as { value: string } | undefined;

    return parseGenerationModel(row?.value ?? JSON.stringify(fallback));
  };

  return {
    generationModel: getConfig("generation_model", DEFAULT_GENERATION_MODEL),
    synthesisModel: getConfig("synthesis_model", DEFAULT_GENERATION_MODEL),
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

// ── Philosopher content generation ───────────────────────────────────

export async function generateContent(
  philosopherId: string,
  contentTypeKey: ContentTypeKey,
  sourceMaterial: string,
  targetLength?: TargetLength
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
  const templateInstructions = getActiveTemplate(contentTypeKey);

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
  const lengthGuidance = getLengthGuidance(contentTypeKey, targetLength ?? "medium");
  const instructions = templateInstructions.replace(
    "{LENGTH_GUIDANCE}",
    lengthGuidance
  );
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

  let rawOutput = "";

  try {
    const response = await client.messages.create({
      model: generationModel,
      max_tokens: maxTokens,
      temperature: TEMPERATURE,
      system: systemMessage,
      messages: [{ role: "user", content: userMessage }],
    });

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
  sourceMaterial: string
): Promise<GenerationOutcome> {
  const { synthesisModel } = getGenerationModels();

  // 1. Get the synthesis template (DB-first, code fallback)
  const systemMessage = getActiveTemplate(synthesisType);

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
    const response = await client.messages.create({
      model: synthesisModel,
      max_tokens: SYNTHESIS_MAX_TOKENS,
      temperature: SYNTHESIS_TEMPERATURE,
      system: systemMessage,
      messages: [{ role: "user", content: sourceMaterial }],
    });

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
