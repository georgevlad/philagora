"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: "📊" },
      { href: "/admin/feed-preview", label: "Live Feed", icon: "👁️" },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { href: "/admin/news-scout", label: "News Scout", icon: "📰" },
      { href: "/admin/content", label: "Generate", icon: "⚡" },
      { href: "/admin/daily", label: "Daily Planner", icon: "🗓️" },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/posts", label: "Posts", icon: "📝" },
      { href: "/admin/debates", label: "Debates", icon: "⚔️" },
      { href: "/admin/agora", label: "Agora", icon: "❓" },
      { href: "/admin/everyday", label: "Scenarios", icon: "💭" },
      { href: "/admin/historical-events", label: "On This Day", icon: "🏛️" },
    ],
  },
  {
    label: "Configuration",
    items: [
      { href: "/admin/philosophers", label: "Philosophers", icon: "🏛️" },
      { href: "/admin/prompts", label: "Prompts", icon: "💬" },
      { href: "/admin/templates", label: "Templates", icon: "📋" },
      { href: "/admin/scoring", label: "Scoring", icon: "⚙️" },
      { href: "/admin/generation-settings", label: "AI Models", icon: "🤖" },
      { href: "/admin/news-scout/sources", label: "Sources", icon: "📡" },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {navSections.map((section, sectionIndex) => (
        <div key={section.label}>
          <div
            className={`px-3 pb-1 text-[10px] font-mono uppercase tracking-widest text-ink-lighter ${
              sectionIndex === 0 ? "pt-1" : "pt-5"
            }`}
          >
            {section.label}
          </div>

          {section.items.map((item) => {
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
                className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors duration-150 ${
                  active
                    ? "bg-terracotta/10 font-medium text-terracotta"
                    : "text-ink-light hover:bg-parchment-dark hover:text-ink"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span className="font-body">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
