import type Database from "better-sqlite3";
import { DEFAULT_SCORING_CONFIG_VALUES } from "../src/lib/scoring-config";

// ── Migration Registry ─────────────────────────────────────────

interface Migration {
  version: number;
  name: string;
  migrate: (db: Database.Database, options: MigrationOptions) => void;
}

interface MigrationOptions {
  bootstrapNewsSources?: boolean;
}

/**
 * Ordered list of all migrations. Each migration has a version number,
 * a human-readable name, and a migrate function.
 *
 * Rules:
 * - Version numbers must be sequential starting from 1
 * - Never reorder, rename, or remove existing migrations
 * - New migrations are appended to the end with the next version number
 * - Migration functions receive the db instance and options
 */
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "legacy_baseline",
    migrate: runLegacyMigrations,
  },
  {
    version: 2,
    name: "add_user_interactions",
    migrate: (db) => migrateAddUserInteractions(db),
  },
  {
    version: 3,
    name: "backfill_reflection_source_type",
    migrate: (db) => migrateBackfillReflectionSourceType(db),
  },
  {
    version: 4,
    name: "add_failed_agora_thread_status",
    migrate: (db) => migrateAgoraThreadsFailedStatus(db),
  },
  {
    version: 5,
    name: "agora_question_categorization_and_flexible_synthesis",
    migrate: (db) => migrateAgoraQuestionCategorizationAndFlexibleSynthesis(db),
  },
  {
    version: 6,
    name: "agora_article_submission_fields",
    migrate: (db) => migrateAgoraArticleSubmissionFields(db),
  },
  {
    version: 7,
    name: "agora_thread_visibility_and_user_ownership",
    migrate: (db) => migrateAgoraThreadVisibilityAndUserOwnership(db),
  },
  // ── Future migrations go here ──
  // {
  //   version: 2,
  //   name: "add_user_profiles",
  //   migrate: migrateAddUserProfiles,
  // },
];

const DEFAULT_NEWS_SOURCES: [string, string, string, string][] = [
  ["bbc-world", "BBC World News", "https://feeds.bbci.co.uk/news/world/rss.xml", "world"],
  ["npr-top", "NPR Top Stories", "https://feeds.npr.org/1001/rss.xml", "world"],
  ["guardian-world", "The Guardian World", "https://www.theguardian.com/world/rss", "world"],
  ["aljazeera", "Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml", "world"],
  ["cnn-world", "CNN World", "http://rss.cnn.com/rss/edition_world.rss", "world"],
  ["economist", "The Economist", "https://www.economist.com/latest/rss.xml", "world"],
  ["reuters-google", "Reuters (via Google News)", "https://news.google.com/rss/search?q=when:24h+allinurl:reuters.com&ceid=US:en&hl=en-US&gl=US", "world"],
  ["france24", "France 24", "https://www.france24.com/en/rss", "world"],
  ["dw-europe", "Deutsche Welle Europe", "https://rss.dw.com/rdf/rss-en-eu", "world"],
  ["spiegel-intl", "Der Spiegel International", "https://www.spiegel.de/international/index.rss", "world"],
  ["politico-eu", "Politico Europe", "https://www.politico.eu/feed/", "politics"],
  ["euronews", "Euronews", "https://feeds.feedburner.com/euronews/en/home/", "world"],
  ["eurotopics", "Euro Topics", "https://www.eurotopics.net/export/en/rss.xml", "ideas"],
  ["foreign-affairs", "Foreign Affairs", "https://foreignaffairs.com/rss.xml", "politics"],
  ["foreign-policy", "Foreign Policy", "https://foreignpolicy.com/feed/", "politics"],
  ["war-on-the-rocks", "War on the Rocks", "https://warontherocks.com/feed/", "politics"],
  ["nature-news", "Nature", "https://www.nature.com/nature.rss", "science"],
  ["ars-technica", "Ars Technica", "http://feeds.arstechnica.com/arstechnica/index/", "tech"],
  ["wired", "Wired", "https://www.wired.com/feed/rss", "tech"],
  ["the-conversation", "The Conversation", "https://theconversation.com/us/articles.atom", "ideas"],
  ["oxford-practical-ethics", "Oxford Practical Ethics", "https://blog.practicalethics.ox.ac.uk/feed/", "ideas"],
  ["atlantic", "The Atlantic", "https://www.theatlantic.com/feed/all/", "opinion"],
  ["aeon", "Aeon", "https://aeon.co/feed.rss", "culture"],
  ["avclub", "The A.V. Club", "https://www.avclub.com/rss", "entertainment"],
  ["popmatters", "PopMatters", "https://popmatters.com/feed", "culture"],
  ["bbc-sport", "BBC Sport", "https://feeds.bbci.co.uk/sport/rss.xml", "sports"],
  ["espn-top", "ESPN Top News", "http://www.espn.com/espn/rss/news", "sports"],
];

