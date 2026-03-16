import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { HistoricalEventRow } from "@/lib/db-types";
import {
  buildThumbnailPrompt,
  deleteThumbnail,
  generateImage,
  saveThumbnail,
} from "@/lib/image-generation";
import {
  isHistoricalEventCategory,
  isHistoricalEventEra,
  parseHistoricalThemes,
} from "@/lib/historical-events";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const db = getDb();
  const event = db
    .prepare("SELECT * FROM historical_events WHERE id = ?")
    .get(id) as HistoricalEventRow | undefined;

  if (!event) {
    return NextResponse.json(
      { error: "Historical event not found" },
      { status: 404 }
    );
  }

  const prompt = buildThumbnailPrompt({
    title: event.title,
    displayDate: event.display_date,
    era: isHistoricalEventEra(event.era) ? event.era : "modern",
    category: isHistoricalEventCategory(event.category)
      ? event.category
      : "other",
    context: event.context,
    keyThemes: parseHistoricalThemes(event.key_themes),
  });

  const result = await generateImage(prompt);
  if (!result.success) {
    return NextResponse.json({ error: result.error, prompt }, { status: 422 });
  }

  if (event.thumbnail_filename) {
    deleteThumbnail(event.thumbnail_filename);
  }

  const filename = saveThumbnail(id, result.imageBase64, result.mimeType);

  db.prepare(
    "UPDATE historical_events SET thumbnail_filename = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(filename, id);

  return NextResponse.json({
    filename,
    thumbnailUrl: `/api/thumbnails/${filename}`,
    description: result.description,
    prompt,
  });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const db = getDb();
  const event = db
    .prepare("SELECT thumbnail_filename FROM historical_events WHERE id = ?")
    .get(id) as { thumbnail_filename: string | null } | undefined;

  if (!event) {
    return NextResponse.json(
      { error: "Historical event not found" },
      { status: 404 }
    );
  }

  if (event.thumbnail_filename) {
    deleteThumbnail(event.thumbnail_filename);
  }

  db.prepare(
    "UPDATE historical_events SET thumbnail_filename = NULL, updated_at = datetime('now') WHERE id = ?"
  ).run(id);

  return NextResponse.json({ deleted: true });
}
