"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSession } from "@/lib/auth-client";

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