const DEFAULT_NEWS_SOURCE_LOGOS: Record<string, string> = {
  "bbc-world": "https://www.google.com/s2/favicons?domain=bbc.co.uk&sz=64",
  "npr-top": "https://www.google.com/s2/favicons?domain=npr.org&sz=64",
  "guardian-world": "https://www.google.com/s2/favicons?domain=theguardian.com&sz=64",
  "aljazeera": "https://www.google.com/s2/favicons?domain=aljazeera.com&sz=64",
  "cnn-world": "https://www.google.com/s2/favicons?domain=cnn.com&sz=64",
  "economist": "https://www.google.com/s2/favicons?domain=economist.com&sz=64",
  "reuters-google": "https://www.google.com/s2/favicons?domain=reuters.com&sz=64",
  "france24": "https://www.google.com/s2/favicons?domain=france24.com&sz=64",
  "dw-europe": "https://www.google.com/s2/favicons?domain=dw.com&sz=64",
  "spiegel-intl": "https://www.google.com/s2/favicons?domain=spiegel.de&sz=64",
  "politico-eu": "https://www.google.com/s2/favicons?domain=politico.eu&sz=64",
  "euronews": "https://www.google.com/s2/favicons?domain=euronews.com&sz=64",
  "eurotopics": "https://www.google.com/s2/favicons?domain=eurotopics.net&sz=64",
  "foreign-affairs": "https://www.google.com/s2/favicons?domain=foreignaffairs.com&sz=64",
  "foreign-policy": "https://www.google.com/s2/favicons?domain=foreignpolicy.com&sz=64",
  "war-on-the-rocks": "https://www.google.com/s2/favicons?domain=warontherocks.com&sz=64",
  "nature-news": "https://www.google.com/s2/favicons?domain=nature.com&sz=64",
  wired: "https://www.google.com/s2/favicons?domain=wired.com&sz=64",
  "the-conversation": "https://www.google.com/s2/favicons?domain=theconversation.com&sz=64",
  "oxford-practical-ethics": "https://www.google.com/s2/favicons?domain=practicalethics.ox.ac.uk&sz=64",
  atlantic: "https://www.google.com/s2/favicons?domain=theatlantic.com&sz=64",
  aeon: "https://www.google.com/s2/favicons?domain=aeon.co&sz=64",
  avclub: "https://www.google.com/s2/favicons?domain=avclub.com&sz=64",
  popmatters: "https://www.google.com/s2/favicons?domain=popmatters.com&sz=64",
  "bbc-sport": "https://www.google.com/s2/favicons?domain=bbc.co.uk&sz=64",
  "espn-top": "https://www.google.com/s2/favicons?domain=espn.com&sz=64",
  "ars-technica": "https://www.google.com/s2/favicons?domain=arstechnica.com&sz=64",
};

