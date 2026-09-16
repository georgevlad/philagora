"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/lib/auth-client";
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function leave() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await signOut();
      if (result.error) throw new Error("Sign out failed");
      router.push("/");
      router.refresh();
    } catch {
      setError("Sign-out couldn’t complete. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="public-sign-out">
      <button
        type="button"
        className="agora-outline"
        disabled={pending}
        onClick={() => void leave()}
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {error && (
        <p className="agora-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
