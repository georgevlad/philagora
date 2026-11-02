import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";

import {
  normalizeMessageParams,
  omitsSamplingParameters,
  parseJsonResponse,
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

  it.each(["claude-opus-5-5", "claude-sonnet-5-5", "claude-fable-5-1", "claude-haiku-5-5"])(
    "prepares %s for adaptive thinking without changing the caller's params", (model) => {
      const params = baseParams(model);
      const normalized = normalizeMessageParams(params);
      expect(normalized).not.toHaveProperty("temperature");
      expect(normalized).not.toHaveProperty("top_p");
      expect(normalized).not.toHaveProperty("top_k");
      expect(normalized.thinking).toEqual({ type: "adaptive" });
      expect(normalized.output_config).toEqual({ effort: "medium" });
      expect(normalized.max_tokens).toBe(8192);
      expect(params.max_tokens).toBe(64);
      expect(params).not.toHaveProperty("thinking");
    },
  );

  it("preserves explicit effort, output format and larger token ceilings", () => {
    const params = { ...baseParams("claude-opus-5-5"), max_tokens: 16000,
      output_config: { effort: "high" as const, format: { type: "json_schema" as const, schema: { type: "object" } } } };
    const normalized = normalizeMessageParams(params);
    expect(normalized.output_config).toEqual(params.output_config);
    expect(normalized.max_tokens).toBe(16000);
  });

  it("allows Haiku's explicitly disabled thinking without expanding its budget", () => {
    const normalized = normalizeMessageParams({ ...baseParams("claude-haiku-5-5"), thinking: { type: "disabled" } });
    expect(normalized.thinking).toEqual({ type: "disabled" });
    expect(normalized.max_tokens).toBe(64);
  });
});

describe("model JSON with literal string controls", () => {
  it("preserves paragraphs, quoted words, backslashes and punctuation inside content", () => {
    const content = 'First paragraph with "quoted words", a path C:\\files, and literal ,}.\n\nSecond paragraph.\r\n\tA tab and control \u0001. [S1]';
    const malformed = JSON.stringify({ content }).replaceAll('\\n', '\n').replaceAll('\\r', '\r').replaceAll('\\t', '\t').replaceAll('\\u0001', '\u0001');
    expect(() => JSON.parse(malformed)).toThrow();
    expect(parseJsonResponse(malformed)).toEqual({ content });
  });

  it.each(["%s", "```json\n%s\n```", "Here is the draft:\n%s\nEnd."])("repairs controls in %s", (wrapper) => {
    expect(parseJsonResponse(wrapper.replace("%s", '{"content":"First.\n\nSecond."}'))).toEqual({ content: "First.\n\nSecond." });
  });

  it("leaves valid JSON escapes and formatting untouched", () => {
    const data = { content: 'A literal \\n, an escaped quote ", and a line\nbreak.', values: [1, 2] };
    expect(parseJsonResponse(JSON.stringify(data, null, 2))).toEqual(data);
  });

  it.each(['{"content":"Unfinished\nparagraph', '{"content":"Unknown escape \\q"}', '{"content":"A "bare" quote"}'])("does not guess at ambiguous or incomplete content: %s", (raw) => {
    expect(() => parseJsonResponse(raw)).toThrow();
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
