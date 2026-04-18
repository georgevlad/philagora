import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { bustFeedCache } from "@/lib/feed-cache";
import { generateContent } from "@/lib/generation-service";
import type { TargetLength } from "@/lib/content-templates";
import type { Stance } from "@/lib/types";
import { STANCE_CONFIG } from "@/lib/constants";

type EverydayResult = {
  philosopher_id: string;
  philosopher_name: string;
  post_id?: string;
  generation_log_id?: number;
  content?: string;
  thesis?: string;
  stance?: Stance;
  tag?: string;
  error?: string;
};

interface GeneratedPostPayload {
  content: string;
  thesis: string;
  stance: Stance;
  tag: string;
}

const VALID_LENGTHS: TargetLength[] = ["short", "medium", "long"];

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeGeneratedPost(data: Record<string, unknown>): GeneratedPostPayload | null {
  const content = typeof data.content === "string" ? data.content.trim() : "";
  if (!content) return null;

  const thesis =
    typeof data.thesis === "string" && data.thesis.trim()
      ? data.thesis.trim()
      : content.split("\n")[0]?.trim().slice(0, 140) ?? "";
  const stance =
    typeof data.stance === "string" && data.stance in STANCE_CONFIG
      ? (data.stance as Stance)
      : "observes";
  const tag =
    typeof data.tag === "string" && data.tag.trim() ? data.tag.trim() : "Examined Life";

  return {
    content,
    thesis,
    stance,
    tag,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      scenario?: string;
      philosopher_ids?: string[];
      target_length?: TargetLength;
    };

    const scenario = body.scenario?.trim() ?? "";
    if (!scenario) {
      return NextResponse.json({ error: "scenario is required" }, { status: 400 });
    }
    if (scenario.length > 500) {
      return NextResponse.json(
        { error: "scenario must be 500 characters or fewer" },
        { status: 400 }
      );
    }

    const philosopherIds = Array.isArray(body.philosopher_ids)
      ? body.philosopher_ids.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];
    const uniqueIds = [...new Set(philosopherIds)];
    if (uniqueIds.length < 2 || uniqueIds.length > 4) {
      return NextResponse.json(
        { error: "philosopher_ids must contain 2 to 4 unique philosopher ids" },
        { status: 400 }
      );
    }

    const targetLength = body.target_length ?? "short";
    if (!VALID_LENGTHS.includes(targetLength)) {
      return NextResponse.json(
        { error: "target_length must be short, medium, or long" },
        { status: 400 }
      );
    }

    const db = getDb();
    const philosophers = db
      .prepare(
        `SELECT id, name
         FROM philosophers
         WHERE id IN (${uniqueIds.map(() => "?").join(", ")})
         ORDER BY name ASC`
      )
      .all(...uniqueIds) as Array<{ id: string; name: string }>;

    const philosophersById = new Map(philosophers.map((philosopher) => [philosopher.id, philosopher]));
    const invalidIds = uniqueIds.filter((id) => !philosophersById.has(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `Unknown philosopher id(s): ${invalidIds.join(", ")}` },
        { status: 400 }
      );
    }

    const orderedPhilosophers = uniqueIds
      .map((id) => philosophersById.get(id))
      .filter((value): value is { id: string; name: string } => Boolean(value));

    const insertLog = db.prepare(
      `INSERT INTO generation_log (philosopher_id, content_type, system_prompt_id, user_input, raw_output, status)
       VALUES (?, 'post', ?, ?, ?, ?)`
    );
    const insertPost = db.prepare(
      `INSERT INTO posts (
        id, philosopher_id, content, thesis, stance, tag, source_type, historical_event_id,
        citation_title, citation_source, citation_url, citation_image_url,
        reply_to, likes, replies, bookmarks, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'everyday', NULL, ?, ?, NULL, NULL, NULL, 0, 0, 0, 'draft', datetime('now'), datetime('now'))`
    );

    const generated: EverydayResult[] = [];
    const errors: string[] = [];

    for (let index = 0; index < orderedPhilosophers.length; index += 1) {
      const philosopher = orderedPhilosophers[index];
      const outcome = await generateContent(
        philosopher.id,
        "everyday_reaction",
        scenario,
        targetLength
      );

      if (!outcome.success) {
        const result = insertLog.run(
          philosopher.id,
          outcome.systemPromptId,
          scenario,
          outcome.rawOutput || outcome.error,
          "rejected"
        );

        const errorMessage = outcome.error || "Generation failed.";
        generated.push({
          philosopher_id: philosopher.id,
          philosopher_name: philosopher.name,
          generation_log_id: Number(result.lastInsertRowid),
          error: errorMessage,
        });
        errors.push(`${philosopher.name}: ${errorMessage}`);
      } else {
        const normalized = normalizeGeneratedPost(outcome.data);
        if (!normalized) {
          const result = insertLog.run(
            philosopher.id,
            outcome.systemPromptId,
            scenario,
            JSON.stringify(outcome.data, null, 2),
            "rejected"
          );
          const errorMessage = "Generation returned malformed content.";
          generated.push({
            philosopher_id: philosopher.id,
            philosopher_name: philosopher.name,
            generation_log_id: Number(result.lastInsertRowid),
            error: errorMessage,
          });
          errors.push(`${philosopher.name}: ${errorMessage}`);
        } else {
          const postId = `post-gen-${crypto.randomUUID()}`;
          const logId = db.transaction(() => {
            const logResult = insertLog.run(
              philosopher.id,
              outcome.systemPromptId,
              scenario,
              JSON.stringify(outcome.data, null, 2),
              "generated"
            );

            insertPost.run(
              postId,
              philosopher.id,
              normalized.content,
              normalized.thesis,
              normalized.stance,
              normalized.tag,
              scenario,
              "The Examined Life"
            );

            return Number(logResult.lastInsertRowid);
          })();

          generated.push({
            philosopher_id: philosopher.id,
            philosopher_name: philosopher.name,
            post_id: postId,
            generation_log_id: logId,
            content: normalized.content,
            thesis: normalized.thesis,
            stance: normalized.stance,
            tag: normalized.tag,
          });
        }
      }

      if (index < orderedPhilosophers.length - 1) {
        await wait(500);
      }
    }

    bustFeedCache();

    return NextResponse.json({
      success: true,
      scenario,
      generated,
      errors,
    });
  } catch (error) {
    console.error("Failed to generate everyday reactions:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate everyday reactions",
      },
      { status: 500 }
    );
  }
}
