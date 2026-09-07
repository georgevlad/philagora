"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { AgoraShell } from "@/components/agora/AgoraShell";

export function PageError({ reset }: { reset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <AgoraShell>
      <main id="main" className="public-page public-reading">
        <div className="public-empty" role="alert">
          <p className="agora-eyebrow">Page unavailable</p>
          <h1>This page couldn’t load.</h1>
          <p>
            Please try loading it again. Your saved questions, likes and
            bookmarks remain in your account.
          </p>
          <div className="agora-actions">
            <button
              className="agora-button"
              disabled={pending}
              onClick={() =>
                startTransition(() => {
                  router.refresh();
                  reset();
                })
              }
            >
              {pending ? "Loading page…" : "Try again"}
            </button>
            <Link href="/" className="agora-text-link">
              Back to the Agora →
            </Link>
          </div>
        </div>
      </main>
    </AgoraShell>
  );
}
