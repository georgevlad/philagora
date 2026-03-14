import type Database from "better-sqlite3";
import { DEFAULT_SCORING_CONFIG_VALUES } from "../src/lib/scoring-config";

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

export function runMigrations(
  db: Database.Database,
  options: { bootstrapNewsSources?: boolean } = {}
): void {
  migrateNewsScout(db, options);
  migrateNewsSourceLogos(db);
  migrateArticleCandidatesTopicCluster(db);
  migrateAgoraThreadsIpAddress(db);
  migratePhilosophersIsActive(db);
  migrateScoringConfig(db);
  migrateContentTemplates(db);

  try {
    migratePostsSchema(db);
  } catch (err) {
    if (!(err instanceof Error && err.message.includes("SQLITE_ERROR"))) throw err;
  }

  const tableInfo = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='generation_log'")
    .get() as { sql: string } | undefined;

  if (!tableInfo) return;

  const needsMigration =
    tableInfo.sql.includes("NOT NULL REFERENCES philosophers") ||
    !tableInfo.sql.includes("synthesis");

  if (!needsMigration) return;

  try {
    db.exec("PRAGMA foreign_keys = OFF;");

    db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS generation_log_new (
          id               INTEGER PRIMARY KEY AUTOINCREMENT,
          philosopher_id   TEXT REFERENCES philosophers(id),
          content_type     TEXT NOT NULL CHECK(content_type IN ('post','debate_opening','debate_rebuttal','agora_response','reflection','synthesis')),
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

function migrateNewsScout(
  db: Database.Database,
  options: { bootstrapNewsSources?: boolean }
): void {
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

  const hasArchivedStatus = tableInfo.sql.includes("archived");
  const hasExpandedStances =
    tableInfo.sql.includes("diagnoses") &&
    tableInfo.sql.includes("provokes") &&
    tableInfo.sql.includes("laments") &&
    tableInfo.sql.includes("quips") &&
    tableInfo.sql.includes("mocks");

  if (hasArchivedStatus && hasExpandedStances) return;

  db.exec("PRAGMA foreign_keys = OFF;");

  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS posts_new (
        id              TEXT PRIMARY KEY,
        philosopher_id  TEXT NOT NULL REFERENCES philosophers(id),
        content         TEXT NOT NULL,
        thesis          TEXT NOT NULL DEFAULT '',
        stance          TEXT NOT NULL CHECK(stance IN ('challenges','defends','reframes','questions','warns','observes','diagnoses','provokes','laments','quips','mocks')),
        tag             TEXT NOT NULL DEFAULT '',
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

    db.exec("INSERT INTO posts_new SELECT * FROM posts;");
    db.exec("DROP TABLE posts;");
    db.exec("ALTER TABLE posts_new RENAME TO posts;");
    db.exec("CREATE INDEX IF NOT EXISTS idx_posts_philosopher ON posts(philosopher_id);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_posts_tag ON posts(tag);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_posts_reply_to ON posts(reply_to);");
  })();

  db.exec("PRAGMA foreign_keys = ON;");
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
