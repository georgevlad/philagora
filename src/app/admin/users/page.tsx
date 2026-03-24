"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/Spinner";
import { formatDate } from "@/lib/date-utils";

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  createdAt: string;
  updatedAt: string;
  bookmark_count: number;
  like_count: number;
  auth_provider: string | null;
}

interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
}

function isAdminUsersResponse(value: unknown): value is AdminUsersResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  return Array.isArray((value as { users?: unknown }).users) && typeof (value as { total?: unknown }).total === "number";
}

function deriveDisplayName(user: AdminUser): string {
  const trimmedName = user.name?.trim();
  return trimmedName || user.email;
}

function deriveInitials(user: AdminUser): string {
  const source = deriveDisplayName(user);
  const initials = source
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || "U";
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadUsers = useCallback(async () => {
    setError("");

    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as AdminUsersResponse | { error?: string } | null;

      if (!response.ok) {
        throw new Error(data && "error" in data ? data.error || "Failed to fetch users" : "Failed to fetch users");
      }

      if (isAdminUsersResponse(data)) {
        setUsers(data.users);
        setTotal(data.total);
      } else {
        setUsers([]);
        setTotal(0);
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-ink">Users</h1>
        <p className="mt-1 text-sm font-body text-ink-lighter">
          Registered accounts and their public interaction footprint.{" "}
          {loading ? "Loading..." : `${total} total`}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border-light/60 bg-parchment-dark/20 px-4 py-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-lighter">
            {loading ? "Loading users" : `${total} registered users`}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border-light/60 bg-parchment-dark/30">
                <th className="px-4 py-3 text-xs font-mono uppercase tracking-wider text-ink-lighter">User</th>
                <th className="px-4 py-3 text-xs font-mono uppercase tracking-wider text-ink-lighter">Provider</th>
                <th className="px-4 py-3 text-right text-xs font-mono uppercase tracking-wider text-ink-lighter">
                  Bookmarks
                </th>
                <th className="px-4 py-3 text-right text-xs font-mono uppercase tracking-wider text-ink-lighter">
                  Likes
                </th>
                <th className="px-4 py-3 text-xs font-mono uppercase tracking-wider text-ink-lighter">Signed Up</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="inline-flex items-center gap-2 text-sm font-body text-ink-lighter">
                      <Spinner className="h-4 w-4 text-terracotta" />
                      Loading users...
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm font-body text-ink-lighter">
                    No registered users yet.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-border-light/60 transition-colors duration-100 hover:bg-parchment-dark/20 last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {user.image ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={user.image}
                              alt={deriveDisplayName(user)}
                              className="h-9 w-9 rounded-full border border-border-light/60 object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </>
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-terracotta/10 text-xs font-mono font-semibold text-terracotta">
                            {deriveInitials(user)}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="truncate font-serif font-semibold text-ink">
                            {deriveDisplayName(user)}
                          </div>
                          <div className="truncate text-sm font-body text-ink-lighter">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono uppercase tracking-wide text-ink-light">
                      {user.auth_provider ?? "unknown"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-mono tabular-nums text-ink-light">
                      {user.bookmark_count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-mono tabular-nums text-ink-light">
                      {user.like_count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-body text-ink-light">
                      {formatDate(user.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
