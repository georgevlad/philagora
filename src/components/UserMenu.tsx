"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { signOut, useSession } from "@/lib/auth-client";

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

export function UserMenu() {
  const { data: session, isPending } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isPending) {
    return <div className="h-8 w-8 animate-pulse rounded-full bg-border-light/60" />;
  }

  if (!session?.user) {
    return (
      <Link
        href="/sign-in"
        className="flex items-center gap-2 rounded-full border border-border-light bg-white/80 px-3.5 py-1.5 text-xs font-mono text-ink-lighter transition-colors hover:border-border hover:bg-parchment hover:text-ink"
      >
        Sign in
      </Link>
    );
  }

  const user = session.user;
  const displayName = user.name || "Philosopher";
  const initials = getInitials(user.name || user.email);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-full p-0.5 transition-colors hover:bg-parchment-dark/40"
        aria-label="User menu"
      >
        {user.image ? (
          <img
            src={user.image}
            alt={`${displayName} avatar`}
            className="h-8 w-8 rounded-full border border-border-light/80 object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-athenian/20 bg-athenian/15 text-[11px] font-mono font-medium text-athenian">
            {initials}
          </div>
        )}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-border-light bg-parchment shadow-lg">
          <div className="border-b border-border-light/80 px-4 py-3">
            <p className="truncate text-sm font-body font-medium text-ink">{displayName}</p>
            <p className="mt-0.5 truncate text-[11px] font-mono text-ink-lighter">{user.email}</p>
          </div>

          <div className="py-1.5">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm font-body text-ink-light transition-colors hover:bg-parchment-dark/40 hover:text-ink"
            >
              My Profile
            </Link>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void signOut().then(() => window.location.reload());
              }}
              className="block w-full px-4 py-2 text-left text-sm font-body text-ink-light transition-colors hover:bg-parchment-dark/40 hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function UserNavItem() {
  const pathname = usePathname();
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="flex flex-col items-center gap-0.5 px-3 py-1.5">
        <div className="h-5 w-5 animate-pulse rounded-full bg-border-light/60" />
        <span className="text-[10px] font-mono text-ink-lighter">Profile</span>
      </div>
    );
  }

  const href = session?.user ? "/profile" : "/sign-in";
  const label = session?.user ? "Profile" : "Sign in";
  const isActive = pathname === href || (href === "/profile" && pathname.startsWith("/profile"));
  const initials = session?.user ? getInitials(session.user.name || session.user.email) : "";

  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-colors ${
        isActive ? "bg-athenian/8 text-athenian" : "text-ink-faint/70 hover:text-athenian"
      }`}
    >
      {session?.user?.image ? (
        <img
          src={session.user.image}
          alt={`${session.user.name || "User"} avatar`}
          className="h-5 w-5 rounded-full border border-border-light/80 object-cover"
        />
      ) : session?.user ? (
        <div className="flex h-5 w-5 items-center justify-center rounded-full border border-athenian/20 bg-athenian/15 text-[8px] font-mono font-medium text-athenian">
          {initials}
        </div>
      ) : (
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
      )}
      <span className="text-[10px] font-mono">{label}</span>
    </Link>
  );
}
