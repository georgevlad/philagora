import { NextRequest, NextResponse } from "next/server";
import {
  createMessage,
  getAnthropicClient,
} from "@/lib/anthropic-utils";
import { getDb } from "@/lib/db";
import type { HistoricalEventRow, PhilosopherRow } from "@/lib/db-types";
import {
  formatHistoricalDisplayDate,
  isHistoricalEventCategory,
  isHistoricalEventEra,
  isHistoricalEventStatus,
  mapHistoricalEventRow,
  normalizeHistoricalThemes,
  parseHistoricalThemes,
} from "@/lib/historical-events";
import { DEFAULT_GENERATION_MODEL, parseGenerationModel } from "@/lib/scoring-config";

function coerceInteger(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
}

function parseAnthropicJson(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .replace(/,\s*([}\]])/g, "$1");

  return JSON.parse(cleaned);
}

function extractTextContent(response: { content: Array<{ type: string; text?: string }> }) {
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");
}

function getGenerationModel() {
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM scoring_config WHERE key = 'generation_model'")
    .get() as { value: string } | undefined;

  return parseGenerationModel(row?.value ?? JSON.stringify(DEFAULT_GENERATION_MODEL));
}

function isValidMonth(month: number) {
  return Number.isInteger(month) && month >= 1 && month <= 12;
}

function isValidDay(day: number) {
  return Number.isInteger(day) && day >= 1 && day <= 31;
}

