import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const tempPath = path.join("/tmp", `philagora-backup-${Date.now()}.db`);

  try {
    await getDb().backup(tempPath);
    const file = await fs.readFile(tempPath);
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(file, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="philagora-${date}.db"`,
      },
    });
  } catch (error) {
    console.error("Failed to download database:", error);
    return NextResponse.json(
      { error: "Failed to download database" },
      { status: 500 }
    );
  } finally {
    try {
      await fs.unlink(tempPath);
    } catch {
      // temp file cleanup is best-effort
    }
  }
}
