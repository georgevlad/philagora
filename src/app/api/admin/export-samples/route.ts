import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

interface PhilosopherRow {
  id: string;
  name: string;
  tradition: string;
  era: string;
}

interface PostRow {
  content: string;
  thesis: string;
  stance: string;
  citation_title: string | null;
  citation_source: string | null;
  citation_url: string | null;
  created_at: string;
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

function buildPostBlock(post: PostRow, index: number): string {
  const citationTitle = sanitizeText(post.citation_title);
  const citationSource = sanitizeText(post.citation_source);
  const citationUrl = sanitizeText(post.citation_url);
  const thesis = sanitizeText(post.thesis);
  const content = sanitizeText(post.content);
  const heading = `[Post ${index}]`;
  const sourceLine = citationTitle
    ? `Reacting to: "${citationTitle}"${citationSource ? ` (${citationSource})` : ""}`
    : "[Timeless Reflection]";

  return [
    heading,
    sourceLine,
    ...(citationUrl ? [`URL: ${citationUrl}`] : []),
    `Stance: ${titleCase(post.stance)}`,
    `Thesis: ${thesis}`,
    "",
    content,
  ].join("\n");
}

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const db = getDb();
    const philosophers = db
      .prepare(
        `SELECT id, name, tradition, era
         FROM philosophers
         WHERE is_active = 1
         ORDER BY name ASC`
      )
      .all() as PhilosopherRow[];

    const selectPosts = db.prepare(
      `SELECT content, thesis, stance, citation_title, citation_source, citation_url, created_at
       FROM posts
       WHERE philosopher_id = ? AND status = 'published'
       ORDER BY created_at DESC
       LIMIT 2`
    );

    const sections: string[] = [
      DOUBLE_RULE,
      "PHILAGORA — CONTENT SAMPLES",
      `Exported: ${formatExportDate(new Date())}`,
      DOUBLE_RULE,
      "",
      "",
    ];

    let totalPosts = 0;

    philosophers.forEach((philosopher, philosopherIndex) => {
      const posts = selectPosts.all(philosopher.id) as PostRow[];
      totalPosts += posts.length;

      sections.push(SINGLE_RULE);
      sections.push(philosopher.name.toUpperCase());
      sections.push(`${sanitizeText(philosopher.tradition)} · ${sanitizeText(philosopher.era)}`);
      sections.push(SINGLE_RULE);
      sections.push("");

      if (posts.length === 0) {
        sections.push("(No published posts yet)");
      } else {
        posts.forEach((post, index) => {
          sections.push(buildPostBlock(post, index + 1));

          if (index < posts.length - 1) {
            sections.push("");
            sections.push("- - -");
            sections.push("");
          }
        });
      }

      if (philosopherIndex < philosophers.length - 1) {
        sections.push("");
        sections.push("");
      }
    });

    sections.push("");
    sections.push(
      `═══ End of samples · ${philosophers.length} philosophers · ${totalPosts} posts total ═══`
    );

    const textContent = sections.join("\n");
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(textContent, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="philagora-samples-${date}.txt"`,
      },
    });
  } catch (error) {
    console.error("Failed to export content samples:", error);
    return NextResponse.json(
      { error: "Failed to export content samples" },
      { status: 500 }
    );
  }
}