function loadHistoricalEvent(eventId: string) {
  const db = getDb();
  return db
    .prepare(
      `SELECT he.*, COUNT(p.id) AS posts_count
       FROM historical_events he
       LEFT JOIN posts p ON p.historical_event_id = he.id
       WHERE he.id = ?
       GROUP BY he.id`
    )
    .get(eventId) as HistoricalEventRow | undefined;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const db = getDb();
    const event = loadHistoricalEvent(id);

    if (!event) {
      return NextResponse.json({ error: "Historical event not found" }, { status: 404 });
    }

    const posts = db
      .prepare(
        `SELECT
           p.id AS post_id,
           p.philosopher_id,
           p.status,
           p.stance,
           p.created_at,
           ph.name AS philosopher_name,
           ph.initials AS philosopher_initials,
           ph.color AS philosopher_color
         FROM posts p
         JOIN philosophers ph ON ph.id = p.philosopher_id
         WHERE p.historical_event_id = ?
         ORDER BY p.created_at DESC`
      )
      .all(id) as Array<{
      post_id: string;
      philosopher_id: string;
      philosopher_name: string;
      philosopher_initials: string;
      philosopher_color: string;
      status: string;
      stance: string;
      created_at: string;
    }>;

    return NextResponse.json({
      event: {
        ...mapHistoricalEventRow(event),
        posts: posts.map((post) => ({
          postId: post.post_id,
          philosopherId: post.philosopher_id,
          philosopherName: post.philosopher_name,
          philosopherInitials: post.philosopher_initials,
          philosopherColor: post.philosopher_color,
          status: post.status,
          stance: post.stance,
          createdAt: post.created_at,
        })),
      },
    });
  } catch (error) {
    console.error("Failed to fetch historical event:", error);
    return NextResponse.json(
      { error: "Failed to fetch historical event" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const db = getDb();
    const body = (await request.json()) as Record<string, unknown>;
    const event = loadHistoricalEvent(id);

    if (!event) {
      return NextResponse.json({ error: "Historical event not found" }, { status: 404 });
    }

    if (body.action === "suggest_philosophers") {
      const client = getAnthropicClient();
      if (!client) {
        return NextResponse.json(
          { error: "ANTHROPIC_API_KEY is not configured." },
          { status: 503 }
        );
      }

      const philosophers = db
        .prepare(
          `SELECT id, name, tradition, core_principles
           FROM philosophers
           WHERE COALESCE(is_active, 1) = 1
           ORDER BY name ASC`
        )
        .all() as PhilosopherRow[];

      if (philosophers.length === 0) {
        return NextResponse.json({ suggestions: [] });
      }

      const philosopherList = philosophers
        .map((philosopher) => {
          let principles = "";

          try {
            const parsed = JSON.parse(philosopher.core_principles ?? "[]") as Array<{
              title: string;
              description: string;
            }>;
            principles = parsed
              .map((item) => `${item.title}: ${item.description}`)
              .join("; ");
          } catch {
            principles = "";
          }

          return `- ${philosopher.id} | ${philosopher.name} | ${philosopher.tradition}${
            principles ? ` | ${principles}` : ""
          }`;
        })
        .join("\n");

      const prompt = `Given this historical event and its themes, rank the following philosophers by how interesting and distinctive their reaction would be. Consider each philosopher's core framework and how it applies to the event's themes.

EVENT: ${event.title}
CONTEXT: ${event.context}
KEY THEMES: ${parseHistoricalThemes(event.key_themes).join(", ")}

PHILOSOPHERS:
${philosopherList}

Return a JSON array of objects: [{"id": "philosopher_id", "score": 1-100, "angle": "Brief description of their likely angle"}]
Order by score descending.`;

      const response = await createMessage(
        client,
        {
          model: getGenerationModel(),
          max_tokens: 2048,
          temperature: 0.4,
          system:
            "You are a literary editor ranking philosophers for distinctive historical commentary. Return valid JSON only.",
          messages: [{ role: "user", content: prompt }],
        },
        "historical-events"
      );

      const rawOutput = extractTextContent(response);
      const parsed = parseAnthropicJson(rawOutput);

      if (!Array.isArray(parsed)) {
        return NextResponse.json(
          { error: "Model response was not a JSON array.", raw_output: rawOutput },
          { status: 422 }
        );
      }

      const validIds = new Set(philosophers.map((philosopher) => philosopher.id));
      const suggestions = parsed
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item) => ({
          id: typeof item.id === "string" ? item.id : "",
          score: clamp(coerceInteger(item.score as string | number | null | undefined) ?? 0, 1, 100),
          angle: typeof item.angle === "string" ? item.angle.trim() : "",
        }))
        .filter((item) => item.id && validIds.has(item.id))
        .sort((left, right) => right.score - left.score);

      return NextResponse.json({ suggestions });
    }

    const nextTitle =
      typeof body.title === "string" && body.title.trim() ? body.title.trim() : event.title;
    const nextMonth =
      body.event_month === undefined
        ? event.event_month
        : coerceInteger(body.event_month as string | number | null | undefined);
    const nextDay =
      body.event_day === undefined
        ? event.event_day
        : coerceInteger(body.event_day as string | number | null | undefined);
    const nextYear =
      body.event_year === undefined
        ? event.event_year
        : body.event_year === null
        ? null
        : coerceInteger(body.event_year as string | number | null | undefined);
    const nextContext =
      typeof body.context === "string" && body.context.trim()
        ? body.context.trim()
        : event.context;
    const nextEra =
      body.era === undefined
        ? event.era
        : isHistoricalEventEra(String(body.era))
        ? String(body.era)
        : null;
    const nextCategory =
      body.category === undefined
        ? event.category
        : isHistoricalEventCategory(String(body.category))
        ? String(body.category)
        : null;
    const nextStatus =
      body.status === undefined
        ? event.status
        : isHistoricalEventStatus(String(body.status))
        ? String(body.status)
        : null;
    const nextThemes =
      body.key_themes === undefined
        ? parseHistoricalThemes(event.key_themes)
        : normalizeHistoricalThemes(body.key_themes);

    if (nextMonth === null || !isValidMonth(nextMonth)) {
      return NextResponse.json({ error: "event_month must be between 1 and 12" }, { status: 400 });
    }
    if (nextDay === null || !isValidDay(nextDay)) {
      return NextResponse.json({ error: "event_day must be between 1 and 31" }, { status: 400 });
    }
    if (body.era !== undefined && nextEra === null) {
      return NextResponse.json({ error: "Invalid era value" }, { status: 400 });
    }
    if (body.category !== undefined && nextCategory === null) {
      return NextResponse.json({ error: "Invalid category value" }, { status: 400 });
    }
    if (body.status !== undefined && nextStatus === null) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }
    if (!nextTitle) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (!nextContext) {
      return NextResponse.json({ error: "context is required" }, { status: 400 });
    }

    const nextDisplayDate =
      typeof body.display_date === "string" && body.display_date.trim()
        ? body.display_date.trim()
        : formatHistoricalDisplayDate({
            month: nextMonth,
            day: nextDay,
            year: nextYear ?? null,
          });

    db.prepare(
      `UPDATE historical_events
       SET title = ?, event_month = ?, event_day = ?, event_year = ?, display_date = ?,
           era = ?, category = ?, context = ?, key_themes = ?, status = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      nextTitle,
      nextMonth,
      nextDay,
      nextYear,
      nextDisplayDate,
      nextEra ?? event.era,
      nextCategory ?? event.category,
      nextContext,
      JSON.stringify(nextThemes),
      nextStatus ?? event.status,
      id
    );

    const updated = loadHistoricalEvent(id);

    return NextResponse.json({
      event: updated ? mapHistoricalEventRow(updated) : null,
    });
  } catch (error) {
    console.error("Failed to update historical event:", error);
    return NextResponse.json(
      { error: "Failed to update historical event" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const db = getDb();
    const event = db
      .prepare("SELECT id FROM historical_events WHERE id = ?")
      .get(id) as { id: string } | undefined;

    if (!event) {
      return NextResponse.json({ error: "Historical event not found" }, { status: 404 });
    }

    const usage = db
      .prepare("SELECT COUNT(*) AS count FROM posts WHERE historical_event_id = ?")
      .get(id) as { count: number };

    if (usage.count > 0) {
      return NextResponse.json(
        { error: "Cannot delete an event that already has generated posts." },
        { status: 409 }
      );
    }

    db.prepare("DELETE FROM historical_events WHERE id = ?").run(id);

    return NextResponse.json({ deleted: id });
  } catch (error) {
    console.error("Failed to delete historical event:", error);
    return NextResponse.json(
      { error: "Failed to delete historical event" },
      { status: 500 }
    );
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
