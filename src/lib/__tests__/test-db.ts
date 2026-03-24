import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

/**
 * Create a fresh in-memory SQLite database with the full Philagora schema.
 * Returns the db instance for use in tests.
 */
export function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const schemaPath = path.join(process.cwd(), "db", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");

  const statements = schema
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0 && !statement.startsWith("PRAGMA"));

  for (const statement of statements) {
    db.exec(statement + ";");
  }

  return db;
}

/**
 * Seed the test database with minimal philosopher data.
 * Returns the IDs of seeded philosophers.
 */
export function seedPhilosophers(db: Database.Database): string[] {
  const philosophers = [
    {
      id: "nietzsche",
      name: "Friedrich Nietzsche",
      tradition: "Existentialism",
      color: "#8B0000",
      initials: "FN",
      bio: "Test bio",
      era: "Modern",
      key_works: "[]",
      core_principles: "[]",
    },
    {
      id: "camus",
      name: "Albert Camus",
      tradition: "Absurdism",
      color: "#2E5A4C",
      initials: "AC",
      bio: "Test bio",
      era: "Modern",
      key_works: "[]",
      core_principles: "[]",
    },
    {
      id: "plato",
      name: "Plato",
      tradition: "Platonism",
      color: "#4A5899",
      initials: "PL",
      bio: "Test bio",
      era: "Ancient",
      key_works: "[]",
      core_principles: "[]",
    },
    {
      id: "kant",
      name: "Immanuel Kant",
      tradition: "German Idealism",
      color: "#5C4033",
      initials: "IK",
      bio: "Test bio",
      era: "Modern",
      key_works: "[]",
      core_principles: "[]",
    },
  ];

  const insert = db.prepare(`
    INSERT INTO philosophers (id, name, tradition, color, initials, bio, era, key_works, core_principles)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const philosopher of philosophers) {
    insert.run(
      philosopher.id,
      philosopher.name,
      philosopher.tradition,
      philosopher.color,
      philosopher.initials,
      philosopher.bio,
      philosopher.era,
      philosopher.key_works,
      philosopher.core_principles
    );
  }

  return philosophers.map((philosopher) => philosopher.id);
}

/**
 * Seed posts into the test database.
 * Returns the IDs of seeded posts.
 */
export function seedPosts(
  db: Database.Database,
  posts: Array<{
    id: string;
    philosopher_id: string;
    content: string;
    thesis?: string;
    stance?: string;
    tag?: string;
    source_type?: string;
    citation_title?: string | null;
    citation_source?: string | null;
    citation_url?: string | null;
    reply_to?: string | null;
    status?: string;
    likes?: number;
    replies?: number;
    bookmarks?: number;
    created_at?: string;
  }>
): string[] {
  const insert = db.prepare(`
    INSERT INTO posts (
      id, philosopher_id, content, thesis, stance, tag,
      source_type, citation_title, citation_source, citation_url,
      reply_to, status, likes, replies, bookmarks, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const post of posts) {
    insert.run(
      post.id,
      post.philosopher_id,
      post.content,
      post.thesis ?? "",
      post.stance ?? "challenges",
      post.tag ?? "",
      post.source_type ?? "news",
      post.citation_title ?? null,
      post.citation_source ?? null,
      post.citation_url ?? null,
      post.reply_to ?? null,
      post.status ?? "published",
      post.likes ?? 0,
      post.replies ?? 0,
      post.bookmarks ?? 0,
      post.created_at ?? new Date().toISOString().replace("T", " ").slice(0, 19),
      new Date().toISOString().replace("T", " ").slice(0, 19)
    );
  }

  return posts.map((post) => post.id);
}
