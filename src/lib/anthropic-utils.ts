/**
 * Shared Anthropic API utilities used by generation-service and news-scout-service.
 */

import Anthropic from "@anthropic-ai/sdk";

export function getAnthropicClient(): Anthropic | null {
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

export function parseJsonResponse(rawOutput: string): Record<string, unknown> {
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
