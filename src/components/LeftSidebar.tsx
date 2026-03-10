"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Philosopher } from "@/lib/types";
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

export function LeftSidebar({ philosophers }: { philosophers: Philosopher[] }) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 sticky top-0 h-screen border-r border-border-light py-6 px-4">
      {/* Logo */}
      <Link href="/" className="group mb-8 px-2 flex items-center gap-3">
        <img src="/logo.svg" alt="" width={32} height={32} className="shrink-0" />
        <h1 className="text-2xl font-bold text-athenian tracking-tight italic"
            style={{ fontFamily: 'var(--font-cormorant), var(--font-playfair), serif' }}>
          Philagora
        </h1>
      </Link>

      {/* Navigation */}
      <nav className="space-y-1 mb-6">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href) && item.href !== "#";

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium tracking-wide transition-all duration-200 ${
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
        className="group mx-2 mb-6 block overflow-hidden rounded-xl border border-warm-gold/30 bg-gradient-to-br from-parchment-dark via-parchment to-parchment-dark/80 hover:border-warm-gold/60 transition-all duration-300 shadow-sm hover:shadow-md"
      >
        <div className="px-4 py-3.5 flex items-center gap-3">
          {/* Decorative icon — column/temple motif */}
          <div className="w-9 h-9 rounded-lg bg-warm-gold/10 flex items-center justify-center shrink-0 group-hover:bg-warm-gold/20 transition-colors duration-300">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-warm-gold">
              <path d="M10 2L3 6V7H17V6L10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M5 7V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M10 7V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M15 7V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M3 14H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M2 17H18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <span className="block font-serif text-[15px] font-semibold text-ink group-hover:text-warm-gold transition-colors duration-300">
              Ask the Philosophers
            </span>
            <span className="block text-[10px] font-mono text-ink-faint tracking-wide mt-0.5">
              Pose your question to the Agora
            </span>
          </div>
        </div>
      </Link>

      {/* Following — scrollable */}
      <div className="flex-1 min-h-0 px-2">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-[9px] font-mono tracking-[0.25em] uppercase text-ink-faint shrink-0">
            Following
          </h3>
          <div className="flex-1 h-px bg-border-light/60" />
        </div>
        <div className="overflow-y-auto max-h-[calc(100vh-380px)] space-y-1.5 pr-1">
          {philosophers.map((p) => (
            <Link
              key={p.id}
              href={`/philosophers/${p.id}`}
              className="flex items-center gap-2.5 py-1.5 group"
            >
              <PhilosopherAvatar philosopherId={p.id} name={p.name} color={p.color} initials={p.initials} size="sm" />
              <span
                className="text-sm text-ink-light transition-colors duration-200 truncate font-serif"
                onMouseEnter={(e) => (e.currentTarget.style.color = p.color)}
                onMouseLeave={(e) => (e.currentTarget.style.color = '')}
              >
                {p.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
