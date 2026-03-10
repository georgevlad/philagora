"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileNav() {
  const pathname = usePathname();

  const items = [
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
      label: "Agora",
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
      label: "Profile",
      href: "/philosophers/marcus-aurelius",
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="10" cy="7" r="3" />
          <path d="M4 17C4 14 6.5 12 10 12C13.5 12 16 14 16 17" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* Top bar on mobile */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-parchment/92 supports-[backdrop-filter]:backdrop-blur-md border-b border-border-light/90 px-4 py-3 shadow-[0_6px_18px_rgba(42,36,31,0.05)]">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="" width={28} height={28} />
            <div>
              <h1
                className="text-xl font-bold text-athenian italic leading-none"
                style={{ fontFamily: "var(--font-cormorant), var(--font-playfair), serif" }}
              >
                Philagora
              </h1>
              <span className="text-[9px] font-mono uppercase tracking-[0.24em] text-ink-faint">
                Forum
              </span>
            </div>
          </Link>
          <Link
            href="/agora"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-athenian text-white text-xs font-medium rounded-full border border-gold/25 shadow-sm"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3V13" strokeLinecap="round" />
              <path d="M3 8H13" strokeLinecap="round" />
            </svg>
            Ask
          </Link>
        </div>
      </div>

      {/* Bottom nav on mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-parchment/96 supports-[backdrop-filter]:backdrop-blur-md border-t border-border-light/90 shadow-[0_-6px_18px_rgba(42,36,31,0.05)]">
        <div className="flex items-center justify-around py-2">
          {items.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                  isActive ? "text-athenian bg-athenian/8" : "text-ink-lighter"
                }`}
              >
                {item.icon}
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
