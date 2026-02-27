"use client";

import { useState, useEffect, useCallback } from "react";
import type { Philosopher, PhiloStatus, PhiloState } from "@/types/admin";
import { AGORA_STATUS_COLORS } from "@/lib/constants";
import { formatDate } from "@/lib/date-utils";
import { Spinner } from "@/components/Spinner";

// ── Types ───────────────────────────────────────────────────────────────

interface ThreadListItem {
  id: string;
  question: string;
  asked_by: string;
  status: string;
  created_at: string;
  philosopher_names: string[];
}

interface AgResponseRow {
  id: string;
  philosopher_id: string;
  posts: string; // JSON
  philosopher_name: string;
  philosopher_color: string;
  philosopher_initials: string;
  philosopher_tradition: string;
}

interface AgoraSynthesisData {
  tensions: string[];
  agreements: string[];
  practicalTakeaways: string[];
}

// ── Component ───────────────────────────────────────────────────────────

export default function AgoraWorkshopPage() {
  // ── Shared state ──────────────────────────────────────────────────────
  const [philosophers, setPhilosophers] = useState<Philosopher[]>([]);
  const [existingThreads, setExistingThreads] = useState<ThreadListItem[]>([]);
  const [error, setError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Wizard state ──────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [threadId, setThreadId] = useState<string | null>(null);

  // Step 1: Setup
  const [question, setQuestion] = useState("");
  const [askedBy, setAskedBy] = useState("Anonymous User");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Step 2: Responses
  const [responses, setResponses] = useState<Record<string, PhiloState>>({});

  // Step 3: Synthesis
  const [synthesisState, setSynthesisState] = useState<"pending" | "generating" | "preview" | "approved">("pending");
  const [synthesisData, setSynthesisData] = useState<AgoraSynthesisData | null>(null);
  const [synthesisLogId, setSynthesisLogId] = useState<number | null>(null);
  const [synthesisRawOutput, setSynthesisRawOutput] = useState("");
  const [showSynthesisRaw, setShowSynthesisRaw] = useState(false);
  const [savingSynthesis, setSavingSynthesis] = useState(false);

  // ── Selected philosopher objects ──────────────────────────────────────
  const selectedPhilosophers = selectedIds
    .map((id) => philosophers.find((p) => p.id === id))
    .filter(Boolean) as Philosopher[];

  // ── Fetch on mount ────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/admin/philosophers")
      .then((r) => r.json())
      .then((data) => setPhilosophers(Array.isArray(data) ? data : []))
      .catch((e) => console.error("Failed to fetch philosophers:", e));
    fetchThreads();
  }, []);

  function fetchThreads() {
    fetch("/api/admin/agora")
      .then((r) => r.json())
      .then((data) => setExistingThreads(Array.isArray(data) ? data : []))
      .catch((e) => console.error("Failed to fetch agora threads:", e));
  }

  async function handleDeleteThread(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch("/api/admin/agora", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error("Failed to delete thread");

      setExistingThreads((prev) => prev.filter((t) => t.id !== id));
      setConfirmDeleteId(null);

      if (threadId === id) {
        setThreadId(null);
        setStep(1);
      }
    } catch {
      setError("Failed to delete thread. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  // ── Resume an existing thread ─────────────────────────────────────────
  const resumeThread = useCallback(
    async (id: string) => {
      setError("");
      try {
        const res = await fetch(`/api/admin/agora/${id}`);
        if (!res.ok) throw new Error("Failed to load thread");
        const data = await res.json();

        setThreadId(id);
        setQuestion(data.thread.question);
        setAskedBy(data.thread.asked_by);

        const philoIds = (data.philosophers as Philosopher[]).map((p) => p.id);
        setSelectedIds(philoIds);

        // Merge philosophers
        const fetchedPhilos = data.philosophers as Philosopher[];
        setPhilosophers((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          const merged = [...prev];
          for (const p of fetchedPhilos) {
            if (!ids.has(p.id)) merged.push(p);
          }
          return merged;
        });

        // Build responses state
        const existingResponses = (data.responses || []) as AgResponseRow[];
        const responsesMap: Record<string, PhiloState> = {};
        for (const pid of philoIds) {
          const existing = existingResponses.find((r) => r.philosopher_id === pid);
          if (existing) {
            const posts = JSON.parse(existing.posts) as string[];
            responsesMap[pid] = { status: "approved", posts };
          } else {
            responsesMap[pid] = { status: "pending" };
          }
        }
        setResponses(responsesMap);

        // Build synthesis state
        if (data.synthesis) {
          const tensions = JSON.parse(data.synthesis.tensions || "[]");
          const agreements = JSON.parse(data.synthesis.agreements || "[]");
          const takeaways = JSON.parse(data.synthesis.practical_takeaways || "[]");
          setSynthesisData({ tensions, agreements, practicalTakeaways: takeaways });
          setSynthesisState("approved");
        } else {
          setSynthesisData(null);
          setSynthesisState("pending");
        }

        // Determine step
        const allResponsesApproved =
          philoIds.length > 0 && philoIds.every((pid) => existingResponses.some((r) => r.philosopher_id === pid));

        if (data.thread.status === "complete") {
          setStep(3);
        } else if (allResponsesApproved) {
          setStep(3);
        } else {
          setStep(2);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load thread");
      }
    },
    []
  );

  // ── Step 1: Create thread ─────────────────────────────────────────────
  async function handleCreateThread() {
    setError("");
    if (!question.trim()) {
      setError("A question is required.");
      return;
    }
    if (selectedIds.length < 2) {
      setError("Select at least 2 philosophers.");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/agora", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          asked_by: askedBy.trim() || "Anonymous User",
          philosopher_ids: selectedIds,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Failed to create thread");
      }
      const data = await res.json();
      setThreadId(data.thread.id);

      // Initialize responses state
      const init: Record<string, PhiloState> = {};
      for (const pid of selectedIds) init[pid] = { status: "pending" };
      setResponses(init);

      fetchThreads();
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create thread");
    } finally {
      setCreating(false);
    }
  }

  // ── Step 2: Generate response ─────────────────────────────────────────
  async function handleGenerateResponse(philosopherId: string) {
    if (!threadId) return;
    setError("");
    setResponses((prev) => ({ ...prev, [philosopherId]: { status: "generating" } }));

    try {
      const res = await fetch(`/api/admin/agora/${threadId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ philosopher_id: philosopherId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      const posts = data.generated.posts as string[];
      setResponses((prev) => ({
        ...prev,
        [philosopherId]: {
          status: "preview",
          posts,
          logId: data.log_entry?.id,
          rawOutput: data.raw_output,
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setResponses((prev) => ({ ...prev, [philosopherId]: { status: "pending" } }));
    }
  }

  async function handleApproveResponse(philosopherId: string) {
    if (!threadId) return;
    const state = responses[philosopherId];
    if (!state?.posts) return;
    setError("");

    try {
      const res = await fetch(`/api/admin/agora/${threadId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          philosopher_id: philosopherId,
          posts: state.posts,
          generation_log_id: state.logId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Approval failed");
      }

      setResponses((prev) => ({
        ...prev,
        [philosopherId]: { ...prev[philosopherId], status: "approved" },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    }
  }

  // ── Step 3: Synthesis ─────────────────────────────────────────────────
  async function handleGenerateSynthesis() {
    if (!threadId) return;
    setError("");
    setSynthesisState("generating");

    try {
      const res = await fetch(`/api/admin/agora/${threadId}/synthesis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Synthesis generation failed");

      setSynthesisData(data.generated as AgoraSynthesisData);
      setSynthesisLogId(data.log_entry?.id ?? null);
      setSynthesisRawOutput(data.raw_output || "");
      setSynthesisState("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Synthesis failed");
      setSynthesisState("pending");
    }
  }

  async function handleSaveSynthesis() {
    if (!threadId || !synthesisData) return;
    setError("");
    setSavingSynthesis(true);

    try {
      const res = await fetch(`/api/admin/agora/${threadId}/synthesis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          data: { ...synthesisData, generation_log_id: synthesisLogId },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Failed to save synthesis");
      }

      setSynthesisState("approved");
      fetchThreads();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save synthesis");
    } finally {
      setSavingSynthesis(false);
    }
  }

  // ── Progress helpers ──────────────────────────────────────────────────
  const allResponsesApproved =
    selectedIds.length > 0 && selectedIds.every((id) => responses[id]?.status === "approved");
  const responsesApprovedCount = selectedIds.filter((id) => responses[id]?.status === "approved").length;

  function togglePhilosopher(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const stepsList = [
    { num: 1, label: "Setup" },
    { num: 2, label: "Responses" },
    { num: 3, label: "Synthesis" },
  ];

  // ── Philosopher response card ─────────────────────────────────────────
  function ResponseCard({
    philosopher,
    state,
    onGenerate,
    onApprove,
  }: {
    philosopher: Philosopher;
    state: PhiloState;
    onGenerate: () => void;
    onApprove: () => void;
  }) {
    return (
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-serif font-bold shrink-0"
              style={{ backgroundColor: philosopher.color }}
            >
              {philosopher.initials}
            </div>
            <div>
              <span className="font-serif font-bold text-ink text-sm">{philosopher.name}</span>
              <span
                className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{ backgroundColor: `${philosopher.color}15`, color: philosopher.color }}
              >
                {philosopher.tradition}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {state.status === "pending" && (
              <button
                onClick={onGenerate}
                className="inline-flex items-center gap-1.5 bg-terracotta hover:bg-terracotta-light text-white text-xs font-body px-3 py-1.5 rounded-full transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                Generate
              </button>
            )}
            {state.status === "generating" && (
              <span className="inline-flex items-center gap-1.5 text-xs text-ink-lighter">
                <Spinner /> Generating...
              </span>
            )}
            {state.status === "approved" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Approved
              </span>
            )}
          </div>
        </div>

        {/* Preview */}
        {(state.status === "preview" || state.status === "approved") && state.posts && (
          <div className="px-5 pb-4 border-t border-border/50">
            <div className="mt-3 space-y-3">
              {state.posts.map((post, i) => (
                <div
                  key={i}
                  className="text-sm text-ink leading-relaxed whitespace-pre-line pl-3"
                  style={{ borderLeft: `2px solid ${philosopher.color}40` }}
                >
                  {state.posts!.length > 1 && (
                    <span className="text-[10px] font-mono text-ink-lighter block mb-1">
                      Response {i + 1}
                    </span>
                  )}
                  {post}
                </div>
              ))}
            </div>

            {state.status === "preview" && (
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={onApprove}
                  className="inline-flex items-center gap-1.5 bg-green-700 hover:bg-green-800 text-white text-xs font-body px-3 py-1.5 rounded-lg transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Approve
                </button>
                <button
                  onClick={onGenerate}
                  className="inline-flex items-center gap-1 text-xs font-mono text-terracotta hover:text-terracotta-light transition-colors"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                  </svg>
                  Re-generate
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-ink">Agora Workshop</h1>
        <p className="text-sm text-ink-lighter mt-1">
          Create and orchestrate philosopher responses to user questions.
        </p>
      </div>

      {/* Existing threads */}
      {existingThreads.length > 0 && (
        <div className="mb-8">
          <h2 className="font-serif text-lg font-bold text-ink mb-3">Existing Threads</h2>
          <div className="space-y-2">
            {existingThreads.map((t) => (
              <div
                key={t.id}
                className={`w-full bg-white border rounded-xl px-5 py-3 transition-colors ${
                  threadId === t.id ? "border-terracotta ring-1 ring-terracotta/30" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => resumeThread(t.id)}
                    className="min-w-0 flex-1 mr-4 text-left hover:opacity-70 transition-opacity"
                  >
                    <span className="font-serif font-bold text-ink text-sm line-clamp-1">{t.question}</span>
                    <span className="text-xs text-ink-lighter block mt-0.5">
                      Asked by {t.asked_by} &middot; {t.philosopher_names.join(", ")}
                    </span>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${AGORA_STATUS_COLORS[t.status] || "bg-gray-100 text-gray-700"}`}>
                      {t.status}
                    </span>
                    <span className="text-xs text-ink-lighter font-mono">{formatDate(t.created_at)}</span>
                    {confirmDeleteId === t.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleDeleteThread(t.id)}
                          disabled={deletingId === t.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono tracking-wide rounded-full text-white bg-red-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700"
                        >
                          {deletingId === t.id ? (
                            <span className="flex items-center gap-1">
                              <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                              Deleting
                            </span>
                          ) : (
                            "Confirm"
                          )}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="inline-flex items-center px-2.5 py-1 text-[11px] font-mono tracking-wide rounded-full text-ink-lighter border border-border-light transition-all duration-200 hover:bg-parchment-dark/50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(t.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono tracking-wide rounded-full text-ink-lighter border border-border-light transition-all duration-200 hover:text-red-600 hover:border-red-300 hover:bg-red-50"
                        title="Delete this thread"
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M3 4H13L12 14H4L3 4Z" />
                          <path d="M1 4H15" strokeLinecap="round" />
                          <path d="M6 2H10" strokeLinecap="round" />
                          <path d="M7 7V11" strokeLinecap="round" />
                          <path d="M9 7V11" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step indicator */}
      {threadId && (
        <div className="mb-6 flex items-center gap-2">
          {stepsList.map((s, i) => (
            <div key={s.num} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px bg-border" />}
              <div
                className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-full transition-colors ${
                  s.num < step
                    ? "bg-green-100 text-green-800"
                    : s.num === step
                    ? "bg-terracotta/10 text-terracotta ring-1 ring-terracotta/30"
                    : "bg-parchment-dark/30 text-ink-lighter"
                }`}
              >
                {s.num < step ? (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <span>{s.num}</span>
                )}
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* ── Step 1: Setup ──────────────────────────────────────────── */}
      {step === 1 && !threadId && (
        <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-border bg-parchment-dark/20">
            <h2 className="font-serif text-lg font-bold text-ink">New Agora Thread</h2>
          </div>
          <div className="px-6 py-6 space-y-6">
            {/* Question */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2">
                User&apos;s Question
              </label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={4}
                placeholder="What question should the philosophers respond to?"
                className="w-full rounded-lg border border-border bg-parchment px-4 py-3 text-sm text-ink font-body placeholder:text-ink-lighter/60 focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta transition-colors resize-y"
              />
            </div>

            {/* Asked by */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2">
                Asked By
              </label>
              <input
                type="text"
                value={askedBy}
                onChange={(e) => setAskedBy(e.target.value)}
                placeholder="Anonymous User"
                className="w-full max-w-xs rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm text-ink font-body focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta transition-colors"
              />
            </div>

            {/* Philosopher multi-select */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2">
                Select Philosophers
                <span className="normal-case text-ink-lighter/60 ml-1">(3-6 recommended)</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {philosophers.map((p) => {
                  const selected = selectedIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePhilosopher(p.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-all text-sm ${
                        selected
                          ? "border-terracotta bg-terracotta/5 ring-1 ring-terracotta/30"
                          : "border-border hover:bg-parchment-dark/20"
                      }`}
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-serif font-bold shrink-0"
                        style={{ backgroundColor: p.color }}
                      >
                        {p.initials}
                      </div>
                      <div className="min-w-0">
                        <div className="font-serif font-bold text-ink text-xs truncate">{p.name}</div>
                        <div className="text-[10px] text-ink-lighter truncate">{p.tradition}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-border bg-parchment-dark/20 flex items-center justify-between">
            <p className="text-xs text-ink-lighter">
              {selectedIds.length} philosopher{selectedIds.length !== 1 ? "s" : ""} selected
            </p>
            <button
              onClick={handleCreateThread}
              disabled={creating || !question.trim() || selectedIds.length < 2}
              className="inline-flex items-center gap-2 bg-terracotta hover:bg-terracotta-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-body font-medium text-sm px-6 py-2.5 rounded-full shadow-sm hover:shadow transition-all"
            >
              {creating ? <><Spinner /> Creating...</> : "Create Thread"}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Philosopher Responses ──────────────────────────── */}
      {step === 2 && threadId && (
        <div>
          {/* Show question */}
          <div className="bg-parchment-dark/30 border border-border rounded-xl px-5 py-4 mb-4">
            <p className="text-xs font-mono uppercase tracking-wider text-ink-lighter mb-1">Question</p>
            <p className="font-serif text-ink leading-relaxed">{question}</p>
            <p className="text-xs text-ink-lighter mt-1">— {askedBy}</p>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-serif text-lg font-bold text-ink">Philosopher Responses</h2>
              <p className="text-xs text-ink-lighter mt-0.5">
                {responsesApprovedCount} of {selectedIds.length} approved
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {selectedPhilosophers.map((p) => (
              <ResponseCard
                key={p.id}
                philosopher={p}
                state={responses[p.id] || { status: "pending" }}
                onGenerate={() => handleGenerateResponse(p.id)}
                onApprove={() => handleApproveResponse(p.id)}
              />
            ))}
          </div>

          {allResponsesApproved && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  fetch(`/api/admin/agora/${threadId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "in_progress" }),
                  });
                  setStep(3);
                }}
                className="inline-flex items-center gap-2 bg-terracotta hover:bg-terracotta-light text-white font-body font-medium text-sm px-6 py-2.5 rounded-full shadow-sm hover:shadow transition-all"
              >
                Proceed to Synthesis
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Synthesis ──────────────────────────────────────── */}
      {step === 3 && threadId && (
        <div>
          {/* Show question */}
          <div className="bg-parchment-dark/30 border border-border rounded-xl px-5 py-4 mb-4">
            <p className="text-xs font-mono uppercase tracking-wider text-ink-lighter mb-1">Question</p>
            <p className="font-serif text-ink leading-relaxed">{question}</p>
            <p className="text-xs text-ink-lighter mt-1">— {askedBy}</p>
          </div>

          <h2 className="font-serif text-lg font-bold text-ink mb-4">Synthesis</h2>

          {synthesisState === "pending" && (
            <div className="bg-white border border-border rounded-xl px-6 py-8 text-center">
              <p className="text-sm text-ink-lighter mb-4">
                Generate an editorial synthesis of the philosopher responses.
              </p>
              <button
                onClick={handleGenerateSynthesis}
                className="inline-flex items-center gap-2 bg-terracotta hover:bg-terracotta-light text-white font-body font-medium text-sm px-6 py-2.5 rounded-full shadow-sm hover:shadow transition-all"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                Generate Synthesis
              </button>
            </div>
          )}

          {synthesisState === "generating" && (
            <div className="bg-white border border-border rounded-xl px-6 py-8 text-center">
              <Spinner className="h-6 w-6 mx-auto mb-2 text-terracotta" />
              <p className="text-sm text-ink-lighter">Generating editorial synthesis...</p>
            </div>
          )}

          {(synthesisState === "preview" || synthesisState === "approved") && synthesisData && (
            <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-5 space-y-5">
                {/* Tensions */}
                <div>
                  <h3 className="text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2">Tensions</h3>
                  <ul className="space-y-1.5">
                    {synthesisData.tensions.map((t, i) => (
                      <li key={i} className="text-sm text-ink leading-relaxed pl-3 border-l-2 border-red-300">{t}</li>
                    ))}
                  </ul>
                </div>

                {/* Agreements */}
                <div>
                  <h3 className="text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2">Agreements</h3>
                  <ul className="space-y-1.5">
                    {synthesisData.agreements.map((a, i) => (
                      <li key={i} className="text-sm text-ink leading-relaxed pl-3 border-l-2 border-green-300">{a}</li>
                    ))}
                  </ul>
                </div>

                {/* Practical Takeaways */}
                <div>
                  <h3 className="text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2">Practical Takeaways</h3>
                  <ul className="space-y-1.5">
                    {synthesisData.practicalTakeaways.map((t, i) => (
                      <li key={i} className="text-sm text-ink leading-relaxed pl-3 border-l-2 border-terracotta/50">{t}</li>
                    ))}
                  </ul>
                </div>

                {/* Raw output */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowSynthesisRaw(!showSynthesisRaw)}
                    className="text-xs font-mono text-ink-lighter hover:text-ink-light transition-colors"
                  >
                    {showSynthesisRaw ? "▼ Hide" : "▶ Show"} raw output
                  </button>
                  {showSynthesisRaw && (
                    <pre className="mt-2 p-3 bg-parchment-dark/40 rounded-lg text-xs font-mono text-ink-light overflow-x-auto max-h-48 whitespace-pre-wrap">
                      {synthesisRawOutput}
                    </pre>
                  )}
                </div>
              </div>

              {synthesisState === "preview" && (
                <div className="px-6 py-4 border-t border-border bg-parchment-dark/20 flex items-center justify-between">
                  <button
                    onClick={handleGenerateSynthesis}
                    className="inline-flex items-center gap-1 text-xs font-mono text-terracotta hover:text-terracotta-light transition-colors"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                    </svg>
                    Re-generate
                  </button>
                  <button
                    onClick={handleSaveSynthesis}
                    disabled={savingSynthesis}
                    className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-body font-medium text-sm px-5 py-2 rounded-lg shadow-sm transition-colors"
                  >
                    {savingSynthesis ? <><Spinner /> Saving...</> : (
                      <>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Approve &amp; Complete Thread
                      </>
                    )}
                  </button>
                </div>
              )}

              {synthesisState === "approved" && (
                <div className="px-6 py-4 border-t border-border bg-green-50">
                  <p className="text-sm text-green-800 font-medium flex items-center gap-1.5">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Thread complete! Synthesis has been saved.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!threadId && step === 1 && existingThreads.length === 0 && (
        <p className="text-sm text-ink-lighter mt-4">
          No agora threads yet. Create your first one above.
        </p>
      )}
    </div>
  );
}
