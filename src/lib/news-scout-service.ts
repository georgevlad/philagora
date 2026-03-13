/**
 * News Scout Service — RSS feed fetching and philosophical scoring pipeline.
 *
 * fetchAllFeeds()   — Pull RSS feeds, deduplicate, store new article candidates.
 * scoreUnscored()   — Send unscored articles to Claude for philosophical scoring.
 */

import type Anthropic from "@anthropic-ai/sdk";
import Parser from "rss-parser";
import { getDb } from "@/lib/db";
import { getAnthropicClient, parseJsonResponse } from "@/lib/anthropic-utils";
import {
  DEFAULT_SCORING_MODEL,
  DEFAULT_SCORING_CONFIG_VALUES,
  parseScoringModel,
  DEFAULT_SCORE_TIERS,
  parseScoreTiers,
  parseStanceGuidance,
  parseTensionVocabulary,
} from "@/lib/scoring-config";

// ── Types ────────────────────────────────────────────────────────────

export interface NewsSource {
  id: string;
  name: string;
  feed_url: string;
  category: string;
  is_active: number;
  last_fetched_at: string | null;
  created_at: string;
}

export interface ArticleCandidate {
  id: string;
  source_id: string;
  title: string;
  url: string;
  description: string;
  pub_date: string | null;
  score: number | null;
  score_reasoning: string | null;
  suggested_philosophers: string; // JSON array
  suggested_stances: string; // JSON object
  primary_tensions: string; // JSON array
  philosophical_entry_point: string | null;
  image_url: string | null;
  status: "new" | "scored" | "approved" | "dismissed" | "used";
  fetched_at: string;
  scored_at: string | null;
  // joined fields
  source_name?: string;
  source_category?: string;
  source_logo_url?: string;
}

export interface FetchResult {
  sourcesChecked: number;
  newArticles: number;
  errors: string[];
}

export interface ScoreResult {
  scored: number;
  errors: string[];
}

interface ScoreResponse {
  score: number;
  reasoning: string;
  suggested_philosophers: string[];
  suggested_stances: Record<string, string>;
  primary_tensions: string[];
  philosophical_entry_point: string;
}

// ── Configuration ────────────────────────────────────────────────────

const SCORING_MODEL = DEFAULT_SCORING_MODEL;
const SCORING_MAX_TOKENS = 1024;
const SCORING_TEMPERATURE = 0.5;

/**
 * Fetch the og:image meta tag from an article's HTML page.
 * Used to enrich articles that lack an image from RSS.
 */
export async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Philagora/1.0)",
      },
    });

    clearTimeout(timeout);

    if (!res.ok) return null;

    // Read only enough to get the <head> section (~20KB)
    const text = await res.text();
    const head = text.substring(0, 20000);

    // Try property before content: <meta property="og:image" content="...">
    let match = head.match(
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
    );

    // Try content before property: <meta content="..." property="og:image">
    if (!match) {
      match = head.match(
        /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i
      );
    }

    if (!match?.[1]) return null;

    let imageUrl = match[1].trim();

    // Handle protocol-relative URLs
    if (imageUrl.startsWith("//")) {
      imageUrl = "https:" + imageUrl;
    }

    return imageUrl;
  } catch {
    return null;
  }
}

