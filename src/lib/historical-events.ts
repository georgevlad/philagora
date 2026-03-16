export const HISTORICAL_EVENT_ERAS = [
  "ancient",
  "medieval",
  "early_modern",
  "modern",
  "contemporary",
] as const;

export const HISTORICAL_EVENT_CATEGORIES = [
  "war_conflict",
  "revolution",
  "science_discovery",
  "cultural_shift",
  "political",
  "economic",
  "philosophical",
  "other",
] as const;

export const HISTORICAL_EVENT_STATUSES = ["draft", "ready", "used"] as const;

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type HistoricalEventEra = (typeof HISTORICAL_EVENT_ERAS)[number];
export type HistoricalEventCategory = (typeof HISTORICAL_EVENT_CATEGORIES)[number];
export type HistoricalEventStatus = (typeof HISTORICAL_EVENT_STATUSES)[number];
export type PostSourceType = "news" | "historical_event" | "reflection" | "everyday";

export function isHistoricalEventEra(value: string): value is HistoricalEventEra {
  return HISTORICAL_EVENT_ERAS.includes(value as HistoricalEventEra);
}

export function isHistoricalEventCategory(
  value: string
): value is HistoricalEventCategory {
  return HISTORICAL_EVENT_CATEGORIES.includes(value as HistoricalEventCategory);
}

export function isHistoricalEventStatus(
  value: string
): value is HistoricalEventStatus {
  return HISTORICAL_EVENT_STATUSES.includes(value as HistoricalEventStatus);
}

export function isPostSourceType(value: string): value is PostSourceType {
  return ["news", "historical_event", "reflection", "everyday"].includes(value);
}

export function normalizeHistoricalThemes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 8);
}

export function parseHistoricalThemes(raw: string | null | undefined): string[] {
  if (!raw) return [];

  try {
    return normalizeHistoricalThemes(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function formatHistoricalDisplayDate(args: {
  month: number;
  day: number;
  year?: number | null;
}): string {
  const monthName = MONTH_NAMES[args.month - 1] ?? `Month ${args.month}`;

  if (typeof args.year === "number" && Number.isInteger(args.year)) {
    if (args.year < 0) {
      return `${args.day} ${monthName} ${Math.abs(args.year)} BCE`;
    }

    return `${args.day} ${monthName} ${args.year}`;
  }

  return `${args.day} ${monthName}`;
}

export function formatHistoricalDateBadge(args: {
  month: number;
  day: number;
  year?: number | null;
}): { monthLabel: string; dayLabel: string; yearLabel?: string } {
  const monthName = MONTH_NAMES[args.month - 1] ?? `Month ${args.month}`;

  return {
    monthLabel: monthName.slice(0, 3).toUpperCase(),
    dayLabel: String(args.day),
    yearLabel:
      typeof args.year === "number" && Number.isInteger(args.year)
        ? args.year < 0
          ? `${Math.abs(args.year)} BCE`
          : String(args.year)
        : undefined,
  };
}

export function labelHistoricalCategory(category: HistoricalEventCategory): string {
  switch (category) {
    case "war_conflict":
      return "War / Conflict";
    case "science_discovery":
      return "Science / Discovery";
    case "cultural_shift":
      return "Cultural Shift";
    default:
      return category.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

export function labelHistoricalEra(era: HistoricalEventEra): string {
  switch (era) {
    case "early_modern":
      return "Early Modern";
    default:
      return era.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

export function buildHistoricalEventSourceMaterial(event: {
  title: string;
  display_date: string;
  context: string;
  key_themes: string;
}): string {
  const keyThemes = parseHistoricalThemes(event.key_themes);

  return [
    `HISTORICAL EVENT: ${event.title}`,
    `DATE: ${event.display_date}`,
    "",
    event.context,
    "",
    `KEY THEMES: ${keyThemes.join(", ")}`,
  ].join("\n");
}

export function mapHistoricalEventRow(row: HistoricalEventRow): HistoricalEvent {
  return {
    id: row.id,
    title: row.title,
    eventMonth: row.event_month,
    eventDay: row.event_day,
    eventYear: row.event_year,
    displayDate: row.display_date,
    era: row.era,
    category: row.category,
    context: row.context,
    keyThemes: parseHistoricalThemes(row.key_themes),
    status: row.status,
    thumbnailFilename: row.thumbnail_filename ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    postsCount: row.posts_count ?? 0,
  };
}
import type { HistoricalEventRow } from "@/lib/db-types";
import type { HistoricalEvent } from "@/lib/types";
