import type Anthropic from "@anthropic-ai/sdk";
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedPhilosophers } from "@/lib/__tests__/test-db";

let db: Database.Database;
vi.mock("@/lib/db", () => ({ getDb: () => db }));
const { provider } = vi.hoisted(() => ({ provider: vi.fn() }));
vi.mock("@/lib/anthropic-utils", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/anthropic-utils")>(),
  getAnthropicClient: () => ({ messages: { create: provider } }),
}));

import { generateContent } from "@/lib/generation-service";
import { createFocusExperiment, editFocusVersion, generateFocusVersion, saveFocusExperiment } from "@/lib/in-focus-service";
import type { FocusExperiment, FocusKind } from "@/lib/in-focus";

function response(raw: string, stopReason: Anthropic.Message["stop_reason"] = "end_turn") {
  return { content: [{ type: "text", text: raw }], stop_reason: stopReason, usage: { input_tokens: 120, output_tokens: 80 } };
}
function generate(experiment: FocusExperiment, kind: FocusKind = "argument") {
  return generateFocusVersion(experiment.id, { kind, expected_revision: experiment.revision, request_id: randomUUID() });
}
function setup() {
  let experiment = createFocusExperiment("The council's decision");
  experiment = saveFocusExperiment(experiment.id, {
    ...experiment.state, question: "What makes this decision fair?", leadId: "plato", challengerId: "kant",
    sources: [{ id: "source-one", title: "Council statement", url: "", publisher: "", date: "", excerpt: "The council has a limited budget." }],
  }, experiment.revision);
  return editFocusVersion(experiment.id, { kind: "briefing", content: "The budget is limited. [S1]", expected_revision: experiment.revision });
}
function logs() {
  return db.prepare("SELECT caller, success, error_type, error_message, input_tokens, output_tokens, stop_reason FROM api_call_log ORDER BY id").all();
}

beforeEach(() => {
  provider.mockReset();
  db = createTestDb(); seedPhilosophers(db);
  for (const id of ["plato", "kant"]) {
    db.prepare("INSERT INTO system_prompts (philosopher_id, system_prompt_text, is_active) VALUES (?, ?, 1)").run(id, `You are ${id}.`);
  }
});
afterEach(() => db.close());

describe("workshop output processing through the real generation and logging pipeline", () => {
  it("saves a complete argument when the provider puts literal paragraph breaks in JSON", async () => {
    const content = 'A citizen must examine the "fair" allocation. [S1]\n\nA second paragraph tests that judgment.';
    const raw = JSON.stringify({ content }).replaceAll('\\n', '\n');
    provider.mockResolvedValue(response(raw));
    const result = await generate(setup());
    expect(result.version.status).toBe("complete");
    expect(result.version.output).toEqual({ content });
    expect(result.selected).toBe(true);
    expect(logs()).toEqual([expect.objectContaining({ caller: "in_focus", success: 1, input_tokens: 120, output_tokens: 80 })]);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it("records a parse failure with token usage and a safe explanation while preserving the selected alternative", async () => {
    provider.mockResolvedValueOnce(response('{"content":"An existing argument. [S1]"}'));
    const previous = await generate(setup());
    provider.mockResolvedValueOnce(response('private source details: {"content":"unfinished'));
    const result = await generate(previous.experiment);
    expect(result.version.status).toBe("failed");
    expect(result.version.error).toContain("unreadable JSON");
    expect(result.version.error).not.toContain("private source details");
    expect(result.experiment.state.selected.argument).toBe(previous.version.id);
    expect(logs()).toHaveLength(2);
    expect(logs()[1]).toMatchObject({ caller: "in_focus", success: 0, error_type: "response_invalid_json", input_tokens: 120, output_tokens: 80, stop_reason: "end_turn" });
    expect(JSON.stringify(logs())).not.toContain("private source details");
  });

  it.each(["briefing", "questions", "voices"] as const)("records unreadable %s output as a processing failure", async (kind) => {
    provider.mockResolvedValue(response("Unstructured text instead of JSON"));
    const result = await generate(setup(), kind);
    expect(result.version.error).toContain("unreadable JSON");
    expect(logs()[0]).toMatchObject({ caller: "in_focus", success: 0, error_type: "response_invalid_json" });
  });

  it("also logs source validation failures after a successful provider response", async () => {
    provider.mockResolvedValue(response('{"content":"An unavailable source. [S99]"}'));
    const result = await generate(setup());
    expect(result.version.error).toContain("outside the supplied material");
    expect(logs()[0]).toMatchObject({ success: 0, error_type: "response_invalid_content" });
  });

  it("rejects and logs truncated responses even if the returned JSON parses", async () => {
    provider.mockResolvedValue(response('{"content":"An incomplete argument. [S1]"}', "max_tokens"));
    const result = await generate(setup());
    expect(result.version.error).toContain("cut off");
    expect(result.experiment.state.selected.argument).toBeUndefined();
    expect(logs()[0]).toMatchObject({ success: 0, error_type: "response_truncated", stop_reason: "max_tokens" });
  });

  it("keeps provider failures distinct from processing failures", async () => {
    provider.mockRejectedValue(new Error("provider unavailable"));
    const result = await generate(setup());
    expect(result.version.status).toBe("failed");
    expect(result.version.error).not.toContain("provider unavailable");
    expect(logs()[0]).toMatchObject({ success: 0, error_type: "api_error", input_tokens: null, output_tokens: null });
  });

  it("keeps the existing generation caller for other content types", async () => {
    provider.mockResolvedValue(response('{"content":"A news reaction."}'));
    const result = await generateContent("plato", "news_reaction", "Source text");
    expect(result.success).toBe(true);
    expect(logs()[0]).toMatchObject({ caller: "generation", success: 1 });
  });
});
