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
      { href: "/admin", label: "Dashboard", icon: "\uD83D\uDCCA" },
      { href: "/admin/feed-preview", label: "Live Feed", icon: "\uD83D\uDC41\uFE0F" },
      { href: "/admin/users", label: "Users", icon: "\uD83D\uDC65" },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { href: "/admin/news-scout", label: "News Scout", icon: "\uD83D\uDCF0" },
      { href: "/admin/content", label: "Generate", icon: "\u26A1" },
      { href: "/admin/daily", label: "Daily Planner", icon: "\uD83D\uDDD3\uFE0F" },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/posts", label: "Posts", icon: "\uD83D\uDCDD" },
      { href: "/admin/debates", label: "Debates", icon: "\u2694\uFE0F" },
      { href: "/admin/agora", label: "Agora", icon: "\u2753" },
      { href: "/admin/everyday", label: "Scenarios", icon: "\uD83D\uDCAD" },
      { href: "/admin/historical-events", label: "Today in History", icon: "\uD83C\uDFDB\uFE0F" },
    ],
  },
  {
    label: "Configuration",
    items: [
      { href: "/admin/philosophers", label: "Philosophers", icon: "\uD83C\uDFDB\uFE0F" },
      { href: "/admin/prompts", label: "Prompts", icon: "\uD83D\uDCAC" },
      { href: "/admin/templates", label: "Templates", icon: "\uD83D\uDCCB" },
      { href: "/admin/scoring", label: "Scoring", icon: "\u2699\uFE0F" },
      { href: "/admin/mood-palettes", label: "Mood Palettes", icon: "\uD83C\uDFA8" },
      { href: "/admin/generation-settings", label: "AI Models", icon: "\uD83E\uDD16" },
      { href: "/admin/api-logs", label: "API Logs", icon: "\uD83D\uDCCB" },
      { href: "/admin/news-scout/sources", label: "Sources", icon: "\uD83D\uDCE1" },
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
