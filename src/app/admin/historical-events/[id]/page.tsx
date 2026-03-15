"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Spinner } from "@/components/Spinner";
import { STANCE_CONFIG } from "@/lib/constants";
import type { HistoricalEvent, HistoricalEventPostUsage, Stance } from "@/lib/types";
import type { Philosopher } from "@/types/admin";
import {
  HISTORICAL_EVENT_CATEGORIES,
  HISTORICAL_EVENT_ERAS,
  formatHistoricalDisplayDate,
  labelHistoricalCategory,
  labelHistoricalEra,
} from "@/lib/historical-events";

interface EventDetailResponse {
  event: HistoricalEvent;
}

interface PhilosopherSuggestion {
  id: string;
  score: number;
  angle: string;
}

interface GeneratedPreview {
  philosopherId: string;
  philosopherName: string;
  philosopherColor: string;
  philosopherInitials: string;
  postId: string;
  generationLogId: number;
  content: string;
  thesis: string;
  stance: Stance;
  tag: string;
  approved?: boolean;
  rejecting?: boolean;
  approving?: boolean;
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
  status: string;
}

const MONTH_OPTIONS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

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

function buildFormFromEvent(event: HistoricalEvent): EventFormState {
  return {
    title: event.title,
    eventMonth: String(event.eventMonth),
    eventDay: String(event.eventDay),
    eventYear: event.eventYear === null || event.eventYear === undefined ? "" : String(event.eventYear),
    displayDate: event.displayDate,
    era: event.era,
    category: event.category,
    context: event.context,
    themeInput: "",
    keyThemes: event.keyThemes,
    status: event.status,
  };
}

