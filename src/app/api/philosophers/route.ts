import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

interface PhilosopherRow {
  id: string;
  name: string;
  tradition: string;
  color: string;
  initials: string;
}

/** GET /api/philosophers — Public list of all philosophers (for forms/selectors) */
export async function GET() {
  try {
    const db = getDb();

    const philosophers = db
      .prepare(
        `SELECT id, name, tradition, color, initials
         FROM philosophers
         ORDER BY name ASC`
      )
      .all() as PhilosopherRow[];

    return NextResponse.json(philosophers);
  } catch (error) {
    console.error("Failed to fetch philosophers:", error);
    return NextResponse.json(
      { error: "Failed to fetch philosophers" },
      { status: 500 }
    );
  }
}
