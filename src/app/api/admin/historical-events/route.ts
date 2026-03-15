import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, parseJsonValueResponse } from "@/lib/anthropic-utils";
import { getDb } from "@/lib/db";
import type { HistoricalEventRow } from "@/lib/db-types";
import {
  HISTORICAL_EVENT_CATEGORIES,
  HISTORICAL_EVENT_ERAS,
  HISTORICAL_EVENT_STATUSES,
  MONTH_NAMES,
  formatHistoricalDisplayDate,
  isHistoricalEventCategory,
  isHistoricalEventEra,
  isHistoricalEventStatus,
  mapHistoricalEventRow,
  normalizeHistoricalThemes,
} from "@/lib/historical-events";
import { DEFAULT_GENERATION_MODEL, parseGenerationModel } from "@/lib/scoring-config";

const DEFAULT_LIMIT = 50;
const DEFAULT_BATCH_COUNT = 15;
const MAX_LIMIT = 200;
const MAX_BATCH_COUNT = 30;
const EVENTS_PER_AI_BATCH = 6;
const BATCH_GENERATION_MAX_TOKENS = 8192;
const MAX_BATCH_GENERATION_ATTEMPTS = 10;

type CreateActionBody = {
  action: "create";
  title?: string;
  event_month?: number;
  event_day?: number;
  event_year?: number | null;
  display_date?: string;
  era?: string;
  category?: string;
  context?: string;
  key_themes?: unknown;
  status?: string;
};

