import Link from "next/link";
import fs from "fs";
import { getDb } from "@/lib/db";
import { formatDateTime } from "@/lib/date-utils";
import { STATUS_STYLES, CONTENT_TYPE_LABELS } from "@/lib/constants";
import { resolveDatabasePath } from "../../../db/index";

interface StatRow {
  count: number;
}

interface GenerationLogRow {
  id: number;
  philosopher_name: string;
  content_type: string;
  status: string;
  created_at: string;
}

function getActionStats() {
  const db = getDb();

  const unscored = db
    .prepare("SELECT COUNT(*) as count FROM article_candidates WHERE status = 'new'")
    .get() as StatRow;

  const approvedNoPosts = db
    .prepare(
      `SELECT COUNT(*) as count FROM article_candidates ac
       WHERE ac.status = 'approved'
         AND NOT EXISTS (
           SELECT 1 FROM posts p
           WHERE p.citation_url = ac.url
             AND p.status IN ('draft', 'approved', 'published')
         )`
    )
    .get() as StatRow;

  const draftPosts = db
    .prepare("SELECT COUNT(*) as count FROM posts WHERE status = 'draft'")
    .get() as StatRow;

  const approvedPosts = db
    .prepare("SELECT COUNT(*) as count FROM posts WHERE status = 'approved'")
    .get() as StatRow;

  return {
    unscored: unscored.count,
    approvedNoPosts: approvedNoPosts.count,
    draftPosts: draftPosts.count,
    approvedPosts: approvedPosts.count,
  };
}

function getQuickStats() {
  const db = getDb();

  const published = db
    .prepare("SELECT COUNT(*) as count FROM posts WHERE status = 'published'")
    .get() as StatRow;
  const debates = db
    .prepare("SELECT COUNT(*) as count FROM debates")
    .get() as StatRow;
  const threads = db
    .prepare("SELECT COUNT(*) as count FROM agora_threads")
    .get() as StatRow;
  const sources = db
    .prepare("SELECT COUNT(*) as count FROM news_sources WHERE is_active = 1")
    .get() as StatRow;

  return {
    published: published.count,
    debates: debates.count,
    threads: threads.count,
    sources: sources.count,
  };
}

