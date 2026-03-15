"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Spinner } from "@/components/Spinner";
import type { HistoricalEvent } from "@/lib/types";
import {
  HISTORICAL_EVENT_CATEGORIES,
  HISTORICAL_EVENT_ERAS,
  MONTH_NAMES,
  formatHistoricalDateBadge,
  formatHistoricalDisplayDate,
  labelHistoricalCategory,
  labelHistoricalEra,
} from "@/lib/historical-events";

type EventStatusFilter = "draft" | "ready" | "used" | "all";

interface ListResponse {
  events: HistoricalEvent[];
  stats: {
    total: number;
    draft: number;
    ready: number;
    used: number;
  };
}

interface EventFormState {
  title: string;
  eventMonth: string;
  eventDay: string;
  eventYear: string;
  displayDate: string;
  era: string;
  category: string;
  context: string;
  themeInput: string;
  keyThemes: string[];
}

const STATUS_TABS: Array<{ key: EventStatusFilter; label: string }> = [
  { key: "draft", label: "Draft" },
  { key: "ready", label: "Ready" },
  { key: "used", label: "Used" },
  { key: "all", label: "All" },
];

const INITIAL_FORM: EventFormState = {
  title: "",
  eventMonth: "",
  eventDay: "",
  eventYear: "",
  displayDate: "",
  era: "modern",
  category: "political",
  context: "",
  themeInput: "",
  keyThemes: [],
};

function buildDisplayDateFromForm(form: EventFormState): string {
  const month = Number.parseInt(form.eventMonth, 10);
  const day = Number.parseInt(form.eventDay, 10);
  const rawYear = form.eventYear.trim();
  const year = rawYear ? Number.parseInt(rawYear, 10) : undefined;

  if (!Number.isInteger(month) || !Number.isInteger(day)) return "";

  return formatHistoricalDisplayDate({
    month,
    day,
    year: Number.isInteger(year) ? year : undefined,
  });
}

