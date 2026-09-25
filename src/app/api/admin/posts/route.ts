import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { parseAdminJsonObject } from "@/lib/admin-request";
import { bustFeedCache } from "@/lib/feed-cache";
import { isPostSourceType } from "@/lib/historical-events";
import { POST_STATUSES, STANCE_CONFIG } from "@/lib/constants";
import { buildFeedContentTypeConditions } from "@/lib/feed-utils";

type AdminPostFilters = {
  query?: string | null;
  id?: string | null;
  philosopher?: string | null;
  status?: string | null;
  tag?: string | null;
  sourceType?: string | null;
  category?: string | null;
};

function buildPostFilterParts(
  filters: AdminPostFilters,
  options: {
    includeStatus?: boolean;
    includeTag?: boolean;
  } = {}
) {
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (filters.id) { conditions.push("p.id = ?"); params.push(filters.id); }
  if (filters.query) {
    conditions.push("(p.content LIKE ? ESCAPE '\\' OR p.thesis LIKE ? ESCAPE '\\' OR p.citation_title LIKE ? ESCAPE '\\')");
    const query = `%${filters.query.replace(/[\\%_]/g, "\\$&")}%`;
    params.push(query, query, query);
  }

  if (filters.philosopher) {
    conditions.push("p.philosopher_id = ?");
    params.push(filters.philosopher);
  }

  if (options.includeStatus !== false && filters.status) {
    conditions.push("p.status = ?");
    params.push(filters.status);
  }

  if (options.includeTag !== false && filters.tag) {
    conditions.push("p.tag = ?");
    params.push(filters.tag);
  }

  if (filters.sourceType) {
    conditions.push("p.source_type = ?");
    params.push(filters.sourceType);
  }

  conditions.push(...buildFeedContentTypeConditions(filters.category, "p"));

  return { conditions, params };
}

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const philosopher = searchParams.get("philosopher");
    const status = searchParams.get("status");
    const tag = searchParams.get("tag");
    const sourceType = searchParams.get("source_type");
    const category = searchParams.get("category");
    const limitParam = searchParams.get("limit");
    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("page_size");

    const filters: AdminPostFilters = {
      query: searchParams.get("q")?.slice(0, 200),
      id: searchParams.get("id"),
      philosopher,
      status,
      tag,
      sourceType,
      category,
    };

    const baseQuery = `
      SELECT p.*,
             ph.name as philosopher_name,
             ph.color as philosopher_color,
             ph.initials as philosopher_initials,
             (SELECT gl.mood_register
              FROM generation_log gl
              WHERE gl.philosopher_id = p.philosopher_id
                AND gl.mood_register IS NOT NULL
                AND datetime(gl.created_at) >= datetime(p.created_at, '-2 minutes')
                AND datetime(gl.created_at) <= datetime(p.created_at, '+2 minutes')
              ORDER BY gl.created_at DESC
              LIMIT 1) as mood_register
      FROM posts p
      JOIN philosophers ph ON p.philosopher_id = ph.id
    `;
    const { conditions, params } = buildPostFilterParts(filters);
    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";

    const parsedPageSize = pageSizeParam ? Number.parseInt(pageSizeParam, 10) : Number.NaN;
    const pageSize = Number.isFinite(parsedPageSize)
      ? Math.max(1, Math.min(parsedPageSize, 100))
      : null;

    if (pageSize !== null) {
      const parsedPage = pageParam ? Number.parseInt(pageParam, 10) : 1;
      const requestedPage = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
      const totalRow = db
        .prepare(`SELECT COUNT(*) as count FROM posts p${whereClause}`)
        .get(...params) as { count: number };
      const total = totalRow.count;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const page = Math.min(requestedPage, totalPages);
      const offset = (page - 1) * pageSize;

      const items = db
        .prepare(`${baseQuery}${whereClause} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`)
        .all(...params, pageSize, offset);

      const tagFilters = buildPostFilterParts(filters, { includeTag: false });
      const tagConditions = [...tagFilters.conditions, "p.tag IS NOT NULL", "p.tag != ''"];
      const tagWhereClause =
        tagConditions.length > 0 ? ` WHERE ${tagConditions.join(" AND ")}` : "";
      const availableTags = (
        db
          .prepare(`SELECT DISTINCT p.tag FROM posts p${tagWhereClause} ORDER BY p.tag ASC`)
          .all(...tagFilters.params) as Array<{ tag: string | null }>
      )
        .map((row) => row.tag)
        .filter((value): value is string => Boolean(value));

      const approvedRow = db
        .prepare("SELECT COUNT(*) as count FROM posts WHERE status = 'approved'")
        .get() as { count: number };

      return NextResponse.json({
        items,
        total,
        page,
        pageSize,
        totalPages,
        availableTags,
        approvedCount: approvedRow.count,
      });
    }

    let query = `${baseQuery}${whereClause} ORDER BY p.created_at DESC`;

    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : Number.NaN;
    const limit = Number.isFinite(parsedLimit)
      ? Math.max(1, Math.min(parsedLimit, 200))
      : null;
    if (limit !== null) {
      query += " LIMIT ?";
      params.push(limit);
    }

    const posts = db.prepare(query).all(...params);
    return NextResponse.json(posts);
  } catch (error) {
    console.error("Failed to fetch posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch posts" },
      { status: 500 }
    );
  }
}

