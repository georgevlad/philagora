"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/Spinner";

const PAGE_SIZE = 50;
const CALLER_FILTERS = [
  { value: "all", label: "All" },
  { value: "generation", label: "Generation" },
  { value: "scoring", label: "Scoring" },
  { value: "synthesis", label: "Synthesis" },
  { value: "historical-events", label: "Historical Events" },
  { value: "better-auth", label: "Auth" },
] as const;
const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "success", label: "Success" },
  { value: "errors", label: "Errors Only" },
] as const;

interface ApiLogRow {
  id: number;
  timestamp: string;
  caller: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  max_tokens_requested: number | null;
  temperature: number | null;
  stop_reason: string | null;
  latency_ms: number | null;
  success: number;
  error_message: string | null;
  error_type: string | null;
  system_prompt_length: number | null;
  user_message_length: number | null;
  response_length: number | null;
}

interface ApiLogStats {
  total_calls: number;
  total_errors: number | null;
  total_truncated: number | null;
  avg_latency_ms: number | null;
  total_input_tokens: number | null;
  total_output_tokens: number | null;
  first_log: string | null;
  last_log: string | null;
}

interface ApiLogResponse {
  logs: ApiLogRow[];
  total: number;
  stats: ApiLogStats;
  limit: number;
  offset: number;
}

function parseLogTimestamp(timestamp: string): Date {
  return new Date(`${timestamp.replace(" ", "T")}Z`);
}

function formatRelativeTime(timestamp: string): string {
  const date = parseLogTimestamp(timestamp);
  const diffMs = date.getTime() - Date.now();

  if (Number.isNaN(date.getTime())) return timestamp;

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const absSeconds = Math.abs(Math.round(diffMs / 1000));

  if (absSeconds < 60) return rtf.format(Math.round(diffMs / 1000), "second");
  if (absSeconds < 3600) return rtf.format(Math.round(diffMs / 60000), "minute");
  if (absSeconds < 86400) return rtf.format(Math.round(diffMs / 3600000), "hour");
  return rtf.format(Math.round(diffMs / 86400000), "day");
}

function formatNumber(value: number | null | undefined): string {
  return typeof value === "number" ? value.toLocaleString("en-US") : "0";
}

function formatTokenPair(input: number | null, output: number | null): string {
  const inputLabel = typeof input === "number" ? input.toLocaleString("en-US") : "?";
  const outputLabel = typeof output === "number" ? output.toLocaleString("en-US") : "?";
  return `${inputLabel}->${outputLabel}`;
}

function shortenModel(model: string): string {
  if (model.includes("haiku")) return "haiku";
  if (model.includes("sonnet")) return "sonnet";
  if (model.includes("opus")) return "opus";
  return model;
}

function formatCaller(caller: string): string {
  return caller.replace(/-/g, " ");
}