function getRecentGenerations(): GenerationLogRow[] {
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT
        g.id,
        COALESCE(p.name, 'Editorial') AS philosopher_name,
        g.content_type,
        g.status,
        g.created_at
      FROM generation_log g
      LEFT JOIN philosophers p ON p.id = g.philosopher_id
      ORDER BY g.created_at DESC
      LIMIT 5`
    )
    .all() as GenerationLogRow[];

  return rows;
}

function getDatabaseMeta() {
  try {
    const dbPath = resolveDatabasePath();
    const stats = fs.statSync(dbPath);

    return {
      size: stats.size,
    };
  } catch {
    return null;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function AdminDashboard() {
  const actions = getActionStats();
  const quick = getQuickStats();
  const recentGenerations = getRecentGenerations();
  const databaseMeta = getDatabaseMeta();

  const actionCards = [
    {
      label: "Unscored Articles",
      value: actions.unscored,
      icon: "📰",
      href: "/admin/news-scout",
      color: "amber" as const,
    },
    {
      label: "Approved, No Posts",
      value: actions.approvedNoPosts,
      icon: "✍️",
      href: "/admin/news-scout?tab=approved",
      color: "amber" as const,
    },
    {
      label: "Draft Posts",
      value: actions.draftPosts,
      icon: "📝",
      href: "/admin/posts?status=draft",
      color: "blue" as const,
    },
    {
      label: "Approved Posts",
      value: actions.approvedPosts,
      icon: "✅",
      href: "/admin/posts?status=approved",
      color: "blue" as const,
    },
  ];

  const borderColors = {
    amber: "border-l-4 border-l-amber-400",
    blue: "border-l-4 border-l-blue-400",
  };

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-ink">Dashboard</h1>
        <p className="text-sm text-ink-lighter mt-1">
          Items that need your attention.
        </p>
      </div>

      {/* A) Action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {actionCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={`bg-white border border-border rounded-xl px-6 py-5 shadow-sm hover:shadow-md hover:border-border-light transition-all duration-150 ${
              card.value > 0 ? borderColors[card.color] : ""
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-ink-lighter">
                {card.label}
              </span>
              <span className="text-lg">{card.icon}</span>
            </div>
            <p className="font-serif text-3xl font-bold text-ink">{card.value}</p>
          </Link>
        ))}
      </div>

      {/* B) Quick stats row */}
      <div className="text-xs font-mono text-ink-lighter mb-10 px-1">
        Published Posts:{" "}
        <Link href="/admin/posts?status=published" className="text-ink-light hover:text-terracotta transition-colors">
          {quick.published}
        </Link>
        {"  ·  "}
        Completed Debates:{" "}
        <Link href="/admin/debates" className="text-ink-light hover:text-terracotta transition-colors">
          {quick.debates}
        </Link>
        {"  ·  "}
        Agora Threads:{" "}
        <Link href="/admin/agora" className="text-ink-light hover:text-terracotta transition-colors">
          {quick.threads}
        </Link>
        {"  ·  "}
        RSS Sources:{" "}
        <Link href="/admin/news-scout/sources" className="text-ink-light hover:text-terracotta transition-colors">
          {quick.sources}
        </Link>
      </div>

      {/* C) Recent generations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg font-bold text-ink">
            Recent Generations
          </h2>
          <Link
            href="/admin/content"
            className="text-xs font-mono text-terracotta hover:text-terracotta-light transition-colors"
          >
            View all &rarr;
          </Link>
        </div>

        {recentGenerations.length === 0 ? (
          <div className="bg-white border border-border rounded-xl px-6 py-10 text-center">
            <p className="text-ink-lighter text-sm">
              No generation log entries yet. Generate some content to see activity here.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-parchment-dark/30">
                  <th className="text-left px-5 py-3 font-mono text-xs uppercase tracking-wider text-ink-lighter">
                    Philosopher
                  </th>
                  <th className="text-left px-5 py-3 font-mono text-xs uppercase tracking-wider text-ink-lighter">
                    Content Type
                  </th>
                  <th className="text-left px-5 py-3 font-mono text-xs uppercase tracking-wider text-ink-lighter">
                    Status
                  </th>
                  <th className="text-left px-5 py-3 font-mono text-xs uppercase tracking-wider text-ink-lighter">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentGenerations.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-border-light last:border-b-0 hover:bg-parchment-dark/20 transition-colors"
                  >
                    <td className="px-5 py-3 font-body text-ink">
                      {entry.philosopher_name}
                    </td>
                    <td className="px-5 py-3 text-ink-light">
                      {CONTENT_TYPE_LABELS[entry.content_type] ?? entry.content_type}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          STATUS_STYLES[entry.status] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink-lighter text-xs font-mono">
                      {formatDateTime(entry.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-8">
        <div className="bg-white border border-border rounded-xl px-6 py-5 shadow-sm">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-serif text-lg font-bold text-ink">Database</h2>
              <p className="text-sm text-ink-lighter mt-1">
                Download a snapshot of the current SQLite database for local browsing or backup.
              </p>
              {databaseMeta && (
                <p className="text-xs font-mono text-ink-lighter mt-2">
                  Current size: {formatBytes(databaseMeta.size)}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex flex-col items-start">
                <a
                  href="/api/admin/export-samples"
                  title="Download .txt with sample posts for editorial review"
                  className="inline-flex items-center gap-2 bg-white hover:bg-parchment-dark/45 text-ink text-sm font-body px-5 py-2.5 rounded-full transition-colors shadow-sm border border-border"
                >
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path d="M4 2.5H9L12 5.5V13.5H4V2.5Z" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 2.5V5.5H12" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6 8H10" strokeLinecap="round" />
                    <path d="M6 10.5H10" strokeLinecap="round" />
                  </svg>
                  <span>Export Content Samples</span>
                </a>
                <p className="text-[11px] text-ink-lighter mt-1.5 px-2">
                  Download .txt with sample posts for editorial review
                </p>
              </div>

              <a
                href="/api/admin/download-db"
                className="inline-flex items-center gap-2 bg-terracotta hover:bg-terracotta-light text-white text-sm font-body px-5 py-2.5 rounded-full transition-colors shadow-sm"
              >
                <span>Download Database</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
