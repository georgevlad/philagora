"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (isPending) {
          return;
        }

        setIsPending(true);
        void signOut()
          .then(() => {
            router.push("/");
            router.refresh();
          })
          .finally(() => {
            setIsPending(false);
          });
      }}
      className="text-xs font-mono text-ink-lighter transition-colors hover:text-terracotta disabled:cursor-wait disabled:text-ink-faint"
    >
      Sign out
    </button>
  );
}
