/**
 * Shared Anthropic API utilities used by generation-service and news-scout-service.
 */

import { agoraModelCall } from "@/lib/agora-model-call";
import Anthropic from "@anthropic-ai/sdk";
import { classifyError, logApiCall } from "@/lib/api-logger";

/** Safe application-level diagnostics; never include source text or provider internals. */
export class ModelResponseError extends Error {
  constructor(public code: "invalid_json" | "truncated" | "invalid_content", message: string) {
    super(message);
  }
}

const MODELS_WITHOUT_SAMPLING_PARAMS = new Set([
  "claude-opus-4-7",
  "claude-opus-4-8",
]);

export function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "placeholder_key_here") return null;
  return new Anthropic({ apiKey });
}

export function omitsSamplingParameters(model: string): boolean {
  return (
    MODELS_WITHOUT_SAMPLING_PARAMS.has(model) ||
    /^claude-opus-4-(?:[7-9]|\d{2})$/.test(model)
  );
}

export function normalizeMessageParams(
  params: Anthropic.MessageCreateParamsNonStreaming
): Anthropic.MessageCreateParamsNonStreaming {
  if (!omitsSamplingParameters(params.model)) {
    return params;
  }

  const normalizedParams = { ...params };
  delete normalizedParams.temperature;
  delete normalizedParams.top_p;
  delete normalizedParams.top_k;

  return normalizedParams;
}

/**
 * Logged wrapper around client.messages.create().
 * Use this instead of calling client.messages.create() directly.
 */
export async function createMessage(
  client: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming,
  caller: string,
  validateResponse?: (response: Anthropic.Message) => void,
): Promise<Anthropic.Message> {
  const start = Date.now();
  const requestParams = normalizeMessageParams(params);
  const systemLength =
    typeof requestParams.system === "string"
      ? requestParams.system.length
      : Array.isArray(requestParams.system)
        ? JSON.stringify(requestParams.system).length
        : 0;
  const userMessageLength = requestParams.messages
    .map((message) =>
      typeof message.content === "string"
        ? message.content.length
        : JSON.stringify(message.content).length
    )
    .reduce((total, length) => total + length, 0);

  let response: Anthropic.Message | null = null;
  let rawText = "";
  try {
    response = await client.messages.create(requestParams, agoraModelCall.getStore() === "durable" ? { maxRetries: 0, timeout: 90_000 } : undefined);
    const latencyMs = Date.now() - start;
    rawText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    // Workshop success includes parsing and content validation, not just HTTP success.
    validateResponse?.(response);

    logApiCall({
      caller,
      model: requestParams.model,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      maxTokensRequested: requestParams.max_tokens,
      temperature: requestParams.temperature ?? null,
      stopReason: response.stop_reason,
      latencyMs,
      success: true,
      systemPromptLength: systemLength,
      userMessageLength,
      responseLength: rawText.length,
    });

    return response;
  } catch (err) {
    const latencyMs = Date.now() - start;
    const { message, type } = classifyError(err);

    logApiCall({
      caller,
      model: requestParams.model,
      inputTokens: response?.usage?.input_tokens ?? null,
      outputTokens: response?.usage?.output_tokens ?? null,
      maxTokensRequested: requestParams.max_tokens,
      temperature: requestParams.temperature ?? null,
      stopReason: response?.stop_reason ?? null,
      latencyMs,
      success: false,
      errorMessage: response
        ? err instanceof ModelResponseError ? err.message : "The model responded, but its output could not be processed."
        : (agoraModelCall.getStore() || caller === "classification") ? "Agora provider request failed" : message,
      errorType: response ? err instanceof ModelResponseError ? `response_${err.code}` : "response_validation" : type,
      systemPromptLength: systemLength,
      userMessageLength,
      responseLength: response ? rawText.length : null,
    });

    throw err;
  }
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

/** Escape literal controls inside strings without changing text, escapes, or JSON structure. */
function escapeJsonStringControls(raw: string): string {
  let fixed = "";
  let inString = false;
  let escaped = false;
  for (const character of raw) {
    if (escaped) {
      fixed += character;
      escaped = false;
    } else if (inString && character === "\\") {
      fixed += character;
      escaped = true;
    } else if (character === '"') {
      fixed += character;
      inString = !inString;
    } else if (inString && character.charCodeAt(0) < 0x20) {
      fixed += JSON.stringify(character).slice(1, -1);
    } else {
      fixed += character;
    }
  }
  return fixed;
}

function parseJsonCandidate(raw: string): unknown {
  try { return JSON.parse(raw); } catch { /* Try lossless control escaping first. */ }
  const escaped = escapeJsonStringControls(raw);
  try { return JSON.parse(escaped); } catch { /* Keep the existing structural repairs as a fallback. */ }
  return JSON.parse(repairJson(escaped));
}

export function parseJsonValueResponse(rawOutput: string): unknown {
  let cleaned = rawOutput.trim();

  // Strategy 1: Strip markdown fences (existing behavior)
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
  }

  // Strategy 2: Direct parse
  try {
    return JSON.parse(cleaned);
  } catch {
    // continue to next strategy
  }

  // Strategy 3: Repair common malformations then parse
  try {
    return parseJsonCandidate(cleaned);
  } catch {
    // continue to next strategy
  }

  // Strategy 4: Extract JSON from markdown fences anywhere in the response
  const fenceMatch = rawOutput.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      try {
        return parseJsonCandidate(fenceMatch[1].trim());
      } catch {
        // continue to next strategy
      }
    }
  }

  // Strategy 5: Find the first top-level { ... } or [ ... ] in the response
  // This handles preamble text before the JSON object.
  const firstBrace = rawOutput.indexOf("{");
  const firstBracket = rawOutput.indexOf("[");
  const startChar =
    firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket) ? "{" : "[";
  const startIndex = startChar === "{" ? firstBrace : firstBracket;

  if (startIndex >= 0) {
    const closeChar = startChar === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escapeNext = false;
    let endIndex = -1;

    for (let index = startIndex; index < rawOutput.length; index += 1) {
      const ch = rawOutput[index];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (ch === "\\") {
        escapeNext = true;
        continue;
      }

      if (ch === "\"") {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (ch === startChar) {
        depth += 1;
      }

      if (ch === closeChar) {
        depth -= 1;
        if (depth === 0) {
          endIndex = index;
          break;
        }
      }
    }

    if (endIndex > startIndex) {
      const jsonCandidate = rawOutput.slice(startIndex, endIndex + 1);
      try {
        return JSON.parse(jsonCandidate);
      } catch {
        try {
          return parseJsonCandidate(jsonCandidate);
        } catch {
          // continue to throw below
        }
      }
    }
  }

  // All strategies failed - throw with a descriptive message
  const preview = rawOutput.length > 300
    ? `${rawOutput.slice(0, 150)} ... ${rawOutput.slice(-150)}`
    : rawOutput;
  throw new SyntaxError(
    `Could not extract valid JSON from model output. Preview: ${preview}`
  );
}

export function parseJsonResponse(rawOutput: string): Record<string, unknown> {
  return parseJsonValueResponse(rawOutput) as Record<string, unknown>;
}
