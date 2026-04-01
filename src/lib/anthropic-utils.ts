/**
 * Shared Anthropic API utilities used by generation-service and news-scout-service.
 */

import Anthropic from "@anthropic-ai/sdk";
import { classifyError, logApiCall } from "@/lib/api-logger";

export function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "placeholder_key_here") return null;
  return new Anthropic({ apiKey });
}

/**
 * Logged wrapper around client.messages.create().
 * Use this instead of calling client.messages.create() directly.
 */
export async function createMessage(
  client: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming,
  caller: string
): Promise<Anthropic.Message> {
  const start = Date.now();
  const systemLength =
    typeof params.system === "string"
      ? params.system.length
      : Array.isArray(params.system)
        ? JSON.stringify(params.system).length
        : 0;
  const userMessageLength = params.messages
    .map((message) =>
      typeof message.content === "string"
        ? message.content.length
        : JSON.stringify(message.content).length
    )
    .reduce((total, length) => total + length, 0);

  try {
    const response = await client.messages.create(params);
    const latencyMs = Date.now() - start;
    const rawText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    logApiCall({
      caller,
      model: params.model,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      maxTokensRequested: params.max_tokens,
      temperature: params.temperature ?? null,
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
      model: params.model,
      inputTokens: null,
      outputTokens: null,
      maxTokensRequested: params.max_tokens,
      temperature: params.temperature ?? null,
      stopReason: null,
      latencyMs,
      success: false,
      errorMessage: message,
      errorType: type,
      systemPromptLength: systemLength,
      userMessageLength,
      responseLength: null,
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
    return JSON.parse(repairJson(cleaned));
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
        return JSON.parse(repairJson(fenceMatch[1].trim()));
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
          return JSON.parse(repairJson(jsonCandidate));
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
