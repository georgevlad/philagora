import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Database from "better-sqlite3";
import { NextRequest } from "next/server";
import { createTestDb, seedPhilosophers } from "@/lib/__tests__/test-db";
let db: Database.Database;
vi.mock("@/lib/db", () => ({ getDb: () => db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/generation-service", () => ({ generateContent: vi.fn(), generateSynthesis: vi.fn(), classifyAgoraQuestion: vi.fn() }));
vi.mock("@/lib/article-extractor", () => ({ extractArticle: vi.fn(), getArticleSourceFromUrl: () => null, normalizeArticleUrl: () => null }));
import { generateContent, generateSynthesis, classifyAgoraQuestion } from "@/lib/generation-service";
import { POST as createDebate } from "./debates/route";
import { POST as createAgora } from "./agora/route";
import { PATCH as updateDebate } from "./debates/[id]/route";
import { POST as generateDebate } from "./debates/[id]/generate/route";
import { POST as approveDebate } from "./debates/[id]/approve/route";
import { POST as saveSynthesis } from "./debates/[id]/synthesis/route";
import { POST as generateAgora } from "./agora/[id]/generate/route";
import { POST as approveAgora } from "./agora/[id]/approve/route";
const request = (body: unknown) => new NextRequest("http://localhost/api/admin/test", { method: "POST", body: JSON.stringify(body) });
const params = { params: Promise.resolve({ id: "debate" }) };
beforeEach(() => {
  db = createTestDb(); seedPhilosophers(db); vi.clearAllMocks();
  db.prepare("INSERT INTO debates (id, title, debate_date) VALUES ('debate', 'A topic', datetime('now'))").run();
  db.prepare("INSERT INTO debate_philosophers (debate_id, philosopher_id) VALUES ('debate', 'camus'), ('debate', 'nietzsche')").run();
  db.prepare("INSERT INTO agora_threads (id, question, asked_by) VALUES ('debate', 'A question?', 'Editor')").run();
  db.prepare("INSERT INTO agora_thread_philosophers (thread_id, philosopher_id) VALUES ('debate', 'camus'), ('debate', 'nietzsche')").run();
});
afterEach(() => { db.close(); vi.restoreAllMocks(); });

describe("admin generation input integrity", () => {
  it.each([null, [], 42, "text"].map((body) => ({ body })))("rejects non-object JSON payload $body", async ({ body }) => {
    expect((await createDebate(request(body))).status).toBe(400);
    expect((await createAgora(request(body))).status).toBe(400);
  });
  it.each([["camus", "camus"], ["camus", "missing"], ["camus", 1]].map((ids) => ({ ids })))("rejects invalid participants $ids before creating work or classifying", async ({ ids }) => {
    expect((await createDebate(request({ title: "Test", philosopher_ids: ids }))).status).toBe(400);
    expect((await createAgora(request({ question: "Test?", philosopher_ids: ids }))).status).toBe(400);
    expect(classifyAgoraQuestion).not.toHaveBeenCalled();
    expect(db.prepare("SELECT COUNT(*) AS count FROM debates").get()).toEqual({ count: 1 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM agora_threads").get()).toEqual({ count: 1 });
  });
  it("rejects a generation request for a philosopher outside the selected group", async () => {
    expect((await generateDebate(request({ philosopher_id: "plato", phase: "opening" }), params)).status).toBe(400);
    expect((await generateAgora(request({ philosopher_id: "plato" }), params)).status).toBe(400);
    expect(generateContent).not.toHaveBeenCalled();
  });
  it("rejects invalid debate phases and missing rebuttal targets before saving", async () => {
    expect((await approveDebate(request({ philosopher_id: "camus", phase: "other", content: "Text" }), params)).status).toBe(400);
    expect((await approveDebate(request({ philosopher_id: "camus", phase: "rebuttal", content: "Text" }), params)).status).toBe(400);
    expect(db.prepare("SELECT COUNT(*) AS count FROM debate_posts").get()).toEqual({ count: 0 });
  });
  it("rejects malformed Agora posts and debate status/synthesis fields", async () => {
    expect((await approveAgora(request({ philosopher_id: "camus", posts: ["Valid", {}] }), params)).status).toBe(400);
    expect((await updateDebate(request({ status: "invalid" }), params)).status).toBe(400);
    expect((await updateDebate(request({ synthesis_tensions: "not-an-array" }), params)).status).toBe(400);
    expect((await saveSynthesis(request({ action: "save", data: { tensions: [{}] } }), params)).status).toBe(400);
  });
  it("creates valid debates and saves a selected philosopher's opening", async () => {
    const created = await createDebate(request({ title: "New debate", philosopher_ids: ["camus", "nietzsche"] }));
    expect(created.status).toBe(201);
    const saved = await approveDebate(request({ philosopher_id: "camus", phase: "opening", content: "An opening" }), params);
    expect(saved.status).toBe(201);
    expect((await saved.json()).content).toBe("An opening");
  });
  it("rolls back synthesis changes when its generation-log update fails, without exposing database errors", async () => {
    db.prepare("INSERT INTO generation_log (id, content_type, user_input, raw_output) VALUES (1, 'synthesis', '', '')").run();
    db.exec("CREATE TRIGGER fail_log BEFORE UPDATE ON generation_log BEGIN SELECT RAISE(ABORT, 'internal database detail'); END");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await saveSynthesis(request({ action: "save", data: { tensions: ["A tension"], generation_log_id: 1 } }), params);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Synthesis failed" });
    expect(db.prepare("SELECT status, synthesis_tensions FROM debates WHERE id = 'debate'").get()).toEqual({ status: "scheduled", synthesis_tensions: "[]" });
  });
  it("includes the reply target in synthesis source material using the joined rows", async () => {
    db.prepare("INSERT INTO debate_posts (id, debate_id, philosopher_id, content, phase) VALUES ('opening', 'debate', 'camus', 'Opening', 'opening')").run();
    db.prepare("INSERT INTO debate_posts (id, debate_id, philosopher_id, content, phase, reply_to) VALUES ('reply', 'debate', 'nietzsche', 'Rebuttal', 'rebuttal', 'opening')").run();
    vi.mocked(generateSynthesis).mockResolvedValueOnce({ success: true, data: {}, rawOutput: "{}", systemPromptId: null });
    expect((await saveSynthesis(request({ action: "generate" }), params)).status).toBe(201);
    expect(vi.mocked(generateSynthesis).mock.calls[0][1]).toContain("Friedrich Nietzsche (rebutting Albert Camus)");
  });
});