type BatchActionBody = {
  action: "generate_batch";
  month?: number;
  count?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function coerceInteger(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
}

function isValidMonth(month: number): boolean {
  return Number.isInteger(month) && month >= 1 && month <= 12;
}

function isValidDay(day: number): boolean {
  return Number.isInteger(day) && day >= 1 && day <= 31;
}

function parseAnthropicJson(raw: string): unknown {
  const trimmed = raw.trim();

  try {
    return parseJsonValueResponse(trimmed);
  } catch (initialError) {
    const arrayStart = trimmed.indexOf("[");
    const arrayEnd = trimmed.lastIndexOf("]");

    if (arrayStart !== -1 && arrayEnd > arrayStart) {
      return parseJsonValueResponse(trimmed.slice(arrayStart, arrayEnd + 1));
    }

    throw initialError;
  }
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

function buildHistoricalEventPrompt(args: {
  month: number;
  count: number;
  excludedEventLabels: string[];
}): string {
  const exclusionBlock =
    args.excludedEventLabels.length > 0
      ? `\nAvoid duplicating events already covered for this month. Do not include:\n${args.excludedEventLabels
          .slice(0, 40)
          .map((label) => `- ${label}`)
          .join("\n")}\n`
      : "";

  return `You are a historian creating a curated list of historically significant events for the month of ${
    MONTH_NAMES[args.month - 1]
  }.

Generate exactly ${args.count} events spanning:
- All major eras (ancient through contemporary)
- Diverse civilizations and geographies (not just Western history)
- Varied categories: wars, revolutions, scientific discoveries, cultural shifts, political milestones, economic turning points, philosophical breakthroughs
${exclusionBlock}
For each event, provide:
- title: A clear, specific event name (e.g., "The Fall of Constantinople", not "Something happened in Turkey")
- event_day: The specific day of the month (1-31)
- event_year: The year (use negative numbers for BCE, e.g., -399 for 399 BCE)
- display_date: Human-readable date string (e.g., "29 May 1453" or "15 March 44 BCE")
- era: One of: ancient, medieval, early_modern, modern, contemporary
- category: One of: war_conflict, revolution, science_discovery, cultural_shift, political, economic, philosophical, other
- context: 2 concise paragraphs giving enough detail for a philosopher to react thoughtfully. Include: what happened, why it mattered, what the consequences were.
- key_themes: Array of 3-5 philosophical themes (e.g., ["power", "empire decline", "cultural preservation", "religious conflict"])

RESPOND WITH VALID JSON ONLY - a JSON array of event objects.`;
}

function buildEventSignature(input: {
  title: string;
  eventDay: number;
  eventYear: number | null;
}): string {
  return [
    input.title.trim().toLowerCase(),
    String(input.eventDay),
    input.eventYear === null ? "unknown" : String(input.eventYear),
  ].join("::");
}

function normalizeCreatedEvent(input: {
  title?: string;
  event_month?: number | null;
  event_day?: number | null;
  event_year?: number | null;
  display_date?: string;
  era?: string;
  category?: string;
  context?: string;
  key_themes?: unknown;
  status?: string;
}) {
  const title = input.title?.trim() ?? "";
  const eventMonth = input.event_month ?? null;
  const eventDay = input.event_day ?? null;
  const context = input.context?.trim() ?? "";

  if (!title) return { error: "title is required" as const };
  if (eventMonth === null || !isValidMonth(eventMonth)) {
    return { error: "event_month must be an integer between 1 and 12" as const };
  }
  if (eventDay === null || !isValidDay(eventDay)) {
    return { error: "event_day must be an integer between 1 and 31" as const };
  }
  if (!context) return { error: "context is required" as const };

  const eventYear =
    typeof input.event_year === "number" && Number.isInteger(input.event_year)
      ? input.event_year
      : input.event_year === null
      ? null
      : undefined;

  const era = isHistoricalEventEra(input.era ?? "") ? input.era : "modern";
  const category = isHistoricalEventCategory(input.category ?? "")
    ? input.category
    : "political";
  const status = isHistoricalEventStatus(input.status ?? "") ? input.status : "draft";
  const displayDate =
    input.display_date?.trim() ||
    formatHistoricalDisplayDate({
      month: eventMonth,
      day: eventDay,
      year: eventYear ?? null,
    });

  return {
    data: {
      title,
      eventMonth,
      eventDay,
      eventYear: eventYear ?? null,
      displayDate,
      era,
      category,
      context,
      keyThemes: normalizeHistoricalThemes(input.key_themes),
      status,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? "all";
    const month = coerceInteger(searchParams.get("month"));
    const era = searchParams.get("era");
    const category = searchParams.get("category");
    const limit = clamp(
      coerceInteger(searchParams.get("limit")) ?? DEFAULT_LIMIT,
      1,
      MAX_LIMIT
    );

    if (status !== "all" && !isHistoricalEventStatus(status)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }
    if (month !== null && !isValidMonth(month)) {
      return NextResponse.json({ error: "Invalid month filter" }, { status: 400 });
    }
    if (era && era !== "all" && !isHistoricalEventEra(era)) {
      return NextResponse.json({ error: "Invalid era filter" }, { status: 400 });
    }
    if (category && category !== "all" && !isHistoricalEventCategory(category)) {
      return NextResponse.json({ error: "Invalid category filter" }, { status: 400 });
    }

    let query = `
      SELECT
        he.*,
        COUNT(p.id) AS posts_count
      FROM historical_events he
      LEFT JOIN posts p ON p.historical_event_id = he.id
    `;
    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (status !== "all") {
      conditions.push("he.status = ?");
      params.push(status);
    }
    if (month !== null) {
      conditions.push("he.event_month = ?");
      params.push(month);
    }
    if (era && era !== "all") {
      conditions.push("he.era = ?");
      params.push(era);
    }
    if (category && category !== "all") {
      conditions.push("he.category = ?");
      params.push(category);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += `
      GROUP BY he.id
      ORDER BY he.event_month ASC, he.event_day ASC, COALESCE(he.event_year, 999999) ASC, he.title ASC
      LIMIT ?
    `;
    params.push(limit);

    const rows = db.prepare(query).all(...params) as HistoricalEventRow[];
    const statsRows = db
      .prepare(
        `SELECT status, COUNT(*) AS count
         FROM historical_events
         GROUP BY status`
      )
      .all() as Array<{ status: string; count: number }>;

    const stats = {
      total: 0,
      draft: 0,
      ready: 0,
      used: 0,
    };

    for (const row of statsRows) {
      if (row.status in stats) {
        stats[row.status as keyof typeof stats] = row.count;
      }
      stats.total += row.count;
    }

    return NextResponse.json({
      events: rows.map(mapHistoricalEventRow),
      stats,
      meta: {
        eras: HISTORICAL_EVENT_ERAS,
        categories: HISTORICAL_EVENT_CATEGORIES,
        statuses: HISTORICAL_EVENT_STATUSES,
      },
    });
  } catch (error) {
    console.error("Failed to fetch historical events:", error);
    return NextResponse.json(
      { error: "Failed to fetch historical events" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = (await request.json()) as CreateActionBody | BatchActionBody;

    if (body.action === "create") {
      const normalized = normalizeCreatedEvent({
        title: body.title,
        event_month: coerceInteger(body.event_month),
        event_day: coerceInteger(body.event_day),
        event_year:
          body.event_year === null ? null : coerceInteger(body.event_year ?? undefined),
        display_date: body.display_date,
        era: body.era,
        category: body.category,
        context: body.context,
        key_themes: body.key_themes,
        status: body.status,
      });

      if ("error" in normalized) {
        return NextResponse.json({ error: normalized.error }, { status: 400 });
      }

      const eventId = `evt-${crypto.randomUUID()}`;
      db.prepare(
        `INSERT INTO historical_events (
          id, title, event_month, event_day, event_year, display_date,
          era, category, context, key_themes, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).run(
        eventId,
        normalized.data.title,
        normalized.data.eventMonth,
        normalized.data.eventDay,
        normalized.data.eventYear,
        normalized.data.displayDate,
        normalized.data.era,
        normalized.data.category,
        normalized.data.context,
        JSON.stringify(normalized.data.keyThemes),
        normalized.data.status
      );

      const created = db
        .prepare(
          `SELECT he.*, COUNT(p.id) AS posts_count
           FROM historical_events he
           LEFT JOIN posts p ON p.historical_event_id = he.id
           WHERE he.id = ?
           GROUP BY he.id`
        )
        .get(eventId) as HistoricalEventRow | undefined;

      return NextResponse.json(
        { event: created ? mapHistoricalEventRow(created) : null },
        { status: 201 }
      );
    }

    if (body.action === "generate_batch") {
      const month = coerceInteger(body.month);
      const count = clamp(
        coerceInteger(body.count) ?? DEFAULT_BATCH_COUNT,
        1,
        MAX_BATCH_COUNT
      );

      if (month === null || !isValidMonth(month)) {
        return NextResponse.json({ error: "month must be between 1 and 12" }, { status: 400 });
      }

      const client = getAnthropicClient();
      if (!client) {
        return NextResponse.json(
          { error: "ANTHROPIC_API_KEY is not configured." },
          { status: 503 }
        );
      }
      const existingMonthEvents = db
        .prepare(
          `SELECT title, event_day, event_year, display_date
           FROM historical_events
           WHERE event_month = ?`
        )
        .all(month) as Array<{
          title: string;
          event_day: number;
          event_year: number | null;
          display_date: string;
        }>;

      const seenSignatures = new Set(
        existingMonthEvents.map((event) =>
          buildEventSignature({
            title: event.title,
            eventDay: event.event_day,
            eventYear: event.event_year,
          })
        )
      );
      const excludedEventLabels = existingMonthEvents.map(
        (event) => `${event.title} (${event.display_date})`
      );
      const generatedItems: unknown[] = [];
      let attempts = 0;
      let lastRawOutput = "";

      while (generatedItems.length < count && attempts < MAX_BATCH_GENERATION_ATTEMPTS) {
        attempts += 1;
        const remaining = count - generatedItems.length;
        const chunkSize = Math.min(remaining, EVENTS_PER_AI_BATCH);
        const prompt = buildHistoricalEventPrompt({
          month,
          count: chunkSize,
          excludedEventLabels,
        });

        const response = await client.messages.create({
          model: getGenerationModel(),
          max_tokens: BATCH_GENERATION_MAX_TOKENS,
          temperature: 0.4,
          system: "You are a careful historian. Return valid JSON only.",
          messages: [{ role: "user", content: prompt }],
        });

        const rawOutput = extractTextContent(response);
        lastRawOutput = rawOutput;

        let parsed: unknown;
        try {
          parsed = parseAnthropicJson(rawOutput);
        } catch (parseError) {
          const isTruncated = response.stop_reason === "max_tokens";
          const parseMessage =
            parseError instanceof Error ? parseError.message : "Invalid JSON";

          return NextResponse.json(
            {
              error: isTruncated
                ? "AI batch generation was truncated before it finished valid JSON. Please try again; this route now generates in smaller chunks, but this attempt still ran out of room."
                : `Failed to parse AI batch response: ${parseMessage}`,
              raw_output: rawOutput,
            },
            { status: 422 }
          );
        }

        if (!Array.isArray(parsed)) {
          return NextResponse.json(
            { error: "Model response was not a JSON array.", raw_output: rawOutput },
            { status: 422 }
          );
        }

        let addedThisRound = 0;

        for (const item of parsed) {
          if (!item || typeof item !== "object") continue;

          const record = item as Record<string, unknown>;
          const title = typeof record.title === "string" ? record.title : "";
          const eventDay = coerceInteger(
            record.event_day as string | number | null | undefined
          );
          const eventYear =
            record.event_year === null
              ? null
              : coerceInteger(record.event_year as string | number | null | undefined);

          if (!title || eventDay === null) continue;

          const signature = buildEventSignature({
            title,
            eventDay,
            eventYear,
          });

          if (seenSignatures.has(signature)) {
            continue;
          }

          seenSignatures.add(signature);
          excludedEventLabels.push(
            `${title} (${
              typeof record.display_date === "string" && record.display_date.trim()
                ? record.display_date.trim()
                : `${eventDay} ${MONTH_NAMES[month - 1]}`
            })`
          );
          generatedItems.push(item);
          addedThisRound += 1;

          if (generatedItems.length >= count) {
            break;
          }
        }

        if (addedThisRound === 0) {
          break;
        }
      }

      if (generatedItems.length === 0) {
        return NextResponse.json(
          {
            error:
              "No valid events could be created from the AI response. Try a smaller count or run the batch again.",
            raw_output: lastRawOutput,
          },
          { status: 422 }
        );
      }

      const insertEvent = db.prepare(
        `INSERT INTO historical_events (
          id, title, event_month, event_day, event_year, display_date,
          era, category, context, key_themes, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', datetime('now'), datetime('now'))`
      );

      const created = db.transaction((items: unknown[]) => {
        const rows: HistoricalEventRow[] = [];

        for (const item of items) {
          if (!item || typeof item !== "object") continue;

          const record = item as Record<string, unknown>;
          const normalized = normalizeCreatedEvent({
            title: typeof record.title === "string" ? record.title : undefined,
            event_month: month,
            event_day: coerceInteger(record.event_day as string | number | null | undefined),
            event_year:
              record.event_year === null
                ? null
                : coerceInteger(record.event_year as string | number | null | undefined),
            display_date:
              typeof record.display_date === "string" ? record.display_date : undefined,
            era: typeof record.era === "string" ? record.era : undefined,
            category: typeof record.category === "string" ? record.category : undefined,
            context: typeof record.context === "string" ? record.context : undefined,
            key_themes: record.key_themes,
            status: "draft",
          });

          if ("error" in normalized) continue;

          const eventId = `evt-${crypto.randomUUID()}`;
          insertEvent.run(
            eventId,
            normalized.data.title,
            normalized.data.eventMonth,
            normalized.data.eventDay,
            normalized.data.eventYear,
            normalized.data.displayDate,
            normalized.data.era,
            normalized.data.category,
            normalized.data.context,
            JSON.stringify(normalized.data.keyThemes)
          );

          const createdRow = db
            .prepare(
              `SELECT he.*, COUNT(p.id) AS posts_count
               FROM historical_events he
               LEFT JOIN posts p ON p.historical_event_id = he.id
               WHERE he.id = ?
               GROUP BY he.id`
            )
            .get(eventId) as HistoricalEventRow | undefined;

          if (createdRow) rows.push(createdRow);
        }

        return rows;
      })(generatedItems);

      return NextResponse.json(
        {
          events: created.map(mapHistoricalEventRow),
          generated: created.length,
          requested: count,
          warning:
            created.length < count
              ? `Generated ${created.length} unique events out of the requested ${count}.`
              : undefined,
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      { error: "action must be 'create' or 'generate_batch'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Failed to save historical events:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save historical events" },
      { status: 500 }
    );
  }
}
