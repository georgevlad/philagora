import { NextRequest, NextResponse } from "next/server";

import { getIdentityFromHeaders } from "@/lib/auth";
import { getDb } from "@/lib/db";

// Lazy-init: getDb() opens the connection on first call; we don't want that to happen at module-load time.
function makeBookmarkTransactions() {
  const db = getDb();
  const insertStmt = db.prepare(
    "INSERT OR IGNORE INTO user_bookmarks (user_id, post_id) VALUES (?, ?)"
  );
  const incrementStmt = db.prepare(
    "UPDATE posts SET bookmarks = bookmarks + 1 WHERE id = ?"
  );
  const deleteStmt = db.prepare(
    "DELETE FROM user_bookmarks WHERE user_id = ? AND post_id = ?"
  );
  const decrementStmt = db.prepare(
    "UPDATE posts SET bookmarks = MAX(0, bookmarks - 1) WHERE id = ?"
  );

  const addBookmark = db.transaction((userId: string, postId: string) => {
    const result = insertStmt.run(userId, postId);
    if (result.changes > 0) {
      incrementStmt.run(postId);
    }

    return result.changes > 0;
  });

  const removeBookmark = db.transaction((userId: string, postId: string) => {
    const result = deleteStmt.run(userId, postId);
    if (result.changes > 0) {
      decrementStmt.run(postId);
    }

    return result.changes > 0;
  });

  return { addBookmark, removeBookmark };
}

let _txn: ReturnType<typeof makeBookmarkTransactions> | null = null;

function getBookmarkTransactions() {
  if (!_txn) {
    _txn = makeBookmarkTransactions();
  }

  return _txn;
}

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
    return NextResponse.json({ error: "Sign in to bookmark posts" }, { status: 401 });
  }

  const postId = await readPostId(request);
  if (!postId) {
    return NextResponse.json({ error: "postId is required" }, { status: 400 });
  }

  try {
    const db = getDb();
    const { addBookmark } = getBookmarkTransactions();
    const post = db
      .prepare("SELECT id FROM posts WHERE id = ? AND status = 'published'")
      .get(postId) as { id: string } | undefined;

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const wasInserted = addBookmark(identity.id, postId);
    void wasInserted;

    return NextResponse.json({ bookmarked: true });
  } catch (error) {
    console.error("Failed to bookmark post:", error);
    return NextResponse.json({ error: "Failed to bookmark post" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const identity = await getIdentityFromHeaders(request);
  if (identity.type !== "user") {
    return NextResponse.json({ error: "Sign in to manage bookmarks" }, { status: 401 });
  }

  const postId = await readPostId(request);
  if (!postId) {
    return NextResponse.json({ error: "postId is required" }, { status: 400 });
  }

  try {
    const { removeBookmark } = getBookmarkTransactions();
    const wasRemoved = removeBookmark(identity.id, postId);
    void wasRemoved;

    return NextResponse.json({ bookmarked: false });
  } catch (error) {
    console.error("Failed to remove bookmark:", error);
    return NextResponse.json(
      { error: "Failed to remove bookmark" },
      { status: 500 }
    );
  }
}