export default function HistoricalEventsPage() {
  const [events, setEvents] = useState<HistoricalEvent[]>([]);
  const [stats, setStats] = useState<ListResponse["stats"]>({
    total: 0,
    draft: 0,
    ready: 0,
    used: 0,
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showBatchPanel, setShowBatchPanel] = useState(false);
  const [statusFilter, setStatusFilter] = useState<EventStatusFilter>("draft");
  const [monthFilter, setMonthFilter] = useState("all");
  const [eraFilter, setEraFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [form, setForm] = useState<EventFormState>(INITIAL_FORM);
  const [displayDateTouched, setDisplayDateTouched] = useState(false);
  const [batchMonth, setBatchMonth] = useState(String(new Date().getMonth() + 1));
  const [batchCount, setBatchCount] = useState("15");

  useEffect(() => {
    if (displayDateTouched) return;
    const nextDisplayDate = buildDisplayDateFromForm(form);
    setForm((current) =>
      current.displayDate === nextDisplayDate
        ? current
        : { ...current, displayDate: nextDisplayDate }
    );
  }, [displayDateTouched, form]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("status", statusFilter);
      if (monthFilter !== "all") params.set("month", monthFilter);
      if (eraFilter !== "all") params.set("era", eraFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      params.set("limit", "200");

      const response = await fetch(`/api/admin/historical-events?${params.toString()}`);
      const data = (await response.json()) as ListResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch historical events");
      }

      setEvents(data.events);
      setStats(data.stats);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to fetch historical events"
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter, monthFilter, eraFilter, categoryFilter]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  function updateForm<K extends keyof EventFormState>(key: K, value: EventFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function addTheme() {
    const theme = form.themeInput.trim();
    if (!theme || form.keyThemes.includes(theme)) return;

    setForm((current) => ({
      ...current,
      keyThemes: [...current.keyThemes, theme],
      themeInput: "",
    }));
  }

  function removeTheme(theme: string) {
    setForm((current) => ({
      ...current,
      keyThemes: current.keyThemes.filter((item) => item !== theme),
    }));
  }

  async function handleCreate(status: "draft" | "ready") {
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/historical-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title: form.title,
          event_month: Number.parseInt(form.eventMonth, 10),
          event_day: Number.parseInt(form.eventDay, 10),
          event_year: form.eventYear.trim() ? Number.parseInt(form.eventYear, 10) : null,
          display_date: form.displayDate,
          era: form.era,
          category: form.category,
          context: form.context,
          key_themes: form.keyThemes,
          status,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Failed to create historical event");
      }

      setSuccess(`Saved "${form.title}" as ${status}.`);
      setForm(INITIAL_FORM);
      setDisplayDateTouched(false);
      setShowForm(false);
      setStatusFilter(status);
      await fetchEvents();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to create historical event"
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGenerateBatch() {
    setBatchSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/historical-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_batch",
          month: Number.parseInt(batchMonth, 10),
          count: Number.parseInt(batchCount, 10) || 15,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        generated?: number;
      };

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate historical events");
      }

      const monthLabel = MONTH_NAMES[Number.parseInt(batchMonth, 10) - 1];
      setSuccess(`Generated ${data.generated ?? 0} events for ${monthLabel}. Review them below.`);
      setShowBatchPanel(false);
      setStatusFilter("draft");
      setMonthFilter(batchMonth);
      await fetchEvents();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to generate historical events"
      );
    } finally {
      setBatchSubmitting(false);
    }
  }

  async function handleDelete(eventId: string) {
    setDeletingId(eventId);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/historical-events/${eventId}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete historical event");
      }

      setSuccess("Historical event deleted.");
      await fetchEvents();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete historical event"
      );
    } finally {
      setDeletingId(null);
    }
  }

  const monthOptions = useMemo(
    () => MONTH_NAMES.map((label, index) => ({ value: String(index + 1), label })),
    []
  );

  return (
    <div className="space-y-8 pb-24">
      <div>
        <h1 className="font-serif text-2xl font-bold text-ink">Historical Events</h1>
        <p className="mt-1 text-sm font-body text-ink-light">
          Curate and generate philosopher reactions to historical events
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </div>
      )}

      <section className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="border-b border-border bg-parchment-dark/20 px-6 py-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-ink-lighter mb-1">
              Event Catalog
            </p>
            <p className="text-sm text-ink-lighter">
              Build a reusable on-this-day library for evergreen feed content.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                setShowForm((current) => !current);
                setShowBatchPanel(false);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-body text-ink transition-colors hover:bg-parchment-dark/30"
            >
              Add Event
            </button>
            <button
              onClick={() => {
                setShowBatchPanel((current) => !current);
                setShowForm(false);
              }}
              className="inline-flex items-center gap-2 rounded-full bg-terracotta px-4 py-2 text-sm font-body text-white transition-colors hover:bg-terracotta-light"
            >
              Generate Batch
            </button>
          </div>
        </div>

        {showForm && (
          <div className="border-b border-border bg-white px-6 py-6 space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-ink-lighter">
                  Title
                </label>
                <input
                  value={form.title}
                  onChange={(event) => updateForm("title", event.target.value)}
                  className="w-full rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/20"
                  placeholder="The Fall of Constantinople"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-ink-lighter">
                  Month
                </label>
                <select
                  value={form.eventMonth}
                  onChange={(event) => updateForm("eventMonth", event.target.value)}
                  className="w-full rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/20"
                >
                  <option value="">Select month</option>
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-ink-lighter">
                  Day
                </label>
                <select
                  value={form.eventDay}
                  onChange={(event) => updateForm("eventDay", event.target.value)}
                  className="w-full rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/20"
                >
                  <option value="">Select day</option>
                  {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-ink-lighter">
                  Year
                </label>
                <input
                  value={form.eventYear}
                  onChange={(event) => updateForm("eventYear", event.target.value)}
                  className="w-full rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/20"
                  placeholder="1453 or -44 for BCE"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-ink-lighter">
                  Display Date
                </label>
                <input
                  value={form.displayDate}
                  onChange={(event) => {
                    setDisplayDateTouched(true);
                    updateForm("displayDate", event.target.value);
                  }}
                  className="w-full rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/20"
                  placeholder="29 May 1453"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-ink-lighter">
                  Era
                </label>
                <select
                  value={form.era}
                  onChange={(event) => updateForm("era", event.target.value)}
                  className="w-full rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/20"
                >
                  {HISTORICAL_EVENT_ERAS.map((era) => (
                    <option key={era} value={era}>
                      {labelHistoricalEra(era)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-ink-lighter">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(event) => updateForm("category", event.target.value)}
                  className="w-full rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/20"
                >
                  {HISTORICAL_EVENT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {labelHistoricalCategory(category)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-ink-lighter">
                Context
              </label>
              <textarea
                value={form.context}
                onChange={(event) => updateForm("context", event.target.value)}
                rows={8}
                className="w-full rounded-lg border border-border bg-parchment px-4 py-3 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/20"
                placeholder="Write 2-3 paragraphs of context, consequences, and why the event matters."
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-ink-lighter">
                Key Themes
              </label>
              <div className="rounded-lg border border-border bg-parchment px-4 py-3">
                <div className="flex flex-wrap gap-2 mb-3">
                  {form.keyThemes.map((theme) => (
                    <span
                      key={theme}
                      className="inline-flex items-center gap-2 rounded-full border border-border-light bg-white px-3 py-1 text-xs font-mono text-ink"
                    >
                      {theme}
                      <button
                        type="button"
                        onClick={() => removeTheme(theme)}
                        className="text-ink-lighter hover:text-red-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-3">
                  <input
                    value={form.themeInput}
                    onChange={(event) => updateForm("themeInput", event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTheme();
                      }
                    }}
                    className="flex-1 rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/20"
                    placeholder="Type a theme and press Enter"
                  />
                  <button
                    type="button"
                    onClick={addTheme}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-body text-ink hover:bg-white"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => handleCreate("draft")}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-body text-ink hover:bg-parchment-dark/30 disabled:opacity-50"
              >
                {submitting ? <Spinner className="h-4 w-4 text-ink" /> : null}
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => handleCreate("ready")}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-full bg-terracotta px-4 py-2 text-sm font-body text-white hover:bg-terracotta-light disabled:opacity-50"
              >
                {submitting ? <Spinner className="h-4 w-4 text-white" /> : null}
                Save as Ready
              </button>
            </div>
          </div>
        )}

        {showBatchPanel && (
          <div className="border-b border-border bg-white px-6 py-6">
            <div className="grid gap-4 md:grid-cols-[1fr_160px_auto] md:items-end">
              <div>
                <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-ink-lighter">
                  Month
                </label>
                <select
                  value={batchMonth}
                  onChange={(event) => setBatchMonth(event.target.value)}
                  className="w-full rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/20"
                >
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-ink-lighter">
                  Count
                </label>
                <input
                  value={batchCount}
                  onChange={(event) => setBatchCount(event.target.value)}
                  className="w-full rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/20"
                />
              </div>
              <button
                onClick={handleGenerateBatch}
                disabled={batchSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-terracotta px-5 py-2.5 text-sm font-body text-white hover:bg-terracotta-light disabled:opacity-50"
              >
                {batchSubmitting ? (
                  <>
                    <Spinner className="h-4 w-4 text-white" />
                    Generating...
                  </>
                ) : (
                  "Generate"
                )}
              </button>
            </div>
          </div>
        )}

        <div className="border-b border-border bg-parchment/40 px-6 py-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => {
              const count =
                tab.key === "all" ? stats.total : stats[tab.key as keyof typeof stats];

              return (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${
                    statusFilter === tab.key
                      ? "bg-terracotta text-white"
                      : "border border-border bg-white text-ink-lighter hover:bg-parchment-dark/30"
                  }`}
                >
                  {tab.label}
                  <span className="text-xs font-mono opacity-80">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
            <select
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
              className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/20"
            >
              <option value="all">All months</option>
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={eraFilter}
              onChange={(event) => setEraFilter(event.target.value)}
              className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/20"
            >
              <option value="all">All eras</option>
              {HISTORICAL_EVENT_ERAS.map((era) => (
                <option key={era} value={era}>
                  {labelHistoricalEra(era)}
                </option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/20"
            >
              <option value="all">All categories</option>
              {HISTORICAL_EVENT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {labelHistoricalCategory(category)}
                </option>
              ))}
            </select>

            <div className="flex items-center justify-end text-xs font-mono uppercase tracking-[0.2em] text-ink-lighter">
              {loading ? "Loading..." : `${events.length} visible`}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-16 text-center">
            <Spinner className="mx-auto h-5 w-5 text-terracotta" />
            <p className="mt-3 text-sm text-ink-lighter">Loading historical events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-ink-lighter">No historical events match the current filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-border-light">
            {events.map((event) => {
              const badge = formatHistoricalDateBadge({
                month: event.eventMonth,
                day: event.eventDay,
                year: event.eventYear,
              });

              return (
                <div
                  key={event.id}
                  className="grid gap-4 px-6 py-5 lg:grid-cols-[90px_1.6fr_1.1fr_1fr_120px_190px] lg:items-center"
                >
                  <div className="rounded-2xl border border-border-light bg-parchment px-3 py-3 text-center">
                    <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-ink-lighter">
                      {badge.monthLabel}
                    </p>
                    <p className="font-serif text-2xl font-bold text-ink">{badge.dayLabel}</p>
                    {badge.yearLabel && (
                      <p className="mt-1 text-[11px] font-mono text-ink-lighter">{badge.yearLabel}</p>
                    )}
                  </div>

                  <div>
                    <Link
                      href={`/admin/historical-events/${event.id}`}
                      className="font-serif text-lg font-bold text-ink hover:text-terracotta"
                    >
                      {event.title}
                    </Link>
                    <p className="mt-1 text-sm text-ink-lighter">{event.displayDate}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex rounded-full border border-border-light bg-parchment px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-ink-light">
                      {labelHistoricalEra(event.era as (typeof HISTORICAL_EVENT_ERAS)[number])}
                    </span>
                    <span className="inline-flex rounded-full border border-border-light bg-parchment px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-ink-light">
                      {labelHistoricalCategory(
                        event.category as (typeof HISTORICAL_EVENT_CATEGORIES)[number]
                      )}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {event.keyThemes.slice(0, 3).map((theme) => (
                      <span
                        key={theme}
                        className="inline-flex rounded-full border border-border-light bg-white px-2.5 py-1 text-[11px] font-mono text-ink-lighter"
                      >
                        {theme}
                      </span>
                    ))}
                    {event.keyThemes.length > 3 && (
                      <span className="inline-flex rounded-full border border-border-light bg-white px-2.5 py-1 text-[11px] font-mono text-ink-lighter">
                        +{event.keyThemes.length - 3} more
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-[11px] font-mono uppercase tracking-wider ${
                        event.status === "ready"
                          ? "bg-green-100 text-green-800"
                          : event.status === "used"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-parchment-dark text-ink-lighter"
                      }`}
                    >
                      {event.status}
                    </span>
                    <span className="text-sm text-ink-lighter">
                      {event.postsCount ?? 0} post{event.postsCount === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-3 text-sm">
                    <Link
                      href={`/admin/historical-events/${event.id}`}
                      className="text-terracotta hover:text-terracotta-light"
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/admin/historical-events/${event.id}`}
                      className="text-ink-light hover:text-ink"
                    >
                      Generate
                    </Link>
                    <button
                      onClick={() => void handleDelete(event.id)}
                      disabled={deletingId === event.id}
                      className="text-red-600 hover:text-red-700 disabled:opacity-50"
                    >
                      {deletingId === event.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
