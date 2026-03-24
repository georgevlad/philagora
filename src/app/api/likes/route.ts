import { NextRequest, NextResponse } from "next/server";

import { getIdentityFromHeaders } from "@/lib/auth";
import { getDb } from "@/lib/db";

function parsePostId(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const postId = (body as { postId?: unknown }).postId;
  if (typeof postId !== "string") {
    return null;
  }

  const trimmedPostId = postId.trim();
  return trimmedPostId.length > 0 ? trimmedPostId : null;
}

async function readPostId(request: NextRequest): Promise<string | null> {
  try {
    const body = await request.json();
    return parsePostId(body);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const identity = await getIdentityFromHeaders(request);
  if (identity.type !== "user") {
    return NextResponse.json({ error: "Sign in to like posts" }, { status: 401 });
  }

  const postId = await readPostId(request);
  if (!postId) {
    return NextResponse.json({ error: "postId is required" }, { status: 400 });
  }

  try {
    const db = getDb();
    const post = db
      .prepare("SELECT id FROM posts WHERE id = ? AND status = 'published'")
      .get(postId) as { id: string } | undefined;

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const result = db
      .prepare("INSERT OR IGNORE INTO user_likes (user_id, post_id) VALUES (?, ?)")
      .run(identity.id, postId);

    if (result.changes > 0) {
      db.prepare("UPDATE posts SET likes = likes + 1 WHERE id = ?").run(postId);
    }

    return NextResponse.json({ liked: true });
  } catch (error) {
    console.error("Failed to like post:", error);
    return NextResponse.json({ error: "Failed to like post" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const identity = await getIdentityFromHeaders(request);
  if (identity.type !== "user") {
    return NextResponse.json({ error: "Sign in to manage likes" }, { status: 401 });
  }

  const postId = await readPostId(request);
  if (!postId) {
    return NextResponse.json({ error: "postId is required" }, { status: 400 });
  }

  try {
    const db = getDb();
    const result = db
      .prepare("DELETE FROM user_likes WHERE user_id = ? AND post_id = ?")
      .run(identity.id, postId);

    if (result.changes > 0) {
      db.prepare("UPDATE posts SET likes = MAX(0, likes - 1) WHERE id = ?").run(postId);
    }

    return NextResponse.json({ liked: false });
  } catch (error) {
    console.error("Failed to remove like:", error);
    return NextResponse.json(
      { error: "Failed to remove like" },
      { status: 500 }
    );
  }
}
