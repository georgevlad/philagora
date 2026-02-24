import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();

    const posts = db.prepare("SELECT COUNT(*) as count FROM posts").get() as { count: number };
    const debates = db.prepare("SELECT COUNT(*) as count FROM debates").get() as { count: number };
    const agoraThreads = db.prepare("SELECT COUNT(*) as count FROM agora_threads").get() as { count: number };
    const generationLog = db.prepare("SELECT COUNT(*) as count FROM generation_log").get() as { count: number };

    return NextResponse.json({
      posts: posts.count,
      debates: debates.count,
      agora_threads: agoraThreads.count,
      generation_log: generationLog.count,
    });
  } catch (error) {
    console.error("Failed to fetch admin stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
