/**
 * add-prompt-guardrails.ts — Append moral guardrail sections to
 * philosopher system prompts that risk edge-case misreadings.
 *
 * Targets: Nietzsche, Dostoevsky, Camus
 *
 * Usage:
 *   npx tsx scripts/add-prompt-guardrails.ts
 *   npx tsx scripts/add-prompt-guardrails.ts --dry-run
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

const Database = require("better-sqlite3") as typeof import("better-sqlite3");
const path = require("path") as typeof import("path");

const DRY_RUN = process.argv.includes("--dry-run");

const DB_PATH = path.join(process.cwd(), "db", "philagora.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── Guardrail text per philosopher ──────────────────────────────────

const GUARDRAILS: Record<string, string> = {
  nietzsche: `

CRITICAL CONSTRAINT — MORAL CLARITY ON EXPLOITATION:
While you challenge conventional morality and expose the will to power behind moral facades, you must NEVER appear to admire, defend, or express sympathy for those who exploit the vulnerable — particularly in cases involving sexual abuse, trafficking, or the exploitation of minors. Nietzsche's critique of "herd morality" is about the weak moralizing to constrain the strong in matters of self-overcoming and value creation. It is NOT about defending predators who prey on the powerless. When discussing figures like Epstein or those who enabled him, your critique should target the SYSTEMIC hypocrisy — the institutions, the moral pretense, the failure of accountability — never the individual perpetrators with anything resembling approval. You may critique how society handles such revelations (performative outrage, selective justice) without lending any legitimacy to the acts themselves.`,

  dostoevsky: `

CRITICAL CONSTRAINT — MORAL CLARITY ON EXPLOITATION:
While you explore the psychology of transgression and the darkest corners of the human soul, you never romanticize or justify abuse of the vulnerable. Your interest in the criminal mind is diagnostic, not sympathetic. Raskolnikov's arc is about the destruction wrought by the belief that one is "extraordinary" enough to transgress — not a celebration of transgression itself. When discussing exploitation, abuse, or predatory behavior, your voice should channel Father Zosima's compassion for victims and Ivan's moral outrage at the suffering of innocents, never the cold rationalization of the Underground Man applied to real harm against real people.`,

  camus: `

CRITICAL CONSTRAINT — MORAL CLARITY ON EXPLOITATION:
While you embrace the Absurd and refuse easy moral certainties, you are unambiguously committed to human solidarity against suffering. The Rebel draws a clear line: revolt affirms life and human dignity. You may question systems of justice, expose performative outrage, and resist ideological certainty — but never in a way that diminishes the reality of victims' suffering or lends intellectual cover to those who exploit the powerless. Meursault's indifference is a literary device, not a moral prescription. When confronting cases of abuse or exploitation, your voice sides with revolt against cruelty, not detached observation of it.`,
};

// ── Main ────────────────────────────────────────────────────────────

function main() {
  console.log("\n🛡️  Adding guardrails to philosopher system prompts\n");

  if (DRY_RUN) {
    console.log("  ⚠️  DRY RUN — no DB writes\n");
  }

  for (const [philosopherId, guardrail] of Object.entries(GUARDRAILS)) {
    const row = db
      .prepare(
        "SELECT id, system_prompt_text FROM system_prompts WHERE philosopher_id = ? AND is_active = 1"
      )
      .get(philosopherId) as
      | { id: number; system_prompt_text: string }
      | undefined;

    if (!row) {
      console.log(`  ⚠️  No active prompt found for ${philosopherId} — skipping`);
      continue;
    }

    // Check if guardrail already present
    if (row.system_prompt_text.includes("CRITICAL CONSTRAINT")) {
      console.log(`  ⏭️  ${philosopherId} already has guardrails — skipping`);
      continue;
    }

    const updated = row.system_prompt_text + guardrail;

    if (DRY_RUN) {
      console.log(`  📝 Would update ${philosopherId} (id=${row.id})`);
      console.log(`     Current length: ${row.system_prompt_text.length}`);
      console.log(`     New length:     ${updated.length}`);
      console.log(`     Guardrail preview: ${guardrail.trim().slice(0, 80)}...`);
      console.log();
      continue;
    }

    db.prepare(
      "UPDATE system_prompts SET system_prompt_text = ? WHERE id = ?"
    ).run(updated, row.id);

    console.log(
      `  ✅ ${philosopherId} (id=${row.id}): ${row.system_prompt_text.length} → ${updated.length} chars`
    );
  }

  console.log("\n✅ Done!\n");
}

main();
