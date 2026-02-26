import Link from "next/link";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/philosophers", label: "Philosophers", icon: "🏛️" },
  { href: "/admin/posts", label: "Posts", icon: "📝" },
  { href: "/admin/prompts", label: "Prompts", icon: "💬" },
  { href: "/admin/debates", label: "Debates", icon: "⚔️" },
  { href: "/admin/agora", label: "Agora", icon: "❓" },
  { href: "/admin/content", label: "Generate", icon: "⚡" },
  { href: "/admin/news-scout", label: "News Scout", icon: "📰" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 text-sm text-ink-light rounded-lg hover:bg-parchment-dark hover:text-ink transition-colors duration-150"
            >
              <span className="text-base">{item.icon}</span>
              <span className="font-body">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-border">
          <Link
            href="/"
            className="text-xs text-ink-lighter hover:text-terracotta transition-colors font-mono"
          >
            &larr; Back to site
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
