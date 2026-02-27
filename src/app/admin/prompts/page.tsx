"use client";

import { useState, useEffect, useCallback } from "react";

interface Philosopher {
  id: string;
  name: string;
  tradition: string;
  color: string;
  initials: string;
}

interface SystemPrompt {
  id: number;
  philosopher_id: string;
  prompt_version: number;
  system_prompt_text: string;
  created_at: string;
  is_active: number;
}

export default function PromptsPage() {
  const [philosophers, setPhilosophers] = useState<Philosopher[]>([]);
  const [selectedPhilosopher, setSelectedPhilosopher] =
    useState<Philosopher | null>(null);
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [newPromptText, setNewPromptText] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [loadingPhilosophers, setLoadingPhilosophers] = useState(true);
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch philosophers on mount
  useEffect(() => {
    async function fetchPhilosophers() {
      try {
        const res = await fetch("/api/admin/philosophers");
        if (!res.ok) throw new Error("Failed to fetch philosophers");
        const data = await res.json();
        setPhilosophers(Array.isArray(data) ? data : data.philosophers ?? []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load philosophers"
        );
      } finally {
        setLoadingPhilosophers(false);
      }
    }
    fetchPhilosophers();
  }, []);

  // Fetch prompts when philosopher changes
  const fetchPrompts = useCallback(async (philosopherId: string) => {
    setLoadingPrompts(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/prompts?philosopher_id=${encodeURIComponent(philosopherId)}`
      );
      if (!res.ok) throw new Error("Failed to fetch prompts");
      const data = await res.json();
      const list: SystemPrompt[] = Array.isArray(data)
        ? data
        : data.prompts ?? [];
      list.sort((a, b) => b.prompt_version - a.prompt_version);
      setPrompts(list);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load prompts"
      );
      setPrompts([]);
    } finally {
      setLoadingPrompts(false);
    }
  }, []);

  function handleSelectPhilosopher(p: Philosopher) {
    setSelectedPhilosopher(p);
    setNewPromptText("");
    setExpandedIds(new Set());
    fetchPrompts(p.id);
  }

  async function handleCreatePrompt() {
    if (!selectedPhilosopher || !newPromptText.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          philosopher_id: selectedPhilosopher.id,
          system_prompt_text: newPromptText.trim(),
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? "Failed to create prompt");
      }
      setNewPromptText("");
      await fetchPrompts(selectedPhilosopher.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save prompt"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSetActive(promptId: number) {
    if (!selectedPhilosopher) return;
    setActivating(promptId);
    setError(null);
    try {
      const res = await fetch("/api/admin/prompts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: promptId, action: "set_active" }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? "Failed to set active prompt");
      }
      await fetchPrompts(selectedPhilosopher.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to activate prompt"
      );
    } finally {
      setActivating(null);
    }
  }

  async function handleDeletePrompt(promptId: number) {
    if (!selectedPhilosopher) return;
    setDeletingId(promptId);
    try {
      const res = await fetch("/api/admin/prompts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: promptId }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? "Failed to delete prompt");
      }

      setConfirmDeleteId(null);
      await fetchPrompts(selectedPhilosopher.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete prompt"
      );
    } finally {
      setDeletingId(null);
    }
  }

  function toggleExpanded(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function formatDate(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  }

  function truncateText(text: string, maxLen: number = 180): string {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen).trimEnd() + "\u2026";
  }

  const activePrompt = prompts.find((p) => p.is_active === 1) ?? null;

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-ink">
          System Prompts
        </h1>
        <p className="text-sm text-ink-lighter mt-1 font-body">
          Manage the system prompts that define each philosopher&apos;s voice
          and personality.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-existential/10 border border-existential/30 text-existential text-sm font-body">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-3 underline hover:no-underline"
          >
            dismiss
          </button>
        </div>
      )}

      <div className="flex gap-6 items-start">
        {/* Left panel: philosopher list */}
        <div className="w-56 shrink-0">
          <h2 className="font-serif text-sm font-semibold text-ink mb-3 px-1">
            Philosophers
          </h2>
          {loadingPhilosophers ? (
            <div className="px-3 py-8 text-center text-ink-lighter text-sm font-body">
              Loading...
            </div>
          ) : philosophers.length === 0 ? (
            <div className="px-3 py-8 text-center text-ink-lighter text-sm font-body">
              No philosophers found.
            </div>
          ) : (
            <ul className="space-y-1">
              {philosophers.map((p) => {
                const isSelected = selectedPhilosopher?.id === p.id;
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => handleSelectPhilosopher(p)}
                      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 ${
                        isSelected
                          ? "bg-parchment-dark border border-border text-ink"
                          : "text-ink-light hover:bg-parchment-dark/60 hover:text-ink border border-transparent"
                      }`}
                    >
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-mono font-bold text-white shrink-0"
                        style={{ backgroundColor: p.color }}
                      >
                        {p.initials}
                      </span>
                      <span className="font-body truncate">{p.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Right panel: prompts content */}
        <div className="flex-1 min-w-0">
          {!selectedPhilosopher ? (
            <div className="rounded-xl border border-border-light bg-parchment-dark/30 px-8 py-16 text-center">
              <p className="text-ink-lighter font-body text-sm">
                Select a philosopher from the list to manage their system
                prompts.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Philosopher header */}
              <div className="flex items-center gap-3">
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-mono font-bold text-white shrink-0"
                  style={{ backgroundColor: selectedPhilosopher.color }}
                >
                  {selectedPhilosopher.initials}
                </span>
                <div>
                  <h2 className="font-serif text-lg font-bold text-ink leading-tight">
                    {selectedPhilosopher.name}
                  </h2>
                  <p className="text-xs text-ink-lighter font-mono">
                    {selectedPhilosopher.tradition}
                  </p>
                </div>
              </div>

              {loadingPrompts ? (
                <div className="py-12 text-center text-ink-lighter text-sm font-body">
                  Loading prompts...
                </div>
              ) : (
                <>
                  {/* Active Prompt */}
                  <section>
                    <h3 className="font-serif text-sm font-semibold text-ink mb-3">
                      Active Prompt
                    </h3>
                    {activePrompt ? (
                      <div className="rounded-xl border-2 border-terracotta/40 bg-terracotta/5 p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-terracotta/15 text-terracotta text-xs font-mono font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-terracotta" />
                              v{activePrompt.prompt_version}
                            </span>
                            <span className="text-xs font-mono text-ink-lighter">
                              {formatDate(activePrompt.created_at)}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-terracotta">
                            Active
                          </span>
                        </div>
                        <p className="text-sm text-ink font-body leading-relaxed whitespace-pre-wrap">
                          {expandedIds.has(activePrompt.id)
                            ? activePrompt.system_prompt_text
                            : truncateText(
                                activePrompt.system_prompt_text,
                                300
                              )}
                        </p>
                        {activePrompt.system_prompt_text.length > 300 && (
                          <button
                            onClick={() => toggleExpanded(activePrompt.id)}
                            className="mt-2 text-xs text-terracotta hover:text-terracotta-light font-mono transition-colors"
                          >
                            {expandedIds.has(activePrompt.id)
                              ? "Show less"
                              : "Show more"}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-border-light bg-parchment-dark/30 px-5 py-6 text-center">
                        <p className="text-sm text-ink-lighter font-body">
                          No active prompt. Create one below or activate an
                          existing version.
                        </p>
                      </div>
                    )}
                  </section>

                  {/* Create New Version */}
                  <section>
                    <h3 className="font-serif text-sm font-semibold text-ink mb-3">
                      Create New Version
                    </h3>
                    <div className="rounded-xl border border-border bg-white/40 p-5">
                      <textarea
                        value={newPromptText}
                        onChange={(e) => setNewPromptText(e.target.value)}
                        placeholder={`Enter the system prompt for ${selectedPhilosopher.name}...\n\nThis defines the philosopher's voice, personality, style, and constraints when generating content.`}
                        rows={10}
                        className="w-full resize-y rounded-lg border border-border bg-parchment px-4 py-3 text-sm text-ink font-body leading-relaxed placeholder:text-ink-lighter/60 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta/50 transition-shadow"
                      />
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-[11px] text-ink-lighter font-mono">
                          {newPromptText.length > 0
                            ? `${newPromptText.length.toLocaleString()} characters`
                            : "Paste or write the full system prompt"}
                        </p>
                        <button
                          onClick={handleCreatePrompt}
                          disabled={saving || !newPromptText.trim()}
                          className="px-5 py-2 rounded-lg bg-terracotta text-white text-sm font-body font-medium hover:bg-terracotta-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
                        >
                          {saving ? "Saving..." : "Save New Version"}
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* Version History */}
                  <section>
                    <h3 className="font-serif text-sm font-semibold text-ink mb-3">
                      Version History
                      {prompts.length > 0 && (
                        <span className="ml-2 text-xs font-mono text-ink-lighter font-normal">
                          ({prompts.length}{" "}
                          {prompts.length === 1 ? "version" : "versions"})
                        </span>
                      )}
                    </h3>
                    {prompts.length === 0 ? (
                      <div className="rounded-xl border border-border-light bg-parchment-dark/30 px-5 py-8 text-center">
                        <p className="text-sm text-ink-lighter font-body">
                          No prompts yet. Create the first version above.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {prompts.map((prompt) => {
                          const isActive = prompt.is_active === 1;
                          const isExpanded = expandedIds.has(prompt.id);

                          return (
                            <div
                              key={prompt.id}
                              className={`rounded-xl border p-4 transition-colors ${
                                isActive
                                  ? "border-terracotta/30 bg-terracotta/[0.03]"
                                  : "border-border bg-white/30 hover:bg-white/50"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-semibold ${
                                      isActive
                                        ? "bg-terracotta/15 text-terracotta"
                                        : "bg-parchment-dark text-ink-light"
                                    }`}
                                  >
                                    {isActive && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-terracotta" />
                                    )}
                                    v{prompt.prompt_version}
                                  </span>
                                  <span className="text-xs font-mono text-ink-lighter">
                                    {formatDate(prompt.created_at)}
                                  </span>
                                  {isActive && (
                                    <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-terracotta">
                                      Active
                                    </span>
                                  )}
                                </div>
                                {!isActive && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleSetActive(prompt.id)}
                                      disabled={activating === prompt.id}
                                      className="px-3 py-1 rounded-md border border-border text-xs font-body text-ink-light hover:border-terracotta/50 hover:text-terracotta disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
                                    >
                                      {activating === prompt.id
                                        ? "Activating..."
                                        : "Make Active"}
                                    </button>
                                    {confirmDeleteId === prompt.id ? (
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          onClick={() => handleDeletePrompt(prompt.id)}
                                          disabled={deletingId === prompt.id}
                                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono tracking-wide rounded-full text-white bg-red-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700"
                                        >
                                          {deletingId === prompt.id ? (
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
                                        onClick={() => setConfirmDeleteId(prompt.id)}
                                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono tracking-wide rounded-full text-ink-lighter border border-border-light transition-all duration-200 hover:text-red-600 hover:border-red-300 hover:bg-red-50"
                                        title="Delete this prompt version"
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
                                )}
                              </div>
                              <p className="text-sm text-ink font-body leading-relaxed whitespace-pre-wrap">
                                {isExpanded
                                  ? prompt.system_prompt_text
                                  : truncateText(prompt.system_prompt_text)}
                              </p>
                              {prompt.system_prompt_text.length > 180 && (
                                <button
                                  onClick={() => toggleExpanded(prompt.id)}
                                  className="mt-2 text-xs text-terracotta hover:text-terracotta-light font-mono transition-colors"
                                >
                                  {isExpanded ? "Show less" : "Show more"}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
