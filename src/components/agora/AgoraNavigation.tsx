"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AgoraAccountLink } from "./AgoraAccountLink";

export function AgoraNavigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation">
      {[
        ["/agora", "The Agora"],
        ["/feed", "Feed"],
        ["/debates", "Debates"],
      ].map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={
            pathname === href ||
            pathname.startsWith(`${href}/`) ||
            (href === "/feed" && pathname.startsWith("/post/"))
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
