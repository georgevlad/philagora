import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedPhilosophers } from "@/lib/__tests__/test-db";
import { MIGRATIONS } from "../../db/migrations";
let db: Database.Database;
vi.mock("@/lib/db", () => ({ getDb: () => db }));
const { editorial, perspective, client } = vi.hoisted(() => ({ editorial: vi.fn(), perspective: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/generation-service", () => ({ generateEditorialContent: editorial, generateContent: perspective }));
vi.mock("@/lib/anthropic-utils", () => ({ getAnthropicClient: client }));
import {
  createFocusExperiment, editFocusVersion, focusPhilosophers, generateFocusVersion,
  getFocusExperiment, listFocusExperiments, normalizeFocusOutput, saveFocusExperiment, validateFocusState,
} from "./in-focus-service";
import { focusVersionIsStale, selectedFocusVersion, type FocusExperiment, type FocusKind } from "./in-focus";
import { POST as createRoute } from "@/app/api/admin/in-focus/route";
import { PUT as saveRoute, GET as getRoute } from "@/app/api/admin/in-focus/[id]/route";
import { POST as generateRoute } from "@/app/api/admin/in-focus/[id]/generate/route";

const outcome = (data: object) => ({ success: true, data, rawOutput: JSON.stringify(data), systemPromptId: null });
beforeEach(() => {
  vi.clearAllMocks();
  db = createTestDb(); seedPhilosophers(db);
  for (const id of ["plato", "kant"]) db.prepare("INSERT INTO system_prompts (philosopher_id, system_prompt_text, prompt_version, is_active) VALUES (?, ?, 1, 1)").run(id, `You are ${id}.`);
  client.mockReturnValue({});
  editorial.mockResolvedValue(outcome({ content: "The council proposed cooling centres. [S1]\n\nIts budget is disputed." }));
  perspective.mockResolvedValue(outcome({ content: "Public duty requires examining who benefits. [S1]" }));
});
afterEach(() => { db.close(); vi.useRealTimers(); });

function setup() {
  const e = createFocusExperiment("Cooling a city");
  return saveFocusExperiment(e.id, { ...e.state, topic: "Judge the council's priorities", question: "Who should receive help first?", leadId: "plato", challengerId: "kant",
    sources: [{ id: "source-one", title: "Council statement", url: "https://example.com/council", publisher: "Council", date: "2026-09-20", excerpt: "The council proposed cooling centres with a limited budget." }] }, e.revision);
}
async function generate(e: FocusExperiment, kind: FocusKind, requestId = randomUUID()) {
  return generateFocusVersion(e.id, { kind, expected_revision: e.revision, request_id: requestId });
}
function body(value: unknown, method = "POST") { return new Request("http://localhost/api/admin/in-focus", { method, body: JSON.stringify(value), headers: { "Content-Type": "application/json" } }); }
const context = (id: string) => ({ params: Promise.resolve({ id }) });

describe("private workshop persistence and provenance", () => {
  it("migrates existing databases additively and idempotently", () => {
    db.exec("DROP TABLE in_focus_versions; DROP TABLE in_focus_experiments;");
    const migration = MIGRATIONS.find((m) => m.name === "private_in_focus_workshop")!;
    migration.migrate(db, {}); migration.migrate(db, {});
    expect(createFocusExperiment("Saved").state.title).toBe("Saved");
    expect(db.prepare("SELECT COUNT(*) AS n FROM philosophers").get()).toEqual({ n: 4 });
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
  });
  it("saves alternatives without producing public posts, debates, Agora threads, or publishable logs", async () => {
    let e = setup();
    for (const kind of ["briefing", "argument", "challenge", "reply"] as const) e = (await generate(e, kind)).experiment;
    expect(e.versions).toHaveLength(4);
    const reply = selectedFocusVersion(e, "reply")!;
    expect(reply.snapshot.argument?.philosopherName).toBe("Plato");
    expect(reply.snapshot.challenge?.philosopherName).toBe("Immanuel Kant");
    expect(reply.snapshot.sources[0].excerpt).toContain("limited budget");
    expect(reply.snapshot.template).toContain("interpretation of a historical thinker");
    for (const table of ["posts", "debates", "agora_threads", "generation_log"]) {
      // Fixed, test-owned table names only.
      expect(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()).toEqual({ n: 0 });
    }
    expect(listFocusExperiments()[0].versionCount).toBe(4);
  });
  it("keeps the old briefing and dependent arguments when sources change", async () => {
    let e = (await generate(setup(), "briefing")).experiment;
    e = (await generate(e, "argument")).experiment;
    const original = selectedFocusVersion(e, "argument")!;
    e = saveFocusExperiment(e.id, { ...e.state, sources: [{ ...e.state.sources[0], excerpt: "The budget has changed." }] }, e.revision);
    expect(focusVersionIsStale(e.state, original)).toBe(true);
    await expect(generate(e, "challenge")).rejects.toThrow("briefing uses earlier context");
    expect(getFocusExperiment(e.id).versions.find((v) => v.id === original.id)?.snapshot.sources[0].excerpt).toContain("limited budget");
    const oldBriefing = selectedFocusVersion(e, "briefing")!;
    e = editFocusVersion(e.id, { kind: "briefing", base_version_id: oldBriefing.id, content: "Reviewed against the new budget. [S1]", expected_revision: e.revision });
    expect(focusVersionIsStale(e.state, selectedFocusVersion(e, "briefing")!)).toBe(false);
    expect(e.versions).toHaveLength(3);
    await expect(generate(e, "challenge")).rejects.toThrow("argument uses earlier context");
  });
  it("does not rebase an edited argument onto new facts", async () => {
    let e = (await generate(setup(), "briefing")).experiment;
    e = (await generate(e, "argument")).experiment;
    const argument = selectedFocusVersion(e, "argument")!;
    e = saveFocusExperiment(e.id, { ...e.state, question: "A different question?" }, e.revision);
    e = editFocusVersion(e.id, { kind: "argument", base_version_id: argument.id, content: "An editorial correction.", expected_revision: e.revision });
    const edited = selectedFocusVersion(e, "argument")!;
    expect(edited.snapshot.question).toBe("Who should receive help first?");
    expect(focusVersionIsStale(e.state, edited)).toBe(true);
    expect(e.versions.find((v) => v.id === argument.id)?.output.content).toBe(argument.output.content);
  });
  it("rejects stale writes and cross-experiment alternative selection", async () => {
    const initial = setup();
    const next = saveFocusExperiment(initial.id, { ...initial.state, title: "New title" }, initial.revision);
    expect(() => saveFocusExperiment(initial.id, initial.state, initial.revision)).toThrow("another tab");
    const other = (await generate(setup(), "briefing")).experiment;
    expect(() => saveFocusExperiment(next.id, { ...next.state, selected: { briefing: other.state.selected.briefing } }, next.revision)).toThrow("from this experiment");
    expect(getFocusExperiment(next.id).state.title).toBe("New title");
  });
  it("archives and restores without discarding alternatives", async () => {
    let e = (await generate(setup(), "briefing")).experiment;
    e = saveFocusExperiment(e.id, e.state, e.revision, true);
    await expect(generate(e, "argument")).rejects.toThrow("Restore");
    expect(listFocusExperiments()[0].archived).toBe(true);
    e = saveFocusExperiment(e.id, e.state, e.revision, false);
    expect(e.versions).toHaveLength(1);
    expect((await generate(e, "argument")).version.status).toBe("complete");
  });
});

describe("generation failure and concurrent requests", () => {
  it("deduplicates a request ID and rejects another simultaneous run", async () => {
    const e = setup(); const requestId = randomUUID();
    let finish!: (value: ReturnType<typeof outcome>) => void;
    editorial.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const pending = generate(e, "briefing", requestId);
    const duplicate = await generate(e, "briefing", requestId);
    expect(duplicate.version.status).toBe("generating");
    await expect(generate(e, "briefing")).rejects.toThrow("already running");
    finish(outcome({ content: "A sourced briefing. [S1]" }));
    const result = await pending;
    expect(result.version.status).toBe("complete");
    expect((await generate(e, "briefing", requestId)).version.id).toBe(requestId);
    expect(editorial).toHaveBeenCalledTimes(1);
  });
  it("saves a late result without overwriting edits made during generation", async () => {
    const e = setup(); let finish!: (value: ReturnType<typeof outcome>) => void;
    editorial.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const pending = generate(e, "briefing");
    saveFocusExperiment(e.id, { ...e.state, topic: "Updated editorial direction" }, e.revision);
    finish(outcome({ content: "The earlier briefing. [S1]" }));
    const result = await pending;
    expect(result.selected).toBe(false);
    expect(result.experiment.state.selected.briefing).toBeUndefined();
    expect(result.version.snapshot.topic).toBe(e.state.topic);
    expect(result.experiment.state.topic).toBe("Updated editorial direction");
  });
  it("preserves earlier alternatives on provider or malformed-output failure", async () => {
    let e = (await generate(setup(), "briefing")).experiment;
    const previousId = e.state.selected.briefing;
    editorial.mockResolvedValueOnce({ success: false, error: "secret internal provider details", rawOutput: "partial JSON" });
    const failed = await generate(e, "briefing");
    expect(failed.version.status).toBe("failed");
    expect(failed.version.error).not.toContain("secret");
    expect(failed.experiment.state.selected.briefing).toBe(previousId);
    e = failed.experiment;
    editorial.mockResolvedValueOnce(outcome({ content: "A made-up source. [S99]" }));
    const invalid = await generate(e, "briefing");
    expect(invalid.version.status).toBe("failed");
    expect(invalid.experiment.state.selected.briefing).toBe(previousId);
    expect(invalid.experiment.versions).toHaveLength(3);
  });
  it("recovers an abandoned request without allowing its late output to replace a new run", async () => {
    const e = setup(); let finish!: (value: ReturnType<typeof outcome>) => void;
    editorial.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const pending = generate(e, "briefing");
    db.prepare("UPDATE in_focus_versions SET created_at = ? WHERE experiment_id = ?").run("2000-01-01T00:00:00.000Z", e.id);
    const newer = await generate(e, "briefing");
    finish(outcome({ content: "Late old output [S1]" }));
    await pending;
    expect(getFocusExperiment(e.id).state.selected.briefing).toBe(newer.version.id);
    expect(getFocusExperiment(e.id).versions.filter((v) => v.status === "failed")).toHaveLength(1);
  });
  it("requires actual source text and a configured model before a paid call", async () => {
    let e = setup();
    e = saveFocusExperiment(e.id, { ...e.state, sources: [{ ...e.state.sources[0], excerpt: "" }] }, e.revision);
    await expect(generate(e, "briefing")).rejects.toThrow("source excerpt");
    client.mockReturnValue(null);
    await expect(generate(setup(), "briefing")).rejects.toThrow("not configured");
    expect(editorial).not.toHaveBeenCalled();
  });
  it("uses editor feedback and the selected main argument for challenges", async () => {
    let e = (await generate(setup(), "briefing")).experiment;
    e = (await generate(e, "argument")).experiment;
    await generateFocusVersion(e.id, { kind: "challenge", expected_revision: e.revision, request_id: randomUUID(), feedback: "Challenge the inference." });
    expect(perspective).toHaveBeenLastCalledWith("kant", "in_focus_perspective", expect.stringContaining("Challenge the inference."), undefined, expect.any(String), expect.any(Function));
    expect(perspective.mock.calls.at(-1)?.[2]).toContain("MAIN ARGUMENT (Plato)");
  });
});

describe("input validation and admin responses", () => {
  it.each(["javascript:alert(1)", "file:///etc/passwd", "https://user:password@example.com"])("rejects unsafe source links: %s", (url) => {
    const e = setup();
    expect(() => validateFocusState({ ...e.state, sources: [{ ...e.state.sources[0], url }] })).toThrow("HTTP or HTTPS");
  });
  it("rejects impossible dates, duplicate sources, and oversized research", () => {
    const e = setup();
    expect(() => validateFocusState({ ...e.state, asOf: "2026-02-31" })).toThrow("valid date");
    expect(() => validateFocusState({ ...e.state, sources: [e.state.sources[0], e.state.sources[0]] })).toThrow("unique ID");
    expect(() => validateFocusState({ ...e.state, sources: [{ ...e.state.sources[0], excerpt: "x".repeat(20001) }] })).toThrow("20,000");
  });
  it("validates suggestion shape and rejects nonexistent philosophers", () => {
    expect(() => normalizeFocusOutput("voices", { voices: [{ philosopherId: "invented", reason: "Why" }] }, 1, focusPhilosophers())).toThrow("unavailable");
    expect(() => normalizeFocusOutput("questions", { questions: ["not an object"] }, 1, [])).toThrow();
    expect(normalizeFocusOutput("questions", { questions: [{ question: "What is fair?", reason: "A limited budget." }] }, 1, []).questions).toHaveLength(1);
  });
  it("returns structured 400, 404, and 409 errors with no raw internals", async () => {
    expect((await createRoute(body([]))).status).toBe(400);
    expect((await getRoute(body({}), context("missing"))).status).toBe(404);
    const e = setup();
    expect((await saveRoute(body({ state: e.state, expected_revision: e.revision - 1 }, "PUT"), context(e.id))).status).toBe(409);
    const response = await generateRoute(body({ kind: "anything", expected_revision: e.revision, request_id: randomUUID() }), context(e.id));
    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty("error");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
