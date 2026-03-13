import { NextRequest, NextResponse } from "next/server";
import Parser from "rss-parser";

const rssParser = new Parser({
  timeout: 10000,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const feedUrl = typeof body.feed_url === "string" ? body.feed_url.trim() : "";

    if (!feedUrl) {
      return NextResponse.json(
        { error: "feed_url is required" },
        { status: 400 }
      );
    }

    const feed = await rssParser.parseURL(feedUrl);
    const articleCount = feed.items?.length ?? 0;
    const sampleTitle = feed.items?.[0]?.title?.trim() ?? "";

    return NextResponse.json({
      valid: true,
      articleCount,
      sampleTitle,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Feed could not be parsed";

    return NextResponse.json({
      valid: false,
      articleCount: 0,
      sampleTitle: "",
      error: message,
    });
  }
}