export default function ApiLogsPage() {
  const [logs, setLogs] = useState<ApiLogRow[]>([]);
  const [stats, setStats] = useState<ApiLogStats | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [callerFilter, setCallerFilter] =
    useState<(typeof CALLER_FILTERS)[number]["value"]>("all");
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_FILTERS)[number]["value"]>("all");
  const [expandedErrors, setExpandedErrors] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadLogs() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
        });

        if (callerFilter !== "all") {
          params.set("caller", callerFilter);
        }
        if (statusFilter === "success") {
          params.set("success", "true");
        } else if (statusFilter === "errors") {
          params.set("success", "false");
        }

        const response = await fetch(`/api/admin/api-logs?${params.toString()}`);
        const data = (await response.json()) as ApiLogResponse | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in data ? data.error || "Failed to load API logs" : "Failed to load API logs"
          );
        }

        if (!ignore && "logs" in data) {
          setLogs(data.logs);
          setStats(data.stats);
          setTotal(data.total);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load API logs");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadLogs();

    return () => {
      ignore = true;
    };
  }, [callerFilter, offset, statusFilter]);

  useEffect(() => {
    if (!successMessage) return;

    const timeout = window.setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  function resetAndSetCaller(nextValue: (typeof CALLER_FILTERS)[number]["value"]) {
    setCallerFilter(nextValue);
    setOffset(0);
  }

  function resetAndSetStatus(nextValue: (typeof STATUS_FILTERS)[number]["value"]) {
    setStatusFilter(nextValue);
    setOffset(0);
  }

  function toggleExpandedError(logId: number) {
    setExpandedErrors((current) =>
      current.includes(logId) ? current.filter((id) => id !== logId) : [...current, logId]
    );
  }

  async function clearOldLogs() {
    if (!window.confirm("Delete API log entries older than 30 days?")) {
      return;
    }

    setClearing(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/api-logs?older_than_days=30", {
        method: "DELETE",
      });
      const data = (await response.json()) as { deleted?: number; error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Failed to clear old logs");
      }

      setSuccessMessage(`Deleted ${formatNumber(data.deleted)} old log entries.`);
      setOffset(0);
      setExpandedErrors([]);

      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: "0",
      });

      if (callerFilter !== "all") {
        params.set("caller", callerFilter);
      }
      if (statusFilter === "success") {
        params.set("success", "true");
      } else if (statusFilter === "errors") {
        params.set("success", "false");
      }

      const refreshResponse = await fetch(`/api/admin/api-logs?${params.toString()}`);
      const refreshData = (await refreshResponse.json()) as ApiLogResponse | { error?: string };

      if (!refreshResponse.ok) {
        throw new Error(
          "error" in refreshData
            ? refreshData.error || "Failed to refresh API logs"
            : "Failed to refresh API logs"
        );
      }

      if ("logs" in refreshData) {
        setLogs(refreshData.logs);
        setStats(refreshData.stats);
        setTotal(refreshData.total);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear old logs");
    } finally {
      setClearing(false);
    }
  }

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + logs.length, total);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-serif text-xl font-bold text-ink">API Logs</h1>
          <p className="font-mono text-xs text-ink-lighter mt-1">
            Request telemetry for AI generation, scoring, synthesis, historical event tools, and Better Auth.
          </p>
        </div>

        <button
          type="button"
          onClick={clearOldLogs}
          disabled={clearing}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-body text-ink transition-colors hover:bg-parchment-dark/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {clearing ? <Spinner className="h-4 w-4" /> : null}
          Clear old logs
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {successMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="border-border-light rounded-lg border px-4 py-3 bg-parchment">
          <div className="font-mono text-[11px] uppercase tracking-wider text-ink-lighter">
            Total Calls
          </div>
          <div className="mt-1 font-serif text-2xl font-bold text-ink">
            {formatNumber(stats?.total_calls)}
          </div>
        </div>
        <div className="border-border-light rounded-lg border px-4 py-3 bg-parchment">
          <div className="font-mono text-[11px] uppercase tracking-wider text-ink-lighter">
            Errors
          </div>
          <div className="mt-1 font-serif text-2xl font-bold text-ink">
            {formatNumber(stats?.total_errors)}
          </div>
        </div>
        <div className="border-border-light rounded-lg border px-4 py-3 bg-parchment">
          <div className="font-mono text-[11px] uppercase tracking-wider text-ink-lighter">
            Truncated
          </div>
          <div className="mt-1 font-serif text-2xl font-bold text-ink">
            {formatNumber(stats?.total_truncated)}
          </div>
        </div>
        <div className="border-border-light rounded-lg border px-4 py-3 bg-parchment">
          <div className="font-mono text-[11px] uppercase tracking-wider text-ink-lighter">
            Avg Latency
          </div>
          <div className="mt-1 font-serif text-2xl font-bold text-ink">
            {stats?.avg_latency_ms ? `${stats.avg_latency_ms}ms` : "0ms"}
          </div>
        </div>
        <div className="border-border-light rounded-lg border px-4 py-3 bg-parchment">
          <div className="font-mono text-[11px] uppercase tracking-wider text-ink-lighter">
            Total Tokens
          </div>
          <div className="mt-1 font-serif text-lg font-bold text-ink">
            {formatNumber(stats?.total_input_tokens)} / {formatNumber(stats?.total_output_tokens)}
          </div>
          <div className="mt-1 font-mono text-[11px] text-ink-lighter">in / out</div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white/40 overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border bg-parchment-dark/20 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-ink-lighter mb-1.5">
                Caller
              </div>
              <div className="flex flex-wrap gap-2">
                {CALLER_FILTERS.map((filter) => {
                  const active = callerFilter === filter.value;
                  return (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => resetAndSetCaller(filter.value)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-mono transition-colors ${
                        active
                          ? "bg-terracotta/10 text-terracotta border-terracotta/20"
                          : "border-border-light text-ink-lighter hover:bg-parchment-dark/40 hover:text-ink"
                      }`}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-ink-lighter mb-1.5">
                Status
              </div>
              <div className="flex flex-wrap gap-2">
                {STATUS_FILTERS.map((filter) => {
                  const active = statusFilter === filter.value;
                  return (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => resetAndSetStatus(filter.value)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-mono transition-colors ${
                        active
                          ? "bg-terracotta/10 text-terracotta border-terracotta/20"
                          : "border-border-light text-ink-lighter hover:bg-parchment-dark/40 hover:text-ink"
                      }`}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="font-mono text-xs text-ink-lighter">
            Showing {rangeStart}-{rangeEnd} of {formatNumber(total)}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner className="h-6 w-6 text-terracotta" />
          </div>
        ) : logs.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="font-serif text-lg text-ink">No API logs yet.</p>
            <p className="mt-2 font-mono text-xs text-ink-lighter">
              AI and auth requests will start appearing here once logged.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-border bg-parchment-dark/30">
                    <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wider text-ink-lighter">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wider text-ink-lighter">
                      Caller
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wider text-ink-lighter">
                      Target
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wider text-ink-lighter">
                      Tokens
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wider text-ink-lighter">
                      Latency
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wider text-ink-lighter">
                      Stop Reason
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wider text-ink-lighter">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wider text-ink-lighter">
                      Error
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const isExpanded = expandedErrors.includes(log.id);
                    const rowTint =
                      log.success === 0
                        ? "bg-red-50/50"
                        : log.stop_reason === "max_tokens"
                          ? "bg-amber-50/50"
                          : "";

                    return (
                      <tr
                        key={log.id}
                        className={`border-b border-border-light last:border-b-0 hover:bg-parchment-dark/20 ${rowTint}`}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-ink-light align-top">
                          <div>{formatRelativeTime(log.timestamp)}</div>
                          <div className="mt-1 text-[11px] text-ink-lighter">
                            {parseLogTimestamp(log.timestamp).toLocaleString("en-US")}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-ink-light align-top">
                          {formatCaller(log.caller)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-ink-light align-top">
                          {shortenModel(log.model)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-ink-light align-top">
                          {formatTokenPair(log.input_tokens, log.output_tokens)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-ink-light align-top">
                          {log.latency_ms ? `${log.latency_ms}ms` : "-"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs align-top">
                          <span
                            className={
                              log.stop_reason === "max_tokens"
                                ? "text-red-700"
                                : "text-ink-light"
                            }
                          >
                            {log.stop_reason ?? "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-ink-light align-top">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className={`inline-block h-2 w-2 rounded-full ${
                                log.success === 1 ? "bg-green-600" : "bg-red-600"
                              }`}
                            />
                            {log.success === 1 ? "success" : "error"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-ink-light align-top">
                          {log.error_message ? (
                            <button
                              type="button"
                              onClick={() => toggleExpandedError(log.id)}
                              className="max-w-[280px] text-left text-red-700 underline decoration-dotted underline-offset-2"
                            >
                              {isExpanded
                                ? log.error_message
                                : `${log.error_message.slice(0, 72)}${
                                    log.error_message.length > 72 ? "..." : ""
                                  }`}
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-border bg-parchment-dark/10 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="font-mono text-xs text-ink-lighter">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOffset((current) => Math.max(current - PAGE_SIZE, 0))}
                  disabled={offset === 0}
                  className="rounded-full border border-border px-4 py-2 text-sm font-body text-ink transition-colors hover:bg-parchment-dark/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setOffset((current) => current + PAGE_SIZE)}
                  disabled={offset + PAGE_SIZE >= total}
                  className="rounded-full border border-border px-4 py-2 text-sm font-body text-ink transition-colors hover:bg-parchment-dark/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