/** POST — create a new post from approved generated content */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await parseAdminJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: "A valid JSON object is required" }, { status: 400 });
    }
    const {
      philosopher_id,
      content,
      thesis,
      stance,
      tag,
      source_type,
      historical_event_id,
      recommendation_title,
      recommendation_author,
      recommendation_medium,
      citation_title,
      citation_source,
      citation_url,
      citation_image_url,
      reply_to,
    } = body;

    if (typeof philosopher_id !== "string" || !philosopher_id.trim() || typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "philosopher_id and content are required" },
        { status: 400 }
      );
    }

    if (stance != null && (typeof stance !== "string" || !Object.hasOwn(STANCE_CONFIG, stance))) {
      return NextResponse.json(
        { error: "Invalid stance provided." },
        { status: 400 }
      );
    }

    if (source_type && !isPostSourceType(String(source_type))) {
      return NextResponse.json(
        { error: "Invalid source_type provided." },
        { status: 400 }
      );
    }

    // Generate a unique post ID
    const postId = `post-gen-${crypto.randomUUID()}`;

    db.prepare(
      `INSERT INTO posts (
        id, philosopher_id, content, thesis, stance, tag, source_type, historical_event_id,
        recommendation_title, recommendation_author, recommendation_medium,
        citation_title, citation_source, citation_url, citation_image_url, reply_to,
        likes, replies, bookmarks, status, created_at, updated_at
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 'draft', datetime('now'), datetime('now'))`
    ).run(
      postId,
      philosopher_id,
      content,
      thesis ?? "",
      stance ?? "observes",
      tag ?? "",
      source_type ?? "news",
      historical_event_id ?? null,
      recommendation_title ?? null,
      recommendation_author ?? null,
      recommendation_medium ?? null,
      citation_title ?? null,
      citation_source ?? null,
      citation_url ?? null,
      citation_image_url ?? null,
      reply_to ?? null
    );

    const created = db
      .prepare(
        "SELECT p.*, ph.name as philosopher_name, ph.color as philosopher_color FROM posts p JOIN philosophers ph ON p.philosopher_id = ph.id WHERE p.id = ?"
      )
      .get(postId);

    bustFeedCache();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to create post:", error);
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const db = getDb();
    const body = await parseAdminJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: "A valid JSON object is required" }, { status: 400 });
    }
    const { id, status } = body;

    if (typeof id !== "string" || !id.trim()) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    if (status !== undefined && !POST_STATUSES.some((validStatus) => validStatus === status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${POST_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const fields = ["content", "thesis", "stance", "tag", "citation_title", "citation_source", "citation_url", "recommendation_title", "recommendation_author", "recommendation_medium"] as const;
    const changes: Array<[string, string | null]> = [];
    for (const field of fields) {
      if (!Object.hasOwn(body, field)) continue;
      const value = body[field];
      if (typeof value !== "string" || value.length > (field === "content" ? 50000 : 3000)) {
        return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
      }
      if (field === "content" && !value.trim()) return NextResponse.json({ error: "Content cannot be empty" }, { status: 400 });
      if (field === "stance" && !Object.hasOwn(STANCE_CONFIG, value)) return NextResponse.json({ error: "Invalid stance" }, { status: 400 });
      if (field === "citation_url" && value.trim()) {
        try { if (!["http:", "https:"].includes(new URL(value).protocol)) throw new Error(); }
        catch { return NextResponse.json({ error: "Source URL must start with http:// or https://" }, { status: 400 }); }
      }
      changes.push([field, value]);
    }
    if (status !== undefined) changes.push(["status", status as string]);
    if (!changes.length) return NextResponse.json({ error: "No changes supplied" }, { status: 400 });
    if (body.expected_updated_at !== undefined && typeof body.expected_updated_at !== "string") return NextResponse.json({ error: "Invalid edit version" }, { status: 400 });
    const existing = db.prepare("SELECT id, updated_at FROM posts WHERE id = ?").get(id) as { id: string; updated_at: string } | undefined;
    if (!existing) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      );
    }

    if (body.expected_updated_at !== undefined && body.expected_updated_at !== existing.updated_at) {
      return NextResponse.json({ error: "This post changed in another editor. Reload the post before saving." }, { status: 409 });
    }
    // Column names come only from the fixed allowlist above. All values are bound.
    const versioned = body.expected_updated_at !== undefined;
    const changed = db.prepare(`UPDATE posts SET ${changes.map(([field]) => `${field} = ?`).join(", ")}, updated_at = ? WHERE id = ?${versioned ? " AND updated_at = ?" : ""}`)
      .run(...changes.map(([, value]) => value), new Date(Math.max(Date.now(), Date.parse(existing.updated_at) + 1)).toISOString(), id, ...(versioned ? [body.expected_updated_at as string] : []));
    if (!changed.changes) return NextResponse.json({ error: "This post changed in another editor. Reload the post before saving." }, { status: 409 });

    bustFeedCache();
    revalidatePath("/");

    const updated = db.prepare("SELECT * FROM posts WHERE id = ?").get(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update post status:", error);
    return NextResponse.json(
      { error: "Failed to update post status" },
      { status: 500 }
    );
  }
}

/** DELETE — permanently remove a post */
export async function DELETE(request: NextRequest) {
  try {
    const db = getDb();
    const body = await parseAdminJsonObject(request);
    if (!body) {
      return NextResponse.json({ error: "A valid JSON object is required" }, { status: 400 });
    }
    const { id } = body;

    if (typeof id !== "string" || !id.trim()) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const existing = db
      .prepare("SELECT id FROM posts WHERE id = ?")
      .get(id) as { id: string } | undefined;

    if (!existing) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      );
    }

    db.transaction(() => {
      // Keep replies intact if deleting their parent fails.
      db.prepare("UPDATE posts SET reply_to = NULL WHERE reply_to = ?").run(id);
      db.prepare("DELETE FROM posts WHERE id = ?").run(id);
    })();

    bustFeedCache();
    revalidatePath("/");

    return NextResponse.json({ deleted: id });
  } catch (error) {
    console.error("Failed to delete post:", error);
    return NextResponse.json(
      { error: "Failed to delete post" },
      { status: 500 }
    );
  }
}
