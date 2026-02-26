/**
 * News Scout Service — RSS feed fetching and philosophical scoring pipeline.
 *
 * fetchAllFeeds()   — Pull RSS feeds, deduplicate, store new article candidates.
 * scoreUnscored()   — Send unscored articles to Claude for philosophical scoring.
 */

import Anthropic from "@anthropic-ai/sdk";
import Parser from "rss-parser";
import { getDb } from "@/lib/db";

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

const SCORING_MODEL = "claude-haiku-4-5-20251001";
const SCORING_MAX_TOKENS = 1024;
const SCORING_TEMPERATURE = 0.3;

// ── Helpers ──────────────────────────────────────────────────────────

function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "placeholder_key_here") return null;
  return new Anthropic({ apiKey });
}

function parseJsonResponse(rawOutput: string): Record<string, unknown> {
  let cleaned = rawOutput.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
  }
  return JSON.parse(cleaned);
}

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

const SCORING_SYSTEM_PROMPT = `You are a content curator for Philagora, a social media platform where AI agents impersonate historical philosophers to debate current events. Your job is to evaluate whether a news article would produce rich, differentiated philosophical commentary.

The philosopher roster is: Nietzsche, Marcus Aurelius, Camus, Confucius, Kant, Bertrand Russell, Kierkegaard, Plato, Seneca, Carl Jung, Dostoevsky, Cicero.

Score each article on philosophical potential (0-100) based on:
1. Multi-framework applicability: Would 2+ philosophers have meaningfully DIFFERENT reactions?
2. Ethical/existential ambiguity: Does it sit at a fault line where reasonable frameworks disagree?
3. Concreteness + depth: Does it have specific details philosophers can grab onto, while implying bigger questions?
4. Stance diversity: Would it produce varied stances (challenges, defends, reframes, questions, warns, observes)?
5. Cross-domain resonance: Does it touch on timeless themes (freedom vs order, truth vs power, individual vs collective, duty vs desire)?

Articles scoring below 40 are not worth reacting to. 40-60 are decent. 60-80 are good. 80+ are excellent.

Reject (score 0) articles that are:
- Pure scores/results with no narrative depth
- Listicles or promotional content
- Too narrowly technical for philosophical engagement
- Breaking news with no substance yet (just "X happened")

RESPOND WITH VALID JSON ONLY — no markdown, no code fences:
{
  "score": 75,
  "reasoning": "Brief explanation of why this score",
  "suggested_philosophers": ["nietzsche", "kant", "confucius"],
  "suggested_stances": { "nietzsche": "challenges", "kant": "questions", "confucius": "reframes" },
  "primary_tensions": ["freedom_vs_order", "individual_vs_collective"],
  "philosophical_entry_point": "One sentence describing the key philosophical angle"
}`;

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
        model: SCORING_MODEL,
        max_tokens: SCORING_MAX_TOKENS,
        temperature: SCORING_TEMPERATURE,
        system: SCORING_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });

      const rawOutput = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");

      const parsed = parseJsonResponse(rawOutput) as unknown as ScoreResponse;

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
        parsed.score ?? 0,
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
