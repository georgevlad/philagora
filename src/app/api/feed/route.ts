import { NextRequest, NextResponse } from "next/server";
import { getFilteredPublishedPosts } from "@/lib/data";
import { normalizeFeedContentType } from "@/lib/feed-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contentType = normalizeFeedContentType(searchParams.get("type"));
    const philosopherId = searchParams.get("philosopher") || undefined;
    const posts = getFilteredPublishedPosts(
      contentType === "all" ? undefined : contentType,
      philosopherId
    );

    return NextResponse.json(posts);
  } catch (error) {
    console.error("Failed to fetch filtered feed:", error);
    return NextResponse.json(
      { error: "Failed to fetch feed" },
      { status: 500 }
    );
  }
}
