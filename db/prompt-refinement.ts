import type Database from "better-sqlite3";
import { createHash } from "node:crypto";
import baseline from "./prompt-refinement-baseline.json";
import { PHILOSOPHER_PROFILES, buildPhilosopherPrompt } from "./philosopher-prompts";
import { CONTENT_TEMPLATES, type ContentTypeKey } from "../src/lib/content-template-defaults";

export function promptHash(text: string): string {
  return createHash("sha256").update(text.replace(/\r\n/g, "\n").trim()).digest("hex");
}

/** Upgrade only the reviewed baseline. Preserve editor changes and all old versions. */
interface PromptBaseline {
  personas: Record<string, string>;
  principles: Record<string, string>;
  templates: Record<string, string[]>;
}

export function applyPromptRefinement(db: Database.Database, knownBaseline: PromptBaseline = baseline) {
  const result = { personas: 0, principles: 0, templates: 0, preservedCustom: [] as string[] };
  // Some legacy installations have no seeded content yet; there is nothing to upgrade.
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = ? AND name IN ('philosophers', 'system_prompts', 'content_templates')").all("table");
  if (tables.length < 3) return result;
  db.transaction(() => {
    for (const [id, profile] of Object.entries(PHILOSOPHER_PROFILES)) {
      const philosopher = db.prepare("SELECT core_principles FROM philosophers WHERE id = ?").get(id) as { core_principles: string } | undefined;
      if (!philosopher) continue;
      const persona = db.prepare("SELECT id, system_prompt_text FROM system_prompts WHERE philosopher_id = ? AND is_active = 1 ORDER BY prompt_version DESC, id DESC LIMIT 1").get(id) as { id: number; system_prompt_text: string } | undefined;
      const next = buildPhilosopherPrompt(id);
      const known = knownBaseline.personas[id];
      if (persona && persona.system_prompt_text !== next) {
        if (promptHash(persona.system_prompt_text) === known) {
          const { version } = db.prepare("SELECT COALESCE(MAX(prompt_version), 0) + 1 AS version FROM system_prompts WHERE philosopher_id = ?").get(id) as { version: number };
          db.prepare("UPDATE system_prompts SET is_active = 0 WHERE philosopher_id = ? AND is_active = 1").run(id);
          db.prepare("INSERT INTO system_prompts (philosopher_id, prompt_version, system_prompt_text, is_active) VALUES (?, ?, ?, 1)").run(id, version, next);
          result.personas++;
        } else result.preservedCustom.push(`persona:${id}`);
      }
      let normalized = philosopher.core_principles;
      try { normalized = JSON.stringify(JSON.parse(normalized)); } catch { /* Preserve unrecognized metadata. */ }
      const nextPrinciples = JSON.stringify(profile.principles);
      if (normalized !== nextPrinciples) {
        if (promptHash(normalized) === knownBaseline.principles[id]) {
          db.prepare("UPDATE philosophers SET core_principles = ? WHERE id = ?").run(nextPrinciples, id);
          result.principles++;
        } else result.preservedCustom.push(`principles:${id}`);
      }
    }
    for (const [key, known] of Object.entries(knownBaseline.templates)) {
      const template = db.prepare("SELECT instructions FROM content_templates WHERE template_key = ? AND is_active = 1 ORDER BY version DESC, id DESC LIMIT 1").get(key) as { instructions: string } | undefined;
      if (!template) continue; // Fresh installations use the code default.
      const next = CONTENT_TEMPLATES[key as ContentTypeKey].instructions;
      if (template.instructions === next) continue;
      if (!known.includes(promptHash(template.instructions))) {
        result.preservedCustom.push(`template:${key}`);
        continue;
      }
      const { version } = db.prepare("SELECT COALESCE(MAX(version), 0) + 1 AS version FROM content_templates WHERE template_key = ?").get(key) as { version: number };
      db.prepare("UPDATE content_templates SET is_active = 0 WHERE template_key = ? AND is_active = 1").run(key);
      db.prepare("INSERT INTO content_templates (template_key, version, instructions, is_active, notes) VALUES (?, ?, ?, 1, ?)").run(key, version, next, "2026-09 prompt refinement and shorter response budgets");
      result.templates++;
    }
  })();
  return result;
}
