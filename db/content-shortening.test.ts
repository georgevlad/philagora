import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb, seedPhilosophers } from "../src/lib/__tests__/test-db";
import { applyContentShortening } from "./content-shortening";
import { promptHash } from "./prompt-refinement";
import { CONTENT_TEMPLATES } from "../src/lib/content-template-defaults";

let db: Database.Database;
const previous = "A recognized older synthesis template.";
const baseline = { agora_synthesis: [promptHash(previous)] };
beforeEach(() => {
  db = createTestDb(); seedPhilosophers(db);
  db.prepare("INSERT INTO content_templates (template_key, version, instructions, is_active) VALUES (?, ?, ?, 1)").run("agora_synthesis", 3, previous);
  db.prepare("INSERT INTO posts (id,philosopher_id,content,thesis,stance,status) VALUES (?, ?, ?, ?, ?, ?)").run("old", "kant", "Every published word stays.", "Original thesis", "observes", "published");
  db.prepare("INSERT INTO agora_threads (id,question) VALUES (?, ?)").run("old", "An old question?");
  db.prepare("INSERT INTO agora_responses (id,thread_id,philosopher_id,posts) VALUES (?, ?, ?, ?)").run("old", "old", "kant", '["Every original answer stays."]');
});
afterEach(() => db.close());
describe("shortening template upgrade", () => {
  it("versions recognized defaults once while preserving published content byte for byte", () => {
    const posts = db.prepare("SELECT * FROM posts").all();
    const responses = db.prepare("SELECT * FROM agora_responses").all();
    expect(applyContentShortening(db, baseline).templates).toBe(1);
    expect(db.prepare("SELECT version,instructions,is_active FROM content_templates ORDER BY version").all()).toEqual([
      { version: 3, instructions: previous, is_active: 0 },
      { version: 4, instructions: CONTENT_TEMPLATES.agora_synthesis.instructions, is_active: 1 },
    ]);
    expect(applyContentShortening(db, baseline).templates).toBe(0);
    expect(db.prepare("SELECT * FROM posts").all()).toEqual(posts);
    expect(db.prepare("SELECT * FROM agora_responses").all()).toEqual(responses);
  });
  it("preserves customized templates", () => {
    db.prepare("UPDATE content_templates SET instructions = ?").run("An editor's custom instructions.");
    expect(applyContentShortening(db, baseline)).toEqual({ templates: 0, preservedCustom: ["agora_synthesis"] });
    expect(db.prepare("SELECT is_active FROM content_templates").get()).toEqual({ is_active: 1 });
  });
  it("restores the active version if insertion fails", () => {
    db.exec("CREATE TRIGGER block_template BEFORE INSERT ON content_templates BEGIN SELECT RAISE(ABORT, 'test failure'); END");
    expect(() => applyContentShortening(db, baseline)).toThrow("test failure");
    expect(db.prepare("SELECT instructions,is_active FROM content_templates").all()).toEqual([{ instructions: previous, is_active: 1 }]);
  });
});
