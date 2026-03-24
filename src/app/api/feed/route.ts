import { NextRequest, NextResponse } from "next/server";
import { getIdentityFromHeaders } from "@/lib/auth";
import { getInterleavedFeed } from "@/lib/data";
import { normalizeFeedContentType } from "@/lib/feed-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const identity = await getIdentityFromHeaders(request);
    const userId = identity.type === "user" ? identity.id : undefined;
    const { searchParams } = new URL(request.url);
    const contentType = normalizeFeedContentType(searchParams.get("type"));
    const philosopherId = searchParams.get("philosopher") || undefined;
    const parsedOffset = Number.parseInt(searchParams.get("offset") ?? "", 10);
    const offset = Number.isFinite(parsedOffset)
      ? Math.max(parsedOffset, 0)
      : 0;
    const parsedLimit = Number.parseInt(searchParams.get("limit") ?? "", 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 50)
      : 15;
    const { posts, hasMore, nextOffset } = getInterleavedFeed({
      contentType: contentType === "all" ? undefined : contentType,
      philosopherId,
      offset,
      limit,
      userId,
    });

    return NextResponse.json({ posts, hasMore, nextOffset });
  } catch (error) {
    console.error("Failed to fetch filtered feed:", error);
    return NextResponse.json(
      { error: "Failed to fetch feed" },
      { status: 500 }
    );
  }
}
