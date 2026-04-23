import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { ArticleCandidateRow, PhilosopherRow } from "@/lib/db-types";
import {
  buildArticleSourceMaterial,
  generateDailyDraft,
} from "@/lib/generation-service";

type GenerateQuipBody = {
  article_id?: unknown;
  philosopher_id?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    let body: GenerateQuipBody;
    try {
      body = (await request.json()) as GenerateQuipBody;
    } catch {
      return NextResponse.json(
        { success: false, error: "Request body must be valid JSON" },
        { status: 400 }
      );
    }

    const articleId =
      typeof body.article_id === "string" ? body.article_id.trim() : "";
    const philosopherId =
      typeof body.philosopher_id === "string" ? body.philosopher_id.trim() : "";

    if (!articleId) {
      return NextResponse.json(
        { success: false, error: "article_id is required and must be a string" },
        { status: 400 }
      );
    }

    if (!philosopherId) {
      return NextResponse.json(
        {
          success: false,
          error: "philosopher_id is required and must be a string",
        },
        { status: 400 }
      );
    }

    const db = getDb();
    const article = db
      .prepare(
        `SELECT ac.*, ns.name as source_name
         FROM article_candidates ac
         JOIN news_sources ns ON ns.id = ac.source_id
         WHERE ac.id = ?`
      )
      .get(articleId) as ArticleCandidateRow | undefined;

    if (!article) {
      return NextResponse.json(
        { success: false, error: "Article candidate not found" },
        { status: 404 }
      );
    }

    const philosopher = db
      .prepare(
        "SELECT id, name, tradition, color, initials FROM philosophers WHERE id = ?"
      )
      .get(philosopherId) as PhilosopherRow | undefined;

    if (!philosopher) {
      return NextResponse.json(
        { success: false, error: "Philosopher not found" },
        { status: 404 }
      );
    }

    const item = await generateDailyDraft({
      philosopher,
      type: "quip",
      dbContentType: "post",
      sourceMaterial: buildArticleSourceMaterial(article),
      targetLength: "medium",
      citation: {
        title: article.title,
        source: article.source_name,
        url: article.url,
        imageUrl: article.image_url,
      },
      articleCandidateId: article.id,
      articleTitle: article.title,
    });

    if (!item.success) {
      return NextResponse.json(
        { success: false, error: item.error },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, post_id: item.data.post_id },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to generate News Scout Glint:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to generate Glint draft",
      },
      { status: 500 }
    );
  }
}
