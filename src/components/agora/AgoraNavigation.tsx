"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AgoraAccountLink } from "./AgoraAccountLink";
import { isExplorePath } from "@/lib/public-navigation";

export function AgoraNavigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation">
      {[
        ["/", "Ask"],
        ["/explore", "Explore"],
        ["/philosophers", "Philosophers"],
      ].map(([href, label]) => (
        <Link
          key={href}
          href={href === "/" ? "/#ask" : href}
          aria-current={
            pathname === href ||
            (href === "/explore" && isExplorePath(pathname)) ||
            (href === "/philosophers" &&
              (pathname.startsWith("/philosophers/") || pathname === "/schools"))
              ? "page"
              : undefined
          }
        >
          {label}
        </Link>
      ))}
      <AgoraAccountLink />
    </nav>
  );
}
