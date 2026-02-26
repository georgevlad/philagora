"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        setError("Invalid password");
        setLoading(false);
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-parchment flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo area */}
        <div className="text-center mb-8">
          <img
            src="/logo.svg"
            alt=""
            width={48}
            height={48}
            className="mx-auto mb-4"
          />
          <h1 className="font-serif text-2xl font-bold text-ink">
            Admin Access
          </h1>
          <p className="text-sm text-ink-lighter mt-1">
            Enter the admin password to continue.
          </p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-mono uppercase tracking-wider text-ink-lighter mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-border rounded-lg bg-white
                         text-ink text-sm font-body
                         focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta
                         placeholder:text-ink-lighter/50"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 font-body">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-athenian text-white text-sm font-medium
                       rounded-lg hover:bg-athenian/90 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-xs text-ink-lighter hover:text-terracotta transition-colors font-mono"
          >
            &larr; Back to site
          </a>
        </div>
      </div>
    </div>
  );
}
