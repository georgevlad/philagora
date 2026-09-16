import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import Database from "better-sqlite3";
import { responsePosts, synthesis } from "../../scripts/fixtures/agora-review-content";
const review=JSON.parse(fs.readFileSync(".local-review/active.json","utf8"));
const db=new Database(review.databasePath);
const group=["marcus-aurelius","camus","nietzsche"];
const stub=`http://127.0.0.1:${review.stubPort}`;
const apiHeaders={cookie:`better-auth.session_token=${review.cookies.owner}`};
function job(id:string, options: { state?:string; count?:number; userId?:string|null; visibility?:string; parent?:string; legacy?:boolean; synthesis?:boolean }={}) {
  const participants=group.map(id=>db.prepare("SELECT id, name, tradition FROM philosophers WHERE id = ?").get(id));
  const userId=options.userId===undefined?"owner":options.userId;
  db.prepare(`INSERT INTO agora_threads (id, question, asked_by, visibility, user_id, status, ip_address, follow_up_to, created_at) VALUES (?, ?, 'Anonymous', ?, ?, 'failed', 'recovery-fixture', ?, '2026-01-01T10:00:00Z')`)
    .run(id,`Recovery fixture ${id}: How do I live with uncertainty?`,options.visibility||"private",userId,options.parent??null);
  for(const [i,pid] of group.entries()) {
    db.prepare("INSERT INTO agora_thread_philosophers VALUES (?, ?)").run(id,pid);
    if(i<(options.count??1))db.prepare("INSERT INTO agora_responses (id, thread_id, philosopher_id, posts, sort_order) VALUES (?, ?, ?, ?, ?)").run(randomUUID(),id,pid,JSON.stringify(responsePosts[pid]),i);
  }
  if(options.synthesis)db.prepare("INSERT INTO agora_synthesis_v2 (thread_id, sections) VALUES (?, ?)").run(id,JSON.stringify(synthesis));
  if(!options.legacy) {
    const context={version:1,question:`Recovery fixture ${id}: How do I live with uncertainty?`,askedBy:"Anonymous",visibility:options.visibility||"private",userId,questionType:"advice",recommendationsEnabled:false,recommendationHint:null,participants,article:null,
      parent:options.parent?{id:options.parent,question:"SNAPSHOT_PARENT_QUESTION",responses:[{posts:'["SNAPSHOT_PARENT_ANSWER"]',philosopher_name:"Marcus Aurelius",philosopher_tradition:"Stoicism"}],synthesis:{type:"advice",sections:synthesis}}:null};
    db.prepare("INSERT INTO agora_jobs (thread_id, context_json, state, next_attempt_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(id,JSON.stringify(context),options.state||"retry_wait",Date.now()+3600000,Date.now(),Date.now());
    for(const key of [...group.map(p=>`response:${p}`),"synthesis"])db.prepare("INSERT INTO agora_job_steps (thread_id, step_key) VALUES (?, ?)").run(id,key);
  }
}
async function login(page:Page, who="owner") { await page.context().addCookies([{name:"better-auth.session_token",value:review.cookies[who],url:review.baseURL}]); }
function due(id:string) { db.prepare("UPDATE agora_jobs SET next_attempt_at = 0, lease_until = 0 WHERE thread_id = ?").run(id); }
function state(id:string) { return (db.prepare("SELECT state FROM agora_jobs WHERE thread_id = ?").get(id) as {state:string}|undefined)?.state; }
function snapshot(id:string) {return db.prepare("SELECT * FROM agora_responses WHERE thread_id = ? ORDER BY sort_order").all(id);}
test.beforeEach(async({request})=>{
  db.prepare("DELETE FROM agora_recovery_limits").run();
  await request.post(`${stub}/mode`,{data:{mode:"normal"}});
});
test.afterAll(()=>db.close());

for(const width of [320,390,1440])test(`recovery keeps content, focus and reading position at ${width}px`,async({page})=>{
  const id=randomUUID();job(id,{legacy:true});const before=snapshot(id)[0];
  await login(page);await page.setViewportSize({width,height:900});await page.goto(`/agora/${id}`);
  const answer=page.locator(".agora-answer").first();const prose=await answer.innerText();
  const button=page.getByRole("button",{name:"Recover missing work"});await button.focus();
  // A focused recovery button remains mounted after responses arrive.
  await page.keyboard.press("Enter");await expect(page.getByRole("button",{name:"Recovery requested",exact:true})).toBeFocused();
  await answer.evaluate(el=>el.scrollIntoView({block:"start"}));
  const readingTop = await answer.evaluate(el=>el.getBoundingClientRect().top);
  const readingScroll = await page.evaluate(()=>scrollY);
  await expect(page.locator(".agora-answer")).toHaveCount(3);
  await expect(page.locator(".agora-synthesis")).toHaveCount(1);
  expect(Math.abs((await answer.evaluate(el=>el.getBoundingClientRect().top))-readingTop)).toBeLessThan(4);
  expect(Math.abs((await page.evaluate(()=>scrollY))-readingScroll)).toBeLessThan(4);
  await expect(page.getByRole("button",{name:"Recovery requested",exact:true})).toBeFocused();
  expect(await answer.innerText()).toBe(prose);expect(snapshot(id)[0]).toEqual(before);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`.local-review/recovery-${width}.png`,fullPage:true});
  await page.getByRole("region", { name: "Conversation recovery" }).screenshot({ path: `.local-review/recovery-controls-${width}.png` });
  await page.reload();await expect(page.locator(".agora-answer")).toHaveCount(3);expect(snapshot(id)).toHaveLength(3);
});