const UPDATED_STANCE_GUIDANCE_VALUE = JSON.stringify({
  preferred_friction_pairs: [
    ["challenges", "defends"],
    ["challenges", "reframes"],
    ["defends", "questions"],
  ],
  deprioritize: ["warns", "observes"],
  guidance_text:
    "CRITICAL: Each suggested philosopher MUST have a DIFFERENT stance. Never assign the same stance to 2+ philosophers on the same article.\n\nStance hierarchy (prefer top, avoid bottom):\n1. 'challenges' + 'defends' \u2014 genuine opposition, highest value\n2. 'reframes' \u2014 shifts the question itself, high value when authentic\n3. 'questions' \u2014 Socratic interrogation, moderate value\n4. 'warns' \u2014 use ONLY when a philosopher's framework genuinely predicts danger, not as a safe default\n5. 'observes' \u2014 LAST RESORT. A philosopher who merely 'observes' adds little friction. If you find yourself assigning 'observes', ask: could this philosopher 'reframe' or 'question' instead? Almost always yes.\n\nMaximum ONE 'observes' per article. Maximum ONE 'warns' per article. If an article can't generate at least one 'challenges' or 'defends', it probably deserves a lower score.",
});

// ── Version Tracking ───────────────────────────────────────────

function ensureMetaTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _schema_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function getSchemaVersion(db: Database.Database): number {
  ensureMetaTable(db);
  const row = db
    .prepare("SELECT value FROM _schema_meta WHERE key = 'schema_version'")
    .get() as { value: string } | undefined;

  return row ? parseInt(row.value, 10) : 0;
}

function setSchemaVersion(db: Database.Database, version: number): void {
  ensureMetaTable(db);
  db.prepare(
    `INSERT INTO _schema_meta (key, value) VALUES ('schema_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(version));
}

/**
 * Run all pending migrations sequentially.
 * Called once during getDb() bootstrap.
 */
export function runMigrations(
  db: Database.Database,
  options: { bootstrapNewsSources?: boolean } = {}
): void {
  const currentVersion = getSchemaVersion(db);
  const pending = MIGRATIONS.filter((migration) => migration.version > currentVersion);

  if (pending.length === 0) return;

  for (const migration of pending) {
    try {
      migration.migrate(db, options);
      setSchemaVersion(db, migration.version);
      console.log(`[Philagora] Migration ${migration.version} (${migration.name}) applied`);
    } catch (err) {
      console.error(`[Philagora] Migration ${migration.version} (${migration.name}) FAILED:`, err);
      throw err;
    }
  }
}

/**
 * Version 1: All pre-versioning migrations bundled together.
 * Each individual function is idempotent, so this is safe to run
 * on databases that already have some or all of these applied.
 */
function runLegacyMigrations(db: Database.Database, options: MigrationOptions): void {
  migrateNewsScout(db, options);
  migrateNewsSourceLogos(db);
  migrateArticleCandidatesTopicCluster(db);
  migrateAgoraThreadsIpAddress(db);
  migratePhilosophersIsActive(db);
  migrateScoringConfig(db);
  migrateContentTemplates(db);
  migrateAddHistoricalEvents(db);
  migrateHistoricalEventThumbnails(db);
  migrateApiCallLog(db);

  try {
    migratePostsSchema(db);
  } catch (err) {
    if (!(err instanceof Error && err.message.includes("SQLITE_ERROR"))) throw err;
  }

  migrateAddPostSourceType(db);
  migrateGenerationLogSchema(db);
}

function migrateAddUserInteractions(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_bookmarks (
      user_id    TEXT NOT NULL,
      post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, post_id)
    );

    CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user ON user_bookmarks(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_bookmarks_post ON user_bookmarks(post_id);

    CREATE TABLE IF NOT EXISTS user_likes (
      user_id    TEXT NOT NULL,
      post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, post_id)
    );

    CREATE INDEX IF NOT EXISTS idx_user_likes_user ON user_likes(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_likes_post ON user_likes(post_id);
  `);
}

function migrateNewsScout(db: Database.Database, options: MigrationOptions): void {
  const newsSourcesTableExists = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='news_sources'")
    .get();

  db.exec(`
    CREATE TABLE IF NOT EXISTS news_sources (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      feed_url        TEXT NOT NULL UNIQUE,
      category        TEXT NOT NULL DEFAULT 'world',
      is_active       INTEGER NOT NULL DEFAULT 1,
      last_fetched_at TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

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
      topic_cluster            TEXT DEFAULT NULL,
      image_url                TEXT,
      status                   TEXT NOT NULL DEFAULT 'new'
                                 CHECK(status IN ('new','scored','approved','dismissed','used')),
      fetched_at               TEXT NOT NULL DEFAULT (datetime('now')),
      scored_at                TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_article_candidates_status ON article_candidates(status);
    CREATE INDEX IF NOT EXISTS idx_article_candidates_score ON article_candidates(score);
    CREATE INDEX IF NOT EXISTS idx_article_candidates_url ON article_candidates(url);
  `);

  const shouldBootstrapSources = options.bootstrapNewsSources || !newsSourcesTableExists;
  if (!shouldBootstrapSources) return;

  seedDefaultNewsSources(db);
}

