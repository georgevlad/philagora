import { NextRequest, NextResponse } from "next/server";
import { getIdentityFromHeaders, hasUnlimitedAgoraAccess } from "@/lib/auth";
import { getDb } from "@/lib/db";

interface CountRow {
  count: number;
}

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const identity = await getIdentityFromHeaders(request);
    const userId = identity.type === "user" ? identity.id : null;
    const hasUnlimitedAccess = hasUnlimitedAgoraAccess(identity);

    if (hasUnlimitedAccess) {
      return NextResponse.json({ used: 0, limit: null, isLoggedIn: true });
    }

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    let used: number;
    let limit: number;

    if (userId) {
      const row = db
        .prepare(
          "SELECT COUNT(*) as count FROM agora_threads WHERE user_id = ? AND created_at >= date('now')"
        )
        .get(userId) as CountRow;
      used = row.count;
      limit = 5;
    } else {
      const row = db
        .prepare(
          "SELECT COUNT(*) as count FROM agora_threads WHERE ip_address = ? AND created_at >= date('now')"
        )
        .get(clientIp) as CountRow;
      used = row.count;
      limit = 3;
    }

    return NextResponse.json({ used, limit, isLoggedIn: !!userId });
  } catch {
    return NextResponse.json({ used: 0, limit: 3, isLoggedIn: false });
  }
}
