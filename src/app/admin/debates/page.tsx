"use client";

import { useState, useEffect, useCallback } from "react";
import type { Philosopher, PhiloStatus, PhiloState } from "@/types/admin";
import { DEBATE_STATUS_COLORS } from "@/lib/constants";
import { formatDate } from "@/lib/date-utils";
import { Spinner } from "@/components/Spinner";

// ── Types ───────────────────────────────────────────────────────────────

interface DebateListItem {
  id: string;
  title: string;
  status: string;
  debate_date: string;
  philosopher_names: string[];
}

interface DebatePost {
  id: string;
  philosopher_id: string;
  content: string;
  phase: string;
  reply_to: string | null;
  philosopher_name: string;
  philosopher_color: string;
  philosopher_initials: string;
  philosopher_tradition: string;
}

interface SynthesisData {
  tensions: string[];
  agreements: string[];
  questionsForReflection: string[];
  synthesisSummary: {
    agree: string;
    diverge: string;
    unresolvedQuestion: string;
  };
}

// ── Component ───────────────────────────────────────────────────────────

export default function DebateWorkshopPage() {
  // ── Shared state ──────────────────────────────────────────────────────
  const [philosophers, setPhilosophers] = useState<Philosopher[]>([]);
  const [existingDebates, setExistingDebates] = useState<DebateListItem[]>([]);
  const [error, setError] = useState("");

  // ── Wizard state ──────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [debateId, setDebateId] = useState<string | null>(null);

  // Step 1: Setup
  const [title, setTitle] = useState("");
  const [articleTitle, setArticleTitle] = useState("");
  const [articleSource, setArticleSource] = useState("");
  const [articleUrl, setArticleUrl] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Step 2: Openings
  const [openings, setOpenings] = useState<Record<string, PhiloState>>({});

  // Step 3: Rebuttals
  const [rebuttals, setRebuttals] = useState<Record<string, PhiloState>>({});
  const [rebuttalTargets, setRebuttalTargets] = useState<Record<string, string>>({});

  // Step 4: Synthesis
  const [synthesisState, setSynthesisState] = useState<"pending" | "generating" | "preview" | "approved">("pending");
  const [synthesisData, setSynthesisData] = useState<SynthesisData | null>(null);
  const [synthesisLogId, setSynthesisLogId] = useState<number | null>(null);
  const [synthesisRawOutput, setSynthesisRawOutput] = useState("");
  const [showSynthesisRaw, setShowSynthesisRaw] = useState(false);
  const [savingSynthesis, setSavingSynthesis] = useState(false);

  // ── Selected philosopher objects (in order) ──────────────────────────
  const selectedPhilosophers = selectedIds
    .map((id) => philosophers.find((p) => p.id === id))
    .filter(Boolean) as Philosopher[];

  // ── Fetch philosophers + existing debates on mount ────────────────────
  useEffect(() => {
    fetch("/api/admin/philosophers")
      .then((r) => r.json())
      .then((data) => setPhilosophers(Array.isArray(data) ? data : []))
      .catch((e) => console.error("Failed to fetch philosophers:", e));
    fetchDebates();
  }, []);

  function fetchDebates() {
    fetch("/api/admin/debates")
      .then((r) => r.json())
      .then((data) => setExistingDebates(Array.isArray(data) ? data : []))
      .catch((e) => console.error("Failed to fetch debates:", e));
  }

  // ── Resume an existing debate ─────────────────────────────────────────
  const resumeDebate = useCallback(
    async (id: string) => {
      setError("");
      try {
        const res = await fetch(`/api/admin/debates/${id}`);
        if (!res.ok) throw new Error("Failed to load debate");
        const data = await res.json();

        setDebateId(id);
        setTitle(data.debate.title);
        setArticleTitle(data.debate.trigger_article_title);
        setArticleSource(data.debate.trigger_article_source);
        setArticleUrl(data.debate.trigger_article_url || "");

        const philoIds = (data.philosophers as Philosopher[]).map((p) => p.id);
        setSelectedIds(philoIds);

        // Merge fetched philosophers with local list
        const fetchedPhilos = data.philosophers as Philosopher[];
        setPhilosophers((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          const merged = [...prev];
          for (const p of fetchedPhilos) {
            if (!ids.has(p.id)) merged.push(p);
          }
          return merged;
        });

        const openingPosts = (data.posts.openings || []) as DebatePost[];
        const rebuttalPosts = (data.posts.rebuttals || []) as DebatePost[];

        // Build openings state
        const openingsMap: Record<string, PhiloState> = {};
        for (const pid of philoIds) {
          const existing = openingPosts.find((p) => p.philosopher_id === pid);
          openingsMap[pid] = existing
            ? { status: "approved", content: existing.content }
            : { status: "pending" };
        }
        setOpenings(openingsMap);

        // Build rebuttals state + targets
        const targets: Record<string, string> = {};
        for (let i = 0; i < philoIds.length; i++) {
          targets[philoIds[i]] = philoIds[(i + 1) % philoIds.length];
        }
        setRebuttalTargets(targets);

        const rebuttalsMap: Record<string, PhiloState> = {};
        for (const pid of philoIds) {
          const existing = rebuttalPosts.find((p) => p.philosopher_id === pid);
          rebuttalsMap[pid] = existing
            ? { status: "approved", content: existing.content }
            : { status: "pending" };
        }
        setRebuttals(rebuttalsMap);

        // Build synthesis state
        if (data.debate.status === "complete") {
          const tensions = JSON.parse(data.debate.synthesis_tensions || "[]");
          const agreements = JSON.parse(data.debate.synthesis_agreements || "[]");
          const questions = JSON.parse(data.debate.synthesis_questions || "[]");
          setSynthesisData({
            tensions,
            agreements,
            questionsForReflection: questions,
            synthesisSummary: {
              agree: data.debate.synthesis_summary_agree || "",
              diverge: data.debate.synthesis_summary_diverge || "",
              unresolvedQuestion: data.debate.synthesis_summary_unresolved || "",
            },
          });
          setSynthesisState("approved");
        } else {
          setSynthesisData(null);
          setSynthesisState("pending");
        }

        // Determine current step
        const allOpeningsApproved =
          philoIds.length > 0 && philoIds.every((pid) => openingPosts.some((p) => p.philosopher_id === pid));
        const allRebuttalsApproved =
          philoIds.length > 0 && philoIds.every((pid) => rebuttalPosts.some((p) => p.philosopher_id === pid));

        if (data.debate.status === "complete") {
          setStep(4);
        } else if (allRebuttalsApproved) {
          setStep(4);
        } else if (allOpeningsApproved) {
          setStep(3);
        } else {
          setStep(2);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load debate");
      }
    },
    []
  );

  // ── Step 1: Create debate ─────────────────────────────────────────────
  async function handleCreateDebate() {
    setError("");
    if (!title.trim() || !articleTitle.trim() || !articleSource.trim()) {
      setError("Title, article title, and source are required.");
      return;
    }
    if (selectedIds.length < 2) {
      setError("Select at least 2 philosophers.");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/debates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          trigger_article_title: articleTitle.trim(),
          trigger_article_source: articleSource.trim(),
          trigger_article_url: articleUrl.trim() || undefined,
          philosopher_ids: selectedIds,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Failed to create debate");
      }
      const data = await res.json();
      setDebateId(data.debate.id);

      // Initialize openings state
      const init: Record<string, PhiloState> = {};
      for (const pid of selectedIds) init[pid] = { status: "pending" };
      setOpenings(init);

      // Initialize rebuttal targets (circular)
      const targets: Record<string, string> = {};
      for (let i = 0; i < selectedIds.length; i++) {
        targets[selectedIds[i]] = selectedIds[(i + 1) % selectedIds.length];
      }
      setRebuttalTargets(targets);

      // Initialize rebuttals state
      const rebInit: Record<string, PhiloState> = {};
      for (const pid of selectedIds) rebInit[pid] = { status: "pending" };
      setRebuttals(rebInit);

      fetchDebates();
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create debate");
    } finally {
      setCreating(false);
    }
  }

  // ── Step 2: Generate opening ──────────────────────────────────────────
  async function handleGenerateOpening(philosopherId: string) {
    if (!debateId) return;
    setError("");
    setOpenings((prev) => ({ ...prev, [philosopherId]: { status: "generating" } }));

    try {
      const res = await fetch(`/api/admin/debates/${debateId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ philosopher_id: philosopherId, phase: "opening" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      setOpenings((prev) => ({
        ...prev,
        [philosopherId]: {
          status: "preview",
          content: data.generated.content,
          logId: data.log_entry?.id,
          rawOutput: data.raw_output,
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setOpenings((prev) => ({ ...prev, [philosopherId]: { status: "pending" } }));
    }
  }

  async function handleApproveOpening(philosopherId: string) {
    if (!debateId) return;
    const state = openings[philosopherId];
    if (!state?.content) return;
    setError("");

    try {
      const res = await fetch(`/api/admin/debates/${debateId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          philosopher_id: philosopherId,
          phase: "opening",
          content: state.content,
          generation_log_id: state.logId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Approval failed");
      }

      setOpenings((prev) => ({
        ...prev,
        [philosopherId]: { ...prev[philosopherId], status: "approved" },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    }
  }

  // ── Step 3: Generate rebuttal ─────────────────────────────────────────
  async function handleGenerateRebuttal(philosopherId: string) {
    if (!debateId) return;
    setError("");
    setRebuttals((prev) => ({ ...prev, [philosopherId]: { status: "generating" } }));

    const targetId = rebuttalTargets[philosopherId];

    try {
      const res = await fetch(`/api/admin/debates/${debateId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          philosopher_id: philosopherId,
          phase: "rebuttal",
          target_philosopher_id: targetId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      setRebuttals((prev) => ({
        ...prev,
        [philosopherId]: {
          status: "preview",
          content: data.generated.content,
          logId: data.log_entry?.id,
          rawOutput: data.raw_output,
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setRebuttals((prev) => ({ ...prev, [philosopherId]: { status: "pending" } }));
    }
  }

  async function handleApproveRebuttal(philosopherId: string) {
    if (!debateId) return;
    const state = rebuttals[philosopherId];
    if (!state?.content) return;
    setError("");

    const targetId = rebuttalTargets[philosopherId];

    try {
      const res = await fetch(`/api/admin/debates/${debateId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          philosopher_id: philosopherId,
          phase: "rebuttal",
          content: state.content,
          generation_log_id: state.logId,
          target_philosopher_id: targetId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Approval failed");
      }

      setRebuttals((prev) => ({
        ...prev,
        [philosopherId]: { ...prev[philosopherId], status: "approved" },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    }
  }

  // ── Step 4: Synthesis ─────────────────────────────────────────────────
  async function handleGenerateSynthesis() {
    if (!debateId) return;
    setError("");
    setSynthesisState("generating");

    try {
      const res = await fetch(`/api/admin/debates/${debateId}/synthesis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Synthesis generation failed");

      setSynthesisData(data.generated as SynthesisData);
      setSynthesisLogId(data.log_entry?.id ?? null);
      setSynthesisRawOutput(data.raw_output || "");
      setSynthesisState("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Synthesis failed");
      setSynthesisState("pending");
    }
  }

  async function handleSaveSynthesis() {
    if (!debateId || !synthesisData) return;
    setError("");
    setSavingSynthesis(true);

    try {
      const res = await fetch(`/api/admin/debates/${debateId}/synthesis`, {
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
      fetchDebates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save synthesis");
    } finally {
      setSavingSynthesis(false);
    }
  }

  // ── Progress helpers ──────────────────────────────────────────────────
  const allOpeningsApproved =
    selectedIds.length > 0 && selectedIds.every((id) => openings[id]?.status === "approved");
  const allRebuttalsApproved =
    selectedIds.length > 0 && selectedIds.every((id) => rebuttals[id]?.status === "approved");
  const openingsApprovedCount = selectedIds.filter((id) => openings[id]?.status === "approved").length;
  const rebuttalsApprovedCount = selectedIds.filter((id) => rebuttals[id]?.status === "approved").length;

  // ── Philosopher toggle ────────────────────────────────────────────────
  function togglePhilosopher(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // ── Step indicator ────────────────────────────────────────────────────
  const steps = [
    { num: 1, label: "Setup" },
    { num: 2, label: "Openings" },
    { num: 3, label: "Rebuttals" },
    { num: 4, label: "Synthesis" },
  ];

  // ── Philosopher card component for generate/approve flows ─────────────
  function PhiloCard({
    philosopher,
    state,
    onGenerate,
    onApprove,
    assignmentLabel,
  }: {
    philosopher: Philosopher;
    state: PhiloState;
    onGenerate: () => void;
    onApprove: () => void;
    assignmentLabel?: string;
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
              {assignmentLabel && (
                <p className="text-xs text-ink-lighter mt-0.5">{assignmentLabel}</p>
              )}
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
        {(state.status === "preview" || state.status === "approved") && state.content && (
          <div className="px-5 pb-4 border-t border-border/50">
            <div
              className="mt-3 text-sm text-ink leading-relaxed whitespace-pre-line pl-3"
              style={{ borderLeft: `2px solid ${philosopher.color}40` }}
            >
              {state.content}
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
        <h1 className="font-serif text-2xl font-bold text-ink">Debate Workshop</h1>
        <p className="text-sm text-ink-lighter mt-1">
          Create and orchestrate structured philosophical debates.
        </p>
      </div>

      {/* Existing debates */}
      {existingDebates.length > 0 && (
        <div className="mb-8">
          <h2 className="font-serif text-lg font-bold text-ink mb-3">Existing Debates</h2>
          <div className="space-y-2">
            {existingDebates.map((d) => (
              <button
                key={d.id}
                onClick={() => resumeDebate(d.id)}
                className={`w-full text-left bg-white border rounded-xl px-5 py-3 hover:bg-parchment-dark/20 transition-colors ${
                  debateId === d.id ? "border-terracotta ring-1 ring-terracotta/30" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-serif font-bold text-ink text-sm">{d.title}</span>
                    <span className="text-xs text-ink-lighter ml-2">
                      {d.philosopher_names.join(", ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${DEBATE_STATUS_COLORS[d.status] || "bg-gray-100 text-gray-700"}`}>
                      {d.status}
                    </span>
                    <span className="text-xs text-ink-lighter font-mono">{formatDate(d.debate_date)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step indicator */}
      {debateId && (
        <div className="mb-6 flex items-center gap-2">
          {steps.map((s, i) => (
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

      {/* Error message */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* ── Step 1: Setup ──────────────────────────────────────────── */}
      {step === 1 && !debateId && (
        <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-border bg-parchment-dark/20">
            <h2 className="font-serif text-lg font-bold text-ink">New Debate Setup</h2>
          </div>
          <div className="px-6 py-6 space-y-6">
            {/* Title */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2">
                Debate Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder='e.g. "Can Suffering Have Meaning?"'
                className="w-full rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm text-ink font-body focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta transition-colors"
              />
            </div>

            {/* Article info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2">
                  Article Title
                </label>
                <input
                  type="text"
                  value={articleTitle}
                  onChange={(e) => setArticleTitle(e.target.value)}
                  placeholder="Title of the trigger article"
                  className="w-full rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm text-ink font-body focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2">
                  Source
                </label>
                <input
                  type="text"
                  value={articleSource}
                  onChange={(e) => setArticleSource(e.target.value)}
                  placeholder="e.g. The New York Times"
                  className="w-full rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm text-ink font-body focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2">
                  URL <span className="normal-case text-ink-lighter/60">(optional)</span>
                </label>
                <input
                  type="url"
                  value={articleUrl}
                  onChange={(e) => setArticleUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm text-ink font-body focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta transition-colors"
                />
              </div>
            </div>

            {/* Philosopher multi-select */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2">
                Select Philosophers
                <span className="normal-case text-ink-lighter/60 ml-1">(3-4 recommended)</span>
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
              onClick={handleCreateDebate}
              disabled={creating || !title.trim() || !articleTitle.trim() || selectedIds.length < 2}
              className="inline-flex items-center gap-2 bg-terracotta hover:bg-terracotta-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-body font-medium text-sm px-6 py-2.5 rounded-full shadow-sm hover:shadow transition-all"
            >
              {creating ? <><Spinner /> Creating...</> : "Create Debate"}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Opening Statements ─────────────────────────────── */}
      {step === 2 && debateId && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-serif text-lg font-bold text-ink">Opening Statements</h2>
              <p className="text-xs text-ink-lighter mt-0.5">
                {openingsApprovedCount} of {selectedIds.length} approved
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {selectedPhilosophers.map((p) => (
              <PhiloCard
                key={p.id}
                philosopher={p}
                state={openings[p.id] || { status: "pending" }}
                onGenerate={() => handleGenerateOpening(p.id)}
                onApprove={() => handleApproveOpening(p.id)}
              />
            ))}
          </div>
          {allOpeningsApproved && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  // Update debate status to in_progress
                  fetch(`/api/admin/debates/${debateId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "in_progress" }),
                  });
                  setStep(3);
                }}
                className="inline-flex items-center gap-2 bg-terracotta hover:bg-terracotta-light text-white font-body font-medium text-sm px-6 py-2.5 rounded-full shadow-sm hover:shadow transition-all"
              >
                Proceed to Rebuttals
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Rebuttals ──────────────────────────────────────── */}
      {step === 3 && debateId && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-serif text-lg font-bold text-ink">Rebuttals</h2>
              <p className="text-xs text-ink-lighter mt-0.5">
                {rebuttalsApprovedCount} of {selectedIds.length} approved
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {selectedPhilosophers.map((p) => {
              const targetId = rebuttalTargets[p.id];
              const targetPhilo = philosophers.find((x) => x.id === targetId);
              return (
                <PhiloCard
                  key={p.id}
                  philosopher={p}
                  state={rebuttals[p.id] || { status: "pending" }}
                  onGenerate={() => handleGenerateRebuttal(p.id)}
                  onApprove={() => handleApproveRebuttal(p.id)}
                  assignmentLabel={targetPhilo ? `Rebutting ${targetPhilo.name}` : undefined}
                />
              );
            })}
          </div>
          {allRebuttalsApproved && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setStep(4)}
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

      {/* ── Step 4: Synthesis ──────────────────────────────────────── */}
      {step === 4 && debateId && (
        <div>
          <h2 className="font-serif text-lg font-bold text-ink mb-4">Synthesis</h2>

          {synthesisState === "pending" && (
            <div className="bg-white border border-border rounded-xl px-6 py-8 text-center">
              <p className="text-sm text-ink-lighter mb-4">
                Generate an editorial synthesis of the debate.
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
                      <li key={i} className="text-sm text-ink leading-relaxed pl-3 border-l-2 border-red-300">
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Agreements */}
                <div>
                  <h3 className="text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2">Agreements</h3>
                  <ul className="space-y-1.5">
                    {synthesisData.agreements.map((a, i) => (
                      <li key={i} className="text-sm text-ink leading-relaxed pl-3 border-l-2 border-green-300">
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Questions for Reflection */}
                <div>
                  <h3 className="text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2">Questions for Reflection</h3>
                  <ul className="space-y-1.5">
                    {synthesisData.questionsForReflection.map((q, i) => (
                      <li key={i} className="text-sm text-ink leading-relaxed pl-3 border-l-2 border-blue-300">
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Summary */}
                {synthesisData.synthesisSummary && (
                  <div className="bg-parchment-dark/20 rounded-lg p-4">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2">Summary</h3>
                    <div className="space-y-2 text-sm text-ink">
                      <p><strong className="text-green-800">Agree:</strong> {synthesisData.synthesisSummary.agree}</p>
                      <p><strong className="text-red-800">Diverge:</strong> {synthesisData.synthesisSummary.diverge}</p>
                      <p><strong className="text-blue-800">Unresolved:</strong> {synthesisData.synthesisSummary.unresolvedQuestion}</p>
                    </div>
                  </div>
                )}

                {/* Raw output toggle */}
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

              {/* Action buttons */}
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
                        Approve &amp; Complete Debate
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
                    Debate complete! Synthesis has been saved.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty state when no debate is active and no existing debates */}
      {!debateId && step === 1 && existingDebates.length === 0 && (
        <p className="text-sm text-ink-lighter mt-4">
          No debates yet. Create your first one above.
        </p>
      )}
    </div>
  );
}