function migrateArticleCandidatesTopicCluster(db: Database.Database): void {
  const tableInfo = db.pragma("table_info(article_candidates)") as Array<{ name: string }>;
  const hasColumn = tableInfo.some((col) => col.name === "topic_cluster");
  if (!hasColumn) {
    db.exec("ALTER TABLE article_candidates ADD COLUMN topic_cluster TEXT DEFAULT NULL");
  }
}

function migrateNewsSourceLogos(db: Database.Database): void {
  ensureNewsSourceLogoColumn(db);
}

function seedDefaultNewsSources(db: Database.Database): void {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO news_sources (id, name, feed_url, category) VALUES (?, ?, ?, ?)"
  );

  for (const row of DEFAULT_NEWS_SOURCES) {
    insert.run(...row);
  }

  ensureNewsSourceLogoColumn(db);

  const updateLogo = db.prepare(
    "UPDATE news_sources SET logo_url = COALESCE(logo_url, ?) WHERE id = ?"
  );

  for (const [id, logoUrl] of Object.entries(DEFAULT_NEWS_SOURCE_LOGOS)) {
    updateLogo.run(logoUrl, id);
  }
}

function ensureNewsSourceLogoColumn(db: Database.Database): void {
  const columns = db
    .prepare("PRAGMA table_info(news_sources)")
    .all() as { name: string }[];

  const hasLogoUrl = columns.some((c) => c.name === "logo_url");
  if (hasLogoUrl) return;

  try {
    db.exec("ALTER TABLE news_sources ADD COLUMN logo_url TEXT;");
  } catch (err) {
    if (!(err instanceof Error && err.message.includes("duplicate column"))) {
      throw err;
    }
  }
}

