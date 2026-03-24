import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ensureBetterAuthTables } from "@/lib/better-auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

interface AdminUserRow {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  createdAt: string;
  updatedAt: string;
  bookmark_count: number;
  like_count: number;
  auth_provider: string | null;
}

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) {
    return denied;
  }

  try {
    await ensureBetterAuthTables();

    const db = getDb();
    const users = db
      .prepare(
        `SELECT
           u.id,
           u.name,
           u.email,
           u.image,
           u.createdAt,
           u.updatedAt,
           (SELECT COUNT(*) FROM user_bookmarks WHERE user_id = u.id) AS bookmark_count,
           (SELECT COUNT(*) FROM user_likes WHERE user_id = u.id) AS like_count,
           (
             SELECT a.providerId
             FROM account a
             WHERE a.userId = u.id
             ORDER BY a.createdAt ASC
             LIMIT 1
           ) AS auth_provider
         FROM "user" u
         ORDER BY u.createdAt DESC`
      )
      .all() as AdminUserRow[];

    return NextResponse.json({ users, total: users.length });
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
