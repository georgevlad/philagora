"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/Spinner";
import { STANCE_CONFIG } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/date-utils";
import { classifyPostFormat } from "@/lib/feed-utils";
import type { Stance } from "@/lib/types";

interface AnnotatedPost {
  id: string;
  philosopherId: string;
  philosopherName: string;
  philosopherColor: string;
  philosopherInitials: string;
  content: string;
  thesis: string;
  stance: string;
  tag: string;
  sourceType?: string;
  replyTo?: string;
  citation?: { title: string; source: string; url?: string };
  timestamp: string;
  createdAt: string;
  replyTargetPhilosopherName?: string;
  _chronoRank: number;
  _shift: number;
}

interface CompositionStats {
  total: number;
  byPhilosopher: { id: string; name: string; count: number; pct: number }[];
  bySourceType: { type: string; count: number; pct: number }[];
  byStance: { stance: string; count: number; pct: number }[];
  byTag: { tag: string; count: number; pct: number }[];
  byFormat: { format: string; count: number; pct: number }[];
}

interface FeedPreviewResponse {
  chronological: AnnotatedPost[];
  interleaved: AnnotatedPost[];
  stats: CompositionStats;
}

interface Segment {
  key: string;
  label: string;
  count: number;
  pct: number;
  color: string;
}

const FORMAT_COLORS: Record<string, string> = {
  "News Reaction": "#4A7C6F",
  Quip: "#B08A49",
  "Cross-Reply": "#7A3E3A",
  Reflection: "#6B7280",
  Historical: "#92400E",
  Everyday: "#4338CA",
};

const SOURCE_TYPE_COLORS: Record<string, string> = {
  news: "#4A7C6F",
  reflection: "#6B7280",
  historical_event: "#92400E",
  everyday: "#4338CA",
};

function getTopSegments(
  items: Array<{ label: string; count: number; pct: number; color: string }>,
  maxSegments = 4
): Segment[] {
  const topItems = items.slice(0, maxSegments);
  const otherItems = items.slice(maxSegments);
  const segments = topItems.map((item) => ({
    key: item.label,
    label: item.label,
    count: item.count,
    pct: item.pct,
    color: item.color,
  }));

  if (otherItems.length > 0) {
    segments.push({
      key: "Other",
      label: `+${otherItems.length} others`,
      count: otherItems.reduce((sum, item) => sum + item.count, 0),
      pct: otherItems.reduce((sum, item) => sum + item.pct, 0),
      color: "#CFC4B6",
    });
  }

  return segments;
}

function getPhilosopherLabel(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] || name;
}

function buildPreviewLine(post: AnnotatedPost): string {
  if (post.citation?.title) return post.citation.title;

  const trimmed = post.content.replace(/\s+/g, " ").trim();
  return trimmed.length <= 60 ? trimmed : `${trimmed.slice(0, 60)}...`;
}

function renderShift(shift: number) {
  if (shift > 0) {
    return <span className="font-mono text-xs text-green-700">{"\u2191"}{shift}</span>;
  }

  if (shift < 0) {
    return <span className="font-mono text-xs text-amber-700">{"\u2193"}{Math.abs(shift)}</span>;
  }

  return <span className="font-mono text-xs text-ink-lighter">{"\u2014"}</span>;
}

