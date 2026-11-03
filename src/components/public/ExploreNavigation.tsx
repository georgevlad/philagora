"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { exploreDestinations, isExplorePath } from "@/lib/public-navigation";

export function ExploreNavigation() {
  const pathname = usePathname();
  if (!isExplorePath(pathname)) return null;
  return (
    <nav className="public-explore-nav" aria-label="Explore Philagora">
      {exploreDestinations.map(({ href, label }) => (
        <Link key={href} href={href} aria-current={
          pathname === href || pathname.startsWith(`${href}/`) ||
          (href === "/feed" && pathname.startsWith("/post/"))
            ? "page" : undefined
        }>{label}</Link>
      ))}
    </nav>
  );
}
