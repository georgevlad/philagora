import fs from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { resolveDatabasePath } from "../../../../../db/index";

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const dbPath = resolveDatabasePath();
    const file = await fs.readFile(dbPath);
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
  }
}
