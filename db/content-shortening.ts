import type Database from "better-sqlite3";
import { promptHash } from "./prompt-refinement";
import baseline from "./content-shortening-baseline.json";
import { CONTENT_TEMPLATES, type ContentTypeKey } from "../src/lib/content-template-defaults";

/** Version known defaults only. Published prose and custom editorial templates are untouched. */
export function applyContentShortening(db: Database.Database, known: Record<string, string[]> = baseline) {
  const result = { templates: 0, preservedCustom: [] as string[] };
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = ? AND name = ?").get("table", "content_templates")) return result;
  db.transaction(() => {
    for (const [key, hashes] of Object.entries(known)) {
      const next = CONTENT_TEMPLATES[key as ContentTypeKey]?.instructions;
      if (!next) continue;
      const active = db.prepare("SELECT instructions FROM content_templates WHERE template_key = ? AND is_active = 1 ORDER BY version DESC, id DESC LIMIT 1")
        .get(key) as { instructions: string } | undefined;
      if (!active || active.instructions === next) continue;
      if (!hashes.includes(promptHash(active.instructions))) {
        result.preservedCustom.push(key);
        continue;
      }
      const { version } = db.prepare("SELECT COALESCE(MAX(version), 0) + 1 AS version FROM content_templates WHERE template_key = ?")
        .get(key) as { version: number };
      db.prepare("UPDATE content_templates SET is_active = 0 WHERE template_key = ? AND is_active = 1").run(key);
      db.prepare("INSERT INTO content_templates (template_key, version, instructions, is_active, notes) VALUES (?, ?, ?, 1, ?)")
        .run(key, version, next, "2026-11 concise answers and synthesis; previous text retained");
      result.templates++;
    }
  })();
  return result;
}
