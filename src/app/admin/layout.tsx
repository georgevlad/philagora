import Link from "next/link";
import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/admin-auth";
import { AdminLogoutButton } from "./AdminLogoutButton";
import { AdminNav } from "./AdminNav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const isAuthenticated = verifyAdminToken(token);

  // Unauthenticated → render children bare (login page via middleware redirect)
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-parchment flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-border bg-parchment-dark/40 flex flex-col">
        <div className="px-5 py-5 border-b border-border">
          <Link href="/admin" className="block">
            <h1 className="font-serif text-lg font-bold text-ink">
              Philagora
            </h1>
            <p className="text-[10px] font-mono text-ink-lighter tracking-widest uppercase mt-0.5">
              Admin Panel
            </p>
          </Link>
        </div>

        <AdminNav />

        <div className="px-5 py-4 border-t border-border flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-ink-lighter hover:text-terracotta transition-colors font-mono"
          >
            &larr; Back to site
          </Link>
          <AdminLogoutButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