function migratePostsSchema(db: Database.Database): void {
  const tableInfo = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='posts'")
    .get() as { sql: string } | undefined;

  if (!tableInfo) return;

  const columns = db.prepare("PRAGMA table_info(posts)").all() as Array<{ name: string }>;
  const hasSourceType = columns.some((column) => column.name === "source_type");
  const hasHistoricalEventId = columns.some((column) => column.name === "historical_event_id");
  const hasArchivedStatus = tableInfo.sql.includes("archived");
  const hasExpandedStances =
    tableInfo.sql.includes("diagnoses") &&
    tableInfo.sql.includes("provokes") &&
    tableInfo.sql.includes("laments") &&
    tableInfo.sql.includes("quips") &&
    tableInfo.sql.includes("mocks") &&
    tableInfo.sql.includes("recommends");
  const hasRecommendationTitle = columns.some((column) => column.name === "recommendation_title");
  const hasRecommendationMedium = columns.some((column) => column.name === "recommendation_medium");

  if (hasArchivedStatus && hasExpandedStances && hasRecommendationTitle && hasRecommendationMedium) {
    return;
  }

  db.exec("PRAGMA foreign_keys = OFF;");

  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS posts_new (
        id              TEXT PRIMARY KEY,
        philosopher_id  TEXT NOT NULL REFERENCES philosophers(id),
        content         TEXT NOT NULL,
        thesis          TEXT NOT NULL DEFAULT '',
        stance          TEXT NOT NULL CHECK(stance IN ('challenges','defends','reframes','questions','warns','observes','diagnoses','provokes','laments','quips','mocks','recommends')),
        tag             TEXT NOT NULL DEFAULT '',
        source_type        TEXT NOT NULL DEFAULT 'news',
        historical_event_id TEXT REFERENCES historical_events(id),
        recommendation_title TEXT DEFAULT NULL,
        recommendation_medium TEXT DEFAULT NULL,
        citation_title     TEXT,
        citation_source    TEXT,
        citation_url       TEXT,
        citation_image_url TEXT,
        reply_to        TEXT REFERENCES posts_new(id),
        likes           INTEGER NOT NULL DEFAULT 0,
        replies         INTEGER NOT NULL DEFAULT 0,
        bookmarks       INTEGER NOT NULL DEFAULT 0,
        status          TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','approved','published','archived')),
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    db.exec(`
      INSERT INTO posts_new (
        id, philosopher_id, content, thesis, stance, tag,
        source_type, historical_event_id, recommendation_title, recommendation_medium,
        citation_title, citation_source, citation_url, citation_image_url,
        reply_to, likes, replies, bookmarks, status, created_at, updated_at
      )
      SELECT
        id, philosopher_id, content, thesis, stance, tag,
        ${hasSourceType ? "COALESCE(source_type, 'news')" : "'news'"},
        ${hasHistoricalEventId ? "historical_event_id" : "NULL"},
        ${hasRecommendationTitle ? "recommendation_title" : "NULL"},
        ${hasRecommendationMedium ? "recommendation_medium" : "NULL"},
        citation_title, citation_source, citation_url, citation_image_url,
        reply_to, likes, replies, bookmarks, status, created_at, updated_at
      FROM posts;
    `);
    db.exec("DROP TABLE posts;");
    db.exec("ALTER TABLE posts_new RENAME TO posts;");
    db.exec("CREATE INDEX IF NOT EXISTS idx_posts_philosopher ON posts(philosopher_id);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_posts_tag ON posts(tag);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_posts_reply_to ON posts(reply_to);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_posts_source_type ON posts(source_type);");
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_posts_historical_event_id ON posts(historical_event_id);"
    );
  })();

  db.exec("PRAGMA foreign_keys = ON;");
}

function migrateGenerationLogSchema(db: Database.Database): void {
  const tableInfo = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='generation_log'")
    .get() as { sql: string } | undefined;

  if (!tableInfo) return;

  const needsMigration =
    tableInfo.sql.includes("NOT NULL REFERENCES philosophers") ||
    !tableInfo.sql.includes("synthesis") ||
    !tableInfo.sql.includes("recommendation");

  if (!needsMigration) return;

  try {
    db.exec("PRAGMA foreign_keys = OFF;");

    db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS generation_log_new (
          id               INTEGER PRIMARY KEY AUTOINCREMENT,
          philosopher_id   TEXT REFERENCES philosophers(id),
          content_type     TEXT NOT NULL CHECK(content_type IN ('post','debate_opening','debate_rebuttal','agora_response','reflection','recommendation','synthesis')),
          system_prompt_id INTEGER REFERENCES system_prompts(id),
          user_input       TEXT NOT NULL DEFAULT '',
          raw_output       TEXT NOT NULL DEFAULT '',
          status           TEXT NOT NULL DEFAULT 'generated' CHECK(status IN ('generated','approved','rejected','published','pending')),
          created_at       TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);

      db.exec("INSERT INTO generation_log_new SELECT * FROM generation_log;");
      db.exec("DROP TABLE generation_log;");
      db.exec("ALTER TABLE generation_log_new RENAME TO generation_log;");
      db.exec("CREATE INDEX IF NOT EXISTS idx_generation_log_philosopher ON generation_log(philosopher_id);");
      db.exec("CREATE INDEX IF NOT EXISTS idx_generation_log_status ON generation_log(status);");
    })();

    db.exec("PRAGMA foreign_keys = ON;");
  } catch (err) {
    if (!(err instanceof Error && err.message.includes("SQLITE_ERROR"))) throw err;
    try {
      db.exec("PRAGMA foreign_keys = ON;");
    } catch {
      // best effort
    }
  }
}

