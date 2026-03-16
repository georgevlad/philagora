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

export function parseJsonResponse(rawOutput: string): Record<string, unknown> {
  return parseJsonValueResponse(rawOutput) as Record<string, unknown>;
}
