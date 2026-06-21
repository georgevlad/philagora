import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";

import {
  normalizeMessageParams,
  omitsSamplingParameters,
} from "@/lib/anthropic-utils";

function baseParams(
  model: string
): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model,
    max_tokens: 64,
    temperature: 0.8,
    top_p: 0.9,
    top_k: 40,
    messages: [{ role: "user", content: "Hello" }],
  };
}

describe("normalizeMessageParams", () => {
  it("omits sampling parameters for Opus 4.8", () => {
    const params = baseParams("claude-opus-4-8");
    const normalized = normalizeMessageParams(params);

    expect(normalized).not.toHaveProperty("temperature");
    expect(normalized).not.toHaveProperty("top_p");
    expect(normalized).not.toHaveProperty("top_k");
    expect(params.temperature).toBe(0.8);
  });

  it("keeps sampling parameters for Sonnet 4.6", () => {
    const normalized = normalizeMessageParams(baseParams("claude-sonnet-4-6"));

    expect(normalized.temperature).toBe(0.8);
    expect(normalized.top_p).toBe(0.9);
    expect(normalized.top_k).toBe(40);
  });
});

describe("omitsSamplingParameters", () => {
  it("only targets Opus 4.7 and later dateless IDs", () => {
    expect(omitsSamplingParameters("claude-opus-4-7")).toBe(true);
    expect(omitsSamplingParameters("claude-opus-4-8")).toBe(true);
    expect(omitsSamplingParameters("claude-opus-4-10")).toBe(true);
    expect(omitsSamplingParameters("claude-opus-4-20250514")).toBe(false);
    expect(omitsSamplingParameters("claude-sonnet-4-6")).toBe(false);
  });
});
