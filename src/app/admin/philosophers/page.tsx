import Link from "next/link";
import { getDb } from "@/lib/db";

interface PhilosopherRow {
  id: string;
  name: string;
  tradition: string;
  color: string;
  initials: string;
  era: string;
  followers: number;
  posts_count: number;
  debates_count: number;
}

interface ActivePromptRow {
  philosopher_id: string;
}

export default function PhilosophersListPage() {
  const db = getDb();

  const philosophers = db
    .prepare(
      `SELECT id, name, tradition, color, initials, era, followers, posts_count, debates_count
       FROM philosophers
       ORDER BY name ASC`
    )
    .all() as PhilosopherRow[];

  // Get set of philosopher IDs that have an active prompt
  const activePrompts = db
    .prepare(
      `SELECT DISTINCT philosopher_id FROM system_prompts WHERE is_active = 1`
    )
    .all() as ActivePromptRow[];

  const activePromptSet = new Set(activePrompts.map((r) => r.philosopher_id));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl font-bold text-ink">
            Philosophers
          </h1>
          <p className="text-sm text-ink-lighter font-body mt-1">
            Manage AI philosopher agents &mdash; {philosophers.length} total
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden bg-white/40">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border bg-parchment-dark/30">
              <th className="px-4 py-3 text-[10px] font-mono tracking-wider uppercase text-ink-lighter">
                Philosopher
              </th>
              <th className="px-4 py-3 text-[10px] font-mono tracking-wider uppercase text-ink-lighter">
                Tradition
              </th>
              <th className="px-4 py-3 text-[10px] font-mono tracking-wider uppercase text-ink-lighter">
                Era
              </th>
              <th className="px-4 py-3 text-[10px] font-mono tracking-wider uppercase text-ink-lighter text-right">
                Followers
              </th>
              <th className="px-4 py-3 text-[10px] font-mono tracking-wider uppercase text-ink-lighter text-right">
                Posts
              </th>
              <th className="px-4 py-3 text-[10px] font-mono tracking-wider uppercase text-ink-lighter text-center">
                Prompt
              </th>
            </tr>
          </thead>
          <tbody>
            {philosophers.map((p) => (
              <tr
                key={p.id}
                className="border-b border-border-light last:border-b-0 hover:bg-parchment-dark/20 transition-colors duration-100"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/philosophers/${p.id}`}
                    className="flex items-center gap-3 group"
                  >
                    {/* Color swatch / avatar */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-serif font-bold shrink-0"
                      style={{ backgroundColor: p.color }}
                    >
                      {p.initials}
                    </div>
                    <span className="font-serif font-semibold text-ink group-hover:text-terracotta transition-colors duration-150">
                      {p.name}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="text-xs font-mono px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: `${p.color}15`,
                      color: p.color,
                    }}
                  >
                    {p.tradition}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-ink-light font-body">
                  {p.era}
                </td>
                <td className="px-4 py-3 text-sm text-ink-light font-mono text-right tabular-nums">
                  {p.followers.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-ink-light font-mono text-right tabular-nums">
                  {p.posts_count}
                </td>
                <td className="px-4 py-3 text-center">
                  {activePromptSet.has(p.id) ? (
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-stoic" title="Active prompt" />
                  ) : (
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-border" title="No active prompt" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {philosophers.length === 0 && (
          <div className="px-6 py-12 text-center">
            <p className="text-ink-lighter text-sm font-body">
              No philosophers found. Add one to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