/**
 * Extract a thumbnail/image URL from an RSS feed item.
 * Tries multiple common locations in priority order.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractImageUrl(item: any): string | null {
  // 1. media:thumbnail (BBC, Guardian)
  const mediaThumbnail = item.mediaThumbnail;
  if (mediaThumbnail) {
    const url = typeof mediaThumbnail === "string" ? mediaThumbnail : mediaThumbnail?.$?.url;
    if (url) return url;
  }

  // 2. media:content with image type
  const mediaContent = item.mediaContent;
  if (mediaContent) {
    const attrs = mediaContent.$ || mediaContent;
    if (attrs?.url) {
      const medium = attrs.medium || "";
      const type = attrs.type || "";
      if (
        medium === "image" ||
        type.startsWith("image/") ||
        /\.(jpg|jpeg|png|webp|gif)/i.test(attrs.url)
      ) {
        return attrs.url;
      }
    }
  }

  // 3. enclosure with image type
  const enclosure = item.enclosure;
  if (enclosure?.url && enclosure.type?.startsWith("image/")) {
    return enclosure.url;
  }

  // 4. Extract first <img> from content
  const htmlContent = item["content:encoded"] || item.content || "";
  if (typeof htmlContent === "string") {
    const imgMatch = htmlContent.match(/<img[^>]+src="([^"]+)"/);
    if (imgMatch?.[1]) return imgMatch[1];
  }

  return null;
}

// ── RSS Parser setup ─────────────────────────────────────────────────

type CustomFeed = Record<string, unknown>;
type CustomItem = {
  mediaThumbnail?: { $?: { url?: string } } | string;
  mediaContent?: { $?: { url?: string; medium?: string; type?: string } };
  [key: string]: unknown;
};

const rssParser = new Parser<CustomFeed, CustomItem>({
  timeout: 10000,
  customFields: {
    item: [
      ["media:thumbnail", "mediaThumbnail", { keepArray: false }],
      ["media:content", "mediaContent", { keepArray: false }],
    ],
  },
});

// ── Scoring Prompt ───────────────────────────────────────────────────

function getScoringConfig(): {
  scoreTiers: string;
  tensionVocabulary: string;
  stanceGuidance: string;
} {
  const db = getDb();
  const getConfig = (key: keyof typeof DEFAULT_SCORING_CONFIG_VALUES, fallback: string) => {
    const row = db.prepare("SELECT value FROM scoring_config WHERE key = ?").get(key) as { value: string } | undefined;
    return row?.value ?? fallback;
  };

  const tiers = parseScoreTiers(
    getConfig("score_tiers", DEFAULT_SCORING_CONFIG_VALUES.score_tiers)
  );
  const tensions = parseTensionVocabulary(
    getConfig("tension_vocabulary", DEFAULT_SCORING_CONFIG_VALUES.tension_vocabulary)
  );
  const stanceConfig = parseStanceGuidance(
    getConfig("stance_guidance", DEFAULT_SCORING_CONFIG_VALUES.stance_guidance)
  );

  const tierOrder = Object.keys(DEFAULT_SCORE_TIERS).filter(
    (key) => key !== "reject"
  ) as Array<Exclude<keyof typeof DEFAULT_SCORE_TIERS, "reject">>;

  const tierText = tierOrder
    .map((key) => {
      const tier = tiers[key];
      return `- ${tier.min}-${tier.max}: ${tier.label} — ${tier.description}`;
    })
    .join("\n");

  const tensionText = tensions
    .map((tension) => `- ${tension.id}: ${tension.description}`)
    .join("\n");

  const stanceText = stanceConfig.guidance_text || "";

  return {
    scoreTiers: tierText,
    tensionVocabulary: tensionText,
    stanceGuidance: stanceText,
  };
}

const SCORING_PROMPT_TEMPLATE = `You are a content curator for Philagora, a social media platform where AI agents impersonate historical philosophers to debate current events. Your job is to evaluate whether a news article would produce rich, differentiated philosophical commentary.

The philosopher roster (14 thinkers):
- nietzsche (FN) — will to power, eternal recurrence, master/slave morality, amor fati
- marcus-aurelius (MA) — Stoic duty, impermanence, inner citadel, cosmic perspective
- camus (AC) — absurdism, revolt, solidarity in suffering, Mediterranean thought
- confucius (CK) — ritual propriety (li), filial duty, rectification of names, harmony
- kant (IK) — categorical imperative, duty, autonomy, dignity as end-in-itself
- russell (BR) — empiricism, logical analysis, skepticism of authority, pacifism
- kierkegaard (SK) — anxiety, leap of faith, aesthetic/ethical/religious stages, despair
- plato (PL) — forms vs appearances, philosopher-kings, justice as harmony, the cave
- seneca (LS) — Stoic practice, wealth and virtue, exile, shortness of life, emotional mastery
- jung (CJ) — shadow, collective unconscious, archetypes, individuation, psyche of nations
- dostoevsky (FD) — suffering as knowledge, underground psychology, faith vs nihilism
- cicero (CI) — natural law, republican duty, institutional legitimacy, oratory
- hannah-arendt (HA) — banality of evil, totalitarianism, public vs private sphere, natality, political action
- simone-de-beauvoir (SB) — situated freedom, ethics of ambiguity, gender as construct, reciprocal recognition

## SCORING CRITERIA (0-100)

1. **Multi-framework friction**: Would 2+ philosophers have genuinely OPPOSED reactions — not just different emphases, but real disagreement? (weight: high)
2. **Ethical/existential ambiguity**: Does it sit at a fault line where reasonable frameworks disagree? Is there a genuine dilemma, not just a clear villain?
3. **Concreteness + depth**: Does it have specific details philosophers can grab onto (names, numbers, decisions, consequences), while implying bigger questions?
4. **Stance friction potential**: Would it produce genuinely varied stances? Prioritize articles where "challenges" vs "defends" is possible — not just articles where everyone "warns" or "questions" from different angles. Two philosophers in genuine tension > four philosophers who loosely agree.
5. **Cross-domain resonance**: Does it connect to timeless themes? (See TENSION VOCABULARY below.)

## SCORE TIERS

{{SCORE_TIERS}}

## SCORING PRECISION

Score to ODD or PRIME numbers when possible. Do NOT default to round numbers or multiples of 5.
- BAD scores: 50, 55, 60, 65, 70, 72, 75, 80 (these indicate lazy bucketing)
- GOOD scores: 47, 53, 58, 63, 67, 71, 73, 77, 79, 81, 83, 86
Think: "Is this a 71 or a 74?" not "Is this roughly a 70?"

Each article is unique. Two articles that are both "good" should NOT get the same score. If you would give two articles the same number, one of them is slightly better — find the difference.

## CALIBRATION EXAMPLES

EXAMPLE 1 — Score: 83
Title: "EU votes to ban AI-generated faces in political advertising, US calls it censorship"
Why 83: Genuine framework collision — Kant's duty-based ethics supports the ban (truth as categorical imperative), while Russell's empiricism questions whether restricting speech ever serves truth. Nietzsche sees both sides as power plays. Concrete policy details + specific US/EU clash. Stances: Kant defends, Russell challenges, Nietzsche reframes.

EXAMPLE 2 — Score: 67
Title: "Japan's birth rate hits new low as young workers cite 'no point in family life'"
Why 67 (not higher): Strong existential angle — Camus on meaning-making, Confucius on filial duty, Kierkegaard on despair. But the philosophical tension is somewhat one-directional: most philosophers would express concern, differing only in diagnosis. Fewer genuinely opposed stances, more "agrees but for different reasons." That ceiling caps it below 70.

EXAMPLE 3 — Score: 41
Title: "New study finds Mediterranean diet reduces inflammation markers by 30%"
Why 41 (not higher): Seneca and Marcus Aurelius could discuss discipline and bodily care, but the article is primarily empirical/medical. Limited ethical ambiguity, limited framework collision. Only 2 philosophers would engage meaningfully, and they'd largely agree. Barely clears the "decent" threshold.

EXAMPLE 4 — Score: 0 (reject)
Title: "Champions League quarterfinal draw: Real Madrid vs Bayern Munich"
Why 0: Pure sports scheduling, no narrative depth, no philosophical hooks.

EXAMPLE 5 — Score: 0 (reject)
Title: "10 Best Noise-Canceling Headphones of 2026"
Why 0: Listicle/promotional content with no philosophical engagement surface.

## PHILOSOPHER DIVERSITY

Do NOT default to the same 4-5 philosophers for every article. Each thinker has a specific domain where they shine — reach for the right voice, not the most general one.

HIGH-USAGE (use these only when their specific framework is genuinely activated — not as defaults):
- Kant (IK), Nietzsche (FN), Russell (BR), Cicero (CI)

Constraint: Maximum 2 of these four per article.

UNDERUSED (actively consider these — at least one must appear per article):
- **Camus (AC)** — absurdity, revolt, meaning in meaninglessness, solidarity, Mediterranean thought
- **Jung (CJ)** — shadow projection, collective unconscious, archetypes, individuation, psyche of nations/cultures
- **Dostoevsky (FD)** — suffering as path to knowledge, underground psychology, faith vs nihilism, moral freedom through anguish
- **Plato (PL)** — forms vs appearances, philosopher-kings, justice as harmony, cave allegory, education of the soul
- **Confucius (CK)** — ritual propriety, filial piety, rectification of names, harmony, moral cultivation through practice
- **Kierkegaard (SK)** — anxiety, leap of faith, aesthetic vs ethical life, despair, authentic individual choice
- **Seneca (LS)** — practical Stoicism, wealth and virtue, emotional mastery, exile, shortness of life
- **Marcus Aurelius (MA)** — Stoic duty, cosmic perspective, impermanence, inner citadel, journal as practice
- **Hannah Arendt (HA)** — banality of evil, totalitarianism, the public sphere, political action, natality and new beginnings
- **Simone de Beauvoir (SB)** — situated freedom, ethics of ambiguity, gender as social construct, reciprocity, oppression as systemic

Use the EXACT IDs above (two-letter codes in parentheses) in your JSON output. Do not invent IDs.

## TENSION VOCABULARY (use ONLY these canonical labels)

{{TENSION_VOCABULARY}}

Always select 1-3 tensions from this list. Do not invent new labels.

## STANCE GUIDANCE

{{STANCE_GUIDANCE}}

## REJECT (score 0) articles that are:
- Pure scores/results/schedules with no narrative depth
- Listicles, rankings, or promotional content
- Too narrowly technical for philosophical engagement (pure code, pure medicine, pure sports stats)
- Breaking news with no substance yet (just "X happened" with no details, decisions, or consequences)
- Celebrity gossip or entertainment news with no ethical/existential dimension

## RESPONSE FORMAT

Suggest 2-5 philosophers (not always 3 — pick the number that genuinely fits).

RESPOND WITH VALID JSON ONLY — no markdown, no code fences:
{
  "score": 75,
  "reasoning": "Brief explanation of why this score, referencing which criteria drove it up or down",
  "suggested_philosophers": ["nietzsche", "kant"],
  "suggested_stances": { "nietzsche": "challenges", "kant": "defends" },
  "primary_tensions": ["freedom_vs_order"],
  "philosophical_entry_point": "One sentence describing the key philosophical angle"
}

Use ONLY these philosopher IDs: nietzsche, marcus-aurelius, camus, confucius, kant, russell, kierkegaard, plato, seneca, jung, dostoevsky, cicero, hannah-arendt, simone-de-beauvoir. Do not use any other IDs or abbreviations.`;

function buildScoringPrompt(): string {
  const { scoreTiers, tensionVocabulary, stanceGuidance } = getScoringConfig();

  return SCORING_PROMPT_TEMPLATE
    .replace("{{SCORE_TIERS}}", scoreTiers)
    .replace("{{TENSION_VOCABULARY}}", tensionVocabulary)
    .replace("{{STANCE_GUIDANCE}}", stanceGuidance);
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Fetch all active RSS feeds, deduplicate, and store new article candidates.
 */
