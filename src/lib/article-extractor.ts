import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

const ARTICLE_FETCH_TIMEOUT_MS = 10_000;
const MAX_ARTICLE_CONTENT_CHARS = 5_000;
const ARTICLE_EXCERPT_CHARS = 200;
const MIN_ARTICLE_TEXT_CHARS = 100;
const ARTICLE_USER_AGENT = "Mozilla/5.0 (compatible; Philagora/1.0)";

export interface ExtractedArticle {
  success: true;
  title: string;
  content: string;
  excerpt: string;
  source: string;
}

export interface ExtractionError {
  success: false;
  error: string;
}

export type ExtractionResult = ExtractedArticle | ExtractionError;

export function normalizeArticleUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    const parsedUrl = new URL(value.trim());
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return null;
    }

    return parsedUrl.toString();
  } catch {
    return null;
  }
}

export function getArticleSourceFromUrl(value: string | null | undefined): string | null {
  const normalizedUrl = normalizeArticleUrl(value);
  if (!normalizedUrl) return null;

  try {
    const parsedUrl = new URL(normalizedUrl);
    return parsedUrl.hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function buildExcerpt(text: string): string {
  if (text.length <= ARTICLE_EXCERPT_CHARS) {
    return text;
  }

  return `${text.slice(0, ARTICLE_EXCERPT_CHARS).replace(/\s+\S*$/, "").trim()}...`;
}

function cleanArticleText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export async function extractArticle(url: string): Promise<ExtractionResult> {
  const normalizedUrl = normalizeArticleUrl(url);
  if (!normalizedUrl) {
    return {
      success: false,
      error:
        "We couldn't read that link as a valid article URL. The philosophers will respond to your question without article context.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ARTICLE_FETCH_TIMEOUT_MS);
  let dom: JSDOM | null = null;

  try {
    const response = await fetch(normalizedUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": ARTICLE_USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
    });

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error:
            "We couldn't access the full article. The philosophers will respond to your question without article context. You can paste key excerpts directly in your question.",
        };
      }

      return {
        success: false,
        error:
          "We couldn't fetch that article right now. The philosophers will respond to your question without article context.",
      };
    }

    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      return {
        success: false,
        error:
          "This link doesn't appear to be a readable article page. The philosophers will respond to your question without article context.",
      };
    }

    const html = await response.text();
    dom = new JSDOM(html, { url: normalizedUrl });
    const article = new Readability(dom.window.document).parse();

    if (!article?.textContent) {
      return {
        success: false,
        error:
          "We couldn't access the full article. The philosophers will respond to your question without article context. You can paste key excerpts directly in your question.",
      };
    }

    const cleanText = cleanArticleText(article.textContent);
    if (cleanText.length < MIN_ARTICLE_TEXT_CHARS) {
      return {
        success: false,
        error:
          "We couldn't access the full article. The philosophers will respond to your question without article context. You can paste key excerpts directly in your question.",
      };
    }

    const source = getArticleSourceFromUrl(normalizedUrl) ?? new URL(normalizedUrl).hostname;
    const content =
      cleanText.length > MAX_ARTICLE_CONTENT_CHARS
        ? `${cleanText.slice(0, MAX_ARTICLE_CONTENT_CHARS).replace(/\s+\S*$/, "").trim()}...`
        : cleanText;

    return {
      success: true,
      title: article.title?.trim() || source,
      content,
      excerpt: buildExcerpt(cleanText),
      source,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: false,
        error:
          "We couldn't reach the article in time. The philosophers will respond to your question without article context.",
      };
    }

    return {
      success: false,
      error:
        "We couldn't fetch that article right now. The philosophers will respond to your question without article context.",
    };
  } finally {
    clearTimeout(timeout);
    dom?.window.close();
  }
}
