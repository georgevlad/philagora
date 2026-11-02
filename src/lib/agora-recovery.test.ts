import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Database from "better-sqlite3";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { createTestDb, seedPhilosophers } from "@/lib/__tests__/test-db";
import type { RequestIdentity } from "@/lib/auth";
let db: Database.Database;
let identity: RequestIdentity;
vi.mock("@/lib/db", () => ({ getDb: () => db }));
vi.mock("@/lib/auth", () => ({ getIdentityFromHeaders: async () => identity }));
vi.mock("@/lib/generation-service", () => ({ generateContent: vi.fn(), generateSynthesis: vi.fn() }));
import { generateContent, generateSynthesis } from "@/lib/generation-service";
import { claimAgoraJob, runAgoraGeneration } from "@/lib/agora-generation";
import { drainAgoraJobs } from "@/lib/agora-worker";
import { agoraWork, enqueueAgoraJob, getAgoraJob, getAgoraRecovery, legacyAgoraContext, requestAgoraRecovery, snapshotParticipants, AgoraRecoveryError, type AgoraJobContext } from "@/lib/agora-jobs";
import { POST as recover } from "@/app/api/agora/[threadId]/recover/route";
import { GET as read } from "@/app/api/agora/[threadId]/route";
import { POST as approve } from "@/app/api/admin/agora/[id]/approve/route";
import { POST as adminSynthesis } from "@/app/api/admin/agora/[id]/synthesis/route";
import { MIGRATIONS } from "../../db/migrations";
const owner = { type: "user", id: "owner", email: "owner@test.invalid" } as const;
const answer = (text = "A preserved answer.") => ({ success: true as const, data: { posts: [text], recommendation: { title: "The Myth of Sisyphus", author: "Camus", medium: "essay", reason: "An example." } }, rawOutput: text, systemPromptId: null });
const synthesis = () => ({ success: true as const, data: { tensions: ["A preserved synthesis."], agreements: [], practicalTakeaways: [] }, rawOutput: "synthesis", systemPromptId: null });
const failure = () => ({ success: false as const, error: "PRIVATE PROVIDER ERROR", rawOutput: "PRIVATE OUTPUT", systemPromptId: null });
function create(id = randomUUID(), options: Partial<AgoraJobContext> = {}, managed = true) {
  const context: AgoraJobContext = {
    version: 1, question: "PRIVATE question about an uncertain future?", askedBy: "Anonymous", questionType: "advice",
    recommendationsEnabled: false, recommendationHint: null, participants: snapshotParticipants(db, ["camus", "nietzsche"]),
    visibility: "private", userId: "owner", article: null, parent: null, ...options,
  };
  db.transaction(() => {
    db.prepare(`INSERT INTO agora_threads (id, question, asked_by, question_type, recommendations_enabled, visibility, user_id, ip_address, follow_up_to, article_url, article_title, article_source, article_excerpt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, context.question, context.askedBy, context.questionType, Number(context.recommendationsEnabled), context.visibility, context.userId, "fixture-ip", context.parent?.id ?? null, context.article?.url ?? null, context.article?.title ?? null, context.article?.source ?? null, context.article?.excerpt ?? null);
    for (const p of context.participants) db.prepare("INSERT INTO agora_thread_philosophers VALUES (?, ?)").run(id, p.id);
    if (managed) enqueueAgoraJob(db, id, context);
  })();
  return id;
}
function saved(id: string, pid = "camus", order = 0) {
  db.prepare("INSERT INTO agora_responses (id, thread_id, philosopher_id, posts, sort_order) VALUES (?, ?, ?, ?, ?)").run(randomUUID(), id, pid, '["Do not rewrite this answer."]', order);
}
function savedSynthesis(id: string) { db.prepare("INSERT INTO agora_synthesis_v2 (thread_id, sections) VALUES (?, ?)").run(id, '{"tensions":["Do not rewrite synthesis."]}'); }
function due(id: string) { db.prepare("UPDATE agora_jobs SET next_attempt_at = 0, lease_until = 0 WHERE thread_id = ?").run(id); }
const req = () => new NextRequest("http://localhost/api/agora/any/recover", { method: "POST" });
const params = (threadId: string) => ({ params: Promise.resolve({ threadId }) });
function capture(id: string) {
  return { responses: db.prepare("SELECT * FROM agora_responses WHERE thread_id = ? ORDER BY sort_order").all(id), synthesis: db.prepare("SELECT * FROM agora_synthesis_v2 WHERE thread_id = ?").get(id) };
}
beforeEach(() => {
  db = createTestDb(); seedPhilosophers(db); identity = owner;
  vi.clearAllMocks();
  vi.mocked(generateContent).mockImplementation(async () => answer());
  vi.mocked(generateSynthesis).mockImplementation(async () => synthesis());
});
afterEach(() => db.close());

describe("durable missing-work generation", () => {
  it("retains the first saved answer across failure and recovery, then synthesizes the complete group", async () => {
    const id = create();
    vi.mocked(generateContent).mockResolvedValueOnce(answer("First answer")).mockResolvedValueOnce(failure());
    await runAgoraGeneration(id);
    expect(getAgoraJob(db,id)?.state).toBe("retry_wait");
    const first = capture(id).responses[0];
    expect(generateSynthesis).not.toHaveBeenCalled();
    due(id); await drainAgoraJobs();
    expect(getAgoraJob(db,id)?.state).toBe("complete");
    expect(capture(id).responses[0]).toEqual(first);
    expect(generateContent).toHaveBeenCalledTimes(3);
    const calls = vi.mocked(generateContent).mock.calls;
    expect(calls[0][2]).not.toContain("EARLIER ANSWERS IN THIS SAME ROUND");
    expect(calls[1][2]).toContain("EARLIER ANSWERS IN THIS SAME ROUND");
    expect(calls[1][2]).toContain("First answer");
    expect(calls[2][2]).toBe(calls[1][2]); // Recovery retains the originally persisted context.
    expect(generateSynthesis).toHaveBeenCalledTimes(1);
  });
  it("recovers synthesis alone without rewriting answers", async () => {
    const id=create(); vi.mocked(generateSynthesis).mockResolvedValueOnce(failure());
    await runAgoraGeneration(id);const original=capture(id).responses;
    due(id);await runAgoraGeneration(id);
    expect(capture(id).responses).toEqual(original); expect(generateContent).toHaveBeenCalledTimes(2);
    expect(generateSynthesis).toHaveBeenCalledTimes(2);expect(agoraWork(db,id).complete).toBe(true);
  });
  it("does not call an empty synthesis complete", async () => {
    const id = create();
    vi.mocked(generateSynthesis).mockResolvedValueOnce({ success: true, data: {}, rawOutput: "{}", systemPromptId: null });
    await runAgoraGeneration(id);
    expect(getAgoraJob(db,id)?.state).toBe("retry_wait");
    expect(capture(id).synthesis).toBeUndefined();
  });
  it("retains private synthesis revision context through provider failure and stops at the budget", async () => {
    const id = create();
    const draft = JSON.stringify({ tensions: ["PRIVATE rejected draft"] });
    vi.mocked(generateSynthesis)
      .mockResolvedValueOnce({ ...failure(), errorCode: "invalid_content", rawOutput: draft })
      .mockResolvedValue(failure());
    for (let attempt = 0; attempt < 3; attempt++) {
      due(id); await runAgoraGeneration(id);
      expect(vi.mocked(generateSynthesis).mock.calls[attempt][3]).toBe(attempt ? draft : undefined);
      expect(db.prepare("SELECT rejected_output FROM agora_job_steps WHERE thread_id = ? AND step_key = 'synthesis'").get(id))
        .toEqual({ rejected_output: draft });
    }
    expect(getAgoraJob(db, id)?.state).toBe("exhausted");
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(getAgoraRecovery(db, id))).not.toContain("PRIVATE");
    expect(JSON.stringify(db.prepare("SELECT * FROM generation_log").all())).not.toContain("PRIVATE");
    due(id); await runAgoraGeneration(id);
    expect(generateSynthesis).toHaveBeenCalledTimes(3);
  });

  it("fences rejected drafts from an expired synthesis worker", async () => {
    const id = create(); saved(id); saved(id, "nietzsche", 1);
    let release!: (value: Awaited<ReturnType<typeof generateSynthesis>>) => void;
    vi.mocked(generateSynthesis).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const stale = runAgoraGeneration(id);
    due(id); await runAgoraGeneration(id);
    release({ ...failure(), errorCode: "invalid_content" });
    await stale;
    expect(getAgoraJob(db, id)?.state).toBe("complete");
    expect(db.prepare("SELECT rejected_output FROM agora_job_steps WHERE thread_id = ? AND step_key = 'synthesis'").get(id))
      .toEqual({ rejected_output: null });
  });
  it("retains existing synthesis even when answers were missing and status said complete", async () => {
    const id=create();saved(id);savedSynthesis(id);db.prepare("UPDATE agora_threads SET status = 'complete' WHERE id = ?").run(id);
    const original=capture(id);await runAgoraGeneration(id);
    expect(capture(id).responses[0]).toEqual(original.responses[0]);expect(capture(id).synthesis).toEqual(original.synthesis);
    expect(generateSynthesis).not.toHaveBeenCalled();expect(generateContent).toHaveBeenCalledTimes(1);
  });
  it("limits concurrent and repeated workers to one writer", async () => {
    const id=create();await Promise.all(Array.from({length:8},()=>runAgoraGeneration(id)));
    await runAgoraGeneration(id);expect(generateContent).toHaveBeenCalledTimes(2);expect(generateSynthesis).toHaveBeenCalledTimes(1);
    expect(capture(id).responses).toHaveLength(2);
  });
  it("fences a stale worker after another worker reclaims an expired lease", async () => {
    const id=create();let release!: (value: ReturnType<typeof answer>)=>void;
    vi.mocked(generateContent).mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
    const stale=runAgoraGeneration(id);
    expect(claimAgoraJob(id)).toBeNull();due(id);
    await runAgoraGeneration(id);const fresh=capture(id);
    release(answer("STALE RESULT"));await stale;
    expect(capture(id)).toEqual(fresh);expect(JSON.stringify(fresh)).not.toContain("STALE");
  });
  it("charges an attempt before the model call and does not reset it after restart", async () => {
    const id=create();claimAgoraJob(id);
    db.prepare("UPDATE agora_job_steps SET attempts = 2 WHERE thread_id = ? AND step_key = 'response:camus'").run(id);
    vi.mocked(generateContent).mockResolvedValue(failure());due(id);await drainAgoraJobs();
    expect(getAgoraJob(db,id)?.state).toBe("exhausted");
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(requestAgoraRecovery(db,id,"user:owner")).toBeInstanceOf(AgoraRecoveryError);
  });
  it("exhausts three attempts and preserves their original source and recommendation context", async () => {
    const id=create(undefined,{recommendationsEnabled:true,recommendationHint:"ORIGINAL HINT"});saved(id);
    vi.mocked(generateContent).mockResolvedValue(failure());
    for(let i=0;i<3;i++){due(id);await runAgoraGeneration(id);}
    expect(getAgoraJob(db,id)?.state).toBe("exhausted");
    expect(generateContent).toHaveBeenCalledTimes(3);
    const inputs=vi.mocked(generateContent).mock.calls.map(c=>c[2]);expect(new Set(inputs).size).toBe(1);expect(inputs[0]).toContain("ORIGINAL HINT");
    due(id);await runAgoraGeneration(id);expect(generateContent).toHaveBeenCalledTimes(3);
  });
  it("keeps extracted article content and classification without refetching", async()=>{
    const id=create(undefined,{questionType:"conceptual",article:{url:"https://example.test/article",title:"Original title",source:"Original source",excerpt:"Original excerpt",content:"Full original extracted article"}});
    vi.mocked(generateSynthesis).mockResolvedValueOnce({ success: true, data: { keyInsight: "A conceptual insight", frameworkComparison: [], deeperQuestions: [] }, rawOutput: "", systemPromptId: null });
    await runAgoraGeneration(id);expect(vi.mocked(generateContent).mock.calls[0][2]).toContain("Full original extracted article");
    expect(db.prepare("SELECT synthesis_type FROM agora_synthesis_v2 WHERE thread_id = ?").get(id)).toEqual({synthesis_type:"conceptual"});
  });
  it("uses the frozen follow-up context after the parent is changed",async()=>{
    const parent=create();await runAgoraGeneration(parent);
    const child=create(undefined,{parent:{id:parent,question:"FROZEN QUESTION",responses:[{posts:'["FROZEN ANSWER"]',philosopher_name:"Original Name",philosopher_tradition:"Original Tradition"}],synthesis:{type:"advice",sections:{tensions:["FROZEN SYNTHESIS"],agreements:[],practicalTakeaways:[]}}}});
    db.prepare("UPDATE agora_threads SET question = ? WHERE id = ?").run("LATER QUESTION",parent);
    db.prepare("UPDATE agora_responses SET posts = ? WHERE thread_id = ?").run('["LATER ANSWER"]',parent);
    vi.clearAllMocks();await runAgoraGeneration(child);
    for(const c of vi.mocked(generateContent).mock.calls){expect(c[2]).toContain("FROZEN QUESTION");expect(c[2]).toContain("FROZEN ANSWER");expect(c[2]).not.toContain("LATER");}
    expect(vi.mocked(generateContent).mock.calls[0][2]).not.toContain("EARLIER ANSWERS IN THIS SAME ROUND");
    expect(vi.mocked(generateContent).mock.calls[1][2]).toContain("EARLIER ANSWERS IN THIS SAME ROUND");
    expect(vi.mocked(generateContent).mock.calls[1][2]).toContain("A preserved answer.");
    expect(vi.mocked(generateSynthesis).mock.calls[0][1]).toContain("FROZEN SYNTHESIS");
  });
  it("can finish a parent with a snapshotted child without altering the child",async()=>{
    const parent=create();saved(parent);savedSynthesis(parent);
    const child=create(undefined,{parent:{id:parent,question:"Original parent",responses:[],synthesis:null}});
    const snapshot=getAgoraJob(db,child)?.context_json;await runAgoraGeneration(parent);
    expect(getAgoraJob(db,child)?.context_json).toBe(snapshot);expect(capture(child).responses).toHaveLength(0);
  });
  it("marks changed job context blocked without model calls",async()=>{
    const id=create();db.prepare("UPDATE agora_threads SET visibility = 'public' WHERE id = ?").run(id);
    await runAgoraGeneration(id);expect(getAgoraJob(db,id)?.state).toBe("blocked");expect(generateContent).not.toHaveBeenCalled();
  });
  it("omits private provider output and source from logs",async()=>{
    const id=create();vi.mocked(generateContent).mockResolvedValueOnce(failure());await runAgoraGeneration(id);
    const logs=JSON.stringify(db.prepare("SELECT * FROM generation_log").all());expect(logs).not.toContain("PRIVATE");
    expect(JSON.stringify(getAgoraRecovery(db,id))).not.toContain("PRIVATE");
  });
});

describe("recovery authorization, quotas and read-only state",()=>{
  it.each(["private","public"] as const)("owner can request recovery of a %s thread without a new allowance",async(visibility)=>{
    const id=create(undefined,{visibility});db.prepare("UPDATE agora_jobs SET state = 'retry_wait', next_attempt_at = ? WHERE thread_id = ?").run(Date.now()+999999,id);
    const responses=await Promise.all([recover(req(),params(id)),recover(req(),params(id))]);expect(responses.map(r=>r.status)).toEqual([202,202]);
    expect(db.prepare("SELECT COUNT(*) c FROM agora_threads").get()).toEqual({c:1});expect(generateContent).not.toHaveBeenCalled();
    expect(db.prepare("SELECT SUM(attempts) attempts FROM agora_job_steps").get()).toEqual({attempts:0});
  });
  it.each(["anonymous","other"])("denies %s readers of public and private conversations",async(type)=>{
    const publicId=create(undefined,{visibility:"public"});const privateId=create();
    identity=type==="anonymous"?{type:"anonymous"}:{type:"user",id:"other",email:"other@test.invalid"};
    expect((await recover(req(),params(publicId))).status).toBe(403);
    const res=await recover(req(),params(privateId));expect(res.status).toBe(404);expect(await res.text()).not.toContain("PRIVATE");
    expect(generateContent).not.toHaveBeenCalled();
  });
  it("never claims a guest thread when a reader signs in, but automatically continues its accepted job",async()=>{
    const id=create(undefined,{visibility:"public",userId:null});expect((await recover(req(),params(id))).status).toBe(403);
    await drainAgoraJobs();expect(agoraWork(db,id).complete).toBe(true);expect(db.prepare("SELECT user_id FROM agora_threads WHERE id = ?").get(id)).toEqual({user_id:null});
  });
  it("allows the existing admin override and applies its rate limit",async()=>{
    const id=create(undefined,{userId:null,visibility:"public"});identity={type:"admin"};
    db.prepare("UPDATE agora_jobs SET state = 'retry_wait', next_attempt_at = ? WHERE thread_id = ?").run(Date.now()+999999,id);
    for(let i=0;i<5;i++)expect((await recover(req(),params(id))).status).toBe(202);
    const res=await recover(req(),params(id));expect(res.status).toBe(429);expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
  it("persists owner rate limits across threads and does not bypass backoff",()=>{
    const first=create();const second=create();
    for(let i=0;i<5;i++)requestAgoraRecovery(db,first,"user:owner",1000);
    expect(requestAgoraRecovery(db,second,"user:owner",1001)).toMatchObject({status:429});
    expect(requestAgoraRecovery(db,second,"user:owner",601001)).not.toBeInstanceOf(AgoraRecoveryError);
  });
  it("GETs and recovery status remain read-only",async()=>{
    const id=create();const before=db.prepare("SELECT total_changes() c").get();
    await read(new NextRequest("http://localhost"),params(id));getAgoraRecovery(db,id);
    expect(db.prepare("SELECT total_changes() c").get()).toEqual(before);expect(generateContent).not.toHaveBeenCalled();
  });
  it("rejects a cross-origin recovery request",async()=>{
    const id=create();const res=await recover(new NextRequest("http://localhost/api/agora/x/recover",{method:"POST",headers:{origin:"https://evil.invalid"}}),params(id));
    expect(res.status).toBe(403);expect(getAgoraJob(db,id)?.state).toBe("queued");
  });
});

describe("legacy eligibility and competing editorial writes",()=>{
  it("adopts a partial legacy complete original when all original inputs can be restored",async()=>{
    const id=create(undefined,{},false);saved(id);savedSynthesis(id);db.prepare("UPDATE agora_threads SET status = 'complete' WHERE id = ?").run(id);
    const original=capture(id);expect(getAgoraRecovery(db,id).state).toBe("available");
    requestAgoraRecovery(db,id,"user:owner");await runAgoraGeneration(id);
    expect(capture(id).responses[0]).toEqual(original.responses[0]);expect(capture(id).synthesis).toEqual(original.synthesis);
  });
  it("allows legacy synthesis-only recovery with retained article metadata",()=>{
    const id=create(undefined,{recommendationsEnabled:true,article:{url:"https://example.test",title:"T",source:"S",excerpt:"E"}},false);
    saved(id);saved(id,"nietzsche",1);expect(legacyAgoraContext(db,id)).not.toBeNull();
  });
  it.each(["article","recommendations","followup","child","order","duplicates","admin"])("requires editorial intervention for legacy %s ambiguity",(kind)=>{
    const id=create(undefined,kind==="article"?{article:{url:"https://example.test",title:null,source:null,excerpt:null}}:kind==="recommendations"?{recommendationsEnabled:true}:{},false);
    if(kind==="followup")db.prepare("UPDATE agora_threads SET follow_up_to = id WHERE id = ?").run(id);
    if(kind==="child")create(undefined,{parent:{id,question:"parent",responses:[],synthesis:null}},false);
    if(kind==="order")saved(id,"camus",1);
    if(kind==="duplicates"){saved(id);saved(id);}
    if(kind==="admin")db.prepare("UPDATE agora_threads SET ip_address = NULL WHERE id = ?").run(id);
    expect(legacyAgoraContext(db,id)).toBeNull();expect(requestAgoraRecovery(db,id,"user:owner")).toMatchObject({status:409});
  });
  it("blocks admin approval and synthesis against active public jobs",async()=>{
    const id=create();const context={params:Promise.resolve({id})};
    const a=await approve(new NextRequest("http://localhost",{method:"POST",body:JSON.stringify({philosopher_id:"camus",posts:["competing"]})}),context);
    const b=await adminSynthesis(new NextRequest("http://localhost",{method:"POST",body:JSON.stringify({action:"save",data:{sections:{tensions:[]}}})}),context);
    expect(a.status).toBe(409);expect(b.status).toBe(409);expect(capture(id).responses).toHaveLength(0);
  });
  it("allows editorial completion of exhausted missing work but preserves finished work",async()=>{
    const id=create();saved(id);db.prepare("UPDATE agora_jobs SET state = 'exhausted' WHERE thread_id = ?").run(id);
    const context={params:Promise.resolve({id})};
    for(const [pid,status] of [["camus",409],["nietzsche",201]] as const){
      const res=await approve(new NextRequest("http://localhost",{method:"POST",body:JSON.stringify({philosopher_id:pid,posts:["editor answer"]})}),context);expect(res.status).toBe(status);
    }
    const res=await adminSynthesis(new NextRequest("http://localhost",{method:"POST",body:JSON.stringify({action:"save",data:{sections:{tensions:["editor synthesis"]}}})}),context);
    expect(res.status).toBe(200);expect(getAgoraJob(db,id)?.state).toBe("complete");
  });
  it("migration 18 is additive and idempotent with legacy duplicate answers",()=>{
    const id=create(undefined,{},false);saved(id);saved(id);savedSynthesis(id);const before=capture(id);
    db.exec("DROP TABLE agora_job_steps; DROP TABLE agora_jobs; DROP TABLE agora_recovery_limits;");
    const migration=MIGRATIONS.find(m=>m.version===18)!;migration.migrate(db,{});migration.migrate(db,{});
    expect(capture(id)).toEqual(before);expect(db.pragma("foreign_key_check")).toEqual([]);
  });
});
