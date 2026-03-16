import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

interface ApiLogStatsRow {
  total_calls: number;
  total_errors: number | null;
  total_truncated: number | null;
  avg_latency_ms: number | null;
  total_input_tokens: number | null;
  total_output_tokens: number | null;
  first_log: string | null;
  last_log: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 200);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);
    const caller = searchParams.get("caller") || undefined;
    const successOnly = searchParams.get("success");

    const db = getDb();

    let whereClause = "1=1";
    const params: Array<string | number> = [];

    if (caller) {
      whereClause += " AND caller = ?";
      params.push(caller);
    }
    if (successOnly === "true") {
      whereClause += " AND success = 1";
    } else if (successOnly === "false") {
      whereClause += " AND success = 0";
    }

    const total = (
      db.prepare(`SELECT COUNT(*) as cnt FROM api_call_log WHERE ${whereClause}`).get(
        ...params
      ) as { cnt: number }
    ).cnt;

    const logs = db
      .prepare(
        `SELECT * FROM api_call_log WHERE ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_calls,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as total_errors,
        SUM(CASE WHEN stop_reason = 'max_tokens' THEN 1 ELSE 0 END) as total_truncated,
        ROUND(AVG(latency_ms)) as avg_latency_ms,
        SUM(input_tokens) as total_input_tokens,
        SUM(output_tokens) as total_output_tokens,
        MIN(timestamp) as first_log,
        MAX(timestamp) as last_log
      FROM api_call_log
    `).get() as ApiLogStatsRow;

    return NextResponse.json({ logs, total, stats, limit, offset });
  } catch (error) {
    console.error("Failed to fetch API logs:", error);
    return NextResponse.json({ error: "Failed to fetch API logs" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const olderThanDays = Math.max(Number(searchParams.get("older_than_days")) || 30, 1);

    const db = getDb();
    const result = db
      .prepare(
        `DELETE FROM api_call_log WHERE timestamp < datetime('now', '-' || ? || ' days')`
      )
      .run(olderThanDays);

    return NextResponse.json({ deleted: result.changes });
  } catch (error) {
    console.error("Failed to clear API logs:", error);
    return NextResponse.json({ error: "Failed to clear logs" }, { status: 500 });
  }
}
