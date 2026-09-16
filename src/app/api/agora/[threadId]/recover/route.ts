import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getIdentityFromHeaders } from "@/lib/auth";
import { canReadAgoraThread } from "@/lib/agora-access";
import { requestAgoraRecovery, AgoraRecoveryError } from "@/lib/agora-jobs";
import { runAgoraGeneration } from "@/lib/agora-generation";

export async function POST(request: NextRequest, { params }: { params: Promise<{ threadId: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    // Explicit mutation, never GET/polling. Reject cross-origin cookie requests.
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== (request.headers.get("host") || request.nextUrl.host))
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403, headers });
    const { threadId } = await params;
    const db = getDb();
    const identity = await getIdentityFromHeaders(request);
    const thread = db.prepare("SELECT visibility, user_id FROM agora_threads WHERE id = ?").get(threadId) as
      { visibility: string; user_id: string | null } | undefined;
    if (!thread || !canReadAgoraThread({ visibility: thread.visibility, userId: thread.user_id }, identity))
      return NextResponse.json({ error: "Thread not found" }, { status: 404, headers });
    const owner = identity.type === "user" && !!thread.user_id && identity.id === thread.user_id;
    if (!owner && identity.type !== "admin")
      return NextResponse.json({ error: "Only the registered owner or an administrator can recover this conversation" }, { status: 403, headers });
    const recovery = requestAgoraRecovery(db, threadId, identity.type === "user" ? `user:${identity.id}` : "admin");
    if (recovery instanceof AgoraRecoveryError)
      return NextResponse.json({ error: recovery.message }, { status: recovery.status, headers: { ...headers, ...(recovery.retryAfter ? { "Retry-After": String(recovery.retryAfter) } : {}) } });
    void runAgoraGeneration(threadId);
    return NextResponse.json({ recovery }, { status: recovery.state === "complete" ? 200 : 202, headers });
  } catch {
    return NextResponse.json({ error: "Recovery could not be confirmed. Check this conversation again." }, { status: 500, headers });
  }
}
