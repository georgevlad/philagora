"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLogoutButton() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    setError("");
    try {
      const response = await fetch("/api/admin/auth", { method: "DELETE" });
      if (!response.ok) throw new Error("Sign out failed");
      router.push("/admin/login");
      router.refresh();
    } catch {
      setError("Could not sign out. Please try again.");
      setSigningOut(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleLogout}
        disabled={signingOut}
        className="text-sm text-ink-lighter hover:text-red-600 transition-colors font-mono cursor-pointer disabled:opacity-50"
        title="Sign out"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
