"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AgoraIcon, DebatesIcon, HomeIcon } from "./Icons";
import { UserNavItem } from "./UserMenu";

export function MobileNav({ topContent }: { topContent?: ReactNode }) {
  const pathname = usePathname();

  const items = [
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
      label: "Agora",
      href: "/agora",
      icon: <AgoraIcon />,
    },
  ];

  return (
    <>
      {/* Top bar on mobile */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-parchment/92 supports-[backdrop-filter]:backdrop-blur-md shadow-[0_6px_18px_rgba(42,36,31,0.05)]">
        <div className={`px-4 ${topContent ? "py-2" : "py-2.5 border-b border-border-light/90"}`}>
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="min-w-0 text-ink">
              <div className="flex items-center gap-2">
                <Image
                  src="/logo-icon.svg"
                  alt=""
                  aria-hidden="true"
                  width={32}
                  height={32}
                  className="h-8 w-8 flex-shrink-0"
                />
                <div className="border-l border-ink/15 pl-2">
                  <span className="block font-display text-[25px] leading-none tracking-[0.03em] text-ink">
                    Philagora
                  </span>
                  <p className="mt-[2px] whitespace-nowrap text-[7.5px] leading-tight tracking-[0.18em] text-ink/50 uppercase">
                    The philosophers are online
                  </p>
                </div>
              </div>
            </Link>
            <Link
              href="/agora"
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-gold/25 bg-athenian px-3.5 py-2 text-[12px] font-medium text-white shadow-sm"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3V13" strokeLinecap="round" />
                <path d="M3 8H13" strokeLinecap="round" />
              </svg>
              Ask
            </Link>
          </div>
        </div>
        {topContent}
      </div>

      {/* Bottom nav on mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-parchment/96 supports-[backdrop-filter]:backdrop-blur-md border-t border-border-light/90 shadow-[0_-6px_18px_rgba(42,36,31,0.05)]">
        <div className="flex items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {items.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const itemClasses = `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
              isActive ? "text-athenian bg-athenian/8" : "text-ink-lighter"
            }`;

            return (
              <Link
                key={item.label}
                href={item.href}
                className={itemClasses}
              >
                {item.icon}
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
          <UserNavItem />
        </div>
      </nav>
    </>
  );
}
