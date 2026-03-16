import crypto from "crypto";
import fs from "fs";
import path from "path";
import { getDb } from "@/lib/db";
import type {
  HistoricalEventCategory,
  HistoricalEventEra,
} from "@/lib/historical-events";
import {
  DEFAULT_IMAGE_GENERATION_MODEL,
  parseImageGenerationModel,
} from "@/lib/scoring-config";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const REQUEST_TIMEOUT_MS = 60_000;

interface GeminiInlineDataPart {
  inlineData?: {
    mimeType?: string;
    data?: string;
  };
  text?: string;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    finishReason?: string;
    safetyRatings?: unknown;
    content?: {
      parts?: GeminiInlineDataPart[];
    };
  }>;
}

export interface ImageGenerationResult {
  success: true;
  imageBase64: string;
  mimeType: string;
  description: string;
}

export interface ImageGenerationError {
  success: false;
  error: string;
}

export type ImageGenerationOutcome =
  | ImageGenerationResult
  | ImageGenerationError;

interface EventForThumbnail {
  title: string;
  displayDate: string;
  era: HistoricalEventEra;
  category: HistoricalEventCategory;
  context: string;
  keyThemes: string[];
}

const ERA_ART_DIRECTION: Record<HistoricalEventEra, string> = {
  ancient:
    "Style: classical antiquity aesthetic. Think weathered stone reliefs, terracotta tones, " +
    "Mediterranean light, columns and amphitheaters in the distance. Palette: ochre, " +
    "burnt sienna, marble white, deep bronze. Mood: monumental, mythic.",
  medieval:
    "Style: illuminated manuscript meets Byzantine mosaic. Rich gold leaf, deep jewel tones, " +
    "dramatic candlelit interiors, Gothic arches, heraldic symbolism. Palette: deep crimson, " +
    "ultramarine, gold, forest green. Mood: solemn, sacred, dramatic.",
  early_modern:
    "Style: Renaissance/Baroque oil painting. Chiaroscuro lighting, rich fabrics, " +
    "architectural grandeur, dramatic skies. Palette: Caravaggio darks with Vermeer " +
    "highlights - deep amber, velvet black, cream, burgundy. Mood: theatrical, humanistic.",
  modern:
    "Style: 19th-century Romantic painting meets early photography. Dramatic landscapes, " +
    "industrial age energy, documentary realism with painterly emotion. Palette: sepia, " +
    "steel grey, gaslight amber, revolutionary red. Mood: turbulent, transformative.",
  contemporary:
    "Style: photojournalistic realism with cinematic composition. High contrast, " +
    "decisive-moment framing, urban textures, broadcast-news gravity. Palette: desaturated " +
    "with selective color emphasis. Mood: immediate, consequential.",
};

const CATEGORY_SUBJECT_HINTS: Record<HistoricalEventCategory, string> = {
  war_conflict:
    "Focus on the human drama of conflict - not gratuitous violence. Show tension, " +
    "fortifications, armies at a distance, smoke on the horizon, or the aftermath. " +
    "Avoid graphic gore or modern weapons.",
  revolution:
    "Capture the energy of uprising - crowds, barricades, raised fists, toppled symbols " +
    "of power, torches in darkness. The composition should feel kinetic and urgent.",
  science_discovery:
    "Show the moment of discovery or its instrument - a laboratory, observatory, " +
    "manuscript, specimen, or the natural phenomenon itself. Convey wonder and precision.",
  cultural_shift:
    "Visualize the transformation - contrasting old and new, a symbolic object or gathering, " +
    "the human face of cultural change. Show movement between worlds.",
  political:
    "Depict the halls of power, signing ceremonies, diplomatic encounters, or the public " +
    "spectacle of political events. Architecture and symbolism matter.",
  economic:
    "Show markets, trade routes, currencies, ships, factories, or the human cost/benefit " +
    "of economic forces. Scale and movement convey economic energy.",
  philosophical:
    "Evoke the life of the mind - a study, a gathering of thinkers, a symbolic scene " +
    "that embodies the philosophical concept. Light represents knowledge.",
  other:
    "Create a scene that captures the historical significance and emotional weight of the event.",
};

function getImageModel(): string {
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM scoring_config WHERE key = 'image_generation_model'")
    .get() as { value: string } | undefined;

  return parseImageGenerationModel(
    row?.value ?? JSON.stringify(DEFAULT_IMAGE_GENERATION_MODEL)
  );
}