export async function fetchAllFeeds(): Promise<FetchResult> {
  const db = getDb();
  const result: FetchResult = { sourcesChecked: 0, newArticles: 0, errors: [] };

  const sources = db
    .prepare("SELECT * FROM news_sources WHERE is_active = 1")
    .all() as NewsSource[];

  result.sourcesChecked = sources.length;

  for (const source of sources) {
    try {
      const feed = await rssParser.parseURL(source.feed_url);

      const insertArticle = db.prepare(`
        INSERT OR IGNORE INTO article_candidates
          (id, source_id, title, url, description, pub_date, image_url, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'new')
      `);

      let sourceNewCount = 0;

      for (const item of feed.items) {
        if (!item.link || !item.title) continue;

        // Deduplicate: INSERT OR IGNORE on the UNIQUE url constraint
        const articleId = `article-${Date.now()}-${sourceNewCount}`;
        const description =
          item.contentSnippet || item.content || item.summary || "";
        const pubDate = item.isoDate || item.pubDate || null;
        const imageUrl = extractImageUrl(item);

        const res = insertArticle.run(
          articleId,
          source.id,
          item.title.trim(),
          item.link.trim(),
          typeof description === "string" ? description.substring(0, 2000) : "",
          pubDate,
          imageUrl
        );

        if (res.changes > 0) sourceNewCount++;
      }

      result.newArticles += sourceNewCount;

      // Update last_fetched_at
      db.prepare(
        "UPDATE news_sources SET last_fetched_at = datetime('now') WHERE id = ?"
      ).run(source.id);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Unknown error";
      result.errors.push(`${source.name}: ${msg}`);
    }
  }

  return result;
}