test("synthesis failure recovers in the background after navigation without rewriting answers",async({page,request})=>{
  const id=randomUUID();job(id,{count:3});const before=snapshot(id);
  await request.post(`${stub}/mode`,{data:{mode:"synthesis-failed"}});due(id);
  await expect.poll(()=>state(id)).toBe("retry_wait");
  await expect.poll(()=> (db.prepare("SELECT attempts FROM agora_job_steps WHERE thread_id = ? AND step_key = 'synthesis'").get(id) as {attempts:number}).attempts).toBe(1);
  await login(page);await page.goto(`/agora/${id}`);await expect(page.getByText("Generation was interrupted.",{exact:false})).toBeVisible();
  await page.goto("/feed");await request.post(`${stub}/mode`,{data:{mode:"normal"}});due(id);
  await expect.poll(()=>state(id)).toBe("complete");expect(snapshot(id)).toEqual(before);
  await page.goto(`/agora/${id}`);await expect(page.locator(".agora-synthesis")).toHaveCount(1);
});

test("interrupted follow-up uses its original snapshot and keeps the one-follow-up limit",async({page,request})=>{
  const parent=randomUUID();job(parent,{count:3,synthesis:true,state:"complete"});db.prepare("UPDATE agora_threads SET status = 'complete' WHERE id = ?").run(parent);
  const child=randomUUID();job(child,{parent});
  const frozen=(db.prepare("SELECT context_json FROM agora_jobs WHERE thread_id = ?").get(child) as {context_json:string}).context_json;
  const before=snapshot(child)[0];db.prepare("UPDATE agora_responses SET posts = ? WHERE thread_id = ?").run('["LATER_CHANGED_PARENT"]',parent);
  await login(page);await page.goto(`/agora/${parent}#follow-up`);
  due(child);await page.locator("#follow-up").getByRole("button",{name:"Recover missing work"}).click();
  await expect(page.locator("#follow-up .agora-answer")).toHaveCount(3);await expect(page.locator("#follow-up .agora-synthesis")).toHaveCount(1);
  expect(snapshot(child)[0]).toEqual(before);
  expect((db.prepare("SELECT context_json FROM agora_jobs WHERE thread_id = ?").get(child) as {context_json:string}).context_json).toBe(frozen);
  const inputs=db.prepare("SELECT source_material FROM agora_job_steps WHERE thread_id = ? AND attempts > 0").all(child) as {source_material:string}[];
  expect(inputs.length).toBeGreaterThan(0);for(const input of inputs){expect(input.source_material).toContain("SNAPSHOT_PARENT_ANSWER");expect(input.source_material).not.toContain("LATER_CHANGED_PARENT");}
  const another=await request.post(`/api/agora/${parent}/follow-up`,{headers:apiHeaders,data:{question:"Can I ask a second distinct follow-up?"}});expect(another.status()).toBe(409);
  await page.goto(`/agora/${child}`);await expect(page).toHaveURL(new RegExp(`${parent}#follow-up`));
});

test("exhausted and legacy blocked states are honest on mobile and desktop",async({page})=>{
  const exhausted=randomUUID();job(exhausted,{state:"exhausted"});
  const parent=randomUUID();job(parent,{count:3,synthesis:true,state:"complete"});
  const legacyChild=randomUUID();job(legacyChild,{parent,legacy:true});
  await login(page);
  for(const width of [320,1440]){
    await page.setViewportSize({width,height:900});await page.goto(`/agora/${exhausted}`);
    await expect(page.getByText("Automatic retries have been used up.",{exact:false})).toBeVisible();await expect(page.getByRole("button",{name:"Recover missing work"})).toHaveCount(0);
    await page.evaluate(()=>document.documentElement.style.fontSize="200%");expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`.local-review/recovery-exhausted-${width}.png`,fullPage:true});
    await page.goto(`/agora/${parent}#follow-up`);await expect(page.getByText("This older conversation does not have enough saved generation context",{exact:false})).toBeVisible();
  }
});

