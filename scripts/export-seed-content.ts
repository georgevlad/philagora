/**
 * Export a curated, sanitized local-development fixture from a Philagora dump.
 *
 * The source database is always opened read-only. User, account, session,
 * interaction, generation-log, API-log, and News Scout records are never read.
 *
 * Usage:
 *   npx tsx scripts/export-seed-content.ts --source data/philagora-2026-08-15.db
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const sourceArg = getArg("--source");
const outputArg = getArg("--output") ?? "scripts/fixtures/seed-content.json";

if (!sourceArg) {
  console.error("Usage: npx tsx scripts/export-seed-content.ts --source <database> [--output <fixture>]");
  process.exit(1);
}

const sourcePath = path.resolve(sourceArg);
const outputPath = path.resolve(outputArg);

if (sourcePath === outputPath) {
  throw new Error("The fixture output path cannot overwrite the source database");
}

const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
source.pragma("query_only = ON");

type DbRow = Record<string, unknown>;

const postRows = source
  .prepare("SELECT * FROM posts ORDER BY created_at DESC, id ASC")
  .all() as DbRow[];

const selectedPostIds = new Set<string>();
const published = postRows.filter((row) => row.status === "published");

for (const row of published) {
  if (["art_commentary", "everyday", "historical_event"].includes(String(row.source_type))) {
    selectedPostIds.add(String(row.id));
  }
}

for (const row of published.filter((candidate) => candidate.source_type === "reflection").slice(0, 12)) {
  selectedPostIds.add(String(row.id));
}

const selectedPerPhilosopher = new Map<string, number>();
for (const row of published) {
  const philosopherId = String(row.philosopher_id);
  const count = selectedPerPhilosopher.get(philosopherId) ?? 0;
  if (count < 2) {
    selectedPostIds.add(String(row.id));
    selectedPerPhilosopher.set(philosopherId, count + 1);
  }
}

const draftPhilosophers = new Set<string>();
for (const row of postRows.filter((candidate) => candidate.status === "draft")) {
  const philosopherId = String(row.philosopher_id);
  if (draftPhilosophers.has(philosopherId)) continue;
  selectedPostIds.add(String(row.id));
  draftPhilosophers.add(philosopherId);
  if (draftPhilosophers.size === 6) break;
}

const postsById = new Map(postRows.map((row) => [String(row.id), row]));
let addedDependency = true;
while (addedDependency) {
  addedDependency = false;
  for (const id of [...selectedPostIds]) {
    const replyTo = postsById.get(id)?.reply_to;
    if (typeof replyTo === "string" && !selectedPostIds.has(replyTo) && postsById.has(replyTo)) {
      selectedPostIds.add(replyTo);
      addedDependency = true;
    }
  }
}

const selectedPosts = postRows
  .filter((row) => selectedPostIds.has(String(row.id)))
  .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)));

const postIdMap = new Map(
  selectedPosts.map((row, index) => [String(row.id), `seed-post-${String(index + 1).padStart(3, "0")}`])
);

const eventIds = new Set(
  selectedPosts
    .map((row) => row.historical_event_id)
    .filter((id): id is string => typeof id === "string")
);

const readyEvents = source
  .prepare("SELECT id FROM historical_events WHERE status = 'ready' ORDER BY event_month, event_day, id LIMIT 2")
  .all() as Array<{ id: string }>;
for (const event of readyEvents) eventIds.add(event.id);

const eventRows = source
  .prepare("SELECT * FROM historical_events ORDER BY event_month, event_day, id")
  .all()
  .filter((row) => eventIds.has(String((row as DbRow).id))) as DbRow[];

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 56);
}

const eventIdMap = new Map(
  eventRows.map((row, index) => [
    String(row.id),
    `seed-event-${slug(String(row.title)) || String(index + 1)}`,
  ])
);

const debateIdMap = new Map<string, string>([
  ["debate-1773662348040", "seed-debate-ai-lethal-decisions"],
  ["debate-1773361347609", "seed-debate-democracy"],
  ["debate-1773361207159", "seed-debate-compassion"],
]);

const debates = [];
for (const [sourceId, seedId] of debateIdMap) {
  const debate = source.prepare("SELECT * FROM debates WHERE id = ?").get(sourceId) as DbRow | undefined;
  if (!debate) throw new Error(`Selected debate ${sourceId} was not found`);
  const participants = source
    .prepare("SELECT philosopher_id FROM debate_philosophers WHERE debate_id = ? ORDER BY rowid")
    .all(sourceId) as Array<{ philosopher_id: string }>;
  const debatePosts = source
    .prepare("SELECT * FROM debate_posts WHERE debate_id = ? ORDER BY sort_order, id")
    .all(sourceId) as DbRow[];
  const debatePostIdMap = new Map(
    debatePosts.map((row, index) => [String(row.id), `${seedId}-post-${String(index + 1).padStart(2, "0")}`])
  );

  debates.push({
    ...debate,
    id: seedId,
    philosophers: participants.map((row) => row.philosopher_id),
    posts: debatePosts.map((row) => ({
      ...row,
      id: debatePostIdMap.get(String(row.id)),
      debate_id: seedId,
      reply_to:
        typeof row.reply_to === "string" ? debatePostIdMap.get(row.reply_to) ?? null : null,
    })),
  });
}

const agoraIdMap = new Map<string, string>([
  ["1e0f8119-ed67-4e10-af76-9e38c30559d9", "seed-agora-envy"],
  ["676a1e53-d8e6-4e38-bacb-ca15524e30ae", "seed-agora-personal-identity"],
  ["11032eba-f382-43a7-ab1d-b626847eca85", "seed-agora-forgiveness"],
  ["0600031a-21d8-4e90-b19b-10bb5e2e3b08", "seed-agora-hope"],
  ["ce84faf1-c8d4-4929-8f8a-6860fd06006e", "seed-agora-growth"],
  ["717b0704-d3b0-42e6-800e-73ba369520db", "seed-agora-nostalgia"],
  ["3dc9c937-33b5-42b4-ab75-4d43be59ec1c", "seed-agora-nostalgia-follow-up"],
  ["f3481d9a-2e42-4e55-87bb-e4d81755bb86", "seed-agora-public-discourse"],
]);

const agoraThreads = [];
for (const [sourceId, seedId] of agoraIdMap) {
  const thread = source.prepare("SELECT * FROM agora_threads WHERE id = ?").get(sourceId) as DbRow | undefined;
  if (!thread) throw new Error(`Selected Agora thread ${sourceId} was not found`);
  const participants = source
    .prepare("SELECT philosopher_id FROM agora_thread_philosophers WHERE thread_id = ? ORDER BY rowid")
    .all(sourceId) as Array<{ philosopher_id: string }>;
  const responses = source
    .prepare("SELECT * FROM agora_responses WHERE thread_id = ? ORDER BY sort_order, id")
    .all(sourceId) as DbRow[];
  const synthesis = source
    .prepare("SELECT synthesis_type, sections, created_at FROM agora_synthesis_v2 WHERE thread_id = ?")
    .get(sourceId) as DbRow | undefined;

  agoraThreads.push({
    ...thread,
    id: seedId,
    asked_by: "Anonymous",
    ip_address: null,
    user_id: null,
    follow_up_to:
      typeof thread.follow_up_to === "string" ? agoraIdMap.get(thread.follow_up_to) ?? null : null,
    philosophers: participants.map((row) => row.philosopher_id),
    responses: responses.map((row, index) => ({
      ...row,
      id: `${seedId}-response-${String(index + 1).padStart(2, "0")}`,
      thread_id: seedId,
    })),
    synthesis: synthesis ?? null,
  });
}

const systemPrompts = source
  .prepare(`
    SELECT philosopher_id, prompt_version, system_prompt_text
    FROM system_prompts
    WHERE is_active = 1
    ORDER BY philosopher_id
  `)
  .all();

const moodPalettes = source
  .prepare(`
    SELECT philosopher_id, registers, is_active
    FROM mood_palettes
    WHERE is_active = 1
    ORDER BY philosopher_id
  `)
  .all();

const contentTemplates = source
  .prepare(`
    SELECT template_key, version, instructions, notes
    FROM content_templates
    WHERE is_active = 1
    ORDER BY template_key
  `)
  .all();

const fixture = {
  version: 1,
  sourceSnapshotDate: "2026-08-15",
  systemPrompts,
  moodPalettes,
  contentTemplates,
  historicalEvents: eventRows.map((row) => ({
    ...row,
    id: eventIdMap.get(String(row.id)),
    thumbnail_filename: null,
  })),
  posts: selectedPosts.map((row) => ({
    ...row,
    id: postIdMap.get(String(row.id)),
    historical_event_id:
      typeof row.historical_event_id === "string"
        ? eventIdMap.get(row.historical_event_id) ?? null
        : null,
    reply_to:
      typeof row.reply_to === "string" ? postIdMap.get(row.reply_to) ?? null : null,
  })),
  debates,
  agoraThreads,
};

const violations = source.pragma("foreign_key_check") as unknown[];
if (violations.length > 0) {
  throw new Error(`Source database has ${violations.length} foreign-key violation(s)`);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
source.close();

console.log(`Wrote sanitized fixture to ${path.relative(process.cwd(), outputPath)}`);
console.log(
  JSON.stringify(
    {
      posts: fixture.posts.length,
      drafts: selectedPosts.filter((post) => post.status === "draft").length,
      historicalEvents: fixture.historicalEvents.length,
      debates: fixture.debates.length,
      agoraThreads: fixture.agoraThreads.length,
      systemPrompts: fixture.systemPrompts.length,
      moodPalettes: fixture.moodPalettes.length,
      contentTemplates: fixture.contentTemplates.length,
    },
    null,
    2
  )
);
