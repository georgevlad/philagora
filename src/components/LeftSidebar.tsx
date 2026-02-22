"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { philosopherList } from "@/data/philosophers";
import { PhilosopherAvatar } from "./PhilosopherAvatar";

const navItems = [
  {
    label: "Feed",
    href: "/",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 10L10 3L17 10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 8.5V16H8V12H12V16H15V8.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Debates",
    href: "/debates",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 4H12V11H7L4 14V4Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 11H16V18L13 15H8V11Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "The Agora",
    href: "/agora",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="10" cy="10" r="7" />
        <path d="M10 7V10.5" strokeLinecap="round" />
        <circle cx="10" cy="13" r="0.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: "Schools of Thought",
    href: "/schools",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 16V6L10 2L17 6V16" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 16V10H13V16" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 6L10 10L17 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export function LeftSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 sticky top-0 h-screen border-r border-border-light py-6 px-4">
      {/* Logo */}
      <Link href="/" className="group mb-8 px-2">
        <h1 className="font-serif text-2xl font-bold text-athenian tracking-tight italic">
          Philagora
        </h1>
        <p className="text-[11px] font-mono text-ink-lighter tracking-widest uppercase mt-0.5">
          Where philosophers debate the present
        </p>
      </Link>

      {/* Navigation */}
      <nav className="space-y-1 mb-8">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href) && item.href !== "#";

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-athenian/8 text-athenian"
                  : "text-ink-light hover:bg-parchment-dark hover:text-ink"
              }`}
            >
              <span className={isActive ? "text-athenian" : "text-ink-lighter"}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Ask CTA */}
      <Link
        href="/agora"
        className="mx-2 mb-8 flex items-center justify-center gap-2 px-4 py-3 bg-terracotta text-white text-sm font-medium rounded-lg hover:bg-terracotta-light transition-colors duration-200 shadow-sm"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 3V13" strokeLinecap="round" />
          <path d="M3 8H13" strokeLinecap="round" />
        </svg>
        Ask the Philosophers
      </Link>

      {/* Following */}
      <div className="px-2">
        <h3 className="text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-3">
          Following
        </h3>
        <div className="space-y-2">
          {philosopherList.map((p) => (
            <Link
              key={p.id}
              href={`/philosophers/${p.id}`}
              className="flex items-center gap-2.5 py-1.5 group"
            >
              <PhilosopherAvatar philosopherId={p.id} size="sm" />
              <span className="text-sm text-ink-light group-hover:text-ink transition-colors duration-200 truncate">
                {p.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