function StatsBlock({
  title,
  total,
  segments,
}: {
  title: string;
  total: number;
  segments: Segment[];
}) {
  return (
    <div className="rounded-xl border border-border-light bg-white px-4 py-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-sm font-serif text-ink">{title}</h2>
        <span className="text-[11px] font-mono uppercase tracking-wider text-ink-lighter">
          {total} total
        </span>
      </div>
      <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-parchment-dark/50">
        {segments.map((segment) => (
          <div
            key={segment.key}
            className="h-full"
            style={{
              width: `${segment.pct}%`,
              backgroundColor: segment.color,
            }}
            title={`${segment.label}: ${segment.count} (${segment.pct}%)`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-2 text-xs text-ink-light">
        {segments.map((segment) => (
          <span key={segment.key} className="font-body">
            {segment.label} {segment.pct}%
          </span>
        ))}
      </div>
    </div>
  );
}

export default function FeedPreviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"interleaved" | "chronological">("interleaved");
  const [chronological, setChronological] = useState<AnnotatedPost[]>([]);
  const [interleaved, setInterleaved] = useState<AnnotatedPost[]>([]);
  const [stats, setStats] = useState<CompositionStats | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setError(null);
        const response = await fetch("/api/admin/feed-preview", { cache: "no-store" });

        if (!response.ok) {
          throw new Error("Failed to load feed preview");
        }

        const data = (await response.json()) as FeedPreviewResponse;
        setChronological(data.chronological);
        setInterleaved(data.interleaved);
        setStats(data.stats);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const activePosts = view === "interleaved" ? interleaved : chronological;
  const philosopherColorMap = new Map<string, string>();

  for (const post of chronological) {
    if (!philosopherColorMap.has(post.philosopherId)) {
      philosopherColorMap.set(post.philosopherId, post.philosopherColor);
    }
  }

  const philosopherSegments = getTopSegments(
    (stats?.byPhilosopher ?? []).map((item) => ({
      label: getPhilosopherLabel(item.name),
      count: item.count,
      pct: item.pct,
      color: philosopherColorMap.get(item.id) || "#A88C6D",
    }))
  );

  const formatSegments = getTopSegments(
    (stats?.byFormat ?? []).map((item) => ({
      label: item.format,
      count: item.count,
      pct: item.pct,
      color: FORMAT_COLORS[item.format] || "#A88C6D",
    }))
  );

  const sourceTypeSegments = getTopSegments(
    (stats?.bySourceType ?? []).map((item) => ({
      label: item.type,
      count: item.count,
      pct: item.pct,
      color: SOURCE_TYPE_COLORS[item.type] || "#A88C6D",
    }))
  );

  const stanceSegments = getTopSegments(
    (stats?.byStance ?? []).map((item) => ({
      label: STANCE_CONFIG[item.stance as Stance]?.label || item.stance,
      count: item.count,
      pct: item.pct,
      color: STANCE_CONFIG[item.stance as Stance]?.bg || "#E7E2DB",
    }))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-6 w-6 text-terracotta" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-ink">Feed Preview</h1>
        <p className="mt-1 text-sm text-ink-lighter">
          See how the public feed is ordered after editorial interleaving.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!error && stats ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <StatsBlock title="Philosopher Distribution" total={stats.total} segments={philosopherSegments} />
            <StatsBlock title="Format Breakdown" total={stats.total} segments={formatSegments} />
            <StatsBlock title="Source Type" total={stats.total} segments={sourceTypeSegments} />
            <StatsBlock title="Stance Distribution" total={stats.total} segments={stanceSegments} />
          </div>

          {stats.total === 0 ? (
            <div className="rounded-xl border border-border-light bg-white px-6 py-12 text-center shadow-sm">
              <p className="font-serif text-lg text-ink-light">No published posts yet.</p>
              <p className="mt-2 text-sm text-ink-lighter">
                Publish a few posts to preview how the public feed will read.
              </p>
            </div>
          ) : (
            <>
              <div className="inline-flex overflow-hidden rounded-lg border border-border">
                <button
                  onClick={() => setView("interleaved")}
                  className={`px-4 py-2 text-sm font-mono transition-colors ${
                    view === "interleaved"
                      ? "bg-terracotta text-white"
                      : "bg-parchment text-ink-light hover:bg-parchment-dark"
                  }`}
                >
                  Interleaved
                </button>
                <button
                  onClick={() => setView("chronological")}
                  className={`px-4 py-2 text-sm font-mono transition-colors ${
                    view === "chronological"
                      ? "bg-terracotta text-white"
                      : "bg-parchment text-ink-light hover:bg-parchment-dark"
                  }`}
                >
                  Chronological
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-border-light bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm font-body">
                    <thead className="bg-parchment/70">
                      <tr className="border-b border-border-light">
                        <th className="px-3 py-3 text-left text-[11px] font-mono uppercase tracking-wider text-ink-lighter">
                          #
                        </th>
                        {view === "interleaved" ? (
                          <th className="px-3 py-3 text-left text-[11px] font-mono uppercase tracking-wider text-ink-lighter">
                            {"\u2195"}
                          </th>
                        ) : null}
                        <th className="px-3 py-3 text-left text-[11px] font-mono uppercase tracking-wider text-ink-lighter">
                          Philosopher
                        </th>
                        <th className="px-3 py-3 text-left text-[11px] font-mono uppercase tracking-wider text-ink-lighter">
                          Format
                        </th>
                        <th className="px-3 py-3 text-left text-[11px] font-mono uppercase tracking-wider text-ink-lighter">
                          Stance
                        </th>
                        <th className="px-3 py-3 text-left text-[11px] font-mono uppercase tracking-wider text-ink-lighter">
                          Article / Content
                        </th>
                        <th className="px-3 py-3 text-left text-[11px] font-mono uppercase tracking-wider text-ink-lighter">
                          Tag
                        </th>
                        <th className="px-3 py-3 text-left text-[11px] font-mono uppercase tracking-wider text-ink-lighter">
                          Age
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePosts.map((post, index) => {
                        const previousPost = index > 0 ? activePosts[index - 1] : null;
                        const sharesArticleWithPrevious =
                          Boolean(post.citation?.url) &&
                          previousPost?.citation?.url === post.citation?.url;
                        const format = classifyPostFormat(post);
                        const stanceConfig = STANCE_CONFIG[post.stance as Stance];

                        return (
                          <tr
                            key={post.id}
                            className={`border-b border-border-light align-top ${
                              index % 2 === 1 ? "bg-parchment-dark/20" : "bg-transparent"
                            }`}
                          >
                            <td
                              className={`whitespace-nowrap px-3 py-3 text-ink-light ${
                                sharesArticleWithPrevious ? "border-l-2 border-l-gold/40" : ""
                              }`}
                            >
                              {index + 1}
                            </td>
                            {view === "interleaved" ? (
                              <td className="whitespace-nowrap px-3 py-3">
                                {renderShift(post._shift)}
                              </td>
                            ) : null}
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-mono text-white"
                                  style={{ backgroundColor: post.philosopherColor }}
                                >
                                  {post.philosopherInitials}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-ink">
                                    {post.replyTo ? <span className="mr-1 text-ink-lighter">{"\u21A9"}</span> : null}
                                    {getPhilosopherLabel(post.philosopherName)}
                                  </div>
                                  {post.replyTo && post.replyTargetPhilosopherName ? (
                                    <div className="text-xs text-ink-lighter">
                                      to {getPhilosopherLabel(post.replyTargetPhilosopherName)}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3">
                              <span
                                className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-mono"
                                style={{
                                  backgroundColor: `${FORMAT_COLORS[format] || "#A88C6D"}20`,
                                  color: FORMAT_COLORS[format] || "#A88C6D",
                                }}
                              >
                                {format}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3">
                              <span
                                className="inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-mono"
                                style={{
                                  color: stanceConfig?.color || "#58544E",
                                  backgroundColor: stanceConfig?.bg || "#E7E2DB",
                                  borderColor: stanceConfig?.border || "#CFC4B6",
                                }}
                              >
                                {stanceConfig?.label || post.stance}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="text-ink">{buildPreviewLine(post)}</div>
                              {post.citation?.source ? (
                                <div className="mt-1 text-xs text-ink-lighter">
                                  {post.citation.source}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-3 py-3">
                              <span className="inline-flex rounded-full bg-parchment-dark px-2.5 py-0.5 text-[11px] font-mono text-ink-light">
                                {post.tag || "(untagged)"}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-ink-lighter">
                              {formatRelativeTime(post.createdAt)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
