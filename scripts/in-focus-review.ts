/** Isolated workshop preview with deterministic model fixtures; no paid API calls. */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Local review only");
  const root = path.resolve(".local-review");
  fs.mkdirSync(root, { recursive: true });
  const directory = fs.mkdtempSync(path.join(root, "in-focus-"));
  const databasePath = path.join(directory, "preview.db");
  const source = new Database(path.resolve("db/philagora.db"), { readonly: true, fileMustExist: true });
  await source.backup(databasePath); source.close();
  const db = new Database(databasePath);
  for (const id of ["plato", "kant"]) {
    db.prepare("UPDATE system_prompts SET is_active = 0 WHERE philosopher_id = ?").run(id);
    db.prepare("INSERT INTO system_prompts (philosopher_id, system_prompt_text, is_active) VALUES (?, ?, 1)").run(id, `You are ${id}. This is a local UI review fixture.`);
    db.prepare("UPDATE philosophers SET is_active = 1 WHERE id = ?").run(id);
  }
  db.close();
  const port = 3510;
  let count = 0;
  const fixture = http.createServer(async (req, res) => {
    if (req.url !== "/v1/messages" || req.method !== "POST") { res.writeHead(404).end(); return; }
    let body = "";
    for await (const chunk of req) body += chunk;
    const request = JSON.parse(body);
    const material = request.messages?.[0]?.content ?? "";
    const role = /ROLE: (\w+)/.exec(material)?.[1] ?? "briefing";
    count += 1;
    const data = material.includes("FAIL_REVIEW_TEST") ? { content: "This response cites an unavailable source. [S99]" }
      : role === "questions" ? { questions: [
        { question: "Who should receive protection first when a city's budget is limited?", reason: "The decision tests equal treatment against urgent need." },
        { question: "What makes a public compromise responsible?", reason: "The briefing describes a contested allocation of resources." },
      ] } : role === "voices" ? { voices: [
        { philosopherId: "plato", reason: "Examine the relationship between a just city and its most vulnerable residents." },
        { philosopherId: "kant", reason: "Challenge the proposed priority using duties owed equally to people." },
      ] } : role === "briefing" ? { content: `What happened\n\nThe council is considering cooling centres with a limited budget. [S1]\n\nCompeting accounts\n\nThe supplied material describes a disagreement about who should receive protection first. The scale of unmet need remains uncertain. [S1]\n\nWhat remains uncertain\n\nThis is a local test fixture, not reporting. Review draft ${count}.` }
      : { content: `A ${role} about public responsibility\n\nA limited budget makes the standard of judgment consequential. The council must explain whom its decision protects and what burden it leaves on others. [S1]\n\n${role === "challenge" ? "The opening identifies a duty to protect, but has not shown why its preferred priority follows from that duty. Equal concern and equal spending are different claims." : role === "reply" ? "That objection changes the burden of my argument. I would require evidence of unequal exposure before defending unequal allocations." : "My judgment depends on evidence about who faces the greatest harm. I would reconsider if the chosen intervention fails to reach those it claims to protect."}\n\nThis is a deterministic local review fixture, alternative ${count}.` };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ id: `msg_review_${count}`, type: "message", role: "assistant", model: request.model,
      content: [{ type: "text", text: JSON.stringify(data) }], stop_reason: "end_turn", stop_sequence: null,
      usage: { input_tokens: 100, output_tokens: 100 } }));
  });
  await new Promise<void>((resolve) => fixture.listen(port + 1, "127.0.0.1", resolve));
  fs.writeFileSync(path.join(root, "in-focus-active.json"), JSON.stringify({ databasePath, baseURL: `http://127.0.0.1:${port}` }));
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(port)], {
    stdio: "inherit", windowsHide: true,
    env: { ...process.env, DATABASE_PATH: databasePath, AGORA_REVIEW_MODE: "admin", AGORA_REVIEW_PORT: String(port),
      AGORA_WORKER_DISABLED: "true", ADMIN_PASSWORD: "local-in-focus-review", ANTHROPIC_API_KEY: "local-fixture-not-a-real-key",
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${port + 1}`, BETTER_AUTH_URL: `http://127.0.0.1:${port}`, RUN_SEED: "false", NEXT_PUBLIC_GA_MEASUREMENT_ID: "" },
  });
  const stop = () => { child.kill(); fixture.close(); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
  child.on("exit", (code) => { fixture.close(); process.exit(code ?? 0); });
  console.log(`Workshop fixture preview: http://127.0.0.1:${port}/admin/in-focus (password: local-in-focus-review)`);
}
main().catch((error) => { console.error(error); process.exit(1); });
