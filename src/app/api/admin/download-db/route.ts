import fs from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/admin-auth";
import { resolveDatabasePath } from "../../../../../db/index";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const isAuthenticated = verifyAdminToken(token);

  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
