import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedPhilosophers } from "../src/lib/__tests__/test-db";
import { applyPromptRefinement, promptHash } from "./prompt-refinement";
import { buildPhilosopherPrompt, PHILOSOPHER_PROFILES } from "./philosopher-prompts";
import { CONTENT_TEMPLATES } from "../src/lib/content-template-defaults";
import fixture from "../scripts/fixtures/seed-content.json";

let db: Database.Database;
const legacy = { persona: "Reviewed older Kant prompt", principles: "[]", template: "Reviewed older news template" };
const baseline = { personas: { kant: promptHash(legacy.persona) }, principles: { kant: promptHash(legacy.principles) }, templates: { news_reaction: [promptHash(legacy.template)] } };
beforeEach(() => {
  db = createTestDb(); seedPhilosophers(db);
  db.prepare("INSERT INTO system_prompts (philosopher_id, prompt_version, system_prompt_text, is_active) VALUES (?, ?, ?, 1)").run("kant", 5, legacy.persona);
  db.prepare("INSERT INTO content_templates (template_key, version, instructions, is_active) VALUES (?, ?, ?, 1)").run("news_reaction", 3, legacy.template);
});
afterEach(() => db.close());

describe("versioned prompt upgrade", () => {
  it("activates new versions, retains old text, updates known metadata and is idempotent", () => {
    expect(applyPromptRefinement(db, baseline)).toMatchObject({ personas: 1, principles: 1, templates: 1 });
    expect(db.prepare("SELECT prompt_version, system_prompt_text, is_active FROM system_prompts WHERE philosopher_id = ? ORDER BY prompt_version").all("kant"))
      .toEqual([{ prompt_version: 5, system_prompt_text: legacy.persona, is_active: 0 }, { prompt_version: 6, system_prompt_text: buildPhilosopherPrompt("kant"), is_active: 1 }]);
    expect(db.prepare("SELECT version, instructions FROM content_templates WHERE is_active = 1").get()).toEqual({ version: 4, instructions: CONTENT_TEMPLATES.news_reaction.instructions });
    expect(applyPromptRefinement(db, baseline)).toMatchObject({ personas: 0, principles: 0, templates: 0 });
  });

  it("preserves newer editor changes to personas, metadata, and templates", () => {
    db.prepare("UPDATE system_prompts SET system_prompt_text = ?").run("Editor's persona");
    db.prepare("UPDATE philosophers SET core_principles = ? WHERE id = ?").run('[{"title":"Custom","description":"Custom"}]', "kant");
    db.prepare("UPDATE content_templates SET instructions = ?").run("Editor's template");
    const result = applyPromptRefinement(db, baseline);
    expect(result).toMatchObject({ personas: 0, principles: 0, templates: 0 });
    expect(result.preservedCustom).toEqual(expect.arrayContaining(["persona:kant", "principles:kant", "template:news_reaction"]));
    expect(db.prepare("SELECT system_prompt_text, is_active FROM system_prompts").get()).toEqual({ system_prompt_text: "Editor's persona", is_active: 1 });
  });

  it("rolls back deactivation if installing a version fails", () => {
    db.exec("CREATE TRIGGER prevent_prompt_insert BEFORE INSERT ON system_prompts BEGIN SELECT RAISE(ABORT, 'test failure'); END");
    expect(() => applyPromptRefinement(db, baseline)).toThrow("test failure");
    expect(db.prepare("SELECT is_active FROM system_prompts").get()).toEqual({ is_active: 1 });
    expect(db.prepare("SELECT instructions FROM content_templates WHERE is_active = 1").get()).toEqual({ instructions: legacy.template });
  });

  it("keeps every seeded persona and active template synchronized with the reviewed sources", () => {
    expect(fixture.systemPrompts).toHaveLength(Object.keys(PHILOSOPHER_PROFILES).length);
    for (const row of fixture.systemPrompts) expect(row.system_prompt_text).toBe(buildPhilosopherPrompt(row.philosopher_id));
    for (const row of fixture.contentTemplates) expect(row.instructions).toBe(CONTENT_TEMPLATES[row.template_key as keyof typeof CONTENT_TEMPLATES].instructions);
  });
});