/**
 * Score unscored article candidates using Claude API.
 */
export async function scoreUnscored(
  batchSize: number = 50
): Promise<ScoreResult> {
  const db = getDb();
  const result: ScoreResult = { scored: 0, errors: [] };
  const scoringPrompt = buildScoringPrompt();
  const modelConfig = db
    .prepare("SELECT value FROM scoring_config WHERE key = 'scoring_model'")
    .get() as { value: string } | undefined;
  const scoringModel = parseScoringModel(modelConfig?.value ?? JSON.stringify(SCORING_MODEL));

  const client = getAnthropicClient();
  if (!client) {
    result.errors.push("Anthropic API key not configured");
    return result;
  }

  // Count active sources to calculate per-source limit for diverse sampling
  const sourceCount = (
    db
      .prepare(
        `SELECT COUNT(DISTINCT ac.source_id) as cnt
         FROM article_candidates ac
         JOIN news_sources ns ON ac.source_id = ns.id
         WHERE ac.status = 'new' AND ns.is_active = 1`
      )
      .get() as { cnt: number }
  ).cnt;

  const perSourceLimit = sourceCount > 0 ? Math.ceil(batchSize / sourceCount) : batchSize;

  // Sample evenly across sources using a window function, picking the most
  // recent articles from each source rather than letting one prolific source
  // monopolize the batch.
  const articles = db
    .prepare(
      `WITH ranked AS (
         SELECT ac.*, ns.name as source_name, ns.category as source_category,
           ROW_NUMBER() OVER (PARTITION BY ac.source_id ORDER BY ac.pub_date DESC, ac.fetched_at DESC) as rn
         FROM article_candidates ac
         JOIN news_sources ns ON ac.source_id = ns.id
         WHERE ac.status = 'new'
       )
       SELECT * FROM ranked
       WHERE rn <= ?
       ORDER BY source_category, source_name, pub_date DESC`
    )
    .all(perSourceLimit) as (ArticleCandidate & { rn: number })[];

  for (const article of articles) {
    try {
      const userMessage = `ARTICLE TO EVALUATE:
Title: ${article.title}
Source: ${article.source_name}
Category: ${article.source_category}
Published: ${article.pub_date || "Unknown"}
Description:
${article.description}`;

      const response = await client.messages.create({
        model: scoringModel,
        max_tokens: SCORING_MAX_TOKENS,
        temperature: SCORING_TEMPERATURE,
        system: scoringPrompt,
        messages: [{ role: "user", content: userMessage }],
      });

      const rawOutput = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");

      const parsed = parseJsonResponse(rawOutput) as unknown as ScoreResponse;
      // Break LLM score clustering with ±2 jitter (clamped to 0-100)
      const rawScore = parsed.score ?? 0;
      const jitter = rawScore > 0 ? Math.floor(Math.random() * 5) - 2 : 0;
      const finalScore = Math.max(0, Math.min(100, rawScore + jitter));

      db.prepare(
        `UPDATE article_candidates
         SET score = ?,
             score_reasoning = ?,
             suggested_philosophers = ?,
             suggested_stances = ?,
             primary_tensions = ?,
             philosophical_entry_point = ?,
             status = 'scored',
             scored_at = datetime('now')
         WHERE id = ?`
      ).run(
        finalScore,
        parsed.reasoning ?? "",
        JSON.stringify(parsed.suggested_philosophers ?? []),
        JSON.stringify(parsed.suggested_stances ?? {}),
        JSON.stringify(parsed.primary_tensions ?? []),
        parsed.philosophical_entry_point ?? "",
        article.id
      );

      // Enrich with OG image if RSS didn't provide one
      if (!article.image_url) {
        const ogImage = await fetchOgImage(article.url);
        if (ogImage) {
          db.prepare(
            "UPDATE article_candidates SET image_url = ? WHERE id = ?"
          ).run(ogImage, article.id);
        }
      }

      result.scored++;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Unknown error";
      result.errors.push(`Scoring "${article.title}": ${msg}`);
    }
  }

  return result;
}
