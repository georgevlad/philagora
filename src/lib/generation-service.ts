/**
 * Generation service — calls the Anthropic Claude API to generate
 * philosophical content based on a philosopher's persona and a content template.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "@/lib/db";
import {
  CONTENT_TEMPLATES,
  getLengthGuidance,
  type ContentTypeKey,
  type TargetLength,
} from "@/lib/content-templates";

// ── Configuration ────────────────────────────────────────────────────

const MODEL = "claude-sonnet-4-20250514";
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

// ── Types ────────────────────────────────────────────────────────────

interface PhilosopherRow {
  id: string;
  name: string;
  tradition: string;
  color: string;
  initials: string;
  bio: string;
  era: string;
  core_principles: string; // JSON string
}

interface PromptRow {
  id: number;
  system_prompt_text: string;
  prompt_version: number;
}

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

// ── Shared helpers ───────────────────────────────────────────────────

function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "placeholder_key_here") return null;
  return new Anthropic({ apiKey });
}

/**
 * Attempt to fix common LLM JSON malformations before parsing.
 * Handles split arrays (e.g. `"posts": ["a"], ["b"]` → `"posts": ["a", "b"]`),
 * trailing commas, and similar structural mistakes.
 */
function repairJson(raw: string): string {
  let fixed = raw;
  // Fix split arrays: "], [" → ", " (model splits one array into two bare arrays)
  fixed = fixed.replace(/"\s*\]\s*,\s*\[\s*"/g, '", "');
  // Remove trailing commas before } or ]
  fixed = fixed.replace(/,\s*([}\]])/g, "$1");
  return fixed;
}

function parseJsonResponse(rawOutput: string): Record<string, unknown> {
  let cleaned = rawOutput.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    // Attempt repair on common LLM JSON malformations
    const repaired = repairJson(cleaned);
    return JSON.parse(repaired); // throws if repair also fails
  }
}

// ── Philosopher content generation ───────────────────────────────────

export async function generateContent(
  philosopherId: string,
  contentTypeKey: ContentTypeKey,
  sourceMaterial: string,
  targetLength?: TargetLength
): Promise<GenerationOutcome> {
  const db = getDb();

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

  // 3. Get the content template
  const template = CONTENT_TEMPLATES[contentTypeKey];
  if (!template) {
    return {
      success: false,
      error: `Unknown content type: ${contentTypeKey}`,
      rawOutput: "",
      systemPromptId: activePrompt.id,
    };
  }

  // 4. Parse core principles for context
  let principlesText = "";
  try {
    const principles = JSON.parse(philosopher.core_principles) as {
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
  const instructions = template.instructions.replace("{LENGTH_GUIDANCE}", lengthGuidance);

  const systemMessage = `${activePrompt.system_prompt_text}

---

PHILOSOPHER METADATA:
Name: ${philosopher.name}
Tradition: ${philosopher.tradition}
Era: ${philosopher.era}
Core Principles:
${principlesText}

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

  const maxTokens = targetLength
    ? (LENGTH_MAX_TOKENS[targetLength] ?? DEFAULT_MAX_TOKENS)
    : DEFAULT_MAX_TOKENS;

  let rawOutput = "";

  try {
    const response = await client.messages.create({
      model: MODEL,
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
  // 1. Get the synthesis template
  const template = CONTENT_TEMPLATES[synthesisType];
  if (!template) {
    return {
      success: false,
      error: `Unknown synthesis type: ${synthesisType}`,
      rawOutput: "",
      systemPromptId: null,
    };
  }

  // 2. System message is ONLY the template instructions (no philosopher persona)
  const systemMessage = template.instructions;

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
      model: MODEL,
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
