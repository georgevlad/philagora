"use client";

import { useRouter } from "next/navigation";

export function AdminLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="text-xs text-ink-lighter hover:text-red-600 transition-colors font-mono cursor-pointer"
      title="Sign out"
    >
      Sign out
    </button>
  );
}
