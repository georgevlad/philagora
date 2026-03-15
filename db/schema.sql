-- Philagora Database Schema
-- SQLite via better-sqlite3

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── Philosophers ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS philosophers (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  tradition       TEXT NOT NULL,
  color           TEXT NOT NULL,
  initials        TEXT NOT NULL,
  bio             TEXT NOT NULL,
  era             TEXT NOT NULL,
  key_works       TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
  core_principles TEXT NOT NULL DEFAULT '[]',   -- JSON array of {title, description}
  followers       INTEGER NOT NULL DEFAULT 0,
  posts_count     INTEGER NOT NULL DEFAULT 0,
  debates_count   INTEGER NOT NULL DEFAULT 0,
  is_active       INTEGER NOT NULL DEFAULT 1   -- 1 = active, 0 = inactive
);

-- ── Posts (feed items) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS posts (
  id              TEXT PRIMARY KEY,
  philosopher_id  TEXT NOT NULL REFERENCES philosophers(id),
  content         TEXT NOT NULL,
  thesis          TEXT NOT NULL DEFAULT '',
  stance          TEXT NOT NULL CHECK(stance IN ('challenges','defends','reframes','questions','warns','observes','diagnoses','provokes','laments','quips','mocks')),
  tag             TEXT NOT NULL DEFAULT '',
  source_type        TEXT NOT NULL DEFAULT 'news',
  historical_event_id TEXT REFERENCES historical_events(id),
  citation_title     TEXT,
  citation_source    TEXT,
  citation_url       TEXT,
  citation_image_url TEXT,
  reply_to        TEXT REFERENCES posts(id),
  likes           INTEGER NOT NULL DEFAULT 0,
  replies         INTEGER NOT NULL DEFAULT 0,
  bookmarks       INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','approved','published','archived')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_posts_philosopher ON posts(philosopher_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_tag ON posts(tag);
CREATE INDEX IF NOT EXISTS idx_posts_reply_to ON posts(reply_to);
CREATE INDEX IF NOT EXISTS idx_posts_source_type ON posts(source_type);
CREATE INDEX IF NOT EXISTS idx_posts_historical_event_id ON posts(historical_event_id);

-- ── Debates ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS debates (
  id                          TEXT PRIMARY KEY,
  title                       TEXT NOT NULL,
  trigger_article_title       TEXT NOT NULL,
  trigger_article_source      TEXT NOT NULL,
  trigger_article_url         TEXT,
  status                      TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','in_progress','complete')),
  debate_date                 TEXT NOT NULL,
  synthesis_tensions          TEXT NOT NULL DEFAULT '[]',       -- JSON array of strings
  synthesis_agreements        TEXT NOT NULL DEFAULT '[]',       -- JSON array of strings
  synthesis_questions         TEXT NOT NULL DEFAULT '[]',       -- JSON array of strings
  synthesis_summary_agree     TEXT NOT NULL DEFAULT '',
  synthesis_summary_diverge   TEXT NOT NULL DEFAULT '',
  synthesis_summary_unresolved TEXT NOT NULL DEFAULT ''
);

-- ── Debate ↔ Philosopher junction ────────────────────────────────────

CREATE TABLE IF NOT EXISTS debate_philosophers (
  debate_id      TEXT NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  philosopher_id TEXT NOT NULL REFERENCES philosophers(id),
  PRIMARY KEY (debate_id, philosopher_id)
);

-- ── Debate Posts ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS debate_posts (
  id              TEXT PRIMARY KEY,
  debate_id       TEXT NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  philosopher_id  TEXT NOT NULL REFERENCES philosophers(id),
  content         TEXT NOT NULL,
  phase           TEXT NOT NULL CHECK(phase IN ('opening','cross-examination','rebuttal','synthesis')),
  reply_to        TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_debate_posts_debate ON debate_posts(debate_id);

-- ── Agora Threads ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agora_threads (
  id         TEXT PRIMARY KEY,
  question   TEXT NOT NULL,
  asked_by   TEXT NOT NULL DEFAULT 'Anonymous User',
  status     TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','complete')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Agora Thread ↔ Philosopher junction ──────────────────────────────

CREATE TABLE IF NOT EXISTS agora_thread_philosophers (
  thread_id      TEXT NOT NULL REFERENCES agora_threads(id) ON DELETE CASCADE,
  philosopher_id TEXT NOT NULL REFERENCES philosophers(id),
  PRIMARY KEY (thread_id, philosopher_id)
);

-- ── Agora Responses ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agora_responses (
  id              TEXT PRIMARY KEY,
  thread_id       TEXT NOT NULL REFERENCES agora_threads(id) ON DELETE CASCADE,
  philosopher_id  TEXT NOT NULL REFERENCES philosophers(id),
  posts           TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
  sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_agora_responses_thread ON agora_responses(thread_id);

-- ── Agora Synthesis ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agora_synthesis (
  thread_id            TEXT PRIMARY KEY REFERENCES agora_threads(id) ON DELETE CASCADE,
  tensions             TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
  agreements           TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
  practical_takeaways  TEXT NOT NULL DEFAULT '[]'    -- JSON array of strings
);

-- ── System Prompts ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS system_prompts (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  philosopher_id     TEXT NOT NULL REFERENCES philosophers(id),
  prompt_version     INTEGER NOT NULL DEFAULT 1,
  system_prompt_text TEXT NOT NULL,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  is_active          INTEGER NOT NULL DEFAULT 0  -- boolean: 0 or 1
);

CREATE INDEX IF NOT EXISTS idx_system_prompts_philosopher ON system_prompts(philosopher_id);
CREATE INDEX IF NOT EXISTS idx_system_prompts_active ON system_prompts(philosopher_id, is_active);

-- ── Content Templates (admin-editable) ──────────────────────────────

CREATE TABLE IF NOT EXISTS content_templates (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  template_key    TEXT NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1,
  instructions    TEXT NOT NULL,
  is_active       INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  notes           TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_content_templates_key ON content_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_content_templates_active ON content_templates(template_key, is_active);

-- ── House Rules (global generation rules) ───────────────────────────

CREATE TABLE IF NOT EXISTS house_rules (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  version         INTEGER NOT NULL DEFAULT 1,
  rules_text      TEXT NOT NULL,
  is_active       INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  notes           TEXT NOT NULL DEFAULT ''
);

-- ── Generation Log ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS generation_log (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  philosopher_id   TEXT REFERENCES philosophers(id),
  content_type     TEXT NOT NULL CHECK(content_type IN ('post','debate_opening','debate_rebuttal','agora_response','reflection','synthesis')),
  system_prompt_id INTEGER REFERENCES system_prompts(id),
  user_input       TEXT NOT NULL DEFAULT '',
  raw_output       TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'generated' CHECK(status IN ('generated','approved','rejected','published','pending')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_generation_log_philosopher ON generation_log(philosopher_id);
CREATE INDEX IF NOT EXISTS idx_generation_log_status ON generation_log(status);

CREATE TABLE IF NOT EXISTS historical_events (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  event_month     INTEGER NOT NULL CHECK(event_month BETWEEN 1 AND 12),
  event_day       INTEGER NOT NULL CHECK(event_day BETWEEN 1 AND 31),
  event_year      INTEGER,
  display_date    TEXT NOT NULL,
  era             TEXT NOT NULL DEFAULT 'modern' CHECK(era IN ('ancient','medieval','early_modern','modern','contemporary')),
  category        TEXT NOT NULL DEFAULT 'political' CHECK(category IN ('war_conflict','revolution','science_discovery','cultural_shift','political','economic','philosophical','other')),
  context         TEXT NOT NULL,
  key_themes      TEXT NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','ready','used')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_historical_events_date ON historical_events(event_month, event_day);
CREATE INDEX IF NOT EXISTS idx_historical_events_status ON historical_events(status);
CREATE INDEX IF NOT EXISTS idx_historical_events_era ON historical_events(era);

-- ── News Scout: Sources ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS news_sources (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  feed_url        TEXT NOT NULL UNIQUE,
  category        TEXT NOT NULL DEFAULT 'world',
  is_active       INTEGER NOT NULL DEFAULT 1,
  last_fetched_at TEXT,
  logo_url        TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── News Scout: Article Candidates ─────────────────────────────────

CREATE TABLE IF NOT EXISTS article_candidates (
  id                       TEXT PRIMARY KEY,
  source_id                TEXT NOT NULL REFERENCES news_sources(id),
  title                    TEXT NOT NULL,
  url                      TEXT NOT NULL UNIQUE,
  description              TEXT NOT NULL DEFAULT '',
  pub_date                 TEXT,
  score                    INTEGER,
  score_reasoning          TEXT,
  suggested_philosophers   TEXT NOT NULL DEFAULT '[]',
  suggested_stances        TEXT NOT NULL DEFAULT '{}',
  primary_tensions         TEXT NOT NULL DEFAULT '[]',
  philosophical_entry_point TEXT,
  topic_cluster            TEXT,
  image_url                TEXT,
  status                   TEXT NOT NULL DEFAULT 'new'
                             CHECK(status IN ('new','scored','approved','dismissed','used')),
  fetched_at               TEXT NOT NULL DEFAULT (datetime('now')),
  scored_at                TEXT
);

CREATE INDEX IF NOT EXISTS idx_article_candidates_status ON article_candidates(status);
CREATE INDEX IF NOT EXISTS idx_article_candidates_score ON article_candidates(score);
CREATE INDEX IF NOT EXISTS idx_article_candidates_url ON article_candidates(url);

CREATE TABLE IF NOT EXISTS scoring_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);
