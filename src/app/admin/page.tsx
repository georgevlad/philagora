import { getDb } from "@/lib/db";

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

function getStats() {
  const db = getDb();

  const posts = db.prepare("SELECT COUNT(*) as count FROM posts").get() as StatRow;
  const debates = db.prepare("SELECT COUNT(*) as count FROM debates").get() as StatRow;
  const threads = db.prepare("SELECT COUNT(*) as count FROM agora_threads").get() as StatRow;
  const logs = db.prepare("SELECT COUNT(*) as count FROM generation_log").get() as StatRow;

  return {
    posts: posts.count,
    debates: debates.count,
    threads: threads.count,
    logs: logs.count,
  };
}

function getRecentGenerations(): GenerationLogRow[] {
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT
        g.id,
        p.name AS philosopher_name,
        g.content_type,
        g.status,
        g.created_at
      FROM generation_log g
      JOIN philosophers p ON p.id = g.philosopher_id
      ORDER BY g.created_at DESC
      LIMIT 10`
    )
    .all() as GenerationLogRow[];

  return rows;
}

const STATUS_STYLES: Record<string, string> = {
  generated: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  published: "bg-terracotta/10 text-terracotta",
  pending: "bg-yellow-100 text-yellow-800",
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  post: "Post",
  debate_opening: "Debate Opening",
  debate_rebuttal: "Debate Rebuttal",
  agora_response: "Agora Response",
  reflection: "Reflection",
};

function formatDate(iso: string): string {
  const d = new Date(iso + "Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminDashboard() {
  const stats = getStats();
  const recentGenerations = getRecentGenerations();

  const statCards = [
    { label: "Total Posts", value: stats.posts, icon: "\u270D" },
    { label: "Total Debates", value: stats.debates, icon: "\u2694" },
    { label: "Agora Threads", value: stats.threads, icon: "\u2753" },
    { label: "Generation Logs", value: stats.logs, icon: "\u2699" },
  ];

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-ink">Dashboard</h1>
        <p className="text-sm text-ink-lighter mt-1">
          Overview of Philagora content and generation activity.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white border border-border rounded-xl px-5 py-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-ink-lighter">
                {card.label}
              </span>
              <span className="text-lg">{card.icon}</span>
            </div>
            <p className="font-serif text-3xl font-bold text-ink">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Recent generations */}
      <div>
        <h2 className="font-serif text-lg font-bold text-ink mb-4">
          Recent Generations
        </h2>

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
                      {formatDate(entry.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
