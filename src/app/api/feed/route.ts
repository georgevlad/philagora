import { NextRequest, NextResponse } from "next/server";
import { getPaginatedPublishedPosts } from "@/lib/data";
import { normalizeFeedContentType } from "@/lib/feed-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contentType = normalizeFeedContentType(searchParams.get("type"));
    const philosopherId = searchParams.get("philosopher") || undefined;
    const cursor = searchParams.get("cursor") || undefined;
    const parsedLimit = Number.parseInt(searchParams.get("limit") ?? "", 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 50)
      : 15;
    const { posts, nextCursor } = getPaginatedPublishedPosts({
      contentType: contentType === "all" ? undefined : contentType,
      philosopherId,
      cursor,
      limit,
    });

    return NextResponse.json({ posts, nextCursor });
  } catch (error) {
    console.error("Failed to fetch filtered feed:", error);
    return NextResponse.json(
      { error: "Failed to fetch feed" },
      { status: 500 }
    );
  }
}
