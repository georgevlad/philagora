import type { RequestIdentity } from "@/lib/auth";
import type { AgoraThreadDetail } from "@/lib/types";

export function canReadAgoraThread(
  thread: { visibility?: string | null; userId?: string | null },
  identity: RequestIdentity,
): boolean {
  return (
    thread.visibility !== "private" ||
    identity.type === "admin" ||
    (identity.type === "user" &&
      !!thread.userId &&
      thread.userId === identity.id)
  );
}

export function canFollowUpAgoraThread(
  thread: AgoraThreadDetail,
  identity: RequestIdentity,
): boolean {
  return (
    canReadAgoraThread(thread, identity) &&
    !!thread.userId &&
    (identity.type === "admin" ||
      (identity.type === "user" && identity.id === thread.userId)) &&
    thread.status === "complete" &&
    thread.responses.length === thread.philosophers.length && !!thread.synthesis &&
    !thread.followUpTo &&
    !thread.followUp
  );
}

export function isPublicAgoraThread(thread: AgoraThreadDetail): boolean {
  return (
    thread.visibility === "public" &&
    !thread.hiddenFromFeed &&
    thread.status === "complete"
  );
}

/** Set action permissions only after read access is checked. Never infer guest ownership. */
export function authorizeAgoraRecovery(thread: AgoraThreadDetail, identity: RequestIdentity) {
  const owner = identity.type === "admin" || (identity.type === "user" && !!thread.userId && identity.id === thread.userId);
  for (const round of [thread, thread.followUp]) {
    if (round?.recovery) round.recovery.canRecover = owner && ["available", "queued", "running", "retry_wait"].includes(round.recovery.state);
  }
}