export async function generateImage(
  prompt: string
): Promise<ImageGenerationOutcome> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error:
        "GOOGLE_AI_API_KEY is not configured. Set it in environment variables.",
    };
  }

  const model = getImageModel();
  const url = `${GEMINI_API_BASE}/${model}:generateContent`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          responseMimeType: "text/plain",
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unknown error");
      return {
        success: false,
        error: `Gemini API error (${response.status}): ${errorBody.substring(0, 500)}`,
      };
    }

    const data = (await response.json()) as GeminiGenerateContentResponse;
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts;

    if (!Array.isArray(parts) || parts.length === 0) {
      return {
        success: false,
        error: `No content in response. Finish reason: ${
          candidate?.finishReason || "unknown"
        }. ${
          candidate?.safetyRatings
            ? `Safety: ${JSON.stringify(candidate.safetyRatings)}`
            : ""
        }`,
      };
    }

    let imageBase64: string | null = null;
    let mimeType = "image/png";
    let description = "";

    for (const part of parts) {
      if (part.inlineData?.data) {
        imageBase64 = part.inlineData.data;
        mimeType = part.inlineData.mimeType || "image/png";
      } else if (typeof part.text === "string") {
        description += part.text;
      }
    }

    if (!imageBase64) {
      return {
        success: false,
        error: `Gemini returned text but no image. Text: "${description.substring(
          0,
          200
        )}"`,
      };
    }

    return {
      success: true,
      imageBase64,
      mimeType,
      description: description.trim(),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: false,
        error: "Image generation timed out (60s)",
      };
    }

    return {
      success: false,
      error: `Image generation failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function buildThumbnailPrompt(event: EventForThumbnail): string {
  const eraDirection = ERA_ART_DIRECTION[event.era] || ERA_ART_DIRECTION.modern;
  const categoryHints =
    CATEGORY_SUBJECT_HINTS[event.category] || CATEGORY_SUBJECT_HINTS.other;
  const briefContext =
    event.context.split("\n\n")[0]?.substring(0, 300) ||
    event.context.substring(0, 300);

  return [
    "Create a single evocative image for this historical event:",
    "",
    `EVENT: ${event.title}`,
    `DATE: ${event.displayDate}`,
    `CONTEXT: ${briefContext}`,
    `THEMES: ${event.keyThemes.join(", ")}`,
    "",
    "ART DIRECTION:",
    eraDirection,
    "",
    "SUBJECT GUIDANCE:",
    categoryHints,
    "",
    "COMPOSITION REQUIREMENTS:",
    "- Aspect ratio: 16:9 (wide landscape format, suitable as a banner/thumbnail)",
    "- No text, watermarks, labels, or UI elements in the image",
    "- No modern elements unless the event is contemporary era",
    "- The image should work as a thumbnail at small sizes - clear focal point, not too busy",
    "- Cinematic composition with a strong sense of place and moment",
    "- The image should feel like a museum-quality illustration or painting, not stock photography",
    "- Evoke the emotional weight and historical significance of the event",
  ].join("\n");
}

function getThumbnailDir(): string {
  const dbPath = process.env.DATABASE_PATH;
  if (dbPath) {
    return path.join(path.dirname(dbPath), "thumbnails");
  }

  return path.join(process.cwd(), "data", "thumbnails");
}

export function saveThumbnail(
  eventId: string,
  base64Data: string,
  mimeType: string
): string {
  const dir = getThumbnailDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const safeEventId = eventId.replace(/[^a-zA-Z0-9_-]/g, "-");
  const ext = mimeType.includes("webp")
    ? "webp"
    : mimeType.includes("jpeg") || mimeType.includes("jpg")
    ? "jpg"
    : "png";
  const hash = crypto
    .createHash("md5")
    .update(base64Data.substring(0, 1000))
    .digest("hex")
    .substring(0, 8);
  const filename = `${safeEventId}-${hash}.${ext}`;
  const filepath = path.join(dir, filename);
  const buffer = Buffer.from(base64Data, "base64");

  fs.writeFileSync(filepath, buffer);

  return filename;
}

export function deleteThumbnail(filename: string): void {
  const filepath = path.join(getThumbnailDir(), filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
}

export function resolveThumbnailPath(filename: string): string | null {
  const filepath = path.join(getThumbnailDir(), filename);
  return fs.existsSync(filepath) ? filepath : null;
}
