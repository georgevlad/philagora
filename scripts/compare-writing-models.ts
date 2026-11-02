/**
 * Local, resumable comparison through the real generation service.
 * Preparation is free; --run makes paid API calls. Source DB is opened read-only.
 * npm exec tsx scripts/compare-writing-models.ts -- --run
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import type { ContentTypeKey, TargetLength } from "../src/lib/content-templates";
import type { GenerationOutcome } from "../src/lib/generation-service";
import type { AgoraQuestionType } from "../src/lib/types";

type Case = { id: string; type: ContentTypeKey; philosopher: string | null; source: string;
  provenance: string; length?: TargetLength; template?: string };
type Call = { request: Record<string, unknown>; status: number; returnedModel?: string;
  inputTokens: number; outputTokens: number; stopReason?: string; latencyMs: number };
type Result = { caseId: string; model: string; outcome: GenerationOutcome; calls: Call[]; elapsedMs: number };
type Log = { id: number; philosopher_id: string; user_input: string };
const models = ["claude-opus-4-8", "claude-opus-5-5", "claude-sonnet-5-5", "claude-fable-5-1", "claude-haiku-5-5"];
// Standard uncached API rates verified 2026-11-02. Haiku inputs here are <100k.
const prices: Record<string, [number, number]> = {
  "claude-opus-4-8": [5, 25], "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10], "claude-fable-5-1": [10, 50], "claude-haiku-5-5": [0.1, 0.5],
};
const args = process.argv.slice(2);
const option = (name: string, fallback: string) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const output = path.resolve(option("--out", `.local-review/model-comparison-${new Date().toISOString().slice(0, 10)}`));
const limit = Number(option("--limit", "20"));
const selectedModels = option("--models", models.join(",")).split(",");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const save = (name: string, value: unknown) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2));
const load = <T>(name: string): T => JSON.parse(fs.readFileSync(path.join(output, name), "utf8"));
const filename = (model: string, id: string) => `${model}--${id}.json`;
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const proseHtml = (value: unknown): string => {
  if (typeof value === "string") return `<p style="white-space:pre-wrap">${escape(value)}</p>`;
  if (Array.isArray(value)) return value.map(proseHtml).join("");
  if (value && typeof value === "object") return Object.entries(value)
    .filter(([, item]) => item !== "" && (!Array.isArray(item) || item.length))
    .map(([label, item]) => `<div><small>${escape(label.replace(/([a-z])([A-Z])/g, "$1 $2"))}</small>${proseHtml(item)}</div>`).join("");
  return "";
};

async function main() {
  if (selectedModels.some(model => !models.includes(model))) throw new Error("Unknown comparison model.");
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error("--limit must be between 1 and 20.");
  fs.mkdirSync(output, { recursive: true });
  dotenv.config({ path: ".env.local", quiet: true });
  const sourcePath = path.resolve(process.env.DATABASE_PATH || "db/philagora.db");
  const snapshot = path.join(output, "snapshot.db");
  if (sourcePath === snapshot) throw new Error("Comparison DB must differ from the source DB.");
  if (!fs.existsSync(snapshot)) {
    const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
    try { await source.backup(snapshot); } finally { source.close(); }
  }
  // Set before importing the DB module: all migrations/config/logs stay in the copy.
  process.env.DATABASE_PATH = snapshot;
  process.env.RUN_SEED = "false";
  const { getDb } = await import("../db");
  const { generateContent, generateSynthesis } = await import("../src/lib/generation-service");
  const { getAgoraResponseTemplate, getSynthesisTemplateForType } = await import("../src/lib/content-templates");
  const { buildAgoraResponseSourceMaterial, buildAgoraSynthesisSourceMaterial } = await import("../src/lib/agora");
  const { countWords, countSynthesisWords } = await import("../src/lib/content-lengths");
  const db = getDb();
  const codeFiles = ["src/lib/anthropic-utils.ts", "src/lib/generation-service.ts", "src/lib/generation-policy.ts",
    "src/lib/content-templates.ts", "src/lib/content-template-defaults.ts", "src/lib/content-lengths.ts", "src/lib/agora.ts"];
  const codeHash = hash(codeFiles.map(file => fs.readFileSync(file, "utf8")).join("\n"));
  if (fs.existsSync(path.join(output, "manifest.json"))) {
    if (load<{ codeHash: string }>("manifest.json").codeHash !== codeHash) throw new Error("Generation code changed; choose a fresh --out directory.");
  } else save("manifest.json", { createdAt: new Date().toISOString(), sourcePath, codeHash, models, prices,
    method: "Current saved personas, DB-first templates, house rules and frozen recent-writing context; real generation service with its normal length-repair attempt. New models use adaptive thinking, medium effort, at least 8192 tokens. Opus 4.8 retains existing behavior. No publishing or original DB writes." });

  let cases: Case[];
  if (fs.existsSync(path.join(output, "cases.json"))) cases = load<Case[]>("cases.json");
  else {
    cases = [];
    const addLog = (row: Log, type: ContentTypeKey, length: TargetLength = "short") => {
      if (!row) throw new Error(`Missing source for ${type}`);
      cases.push({ id: `case-${String(cases.length + 1).padStart(2, "0")}`, type,
        philosopher: type.endsWith("_synthesis") ? null : row.philosopher_id,
        source: row.user_input, provenance: `generation_log:${row.id}`, length });
    };
    const logs = (type: string, prefix = "%") => db.prepare(
      "SELECT id, philosopher_id, user_input FROM generation_log WHERE content_type = ? AND user_input LIKE ? ORDER BY id DESC"
    ).all(type, prefix) as Log[];
    const seen = new Set<string>();
    for (const row of logs("post", "ARTICLE TITLE:%")) {
      if (seen.has(row.philosopher_id)) continue;
      addLog(row, "news_reaction", cases.length % 2 ? "medium" : "short"); seen.add(row.philosopher_id);
      if (cases.length === 6) break;
    }
    for (const row of logs("reflection").slice(0, 2)) addLog(row, "timeless_reflection");
    for (const row of logs("recommendation").filter(r => ["camus", "seneca"].includes(r.philosopher_id)).slice(0, 2)) addLog(row, "cultural_recommendation");
    addLog(logs("art_commentary").at(-1)!, "art_commentary");
    addLog(logs("debate_opening")[0], "debate_opening");
    addLog(logs("debate_rebuttal")[0], "debate_rebuttal");
    addLog(logs("post", "PHILOSOPHER YOU ARE REPLYING TO:%")[0], "cross_philosopher_reply");
    const threads = db.prepare("SELECT id, question, question_type FROM agora_threads WHERE visibility = ? AND status = ? AND follow_up_to IS NULL AND article_url IS NULL ORDER BY created_at DESC, id DESC")
      .all("public", "complete") as { id: string; question: string; question_type: AgoraQuestionType }[];
    const unique = threads.filter((thread, index) => threads.findIndex(t => t.question === thread.question) === index).slice(0, 3);
    if (unique.length !== 3) throw new Error("Need three completed public Agora questions.");
    for (const [index, thread] of unique.entries()) cases.push({
      id: `case-${String(cases.length + 1).padStart(2, "0")}`, type: "agora_response", philosopher: ["seneca", "jung", "kant"][index],
      source: buildAgoraResponseSourceMaterial({ question: thread.question, askedBy: "Anonymous",
        questionType: thread.question_type, recommendationsAppropriate: false, recommendationHint: null }),
      provenance: `public agora_threads:${thread.id}; first response, recommendations disabled`,
      template: getAgoraResponseTemplate(thread.question_type, false),
    });
    addLog(logs("synthesis", "DEBATE TOPIC:%")[0], "debate_synthesis");
    const thread = unique[0];
    const responses = db.prepare("SELECT r.posts, p.name AS philosopher_name, p.tradition AS philosopher_tradition FROM agora_responses r JOIN philosophers p ON p.id = r.philosopher_id WHERE r.thread_id = ? ORDER BY r.sort_order, r.id")
      .all(thread.id) as { posts: string; philosopher_name: string; philosopher_tradition: string }[];
    if (!responses.length) throw new Error("Missing public responses for synthesis.");
    cases.push({ id: "case-19", type: "agora_synthesis", philosopher: null, provenance: `public agora_threads:${thread.id}; existing responses`,
      source: buildAgoraSynthesisSourceMaterial({ question: thread.question, askedBy: "Anonymous", questionType: thread.question_type, responses, recommendations: [] }),
      template: getSynthesisTemplateForType(thread.question_type) });
    const quip = logs("post").find(row => row.philosopher_id === "diogenes" && row.user_input.includes("victory for football"));
    if (!quip) throw new Error("Missing saved quip source.");
    addLog(quip, "quip");
    if (cases.length !== 20) throw new Error(`Expected 20 cases; got ${cases.length}`);
    save("cases.json", cases);
  }

  const context = new AsyncLocalStorage<Call[]>();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const calls = context.getStore();
    if (!calls) return originalFetch(input, init);
    const start = Date.now();
    const request = typeof init?.body === "string" ? JSON.parse(init.body) : {};
    const response = await originalFetch(input, { ...init,
      signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000) });
    const body = await response.clone().json().catch(() => ({}));
    calls.push({ request, status: response.status, returnedModel: body.model,
      inputTokens: body.usage?.input_tokens ?? 0, outputTokens: body.usage?.output_tokens ?? 0,
      stopReason: body.stop_reason, latencyMs: Date.now() - start });
    return response;
  };
  try {
    if (args.includes("--run")) {
      if (!process.env.ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY.");
      for (const model of selectedModels) {
        for (const key of ["generation_model", "synthesis_model"]) db.prepare("INSERT INTO scoring_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, JSON.stringify(model));
        // Each model completes before changing the shared isolated configuration.
        const queue = cases.slice(0, limit).filter(c => !fs.existsSync(path.join(output, filename(model, c.id))));
        await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
          for (let item = queue.shift(); item; item = queue.shift()) {
            const current = item;
            const calls: Call[] = [];
            const started = Date.now();
            const outcome = await context.run(calls, () => current.type === "agora_synthesis" || current.type === "debate_synthesis"
              ? generateSynthesis(current.type, current.source, current.template)
              : generateContent(current.philosopher!, current.type, current.source, current.length, current.template));
            const result: Result = { caseId: current.id, model, outcome, calls, elapsedMs: Date.now() - started };
            save(filename(model, current.id), result);
            console.log(`${model} ${current.id} ${current.type}: ${outcome.success ? "OK" : "FAILED"} (${calls.length} calls, ${result.elapsedMs}ms)`);
            if (!calls.length || calls.some(c => [401, 403, 404].includes(c.status))) throw new Error("Provider access failed; stopped comparison. Completed results are saved.");
          }
        }));
      }
    }
    const blind: { id: string; type: string; philosopher: string | null; source: string; candidates: { label: string; success: boolean; text: unknown }[] }[] = [];
    const key: Record<string, Record<string, string>> = {};
    const summary = models.map(model => {
      const results = cases.flatMap(c => fs.existsSync(path.join(output, filename(model, c.id))) ? [load<Result>(filename(model, c.id))] : []);
      const calls = results.flatMap(r => r.calls);
      const inputTokens = calls.reduce((n, c) => n + c.inputTokens, 0);
      const outputTokens = calls.reduce((n, c) => n + c.outputTokens, 0);
      return { model, samples: results.length, successful: results.filter(r => r.outcome.success).length,
        firstPass: results.filter(r => r.outcome.success && r.calls.length === 1).length,
        calls: calls.length, inputTokens, outputTokens, estimatedUsd: (inputTokens * prices[model][0] + outputTokens * prices[model][1]) / 1e6,
        meanSeconds: results.length ? results.reduce((n, r) => n + r.elapsedMs, 0) / results.length / 1000 : null,
        wordCounts: results.map(r => {
          const c = cases.find(c => c.id === r.caseId)!;
          const data = r.outcome.success ? r.outcome.data : {};
          return { caseId: c.id, words: c.type.endsWith("_synthesis") ? countSynthesisWords(data)
            : c.type === "agora_response" ? countSynthesisWords(data.posts) : countWords(String(data.content ?? "")) };
        }) };
    });
    for (const c of cases) {
      const available = models.filter(m => fs.existsSync(path.join(output, filename(m, c.id))));
      available.sort((a, b) => hash(`${c.id}:${a}`).localeCompare(hash(`${c.id}:${b}`)));
      key[c.id] = {};
      blind.push({ id: c.id, type: c.type, philosopher: c.philosopher, source: c.source,
        candidates: available.map((model, index) => {
          const label = String.fromCharCode(65 + index); key[c.id][label] = model;
          const result = load<Result>(filename(model, c.id));
          return { label, success: result.outcome.success, text: result.outcome.success ? result.outcome.data : result.outcome.rawOutput || result.outcome.error };
        }) });
    }
    save("blind-review.json", blind); save("model-key.json", key); save("summary.json", summary);
    const reviewPath = path.join(output, "editorial-review.json");
    const review = fs.existsSync(reviewPath)
      ? load<{ reviewer: string; method: string; conclusion?: string; cases: { id: string; ranking: string[]; reason: string }[] }>("editorial-review.json") : null;
    const editorial = review ? summary.map(s => ({ ...s,
      firstChoices: review.cases.filter(c => key[c.id]?.[c.ranking[0]] === s.model).length,
      topTwo: review.cases.filter(c => c.ranking.slice(0, 2).some(label => key[c.id]?.[label] === s.model)).length,
    })).sort((a, b) => b.firstChoices - a.firstChoices) : [];
    if (review) save("editorial-summary.json", editorial);
    fs.writeFileSync(path.join(output, "comparison.html"), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Philagora writing comparison</title>
      <style>body{background:#f5f0e6;color:#29251f;font:17px/1.6 Georgia,serif;max-width:1450px;margin:40px auto;padding:0 24px}h1,h2{line-height:1.2}small,button,summary{font-family:system-ui}button{padding:10px 16px;cursor:pointer}section{border-top:1px solid #cabfae;margin-top:40px;padding-top:22px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}article{background:#fffaf0;padding:18px;border:1px solid #d5cbbb}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.6 system-ui}.model{display:none;color:#8d4b36}.revealed .model{display:block}details{margin:12px 0}table{border-collapse:collapse;font:14px system-ui}td,th{padding:9px;text-align:left;border-bottom:1px solid #cabfae}</style>
      <h1>Philagora: which model writes better?</h1><p>20 cases using saved personas, active templates and real source material. Candidate letters are shuffled separately for each case. Review the prose before revealing names.</p>
      <p>Judge philosophical voice, reasoning, natural prose, source fidelity and repetition. A failed result is not publishable even if readable. One sample per model per case; these are editorial comparisons, not statistical proof.</p>
      ${review ? `<details><summary>Read the editorial assessment and ranking (reveals model names)</summary><p>${escape(review.reviewer)}. ${escape(review.method)}</p>${proseHtml(review.conclusion)}<table><tr><th>Model</th><th>First choices / ${review.cases.length}</th><th>Top two / ${review.cases.length}</th><th>Passed existing validator</th><th>First pass</th><th>Mean seconds</th><th>Estimated cost</th></tr>${editorial.map(s => `<tr><td>${escape(s.model)}</td><td>${s.firstChoices}</td><td>${s.topTwo}</td><td>${s.successful}/${s.samples}</td><td>${s.firstPass}/${s.samples}</td><td>${s.meanSeconds?.toFixed(1)}</td><td>$${s.estimatedUsd.toFixed(3)}</td></tr>`).join("")}</table><p>${summary.reduce((n, s) => n + s.samples, 0)} samples, ${summary.reduce((n, s) => n + s.calls, 0)} generation calls including repairs, estimated total $${summary.reduce((n, s) => n + s.estimatedUsd, 0).toFixed(2)}. Passing the existing validator does not guarantee every field or claim is correct.</p></details>` : ""}
      <button onclick="document.body.classList.toggle('revealed')">Show / hide model names</button>
      ${blind.map(c => {
        const judgment = review?.cases.find(item => item.id === c.id);
        return `<section><h2>${escape(c.id)} · ${escape(c.philosopher ?? "Editorial synthesis")} · ${escape(c.type)}</h2><details><summary>Source material</summary><pre>${escape(c.source)}</pre></details>${judgment ? `<details><summary>Editorial preference and reasoning</summary><p>Preference: ${judgment.ranking.join(" → ")}</p><p>${escape(judgment.reason)}</p></details>` : ""}<div class="grid">${c.candidates.map(candidate => {
          const data = candidate.text && typeof candidate.text === "object" ? candidate.text as Record<string, unknown> : null;
          return `<article><h3>Candidate ${candidate.label}</h3><small class="model">${escape(key[c.id][candidate.label])}</small>${candidate.success ? "" : "<strong>Failed validation</strong>"}${proseHtml(data?.content ?? data?.posts ?? candidate.text)}<details><summary>Full JSON output</summary><pre>${escape(JSON.stringify(candidate.text, null, 2))}</pre></details></article>`;
        }).join("")}</div></section>`;
      }).join("")}
      <section><h2>Measured results</h2><p>Includes length-repair calls and thinking tokens. Standard-rate estimates, not an invoice. Up to three concurrent requests; latency includes retries.</p><table><tr><th>Model</th><th>Valid</th><th>First pass</th><th>Mean seconds</th><th>Estimated USD</th></tr>${summary.map(s => `<tr><td>${escape(s.model)}</td><td>${s.successful}/${s.samples}</td><td>${s.firstPass}</td><td>${s.meanSeconds?.toFixed(1) ?? "—"}</td><td>$${s.estimatedUsd.toFixed(4)}</td></tr>`).join("")}</table></section></html>`);
    console.log(`Prepared ${cases.length} cases. Report: ${path.join(output, "comparison.html")}`);
    console.log(JSON.stringify(summary.map(s => ({ model: s.model, samples: s.samples,
      successful: s.successful, firstPass: s.firstPass, calls: s.calls, estimatedUsd: s.estimatedUsd, meanSeconds: s.meanSeconds }))));
  } finally { globalThis.fetch = originalFetch; db.close(); }
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Comparison failed."); process.exitCode = 1; });
