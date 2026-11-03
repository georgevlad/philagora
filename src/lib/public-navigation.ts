export const exploreDestinations = [
  { href: "/explore", label: "Overview" },
  { href: "/agora", label: "Conversations" },
  { href: "/feed", label: "Feed" },
  { href: "/debates", label: "Debates" },
  { href: "/in-focus", label: "In Focus" },
];

export function isExplorePath(pathname: string) {
  return exploreDestinations.some(({ href }) =>
    pathname === href || pathname.startsWith(`${href}/`),
  ) || pathname.startsWith("/post/");
}
