import type { Metadata } from "next";
import Link from "next/link";
import { getIdentityFromCookies, isAdmin } from "@/lib/auth";
import { AdminLogoutButton } from "./AdminLogoutButton";
import { AdminNav } from "./AdminNav";
import { AdminUIProvider } from "@/components/admin/AdminUI";
import "./admin.css";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await getIdentityFromCookies();
  const isAuthenticated = isAdmin(identity);

  // Unauthenticated → render children bare (login page via middleware redirect)
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="admin-theme admin-shell">
      <AdminUIProvider>
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <Link href="/admin" className="block">
            <strong>Philagora</strong><span>Editorial workspace</span>
          </Link>
        </div>

        <AdminNav />

        <div className="admin-sidebar-footer">
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
      <main className="admin-main" id="admin-main">
        {children}
      </main>
      </AdminUIProvider>
    </div>
  );
}
