import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

interface FeedExportRow {
  content: string;
  thesis: string;
  stance: string;
  citation_title: string | null;
  citation_source: string | null;
  citation_url: string | null;
  created_at: string;
  philosopher_name: string;
  tradition: string;
  era: string;
}

const DOUBLE_RULE = "═══════════════════════════════════════════════════════════";
const SINGLE_RULE = "───────────────────────────────────────────────────────────";

function formatExportDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function sanitizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\*+/g, "").trim();
}

function titleCase(value: string): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function buildPostBlock(post: FeedExportRow, index: number): string {
  const philosopherName = sanitizeText(post.philosopher_name).toUpperCase();
  const stance = titleCase(sanitizeText(post.stance));
  const citationTitle = sanitizeText(post.citation_title);
  const citationSource = sanitizeText(post.citation_source);
  const citationUrl = sanitizeText(post.citation_url);
  const thesis = sanitizeText(post.thesis);
  const content = sanitizeText(post.content);
  const sourceLine = citationTitle
    ? `Reacting to: "${citationTitle}"${citationSource ? ` (${citationSource})` : ""}`
    : "[Timeless Reflection]";

  return [
    `[${index}] ${philosopherName} — ${stance}`,
    sourceLine,
    ...(citationUrl ? [`URL: ${citationUrl}`] : []),
    `Thesis: ${thesis}`,
    "",
    content,
    SINGLE_RULE,
  ].join("\n");
}

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const db = getDb();
    const posts = db
      .prepare(
        `SELECT
          p.content,
          p.thesis,
          p.stance,
          p.citation_title,
          p.citation_source,
          p.citation_url,
          p.created_at,
          ph.name as philosopher_name,
          ph.tradition,
          ph.era
        FROM posts p
        JOIN philosophers ph ON p.philosopher_id = ph.id
        WHERE p.status = 'published'
        ORDER BY p.created_at DESC`
      )
      .all() as FeedExportRow[];

    const sections: string[] = [
      DOUBLE_RULE,
      "PHILAGORA — FULL FEED EXPORT",
      `Exported: ${formatExportDate(new Date())}`,
      `Total posts: ${posts.length}`,
      DOUBLE_RULE,
      "",
    ];

    posts.forEach((post, index) => {
      sections.push(buildPostBlock(post, index + 1));
      sections.push("");
    });

    sections.push(`═══ End of feed · ${posts.length} posts ═══`);

    const textContent = sections.join("\n");
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(textContent, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="philagora-feed-${date}.txt"`,
      },
    });
  } catch (error) {
    console.error("Failed to export full feed:", error);
    return NextResponse.json(
      { error: "Failed to export full feed" },
      { status: 500 }
    );
  }
}
