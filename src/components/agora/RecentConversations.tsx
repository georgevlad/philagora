"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { readAgoraDraft } from "@/lib/agora-draft";

export function RecentConversations({ viewerKey }: { viewerKey: string }) {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [loadedUserId, setLoadedUserId] = useState<string | undefined>();
  const [recent, setRecent] = useState<string | null>(null);
  const [threads, setThreads] = useState<
    { id: string; question: string; status: string; visibility: string }[]
  >([]);
  useEffect(() => {
    let active = true;
    const id = readAgoraDraft<string>(`agora:recent:${viewerKey}`);
    if (id)
      fetch(`/api/agora/${id}`, { cache: "no-store" })
        .then((r) => {
          if (active && r.ok) setRecent(id);
        })
        .catch(() => {});
    if (userId)
      fetch("/api/agora/my-threads", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (active) {
            setThreads(data?.threads ?? []);
            setLoadedUserId(userId);
          }
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [viewerKey, userId]);
  return (
    <>
      {recent && (
        <aside className="agora-resume">
          <span>Your conversation is saved.</span>
          <Link href={`/agora/${recent}`}>Return to your conversation →</Link>
        </aside>
      )}
      {userId && loadedUserId === userId && threads.length > 0 && (
        <details className="agora-my-threads">
          <summary>Your conversations ({threads.length})</summary>
          {threads.map((t) => (
            <Link key={t.id} href={`/agora/${t.id}`}>
              <span>{t.question}</span>
              <small>
                {t.visibility} ·{" "}
                {t.status === "complete"
                  ? "Answers available"
                  : t.status === "failed"
                    ? "Generation interrupted"
                    : "In progress"}
              </small>
            </Link>
          ))}
        </details>
      )}
    </>
  );
}
