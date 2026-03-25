import { NextRequest, NextResponse } from "next/server";
import { buildAgoraClassificationInput } from "@/lib/agora";
import {
  getArticleSourceFromUrl,
  normalizeArticleUrl,
} from "@/lib/article-extractor";
import {
  createMessage,
  getAnthropicClient,
  parseJsonResponse,
} from "@/lib/anthropic-utils";
import { getIdentityFromHeaders } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  classifyAgoraQuestion,
  type QuestionClassification,
} from "@/lib/generation-service";
import {
  DEFAULT_SCORING_MODEL,
  parseScoringModel,
} from "@/lib/scoring-config";

interface PhilosopherSuggestion {
  id: string;
  reason: string;
}

interface SuggestionResponse {
  classification: QuestionClassification;
  suggestions: PhilosopherSuggestion[];
}

interface PhilosopherRow {
  id: string;
  name: string;
  tradition: string;
}

const DAILY_SUGGEST_LIMIT = 10;
const suggestionAttempts = new Map<string, number>();

function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function cleanupExpiredSuggestionCounts(todayKey: string) {
  for (const key of suggestionAttempts.keys()) {
    if (!key.startsWith(`${todayKey}:`)) {
      suggestionAttempts.delete(key);
    }
  }
}

function normalizeSuggestions(
  rawSuggestions: unknown,
  validIds: Set<string>
): PhilosopherSuggestion[] {
  if (!Array.isArray(rawSuggestions)) {
    return [];
  }

  const suggestions: PhilosopherSuggestion[] = [];
  const seenIds = new Set<string>();

  for (const rawSuggestion of rawSuggestions) {
    if (!rawSuggestion || typeof rawSuggestion !== "object") {
      continue;
    }

    const id =
      typeof (rawSuggestion as { id?: unknown }).id === "string"
        ? (rawSuggestion as { id: string }).id.trim()
        : "";
    const reason =
      typeof (rawSuggestion as { reason?: unknown }).reason === "string"
        ? (rawSuggestion as { reason: string }).reason.trim()
        : "";

    if (!id || !reason || !validIds.has(id) || seenIds.has(id)) {
      continue;
    }

    suggestions.push({ id, reason });
    seenIds.add(id);

    if (suggestions.length >= 4) {
      break;
    }
  }

  return suggestions.length >= 2 ? suggestions : [];
}

function getSuggestionModel(): string {
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM scoring_config WHERE key = ?")
    .get("scoring_model") as { value: string } | undefined;

  return parseScoringModel(row?.value ?? JSON.stringify(DEFAULT_SCORING_MODEL));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const question = (body.question ?? "").trim();
    const rawArticleUrl = typeof body.article_url === "string" ? body.article_url.trim() : "";
    const articleExcerpt =
      typeof body.article_excerpt === "string" ? body.article_excerpt.trim() : "";

    if (question.length < 10 || question.length > 500) {
      return NextResponse.json(
        { error: "Question must be between 10 and 500 characters" },
        { status: 400 }
      );
    }

    const identity = await getIdentityFromHeaders(request);
    const isOwner =
      identity.type === "user" && identity.email === "george.vlad.utcn@gmail.com";

    if (!isOwner) {
      const todayKey = getTodayKey();
      const clientIp = getClientIp(request);

      cleanupExpiredSuggestionCounts(todayKey);

      const key = `${todayKey}:${clientIp}`;
      const count = suggestionAttempts.get(key) ?? 0;

      if (count >= DAILY_SUGGEST_LIMIT) {
        return NextResponse.json(
          { error: "The philosophers are resting. Check back tomorrow." },
          { status: 429 }
        );
      }

      suggestionAttempts.set(key, count + 1);
    }

    const normalizedArticleUrl = normalizeArticleUrl(rawArticleUrl);
    const articleSource = getArticleSourceFromUrl(normalizedArticleUrl);
    const classificationInput = buildAgoraClassificationInput(
      question,
      normalizedArticleUrl || articleSource || articleExcerpt
        ? {
            url: normalizedArticleUrl ?? rawArticleUrl ?? "",
            title: null,
            source: articleSource,
            excerpt: articleExcerpt || null,
          }
        : null
    );
    const classification = await classifyAgoraQuestion(classificationInput);

    const db = getDb();
    const philosophers = db
      .prepare(
        "SELECT id, name, tradition FROM philosophers WHERE is_active = 1 ORDER BY name"
      )
      .all() as PhilosopherRow[];

    const client = getAnthropicClient();
    if (!client) {
      const response: SuggestionResponse = {
        classification,
        suggestions: [],
      };
      return NextResponse.json(response);
    }

    const rosterList = philosophers
      .map((philosopher) => `- ${philosopher.id}: ${philosopher.name} (${philosopher.tradition})`)
      .join("\n");
    const systemPrompt = `You suggest philosophers for a question submitted to Philagora, a philosophy forum.

Given the user's question and the available philosopher roster, suggest 2-4 philosophers who would produce the most interesting, diverse, and genuinely useful responses.

PRIORITIZE:
- Genuine disagreement: don't suggest 3 thinkers from similar traditions. If you suggest a Stoic, pair them with an Existentialist or a Confucian.
- Framework relevance: the philosopher's tradition should actually speak to this topic, not just tangentially.
- At least one surprising but defensible pick alongside the obvious choices.
- For advice questions: prefer philosophers who give concrete, actionable guidance.
- For conceptual questions: prefer philosophers with deep, distinctive frameworks on the topic.
- For debate questions: prefer philosophers who would take genuinely opposing positions.

AVAILABLE PHILOSOPHERS:
${rosterList}

RESPOND WITH VALID JSON ONLY:
{
  "suggestions": [
    { "id": "philosopher-id", "reason": "One sentence explaining why this thinker is a great fit for THIS question (max 20 words, address the user directly with 'your')" }
  ]
}`;

    try {
      const userPrompt = [
        `Question: ${question}`,
        `Question type: ${classification.questionType}`,
        `Recommendations appropriate: ${classification.recommendationsAppropriate ? "yes" : "no"}`,
        classification.recommendationHint
          ? `Recommendation hint: ${classification.recommendationHint}`
          : null,
        articleSource ? `Article source: ${articleSource}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const response = await createMessage(
        client,
        {
          model: getSuggestionModel(),
          max_tokens: 512,
          temperature: 0.4,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        },
        "suggestion"
      );

      const rawOutput = response.content
        .filter((block) => block.type === "text")
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("");
      const parsed = parseJsonResponse(rawOutput) as {
        suggestions?: unknown;
      };
      const validSuggestions = normalizeSuggestions(
        parsed.suggestions,
        new Set(philosophers.map((philosopher) => philosopher.id))
      );
      const suggestionResponse: SuggestionResponse = {
        classification,
        suggestions: validSuggestions,
      };

      return NextResponse.json(suggestionResponse);
    } catch (error) {
      console.error("Philosopher suggestion failed:", error);

      const response: SuggestionResponse = {
        classification,
        suggestions: [],
      };

      return NextResponse.json(response);
    }
  } catch (error) {
    console.error("Suggest endpoint failed:", error);
    return NextResponse.json(
      { error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
