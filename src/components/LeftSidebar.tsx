"use client";

/* eslint-disable @next/next/no-img-element */

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import type { Philosopher } from "@/lib/types";
import { AgoraIcon, DebatesIcon, HomeIcon } from "./Icons";
import { PhilosopherAvatar } from "./PhilosopherAvatar";

const navItems = [
  {
    label: "Feed",
    href: "/",
    icon: <HomeIcon />,
  },
  {
    label: "Debates",
    href: "/debates",
    icon: <DebatesIcon />,
  },
  {
    label: "The Agora",
    href: "/agora",
    icon: <AgoraIcon />,
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
  {
    label: "About",
    href: "/about",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="10" cy="10" r="7" />
        <path d="M10 9V14" strokeLinecap="round" />
        <circle cx="10" cy="7" r="0.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

function getInitials(value: string) {
  return value
    .split(" ")
    .map((word) => word.trim())
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getUserLabel(name: string | null | undefined, email: string) {
  const firstName = name?.trim().split(/\s+/)[0];
  return firstName || email;
}

export function LeftSidebar({ philosophers }: { philosophers: Philosopher[] }) {
  const pathname = usePathname();
  const { data: session, isPending } = useSession();

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 sticky top-0 h-screen border-r border-border-light/80 bg-parchment-dark/55 supports-[backdrop-filter]:backdrop-blur-sm py-6 px-4 shadow-[inset_-1px_0_0_rgba(255,255,255,0.35)]">
      {/* Logo */}
      <Link href="/" className="group mb-8 block px-4 py-5">
        <div className="flex items-center gap-3">
          <Image
            src="/logo-icon.svg"
            alt=""
            aria-hidden="true"
            width={40}
            height={40}
            className="h-10 w-10 flex-shrink-0"
          />
          <div className="min-w-0 border-l border-ink/20 pl-3 transition-colors duration-200 group-hover:border-athenian/25">
            <span className="mb-1 block font-display text-[30px] leading-none tracking-[0.03em] text-ink transition-colors duration-200 group-hover:text-athenian">
              Philagora
            </span>
            <p className="mt-[2px] text-[8px] leading-tight tracking-[0.06em] text-ink/75 uppercase transition-colors duration-200 group-hover:text-athenian/85">
              The philosophers are online
            </p>
          </div>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="space-y-1.5 mb-6">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href) && item.href !== "#";

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`relative flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium tracking-wide transition-all duration-200 ${
                isActive
                  ? "bg-athenian/10 text-athenian border border-athenian/10 shadow-[0_10px_24px_rgba(35,57,46,0.08)]"
                  : "text-ink-light hover:bg-parchment-tint/80 hover:text-ink border border-transparent"
              }`}
            >
              {isActive && <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full bg-gold" />}
              <span className={isActive ? "text-athenian" : "text-ink-lighter"}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mb-4">
        {isPending ? (
          <div className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-ink-light">
            <div className="h-8 w-8 animate-pulse rounded-full bg-border-light/60" />
            <div className="h-4 w-24 animate-pulse rounded bg-border-light/60" />
          </div>
        ) : session?.user ? (
          <Link
            href="/profile"
            className={`relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium tracking-wide transition-all duration-200 ${
              pathname.startsWith("/profile")
                ? "bg-athenian/10 text-athenian border border-athenian/10 shadow-[0_10px_24px_rgba(35,57,46,0.08)]"
                : "text-ink-light hover:bg-parchment-tint/80 hover:text-athenian border border-transparent"
            }`}
          >
            {pathname.startsWith("/profile") ? (
              <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full bg-gold" />
            ) : null}
            {session.user.image ? (
              <img
                src={session.user.image}
                alt={`${session.user.name || "User"} avatar`}
                className="h-8 w-8 rounded-full border border-border-light/80 object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-athenian/20 bg-athenian/15 text-[11px] font-mono font-medium text-athenian">
                {getInitials(session.user.name || session.user.email)}
              </div>
            )}
            <span className="truncate">
              {getUserLabel(session.user.name, session.user.email)}
            </span>
          </Link>
        ) : (
          <Link
            href="/sign-in"
            className={`relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium tracking-wide transition-all duration-200 ${
              pathname.startsWith("/sign-in")
                ? "bg-athenian/10 text-athenian border border-athenian/10 shadow-[0_10px_24px_rgba(35,57,46,0.08)]"
                : "text-ink-light hover:bg-parchment-tint/80 hover:text-athenian border border-transparent"
            }`}
          >
            {pathname.startsWith("/sign-in") ? (
              <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full bg-gold" />
            ) : null}
            <span className={pathname.startsWith("/sign-in") ? "text-athenian" : "text-ink-lighter"}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <circle cx="10" cy="7" r="3" />
                <path d="M4 17C4 14 6.5 12 10 12C13.5 12 16 14 16 17" strokeLinecap="round" />
              </svg>
            </span>
            <span>Sign in</span>
          </Link>
        )}
      </div>

      {/* Ask CTA */}
      <Link
        href="/agora"
        className="group mx-2 mb-6 block overflow-hidden rounded-2xl border border-gold/35 bg-[linear-gradient(135deg,rgba(248,243,234,0.95),rgba(238,230,216,0.96))] hover:border-gold/60 transition-all duration-300 shadow-[0_10px_30px_rgba(101,83,55,0.08)] hover:shadow-[0_14px_32px_rgba(101,83,55,0.12)]"
      >
        <div className="px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/12 flex items-center justify-center shrink-0 group-hover:bg-gold/18 transition-colors duration-300">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-gold">
              <path d="M10 2L3 6V7H17V6L10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M5 7V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M10 7V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M15 7V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M3 14H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M2 17H18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <span className="block font-serif text-[18px] font-semibold text-ink group-hover:text-athenian transition-colors duration-300 leading-tight">
              Ask the Philosophers
            </span>
            <span className="block text-[10px] font-mono text-ink-faint tracking-[0.18em] uppercase mt-1">
              Your question. Their wisdom.
            </span>
          </div>
        </div>
      </Link>

      {/* Following - scrollable */}
      <div className="flex-1 min-h-0 px-2">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-[9px] font-mono tracking-[0.28em] uppercase text-ink-faint shrink-0">
            Following
          </h3>
          <div className="flex-1 h-px bg-gradient-to-r from-border-light/20 via-border-light to-border-light/20" />
        </div>
        <div className="h-full overflow-y-auto space-y-1 pr-1">
          {philosophers.map((p) => (
            <Link
              key={p.id}
              href={`/philosophers/${p.id}`}
              className="flex items-center gap-2.5 py-2 px-2 rounded-lg group hover:bg-parchment-tint/70 transition-colors duration-200"
            >
              <PhilosopherAvatar philosopherId={p.id} name={p.name} color={p.color} initials={p.initials} size="sm" />
              <span
                className="text-sm text-ink-light transition-colors duration-200 truncate font-serif"
                onMouseEnter={(e) => (e.currentTarget.style.color = p.color)}
                onMouseLeave={(e) => (e.currentTarget.style.color = "")}
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
