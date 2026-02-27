import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const philosopher = searchParams.get("philosopher");
    const status = searchParams.get("status");
    const tag = searchParams.get("tag");

    let query = `
      SELECT p.*, ph.name as philosopher_name, ph.color as philosopher_color
      FROM posts p
      JOIN philosophers ph ON p.philosopher_id = ph.id
    `;
    const conditions: string[] = [];
    const params: string[] = [];

    if (philosopher) {
      conditions.push("p.philosopher_id = ?");
      params.push(philosopher);
    }
    if (status) {
      conditions.push("p.status = ?");
      params.push(status);
    }
    if (tag) {
      conditions.push("p.tag = ?");
      params.push(tag);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY p.created_at DESC";

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
    const body = await request.json();
    const {
      philosopher_id,
      content,
      thesis,
      stance,
      tag,
      citation_title,
      citation_source,
      citation_url,
      citation_image_url,
      reply_to,
    } = body;

    if (!philosopher_id || !content) {
      return NextResponse.json(
        { error: "philosopher_id and content are required" },
        { status: 400 }
      );
    }

    // Generate a unique post ID
    const postId = `post-gen-${crypto.randomUUID()}`;

    const result = db
      .prepare(
        `INSERT INTO posts (id, philosopher_id, content, thesis, stance, tag, citation_title, citation_source, citation_url, citation_image_url, reply_to, likes, replies, bookmarks, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 'draft', datetime('now'), datetime('now'))`
      )
      .run(
        postId,
        philosopher_id,
        content,
        thesis ?? "",
        stance ?? "observes",
        tag ?? "",
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
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: "id and status are required" },
        { status: 400 }
      );
    }

    const validStatuses = ["draft", "approved", "published", "archived"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const existing = db.prepare("SELECT id FROM posts WHERE id = ?").get(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      );
    }

    db.prepare(
      "UPDATE posts SET status = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(status, id);

    // Bust the cached feed so published/unpublished posts appear/disappear
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
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const existing = db
      .prepare("SELECT id, status FROM posts WHERE id = ?")
      .get(id) as { id: string; status: string } | undefined;

    if (!existing) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      );
    }

    // Detach any replies that reference this post (orphan them gracefully)
    db.prepare("UPDATE posts SET reply_to = NULL WHERE reply_to = ?").run(id);

    // Delete the post
    db.prepare("DELETE FROM posts WHERE id = ?").run(id);

    // Bust the feed cache
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