export default function HistoricalEventDetailPage() {
  const params = useParams<{ id: string }>();
  const eventId = params.id;
  const [event, setEvent] = useState<HistoricalEvent | null>(null);
  const [form, setForm] = useState<EventFormState | null>(null);
  const [displayDateTouched, setDisplayDateTouched] = useState(false);
  const [philosophers, setPhilosophers] = useState<Philosopher[]>([]);
  const [selectedPhilosophers, setSelectedPhilosophers] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, PhilosopherSuggestion>>({});
  const [length, setLength] = useState<"short" | "medium" | "long">("medium");
  const [previews, setPreviews] = useState<GeneratedPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const activePhilosophers = useMemo(
    () => philosophers.filter((philosopher) => philosopher.is_active !== 0),
    [philosophers]
  );

  useEffect(() => {
    if (!form || displayDateTouched) return;
    const nextDisplayDate = buildDisplayDateFromForm(form);
    setForm((current) =>
      current && current.displayDate !== nextDisplayDate
        ? { ...current, displayDate: nextDisplayDate }
        : current
    );
  }, [displayDateTouched, form]);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [eventResponse, philosopherResponse] = await Promise.all([
        fetch(`/api/admin/historical-events/${eventId}`),
        fetch("/api/admin/philosophers"),
      ]);

      const eventData = (await eventResponse.json()) as EventDetailResponse & { error?: string };
      const philosopherData = (await philosopherResponse.json()) as Philosopher[];

      if (!eventResponse.ok) {
        throw new Error(eventData.error || "Failed to fetch historical event");
      }
      if (!philosopherResponse.ok) {
        throw new Error("Failed to fetch philosophers");
      }

      setEvent(eventData.event);
      setForm(buildFormFromEvent(eventData.event));
      setPhilosophers(philosopherData);
      setDisplayDateTouched(false);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load historical event"
      );
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const refreshEvent = useCallback(async () => {
    const response = await fetch(`/api/admin/historical-events/${eventId}`);
    const data = (await response.json()) as EventDetailResponse & { error?: string };

    if (!response.ok) {
      throw new Error(data.error || "Failed to refresh event");
    }

    setEvent(data.event);
    setForm((current) =>
      current
        ? {
            ...current,
            status: data.event.status,
          }
        : buildFormFromEvent(data.event)
    );
  }, [eventId]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  function updateForm<K extends keyof EventFormState>(key: K, value: EventFormState[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  function addTheme() {
    if (!form) return;
    const theme = form.themeInput.trim();
    if (!theme || form.keyThemes.includes(theme)) return;

    setForm((current) =>
      current
        ? {
            ...current,
            keyThemes: [...current.keyThemes, theme],
            themeInput: "",
          }
        : current
    );
  }

  function removeTheme(theme: string) {
    setForm((current) =>
      current
        ? {
            ...current,
            keyThemes: current.keyThemes.filter((item) => item !== theme),
          }
        : current
    );
  }

  function togglePhilosopher(philosopherId: string) {
    setSelectedPhilosophers((current) =>
      current.includes(philosopherId)
        ? current.filter((id) => id !== philosopherId)
        : [...current, philosopherId]
    );
  }

  async function handleSave(nextStatus?: "draft" | "ready") {
    if (!form) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/historical-events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          event_month: Number.parseInt(form.eventMonth, 10),
          event_day: Number.parseInt(form.eventDay, 10),
          event_year: form.eventYear.trim() ? Number.parseInt(form.eventYear, 10) : null,
          display_date: form.displayDate,
          era: form.era,
          category: form.category,
          context: form.context,
          key_themes: form.keyThemes,
          status: nextStatus ?? form.status,
        }),
      });

      const data = (await response.json()) as EventDetailResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Failed to update event");
      }

      if (data.event) {
        setEvent(data.event);
        setForm(buildFormFromEvent(data.event));
      }

      setSuccess(nextStatus ? `Event marked as ${nextStatus}.` : "Event updated.");
      setDisplayDateTouched(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update event");
    } finally {
      setSaving(false);
    }
  }

  async function handleSuggestPhilosophers() {
    setSuggesting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/historical-events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suggest_philosophers" }),
      });

      const data = (await response.json()) as {
        error?: string;
        suggestions?: PhilosopherSuggestion[];
      };

      if (!response.ok) {
        throw new Error(data.error || "Failed to suggest philosophers");
      }

      const nextSuggestions: Record<string, PhilosopherSuggestion> = {};
      for (const suggestion of data.suggestions ?? []) {
        nextSuggestions[suggestion.id] = suggestion;
      }

      setSuggestions(nextSuggestions);
      setSelectedPhilosophers((current) => {
        const suggestedIds = (data.suggestions ?? []).slice(0, 4).map((item) => item.id);
        return current.length > 0 ? current : suggestedIds;
      });
    } catch (suggestError) {
      setError(
        suggestError instanceof Error
          ? suggestError.message
          : "Failed to suggest philosophers"
      );
    } finally {
      setSuggesting(false);
    }
  }

  async function handleGenerateSelected() {
    setGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      for (const philosopherId of selectedPhilosophers) {
        const philosopher = activePhilosophers.find((item) => item.id === philosopherId);
        if (!philosopher) continue;

        const response = await fetch(`/api/admin/historical-events/${eventId}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            philosopher_id: philosopherId,
            target_length: length,
          }),
        });

        const data = (await response.json()) as {
          error?: string;
          generated?: {
            content: string;
            thesis: string;
            stance: Stance;
            tag: string;
          };
          post_id?: string;
          generation_log_id?: number;
        };

        if (!response.ok || !data.generated || !data.post_id || !data.generation_log_id) {
          throw new Error(data.error || `Failed to generate for ${philosopher.name}`);
        }

        const postId = data.post_id;
        const generationLogId = data.generation_log_id;
        const generated = data.generated;

        setPreviews((current) => [
          {
            philosopherId,
            philosopherName: philosopher.name,
            philosopherColor: philosopher.color,
            philosopherInitials: philosopher.initials,
            postId,
            generationLogId,
            content: generated.content,
            thesis: generated.thesis,
            stance: generated.stance,
            tag: generated.tag,
          },
          ...current.filter((item) => item.philosopherId !== philosopherId),
        ]);
      }

      setSuccess(`Generated ${selectedPhilosophers.length} draft reaction(s).`);
      await refreshEvent();
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Failed to generate historical reactions"
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprovePreview(preview: GeneratedPreview) {
    setPreviews((current) =>
      current.map((item) =>
        item.postId === preview.postId ? { ...item, approving: true } : item
      )
    );

    try {
      const response = await fetch("/api/admin/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: preview.generationLogId,
          status: "approved",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to approve generated draft");
      }

      setPreviews((current) =>
        current.map((item) =>
          item.postId === preview.postId
            ? { ...item, approving: false, approved: true }
            : item
        )
      );
      setSuccess(`Approved ${preview.philosopherName}'s draft.`);
    } catch (approveError) {
      setError(
        approveError instanceof Error
          ? approveError.message
          : "Failed to approve generated draft"
      );
      setPreviews((current) =>
        current.map((item) =>
          item.postId === preview.postId ? { ...item, approving: false } : item
        )
      );
    }
  }

  async function handleRejectPreview(preview: GeneratedPreview) {
    setPreviews((current) =>
      current.map((item) =>
        item.postId === preview.postId ? { ...item, rejecting: true } : item
      )
    );

    try {
      const [deletePostResponse, rejectLogResponse] = await Promise.all([
        fetch("/api/admin/posts", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: preview.postId }),
        }),
        fetch("/api/admin/content", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: preview.generationLogId,
            status: "rejected",
          }),
        }),
      ]);

      if (!deletePostResponse.ok || !rejectLogResponse.ok) {
        throw new Error("Failed to reject generated draft");
      }

      setPreviews((current) => current.filter((item) => item.postId !== preview.postId));
      setSuccess(`Rejected ${preview.philosopherName}'s draft.`);
      await refreshEvent();
    } catch (rejectError) {
      setError(
        rejectError instanceof Error
          ? rejectError.message
          : "Failed to reject generated draft"
      );
      setPreviews((current) =>
        current.map((item) =>
          item.postId === preview.postId ? { ...item, rejecting: false } : item
        )
      );
    }
  }

  function renderPostRow(post: HistoricalEventPostUsage) {
    const stance = STANCE_CONFIG[post.stance as Stance];

    return (
      <div
        key={post.postId}
        className="flex flex-col gap-3 rounded-xl border border-border bg-white px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-xs font-serif font-bold text-white"
            style={{ backgroundColor: post.philosopherColor }}
          >
            {post.philosopherInitials}
          </span>
          <div>
            <p className="font-serif text-base font-bold text-ink">{post.philosopherName}</p>
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-ink-lighter">
              {new Date(post.createdAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-[11px] font-mono uppercase tracking-wider ${
              post.status === "published"
                ? "bg-green-100 text-green-800"
                : post.status === "approved"
                ? "bg-blue-100 text-blue-800"
                : "bg-parchment-dark text-ink-lighter"
            }`}
          >
            {post.status}
          </span>
          <span
            className="inline-flex rounded-full px-3 py-1 text-[11px] font-mono uppercase tracking-wider"
            style={{
              backgroundColor: stance.bg,
              color: stance.color,
              border: `1px solid ${stance.border}`,
            }}
          >
            {stance.label}
          </span>
          <Link
            href={`/admin/posts?philosopher=${encodeURIComponent(post.philosopherId)}`}
            className="text-sm text-terracotta hover:text-terracotta-light"
          >
            Open in Posts
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !form) {
    return (
      <div className="py-20 text-center">
        <Spinner className="mx-auto h-6 w-6 text-terracotta" />
        <p className="mt-3 text-sm text-ink-lighter">Loading historical event...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24">
      <Link
        href="/admin/historical-events"
        className="inline-flex items-center gap-2 text-sm text-terracotta hover:text-terracotta-light"
      >
        ← Back to Historical Events
      </Link>

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

      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border bg-parchment-dark/20 px-6 py-5">
          <p className="mb-1 text-xs font-mono uppercase tracking-[0.3em] text-ink-lighter">
            Event Detail
          </p>
          <h1 className="font-serif text-2xl font-bold text-ink">{event?.title}</h1>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-ink-lighter">
                Title
              </label>
              <input
                value={form.title}
                onChange={(event) => updateForm("title", event.target.value)}
                className="w-full rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/20"
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
                {MONTH_OPTIONS.map((option) => (
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
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-ink-lighter">
              Key Themes
            </label>
            <div className="rounded-lg border border-border bg-parchment px-4 py-3">
              <div className="mb-3 flex flex-wrap gap-2">
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

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-terracotta px-4 py-2 text-sm font-body text-white hover:bg-terracotta-light disabled:opacity-50"
              >
                {saving ? <Spinner className="h-4 w-4 text-white" /> : null}
                Save
              </button>
              <button
                onClick={() => void handleSave("ready")}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-body text-ink hover:bg-parchment-dark/30 disabled:opacity-50"
              >
                Mark as Ready
              </button>
              <button
                onClick={() => void handleSave("draft")}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-body text-ink hover:bg-parchment-dark/30 disabled:opacity-50"
              >
                Mark as Draft
              </button>
            </div>
            <span className="text-xs font-mono uppercase tracking-[0.2em] text-ink-lighter">
              Status: {event?.status}
            </span>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border bg-parchment-dark/20 px-6 py-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-1 text-xs font-mono uppercase tracking-[0.3em] text-ink-lighter">
              Generate Content
            </p>
            <h2 className="font-serif text-xl font-bold text-ink">
              Pick philosophers and draft reactions
            </h2>
          </div>
          <button
            onClick={handleSuggestPhilosophers}
            disabled={suggesting}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-body text-ink hover:bg-parchment-dark/30 disabled:opacity-50"
          >
            {suggesting ? <Spinner className="h-4 w-4 text-ink" /> : null}
            Suggest Philosophers
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {activePhilosophers.map((philosopher) => {
              const selected = selectedPhilosophers.includes(philosopher.id);
              const suggestion = suggestions[philosopher.id];

              return (
                <button
                  key={philosopher.id}
                  type="button"
                  onClick={() => togglePhilosopher(philosopher.id)}
                  className={`rounded-xl border px-4 py-4 text-left transition-colors ${
                    selected
                      ? "border-terracotta bg-terracotta/5 ring-1 ring-terracotta/20"
                      : "border-border bg-white hover:bg-parchment-dark/20"
                  }`}
                  title={suggestion?.angle || philosopher.tradition}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-serif font-bold text-white"
                      style={{ backgroundColor: philosopher.color }}
                    >
                      {philosopher.initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-serif text-base font-bold text-ink">
                          {philosopher.name}
                        </p>
                        {suggestion && (
                          <span className="rounded-full bg-parchment px-2 py-0.5 text-[11px] font-mono text-ink-lighter">
                            {suggestion.score}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-lighter">{philosopher.tradition}</p>
                      {suggestion?.angle && (
                        <p className="mt-2 line-clamp-2 text-xs text-ink-light">{suggestion.angle}</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-parchment px-5 py-4">
            <div>
              <p className="mb-2 text-xs font-mono uppercase tracking-[0.25em] text-ink-lighter">
                Length
              </p>
              <div className="flex flex-wrap gap-3">
                {(["short", "medium", "long"] as const).map((option) => (
                  <label
                    key={option}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
                      length === option
                        ? "border-terracotta bg-terracotta/5 text-terracotta"
                        : "border-border bg-white text-ink-lighter"
                    }`}
                  >
                    <input
                      type="radio"
                      name="historical-length"
                      value={option}
                      checked={length === option}
                      onChange={() => setLength(option)}
                      className="sr-only"
                    />
                    {option[0].toUpperCase() + option.slice(1)}
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerateSelected}
              disabled={generating || selectedPhilosophers.length === 0}
              className="inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 text-sm font-body text-white hover:bg-terracotta-light disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Spinner className="h-4 w-4 text-white" />
                  Generating...
                </>
              ) : (
                `Generate for ${selectedPhilosophers.length} selected`
              )}
            </button>
          </div>

          {previews.length > 0 && (
            <div className="space-y-4">
              {previews.map((preview) => {
                const stance = STANCE_CONFIG[preview.stance];

                return (
                  <article
                    key={preview.postId}
                    className="rounded-xl border border-border bg-parchment px-5 py-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-3 flex items-center gap-3">
                          <span
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-xs font-serif font-bold text-white"
                            style={{ backgroundColor: preview.philosopherColor }}
                          >
                            {preview.philosopherInitials}
                          </span>
                          <div>
                            <p className="font-serif text-lg font-bold text-ink">
                              {preview.philosopherName}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              <span
                                className="inline-flex rounded-full px-3 py-1 text-[11px] font-mono uppercase tracking-wider"
                                style={{
                                  backgroundColor: stance.bg,
                                  color: stance.color,
                                  border: `1px solid ${stance.border}`,
                                }}
                              >
                                {stance.label}
                              </span>
                              <span className="inline-flex rounded-full border border-border-light bg-white px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-ink-lighter">
                                {preview.tag}
                              </span>
                              {preview.approved && (
                                <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-green-800">
                                  Approved
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <blockquote className="mb-3 rounded-r-xl border-l-[3px] border-terracotta bg-white px-4 py-3 font-serif text-lg font-medium text-ink">
                          {preview.thesis}
                        </blockquote>
                        <div className="rounded-xl border border-border-light bg-white px-4 py-4">
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                            {preview.content}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-2 lg:pl-4">
                        <button
                          onClick={() => void handleApprovePreview(preview)}
                          disabled={preview.approved || preview.approving || preview.rejecting}
                          className="inline-flex items-center gap-2 rounded-full bg-green-700 px-4 py-2 text-sm text-white hover:bg-green-800 disabled:opacity-50"
                        >
                          {preview.approving ? (
                            <>
                              <Spinner className="h-4 w-4 text-white" />
                              Approving...
                            </>
                          ) : (
                            "Approve"
                          )}
                        </button>
                        <button
                          onClick={() => void handleRejectPreview(preview)}
                          disabled={preview.rejecting || preview.approving}
                          className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          {preview.rejecting ? (
                            <>
                              <Spinner className="h-4 w-4 text-red-700" />
                              Rejecting...
                            </>
                          ) : (
                            "Reject"
                          )}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border bg-parchment-dark/20 px-6 py-5">
          <p className="mb-1 text-xs font-mono uppercase tracking-[0.3em] text-ink-lighter">
            Generated Posts
          </p>
          <h2 className="font-serif text-xl font-bold text-ink">
            Drafts and published posts from this event
          </h2>
        </div>
        <div className="space-y-3 px-6 py-6">
          {event?.posts && event.posts.length > 0 ? (
            event.posts.map(renderPostRow)
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-ink-lighter">
              No posts generated from this event yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