test("public non-owners and guests cannot recover; owner requests are rate-limited and idempotent",async({page,request})=>{
  const id=randomUUID();job(id,{visibility:"public"});
  await page.goto(`/agora/${id}`);await expect(page.getByRole("button",{name:"Recover missing work"})).toHaveCount(0);
  expect((await request.post(`/api/agora/${id}/recover`)).status()).toBe(403);
  await login(page,"other");await page.reload();await expect(page.getByRole("button",{name:"Recover missing work"})).toHaveCount(0);
  expect((await request.post(`/api/agora/${id}/recover`,{headers:{cookie:`better-auth.session_token=${review.cookies.other}`}})).status()).toBe(403);
  const before=Number((db.prepare("SELECT COUNT(*) c FROM agora_threads").get() as {c:number}).c);
  const results=await Promise.all(Array.from({length:5},()=>request.post(`/api/agora/${id}/recover`,{headers:apiHeaders})));
  expect(results.every(r=>r.status()===202)).toBe(true);
  const limited=await request.post(`/api/agora/${id}/recover`,{headers:apiHeaders});expect(limited.status()).toBe(429);expect(limited.headers()["retry-after"]).toBeTruthy();
  expect((db.prepare("SELECT COUNT(*) c FROM agora_threads").get() as {c:number}).c).toBe(before);expect(snapshot(id)).toHaveLength(1);
});

test("a real worker process crash resumes from SQLite with no reader and no duplicate saved work",async({request})=>{
  test.setTimeout(90000);
  const id=randomUUID();job(id,{state:"queued",count:0,userId:null,visibility:"public"});
  // Copy only isolated fixture data; the Next worker cannot access this second DB.
  const runDir=fs.mkdtempSync(path.resolve(".local-review/process-"));const file=path.join(runDir,"worker.db");
  await db.backup(file);
  db.prepare("DELETE FROM agora_threads WHERE id = ?").run(id);
  const isolated=new Database(file);isolated.prepare("DELETE FROM agora_jobs WHERE thread_id != ?").run(id);
  isolated.prepare("UPDATE agora_jobs SET next_attempt_at = 0 WHERE thread_id = ?").run(id);
  const launch=()=>spawn(process.execPath,["--import","tsx","scripts/fixtures/agora-worker-process.ts"],{windowsHide:true,stdio:"pipe",env:{...process.env,DATABASE_PATH:file,AGORA_REVIEW_MODE:"fixtures",ANTHROPIC_BASE_URL:stub,ANTHROPIC_API_KEY:"local-fixture-only",RUN_SEED:"false"}});
  const stop=async(child:ChildProcess)=>{if(child.exitCode===null){const ended=new Promise<void>(resolve=>child.once("exit",()=>resolve()));child.kill();await ended;}};
  let worker:ChildProcess|undefined;
  try {
    await request.post(`${stub}/mode`,{data:{mode:"slow"}});worker=launch();
    await expect.poll(()=> (isolated.prepare("SELECT COUNT(*) c FROM agora_responses WHERE thread_id = ?").get(id) as {c:number}).c,{timeout:40000}).toBe(1);
    const first=isolated.prepare("SELECT * FROM agora_responses WHERE thread_id = ?").get(id);
    await stop(worker);
    // Advance only the isolated lease clock to avoid a two-minute wall-clock wait.
    isolated.prepare("UPDATE agora_jobs SET lease_until = 0 WHERE thread_id = ?").run(id);
    await request.post(`${stub}/mode`,{data:{mode:"normal"}});worker=launch();
    await expect.poll(()=> (isolated.prepare("SELECT state FROM agora_jobs WHERE thread_id = ?").get(id) as {state:string}).state,{timeout:30000}).toBe("complete");
    expect(isolated.prepare("SELECT * FROM agora_responses WHERE thread_id = ? ORDER BY sort_order LIMIT 1").get(id)).toEqual(first);
    expect(isolated.prepare("SELECT COUNT(*) c FROM agora_responses WHERE thread_id = ?").get(id)).toEqual({c:3});
    expect(isolated.prepare("SELECT COUNT(*) c FROM agora_synthesis_v2 WHERE thread_id = ?").get(id)).toEqual({c:1});
  } finally {if(worker)await stop(worker);isolated.close();await request.post(`${stub}/mode`,{data:{mode:"normal"}});}
});
