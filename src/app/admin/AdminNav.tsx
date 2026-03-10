"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  indent?: boolean;
}

const navItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/philosophers", label: "Philosophers", icon: "🏛️" },
  { href: "/admin/posts", label: "Posts", icon: "📝" },
  { href: "/admin/prompts", label: "Prompts", icon: "💬" },
  { href: "/admin/debates", label: "Debates", icon: "⚔️" },
  { href: "/admin/agora", label: "Agora", icon: "❓" },
  { href: "/admin/content", label: "Generate", icon: "⚡" },
  { href: "/admin/daily", label: "Daily Feed", icon: "🗓️" },
  { href: "/admin/news-scout", label: "News Scout", icon: "📰" },
  { href: "/admin/news-scout/sources", label: "RSS Sources", icon: "📡", indent: true },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {navItems.map((item) => {
        const isActive =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href) && item.href !== "/admin";

        const isExactSubroute =
          item.href === "/admin/news-scout" &&
          pathname.startsWith("/admin/news-scout/sources");

        const active = isActive && !isExactSubroute;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-3 text-sm rounded-lg transition-colors duration-150 ${
              item.indent ? "ml-4 text-xs" : ""
            } ${
              active
                ? "bg-terracotta/10 text-terracotta font-medium"
                : "text-ink-light hover:bg-parchment-dark hover:text-ink"
            }`}
          >
            <span className={`text-base ${item.indent ? "text-sm" : ""}`}>{item.icon}</span>
            <span className="font-body">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
