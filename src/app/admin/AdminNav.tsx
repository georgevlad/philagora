"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const sections = [
  {
    label: "Editorial",
    items: [
      ["", "Overview"],
      ["news-scout", "News Scout"],
      ["daily", "Daily Planner"],
      ["posts", "Posts"],
      ["content", "Generate content"],
      ["in-focus", "In Focus Workshop"],
      ["feed-preview", "Live feed"],
    ],
  },
  {
    label: "Conversations",
    items: [
      ["debates", "Debates"],
      ["agora", "Agora"],
    ],
  },
  {
    label: "Library",
    items: [
      ["philosophers", "Philosophers"],
      ["everyday", "Scenarios"],
      ["historical-events", "Today in History"],
    ],
  },
  {
    label: "Settings",
    items: [
      ["prompts", "Persona prompts"],
      ["templates", "Templates & house rules"],
      ["scoring", "News scoring"],
      ["mood-palettes", "Mood palettes"],
      ["generation-settings", "AI models"],
      ["news-scout/sources", "RSS sources"],
    ],
  },
  {
    label: "Operations",
    items: [
      ["users", "Users"],
      ["api-logs", "API logs"],
    ],
  },
];
function NavIcon({ index }: { index: number }) {
  const paths = [
    "M3 3h6v6H3zM13 3h6v6h-6zM3 13h6v6H3zM13 13h6v6h-6z",
    "M4 4h14v16H4zM7 8h8M7 12h8M7 16h5",
    "M3 5h16v14H3zM7 2v6M15 2v6M3 10h16",
    "M4 6h14M4 11h14M4 16h14",
    "M4 18l3-6L16 3l3 3-9 9-6 3z",
    "M2 11s4-7 9-7 9 7 9 7-4 7-9 7-9-7-9-7zM8 11a3 3 0 106 0 3 3 0 10-6 0",
  ];
  return (
    <svg
      viewBox="0 0 22 22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[index % paths.length]} />
    </svg>
  );
}
export function AdminNav() {
  const pathname = usePathname();
  function active(path: string) {
    const href = `/admin${path ? `/${path}` : ""}`;
    return path
      ? pathname.startsWith(href) &&
          !(path === "news-scout" && pathname.includes("/sources"))
      : pathname === href;
  }
  return (
    <nav className="admin-nav" aria-label="Administration">
      {sections.map((section) => {
        const links = section.items.map(([path, label], index) => (
          <Link
            key={path}
            href={`/admin${path ? `/${path}` : ""}`}
            aria-current={active(path) ? "page" : undefined}
          >
            <NavIcon index={index} />
            <span>{label}</span>
          </Link>
        ));
        return section.label === "Settings" ? (
          <details
            key={section.label}
            className="admin-nav-group"
            open={section.items.some(([path]) => active(path)) || undefined}
          >
            <summary>Settings</summary>
            {links}
          </details>
        ) : (
          <div className="admin-nav-group" key={section.label}>
            <div className="admin-nav-heading">{section.label}</div>
            {links}
          </div>
        );
      })}
    </nav>
  );
}