function migrateAddHistoricalEvents(db: Database.Database): void {
  const exists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='historical_events'")
    .get();

  if (exists) return;

  db.exec(`
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
      thumbnail_filename TEXT DEFAULT NULL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_historical_events_date ON historical_events(event_month, event_day);
    CREATE INDEX IF NOT EXISTS idx_historical_events_status ON historical_events(status);
    CREATE INDEX IF NOT EXISTS idx_historical_events_era ON historical_events(era);
  `);
}

function migrateApiCallLog(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_call_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      caller TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER,
      output_tokens INTEGER,
      max_tokens_requested INTEGER,
      temperature REAL,
      stop_reason TEXT,
      latency_ms INTEGER,
      success INTEGER NOT NULL DEFAULT 1,
      error_message TEXT,
      error_type TEXT,
      system_prompt_length INTEGER,
      user_message_length INTEGER,
      response_length INTEGER
    );
  `);
}

function migrateAddPostSourceType(db: Database.Database): void {
  const columns = db.prepare("PRAGMA table_info(posts)").all() as Array<{ name: string }>;
  const hasSourceType = columns.some((col) => col.name === "source_type");
  const hasHistoricalEventId = columns.some((col) => col.name === "historical_event_id");

  if (!hasSourceType) {
    db.exec("ALTER TABLE posts ADD COLUMN source_type TEXT NOT NULL DEFAULT 'news'");
  }

  if (!hasHistoricalEventId) {
    db.exec(
      "ALTER TABLE posts ADD COLUMN historical_event_id TEXT REFERENCES historical_events(id)"
    );
  }

  db.exec("CREATE INDEX IF NOT EXISTS idx_posts_source_type ON posts(source_type);");
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_posts_historical_event_id ON posts(historical_event_id);"
  );
}

function migrateAgoraThreadsIpAddress(db: Database.Database): void {
  const columns = db
    .prepare("PRAGMA table_info(agora_threads)")
    .all() as { name: string }[];

  const hasIpAddress = columns.some((c) => c.name === "ip_address");
  if (hasIpAddress) return;

  try {
    db.exec("ALTER TABLE agora_threads ADD COLUMN ip_address TEXT;");
  } catch (err) {
    if (err instanceof Error && err.message.includes("duplicate column")) return;
    throw err;
  }
}

function migratePhilosophersIsActive(db: Database.Database): void {
  const tableInfo = db.prepare("PRAGMA table_info(philosophers)").all() as { name: string }[];
  const hasColumn = tableInfo.some((col) => col.name === "is_active");
  if (hasColumn) return;

  db.exec("ALTER TABLE philosophers ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1");
}

function migrateScoringConfig(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scoring_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const upsert = db.prepare(
    `INSERT OR IGNORE INTO scoring_config (key, value)
     VALUES (?, ?)`
  );

  for (const [key, value] of Object.entries(DEFAULT_SCORING_CONFIG_VALUES)) {
    upsert.run(key, value);
  }

  migrateScoringStanceGuidanceV2(db);
}

function migrateHistoricalEventThumbnails(db: Database.Database): void {
  const columns = db
    .prepare("PRAGMA table_info(historical_events)")
    .all() as Array<{ name: string }>;
  const hasThumbnailFilename = columns.some((column) => column.name === "thumbnail_filename");

  if (!hasThumbnailFilename) {
    db.exec("ALTER TABLE historical_events ADD COLUMN thumbnail_filename TEXT DEFAULT NULL");
  }

  db.prepare(
    `INSERT OR IGNORE INTO scoring_config (key, value)
     VALUES ('image_generation_model', '"gemini-3.1-flash-image-preview"')`
  ).run();
}

function migrateContentTemplates(db: Database.Database): void {
  db.exec(`
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

    CREATE TABLE IF NOT EXISTS house_rules (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      version         INTEGER NOT NULL DEFAULT 1,
      rules_text      TEXT NOT NULL,
      is_active       INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      notes           TEXT NOT NULL DEFAULT ''
    );
  `);
}

function migrateScoringStanceGuidanceV2(db: Database.Database): void {
  const existing = db
    .prepare("SELECT value FROM scoring_config WHERE key = 'stance_guidance'")
    .get() as { value: string } | undefined;

  if (!existing) {
    db.prepare(
      `INSERT INTO scoring_config (key, value, updated_at)
       VALUES ('stance_guidance', ?, datetime('now'))`
    ).run(UPDATED_STANCE_GUIDANCE_VALUE);
    return;
  }

  if (existing.value !== DEFAULT_SCORING_CONFIG_VALUES.stance_guidance) {
    return;
  }

  db.prepare(
    `UPDATE scoring_config
     SET value = ?, updated_at = datetime('now')
     WHERE key = 'stance_guidance'`
  ).run(UPDATED_STANCE_GUIDANCE_VALUE);
}

function migrateBackfillReflectionSourceType(db: Database.Database): void {
  db.prepare(
    `UPDATE posts
     SET source_type = 'reflection'
     WHERE source_type = 'news'
       AND reply_to IS NULL
       AND citation_title IS NULL
       AND citation_source IS NULL
       AND citation_url IS NULL
       AND historical_event_id IS NULL`
  ).run();
}

// ── Test-only exports ──────────────────────────────────────────
// Used by db/migrations.test.ts to verify version tracking behavior

function migrateAgoraThreadsFailedStatus(db: Database.Database): void {
  const tableInfo = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='agora_threads'")
    .get() as { sql: string } | undefined;

  if (!tableInfo || tableInfo.sql.includes("failed")) return;

  const columns = db
    .prepare("PRAGMA table_info(agora_threads)")
    .all() as Array<{ name: string }>;
  const hasIpAddress = columns.some((column) => column.name === "ip_address");

  db.exec("PRAGMA foreign_keys = OFF;");

  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS agora_threads_new (
        id          TEXT PRIMARY KEY,
        question    TEXT NOT NULL,
        asked_by    TEXT NOT NULL DEFAULT 'Anonymous User',
        status      TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','complete','failed')),
        ip_address  TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    db.exec(`
      INSERT INTO agora_threads_new (id, question, asked_by, status, ip_address, created_at)
      SELECT
        id,
        question,
        asked_by,
        status,
        ${hasIpAddress ? "ip_address" : "NULL"},
        created_at
      FROM agora_threads;
    `);
    db.exec("DROP TABLE agora_threads;");
    db.exec("ALTER TABLE agora_threads_new RENAME TO agora_threads;");
  })();

  db.exec("PRAGMA foreign_keys = ON;");
}

function migrateAgoraQuestionCategorizationAndFlexibleSynthesis(
  db: Database.Database
): void {
  ensureAgoraThreadsQuestionMetadata(db);
  ensureAgoraSynthesisV2(db);
  migrateLegacyAgoraSynthesisRows(db);
  ensureAgoraResponseRecommendationColumn(db);
}

function ensureAgoraThreadsQuestionMetadata(db: Database.Database): void {
  const tableInfo = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='agora_threads'")
    .get() as { sql: string } | undefined;

  if (!tableInfo) return;

  const columns = db
    .prepare("PRAGMA table_info(agora_threads)")
    .all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));
  const hasQuestionType = columnNames.has("question_type");
  const hasRecommendationsEnabled = columnNames.has("recommendations_enabled");
  const hasIpAddress = columnNames.has("ip_address");
  const hasQuestionTypeCheck = tableInfo.sql.includes("question_type IN ('advice', 'conceptual', 'debate')");
  const hasRecommendationsCheck = tableInfo.sql.includes(
    "recommendations_enabled IN (0, 1)"
  );

  if (
    hasQuestionType &&
    hasRecommendationsEnabled &&
    hasIpAddress &&
    hasQuestionTypeCheck &&
    hasRecommendationsCheck
  ) {
    return;
  }

  db.exec("PRAGMA foreign_keys = OFF;");

  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS agora_threads_new (
        id                      TEXT PRIMARY KEY,
        question                TEXT NOT NULL,
        asked_by                TEXT NOT NULL DEFAULT 'Anonymous User',
        status                  TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','complete','failed')),
        ip_address              TEXT,
        question_type           TEXT NOT NULL DEFAULT 'advice'
                                  CHECK(question_type IN ('advice', 'conceptual', 'debate')),
        recommendations_enabled INTEGER NOT NULL DEFAULT 0
                                  CHECK(recommendations_enabled IN (0, 1)),
        created_at              TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    db.exec(`
      INSERT INTO agora_threads_new (
        id,
        question,
        asked_by,
        status,
        ip_address,
        question_type,
        recommendations_enabled,
        created_at
      )
      SELECT
        id,
        question,
        asked_by,
        status,
        ${hasIpAddress ? "ip_address" : "NULL"},
        ${hasQuestionType ? "COALESCE(question_type, 'advice')" : "'advice'"},
        ${hasRecommendationsEnabled ? "COALESCE(recommendations_enabled, 0)" : "0"},
        created_at
      FROM agora_threads;
    `);

    db.exec("DROP TABLE agora_threads;");
    db.exec("ALTER TABLE agora_threads_new RENAME TO agora_threads;");
  })();

  db.exec("PRAGMA foreign_keys = ON;");
}

function ensureAgoraSynthesisV2(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agora_synthesis_v2 (
      thread_id        TEXT PRIMARY KEY REFERENCES agora_threads(id) ON DELETE CASCADE,
      synthesis_type   TEXT NOT NULL DEFAULT 'advice'
                         CHECK(synthesis_type IN ('advice', 'conceptual', 'debate')),
      sections         TEXT NOT NULL DEFAULT '{}',
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function migrateLegacyAgoraSynthesisRows(db: Database.Database): void {
  const legacyTable = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='agora_synthesis'")
    .get();

  if (!legacyTable) return;

  const existingRows = db.prepare(
    "SELECT thread_id, tensions, agreements, practical_takeaways FROM agora_synthesis"
  ).all() as Array<{
    thread_id: string;
    tensions: string | null;
    agreements: string | null;
    practical_takeaways: string | null;
  }>;

  const insertV2 = db.prepare(
    `INSERT OR IGNORE INTO agora_synthesis_v2 (thread_id, synthesis_type, sections)
     VALUES (?, 'advice', ?)`
  );

  for (const row of existingRows) {
    const sections = JSON.stringify({
      tensions: safeJsonArray(row.tensions),
      agreements: safeJsonArray(row.agreements),
      practicalTakeaways: safeJsonArray(row.practical_takeaways),
    });
    insertV2.run(row.thread_id, sections);
  }
}

function ensureAgoraResponseRecommendationColumn(db: Database.Database): void {
  const columns = db
    .prepare("PRAGMA table_info(agora_responses)")
    .all() as Array<{ name: string }>;

  if (columns.some((column) => column.name === "recommendation")) return;

  db.exec("ALTER TABLE agora_responses ADD COLUMN recommendation TEXT DEFAULT NULL");
}

function migrateAgoraArticleSubmissionFields(db: Database.Database): void {
  const columns = db
    .prepare("PRAGMA table_info(agora_threads)")
    .all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("article_url")) {
    db.exec("ALTER TABLE agora_threads ADD COLUMN article_url TEXT DEFAULT NULL");
  }

  if (!columnNames.has("article_title")) {
    db.exec("ALTER TABLE agora_threads ADD COLUMN article_title TEXT DEFAULT NULL");
  }

  if (!columnNames.has("article_source")) {
    db.exec("ALTER TABLE agora_threads ADD COLUMN article_source TEXT DEFAULT NULL");
  }

  if (!columnNames.has("article_excerpt")) {
    db.exec("ALTER TABLE agora_threads ADD COLUMN article_excerpt TEXT DEFAULT NULL");
  }
}

function migrateAgoraThreadVisibilityAndUserOwnership(db: Database.Database): void {
  const columns = db
    .prepare("PRAGMA table_info(agora_threads)")
    .all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("visibility")) {
    db.exec("ALTER TABLE agora_threads ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'");
  }

  if (!columnNames.has("user_id")) {
    db.exec("ALTER TABLE agora_threads ADD COLUMN user_id TEXT DEFAULT NULL");
  }
}

function safeJsonArray(value: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export { getSchemaVersion, setSchemaVersion, ensureMetaTable, MIGRATIONS };
export type { Migration, MigrationOptions };

