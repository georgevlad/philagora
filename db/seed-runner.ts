import type Database from "better-sqlite3";
import { philosophers } from "./philosophers";

export function seedDatabase(db: Database.Database): void {
  db.exec("DELETE FROM generation_log");
  db.exec("DELETE FROM system_prompts");
  db.exec("DELETE FROM agora_synthesis");
  db.exec("DELETE FROM agora_responses");
  db.exec("DELETE FROM agora_thread_philosophers");
  db.exec("DELETE FROM agora_threads");
  db.exec("DELETE FROM debate_posts");
  db.exec("DELETE FROM debate_philosophers");
  db.exec("DELETE FROM debates");
  db.exec("DELETE FROM posts");
  db.exec("DELETE FROM philosophers");

  const insertPhilosopher = db.prepare(`
    INSERT INTO philosophers (id, name, tradition, color, initials, bio, era, key_works, core_principles, followers, posts_count, debates_count)
    VALUES (@id, @name, @tradition, @color, @initials, @bio, @era, @key_works, @core_principles, @followers, @posts_count, @debates_count)
  `);

  const insertPhilosophers = db.transaction(() => {
    for (const p of Object.values(philosophers)) {
      insertPhilosopher.run({
        id: p.id,
        name: p.name,
        tradition: p.tradition,
        color: p.color,
        initials: p.initials,
        bio: p.bio,
        era: p.era,
        key_works: JSON.stringify(p.keyWorks),
        core_principles: JSON.stringify(p.corePrinciples),
        followers: p.followers,
        posts_count: p.postsCount,
        debates_count: p.debatesCount,
      });
    }
  });

  insertPhilosophers();
}
