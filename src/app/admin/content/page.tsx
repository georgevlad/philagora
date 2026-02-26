"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// ── Types ───────────────────────────────────────────────────────────────

interface Philosopher {
  id: string;
  name: string;
  tradition: string;
  color: string;
  initials: string;
}

interface GenerationLogEntry {
  id: number;
  philosopher_id: string;
  content_type: string;
  user_input: string;
  raw_output: string;
  status: string;
  created_at: string;
}

interface ActivePrompt {
  id: number;
  prompt_version: number;
  system_prompt_text: string;
  is_active: number;
}

interface GeneratedData {
  content?: string;
  thesis?: string;
  stance?: string;
  tag?: string;
  posts?: string[];
}

interface GenerationPreview {
  data: GeneratedData;
  logEntryId: number;
  rawOutput: string;
}

// ── Content type options ────────────────────────────────────────────────

const CONTENT_TYPE_OPTIONS = [
  { label: "News Reaction", value: "post", description: "React to a current news article" },
  { label: "Timeless Reflection", value: "reflection", description: "A timeless philosophical reflection" },
  { label: "Cross-Philosopher Reply", value: "post", description: "Reply to another philosopher's post" },
  { label: "Debate Opening", value: "debate_opening", description: "Opening statement for a debate" },
  { label: "Debate Rebuttal", value: "debate_rebuttal", description: "Rebuttal in an ongoing debate" },
  { label: "Agora Response", value: "agora_response", description: "Respond to a user's question" },
] as const;

// ── Badge styles ────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  generated: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  published: "bg-terracotta/10 text-terracotta",
  error: "bg-red-100 text-red-800",
};

const STANCE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  challenges: { bg: "#FED7D7", text: "#9B2C2C", border: "#FEB2B2" },
  defends: { bg: "#C6F6D5", text: "#276749", border: "#9AE6B4" },
  reframes: { bg: "#FEFCBF", text: "#744210", border: "#FAF089" },
  questions: { bg: "#BEE3F8", text: "#2A4365", border: "#90CDF4" },
  warns: { bg: "#FEEBC8", text: "#9C4221", border: "#FBD38D" },
  observes: { bg: "#E2E8F0", text: "#4A5568", border: "#CBD5E0" },
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  post: "Post",
  reflection: "Reflection",
  debate_opening: "Debate Opening",
  debate_rebuttal: "Debate Rebuttal",
  agora_response: "Agora Response",
};

// ── Helpers ─────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    const d = new Date(iso.includes("Z") ? iso : iso + "Z");
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ── Component ───────────────────────────────────────────────────────────

function ContentGenerationPageInner() {
  const searchParams = useSearchParams();

  // ── Form state ──────────────────────────────────────────────────────
  const [philosophers, setPhilosophers] = useState<Philosopher[]>([]);
  const [selectedPhilosopherId, setSelectedPhilosopherId] = useState("");
  const [selectedContentTypeIndex, setSelectedContentTypeIndex] = useState(0);
  const [userInput, setUserInput] = useState("");

  // ── Citation fields (News Reaction only) ──────────────────────────
  const [citationTitle, setCitationTitle] = useState("");
  const [citationSource, setCitationSource] = useState("");
  const [citationUrl, setCitationUrl] = useState("");
  const [citationImageUrl, setCitationImageUrl] = useState("");

  // ── Active prompt state ─────────────────────────────────────────────
  const [activePrompt, setActivePrompt] = useState<ActivePrompt | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);

  // ── Generation log state ────────────────────────────────────────────
  const [logEntries, setLogEntries] = useState<GenerationLogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  // ── Submission state ────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // ── Preview state (generated content) ───────────────────────────────
  const [preview, setPreview] = useState<GenerationPreview | null>(null);
  const [showRawOutput, setShowRawOutput] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  // ── Fetch philosophers on mount ─────────────────────────────────────
  useEffect(() => {
    async function fetchPhilosophers() {
      try {
        const res = await fetch("/api/admin/philosophers");
        if (!res.ok) throw new Error("Failed to fetch philosophers");
        const data = await res.json();
        setPhilosophers(data);
      } catch {
        console.error("Could not load philosophers");
      }
    }
    fetchPhilosophers();
  }, []);

  // ── Pre-fill from News Scout query params ─────────────────────────
  useEffect(() => {
    const articleTitle = searchParams.get("article_title");
    if (!articleTitle) return;

    setCitationTitle(articleTitle);
    setCitationSource(searchParams.get("article_source") || "");
    setCitationUrl(searchParams.get("article_url") || "");
    setCitationImageUrl(searchParams.get("article_image_url") || "");

    const description = searchParams.get("article_description") || "";
    const source = searchParams.get("article_source") || "";
    setUserInput(`${articleTitle} — ${source}\n\n${description}`);

    // Ensure content type is "News Reaction" (index 0)
    setSelectedContentTypeIndex(0);

    // Auto-select the first suggested philosopher
    const suggestedRaw = searchParams.get("suggested_philosophers");
    if (suggestedRaw && philosophers.length > 0) {
      try {
        const suggested: string[] = JSON.parse(suggestedRaw);
        if (suggested.length > 0) {
          const firstMatch = philosophers.find((p) => p.id === suggested[0]);
          if (firstMatch) setSelectedPhilosopherId(firstMatch.id);
        }
      } catch {
        // ignore malformed JSON
      }
    }
  }, [searchParams, philosophers]);

  // ── Fetch active prompt when philosopher changes ────────────────────
  const fetchActivePrompt = useCallback(async (philosopherId: string) => {
    if (!philosopherId) {
      setActivePrompt(null);
      return;
    }
    setPromptLoading(true);
    try {
      const res = await fetch(
        `/api/admin/prompts?philosopher_id=${encodeURIComponent(philosopherId)}`
      );
      if (!res.ok) throw new Error("Failed to fetch prompt");
      const data = await res.json();
      if (Array.isArray(data)) {
        const active = data.find(
          (p: { is_active: number }) => p.is_active === 1
        );
        setActivePrompt(active ?? null);
      } else if (data && data.system_prompt_text) {
        setActivePrompt(data);
      } else {
        setActivePrompt(null);
      }
    } catch {
      setActivePrompt(null);
    } finally {
      setPromptLoading(false);
    }
  }, []);

  // ── Fetch generation log for selected philosopher ───────────────────
  const fetchLogEntries = useCallback(async (philosopherId: string) => {
    if (!philosopherId) {
      setLogEntries([]);
      return;
    }
    setLogLoading(true);
    try {
      const res = await fetch(
        `/api/admin/content?philosopher_id=${encodeURIComponent(philosopherId)}`
      );
      if (!res.ok) throw new Error("Failed to fetch generation log");
      const data = await res.json();
      setLogEntries(Array.isArray(data) ? data : []);
    } catch {
      setLogEntries([]);
    } finally {
      setLogLoading(false);
    }
  }, []);

  // ── React to philosopher selection changes ──────────────────────────
  useEffect(() => {
    fetchActivePrompt(selectedPhilosopherId);
    fetchLogEntries(selectedPhilosopherId);
    setPreview(null);
    setErrorMessage("");
    setSuccessMessage("");
  }, [selectedPhilosopherId, fetchActivePrompt, fetchLogEntries]);

  // ── Clear citation fields when content type changes ───────────────
  useEffect(() => {
    setCitationTitle("");
    setCitationSource("");
    setCitationUrl("");
  }, [selectedContentTypeIndex]);

  // ── Auto-detect URL in source material ────────────────────────────
  const isNewsReaction = selectedContentTypeIndex === 0;
  useEffect(() => {
    if (!isNewsReaction) return;
    const trimmed = userInput.trim();
    if (trimmed.startsWith("http")) {
      const firstLine = trimmed.split("\n")[0].trim();
      if (firstLine.startsWith("http") && !citationUrl) {
        setCitationUrl(firstLine);
      }
    }
  }, [userInput, isNewsReaction, citationUrl]);

  // ── Handle generation ───────────────────────────────────────────────
  async function handleGenerate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setSuccessMessage("");
    setErrorMessage("");
    setPreview(null);
    setShowRawOutput(false);

    if (!selectedPhilosopherId) {
      setErrorMessage("Please select a philosopher.");
      return;
    }
    if (!userInput.trim()) {
      setErrorMessage("Please provide source material or a question.");
      return;
    }

    setSubmitting(true);
    try {
      const opt = CONTENT_TYPE_OPTIONS[selectedContentTypeIndex];
      const res = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          philosopher_id: selectedPhilosopherId,
          content_type: opt.value,
          content_label: opt.label,
          user_input: userInput.trim(),
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        // Check for raw_output in the error response (parse failure)
        if (result.raw_output) {
          setErrorMessage(result.error || "Generation failed");
          setPreview({
            data: {},
            logEntryId: result.log_entry?.id ?? 0,
            rawOutput: result.raw_output,
          });
          setShowRawOutput(true);
        } else {
          setErrorMessage(result.error || "Generation failed");
        }
        fetchLogEntries(selectedPhilosopherId);
        return;
      }

      // Success — show the preview card
      setPreview({
        data: result.generated,
        logEntryId: result.log_entry?.id ?? 0,
        rawOutput: result.raw_output ?? JSON.stringify(result.generated, null, 2),
      });
      fetchLogEntries(selectedPhilosopherId);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ── Approve & save as post ──────────────────────────────────────────
  async function handleApprove() {
    if (!preview || !selectedPhilosopherId) return;
    setApproving(true);
    setErrorMessage("");

    try {
      const data = preview.data;

      // Create the post (include citation data for news reactions)
      const postRes = await fetch("/api/admin/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          philosopher_id: selectedPhilosopherId,
          content: data.content ?? data.posts?.join("\n\n") ?? "",
          thesis: data.thesis ?? "",
          stance: data.stance ?? "observes",
          tag: data.tag ?? "",
          citation_title: citationTitle || undefined,
          citation_source: citationSource || undefined,
          citation_url: citationUrl || undefined,
          citation_image_url: citationImageUrl || undefined,
        }),
      });

      if (!postRes.ok) {
        const err = await postRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to create post");
      }

      // Update the generation log entry to "approved"
      await fetch("/api/admin/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: preview.logEntryId, status: "approved" }),
      });

      setSuccessMessage("Post created as draft! View it in the Posts section.");
      setPreview(null);
      setCitationTitle("");
      setCitationSource("");
      setCitationUrl("");
      fetchLogEntries(selectedPhilosopherId);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to approve"
      );
    } finally {
      setApproving(false);
    }
  }

  // ── Reject & discard ────────────────────────────────────────────────
  async function handleReject() {
    if (!preview) return;
    setRejecting(true);

    try {
      await fetch("/api/admin/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: preview.logEntryId, status: "rejected" }),
      });

      setPreview(null);
      fetchLogEntries(selectedPhilosopherId);
    } catch {
      // Silently clear preview even on failure
      setPreview(null);
    } finally {
      setRejecting(false);
    }
  }

  // ── Selected philosopher for display ────────────────────────────────
  const selectedPhilosopher = philosophers.find(
    (p) => p.id === selectedPhilosopherId
  );

  // ── Is this an agora content type? ──────────────────────────────────
  const isAgoraType =
    CONTENT_TYPE_OPTIONS[selectedContentTypeIndex].value === "agora_response";

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-ink">
          Generate Content
        </h1>
        <p className="text-sm text-ink-lighter mt-1">
          Create AI-generated philosophical content. Select a philosopher,
          choose a content type, and provide source material.
        </p>
      </div>

      {/* ── Generation Form ─────────────────────────────────────────── */}
      <form onSubmit={handleGenerate}>
        <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-border bg-parchment-dark/20">
            <h2 className="font-serif text-lg font-bold text-ink">
              New Generation
            </h2>
          </div>

          <div className="px-6 py-6 space-y-6">
            {/* Row: Philosopher + Content Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Philosopher picker */}
              <div>
                <label
                  htmlFor="philosopher"
                  className="block text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2"
                >
                  Philosopher
                </label>
                <select
                  id="philosopher"
                  value={selectedPhilosopherId}
                  onChange={(e) => setSelectedPhilosopherId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm text-ink font-body focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta transition-colors"
                >
                  <option value="">Select a philosopher...</option>
                  {philosophers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.tradition}
                    </option>
                  ))}
                </select>
              </div>

              {/* Content type picker */}
              <div>
                <label
                  htmlFor="content-type"
                  className="block text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2"
                >
                  Content Type
                </label>
                <select
                  id="content-type"
                  value={selectedContentTypeIndex}
                  onChange={(e) =>
                    setSelectedContentTypeIndex(Number(e.target.value))
                  }
                  className="w-full rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm text-ink font-body focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta transition-colors"
                >
                  {CONTENT_TYPE_OPTIONS.map((opt, idx) => (
                    <option key={idx} value={idx}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-ink-lighter mt-1.5">
                  {CONTENT_TYPE_OPTIONS[selectedContentTypeIndex].description}{" "}
                  <span className="font-mono text-terracotta">
                    ({CONTENT_TYPE_OPTIONS[selectedContentTypeIndex].value})
                  </span>
                </p>
              </div>
            </div>

            {/* Source / User Input */}
            <div>
              <label
                htmlFor="user-input"
                className="block text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2"
              >
                Source Material / Question
              </label>
              <textarea
                id="user-input"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                rows={5}
                placeholder="Paste an article URL, title, key quotes, or a user question for the Agora..."
                className="w-full rounded-lg border border-border bg-parchment px-4 py-3 text-sm text-ink font-body placeholder:text-ink-lighter/60 focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta transition-colors resize-y"
              />
            </div>

            {/* Citation fields (News Reaction only) */}
            {isNewsReaction && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="citation-title"
                    className="block text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2"
                  >
                    Article Title
                  </label>
                  <input
                    id="citation-title"
                    type="text"
                    value={citationTitle}
                    onChange={(e) => setCitationTitle(e.target.value)}
                    placeholder="e.g. Trump makes case for Iran diplomacy"
                    className="w-full rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm text-ink font-body placeholder:text-ink-lighter/60 focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta transition-colors"
                  />
                </div>
                <div>
                  <label
                    htmlFor="citation-source"
                    className="block text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2"
                  >
                    Source Name
                  </label>
                  <input
                    id="citation-source"
                    type="text"
                    value={citationSource}
                    onChange={(e) => setCitationSource(e.target.value)}
                    placeholder="e.g. Reuters"
                    className="w-full rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm text-ink font-body placeholder:text-ink-lighter/60 focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta transition-colors"
                  />
                </div>
                <div>
                  <label
                    htmlFor="citation-url"
                    className="block text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2"
                  >
                    Article URL
                  </label>
                  <input
                    id="citation-url"
                    type="url"
                    value={citationUrl}
                    onChange={(e) => setCitationUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm text-ink font-body placeholder:text-ink-lighter/60 focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Active System Prompt Preview */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2">
                Active System Prompt
                {selectedPhilosopher && (
                  <span className="text-ink-light ml-1 normal-case tracking-normal">
                    for {selectedPhilosopher.name}
                  </span>
                )}
              </label>
              <div className="w-full rounded-lg border border-border bg-parchment-dark/40 px-4 py-3 text-sm font-mono text-ink-light min-h-[80px] max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                {!selectedPhilosopherId ? (
                  <span className="text-ink-lighter italic">
                    Select a philosopher to see their active system prompt.
                  </span>
                ) : promptLoading ? (
                  <span className="text-ink-lighter italic">
                    Loading prompt...
                  </span>
                ) : activePrompt ? (
                  <>
                    <span className="text-xs text-terracotta block mb-1">
                      v{activePrompt.prompt_version} (ID: {activePrompt.id})
                    </span>
                    {activePrompt.system_prompt_text}
                  </>
                ) : (
                  <span className="text-ink-lighter italic">
                    No active prompt for this philosopher.{" "}
                    <Link
                      href="/admin/prompts"
                      className="text-terracotta hover:underline"
                    >
                      Set up a system prompt first &rarr;
                    </Link>
                  </span>
                )}
              </div>
            </div>

            {/* Error / Success messages */}
            {errorMessage && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                {successMessage}{" "}
                <Link
                  href="/admin/posts"
                  className="underline font-medium hover:text-green-900"
                >
                  Go to Posts &rarr;
                </Link>
              </div>
            )}
          </div>

          {/* Form footer with generate button */}
          <div className="px-6 py-4 border-t border-border bg-parchment-dark/20 flex items-center justify-between">
            <p className="text-xs text-ink-lighter">
              Generates content via Claude API and saves to the generation log.
            </p>
            <button
              type="submit"
              disabled={
                submitting || !selectedPhilosopherId || !activePrompt
              }
              className="inline-flex items-center gap-2 bg-terracotta hover:bg-terracotta-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-body font-medium text-sm px-6 py-2.5 rounded-full shadow-sm hover:shadow transition-all duration-150"
            >
              {submitting ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                    />
                  </svg>
                  Generate Content
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* ── Preview Card ──────────────────────────────────────────── */}
      {preview && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg font-bold text-ink">
              Generated Preview
            </h2>
            <button
              type="button"
              onClick={() => handleGenerate()}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 text-sm font-mono text-terracotta hover:text-terracotta-light transition-colors disabled:opacity-50"
            >
              <svg
                className={`h-3.5 w-3.5 ${submitting ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
                />
              </svg>
              Re-generate
            </button>
          </div>

          <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
            {/* Post-style preview card */}
            <div className="px-6 py-5">
              {/* Philosopher header */}
              {selectedPhilosopher && (
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-serif font-bold shrink-0"
                    style={{
                      backgroundColor: selectedPhilosopher.color,
                    }}
                  >
                    {selectedPhilosopher.initials}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-bold text-ink">
                        {selectedPhilosopher.name}
                      </span>
                      <span
                        className="text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: `${selectedPhilosopher.color}15`,
                          color: selectedPhilosopher.color,
                        }}
                      >
                        {selectedPhilosopher.tradition}
                      </span>
                    </div>
                    <span className="text-xs text-ink-lighter">
                      Just generated &middot; Draft
                    </span>
                  </div>
                </div>
              )}

              {/* Thesis */}
              {preview.data.thesis && (
                <blockquote
                  className="font-serif text-[17px] leading-snug text-ink mb-3 pl-3"
                  style={{
                    borderLeft: `3px solid ${selectedPhilosopher?.color ?? "#C05A2C"}`,
                    fontWeight: 600,
                  }}
                >
                  {preview.data.thesis}
                </blockquote>
              )}

              {/* Content body */}
              {preview.data.content && (
                <div
                  className="text-[15px] text-ink mb-4 whitespace-pre-line leading-relaxed"
                  style={{
                    borderLeft: `2px solid ${selectedPhilosopher?.color ?? "#C05A2C"}25`,
                    paddingLeft: "12px",
                  }}
                >
                  {preview.data.content}
                </div>
              )}

              {/* Agora posts (array) */}
              {isAgoraType && preview.data.posts && (
                <div className="space-y-3 mb-4">
                  {preview.data.posts.map((post, i) => (
                    <div
                      key={i}
                      className="text-[15px] text-ink whitespace-pre-line leading-relaxed pl-3"
                      style={{
                        borderLeft: `2px solid ${selectedPhilosopher?.color ?? "#C05A2C"}25`,
                      }}
                    >
                      <span className="text-[10px] font-mono text-ink-lighter block mb-1">
                        Response {i + 1}
                      </span>
                      {post}
                    </div>
                  ))}
                </div>
              )}

              {/* Stance + Tag badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {preview.data.stance && (
                  <span
                    className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono tracking-wider uppercase rounded-full"
                    style={{
                      backgroundColor:
                        STANCE_STYLES[preview.data.stance]?.bg ?? "#E2E8F0",
                      color:
                        STANCE_STYLES[preview.data.stance]?.text ?? "#4A5568",
                      border: `1px solid ${STANCE_STYLES[preview.data.stance]?.border ?? "#CBD5E0"}`,
                    }}
                  >
                    {preview.data.stance}
                  </span>
                )}
                {preview.data.tag && (
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-mono tracking-wide rounded"
                    style={{
                      backgroundColor: `${selectedPhilosopher?.color ?? "#C05A2C"}10`,
                      color: selectedPhilosopher?.color ?? "#C05A2C",
                      border: `1px solid ${selectedPhilosopher?.color ?? "#C05A2C"}25`,
                    }}
                  >
                    {preview.data.tag}
                  </span>
                )}
              </div>
            </div>

            {/* Raw output toggle */}
            <div className="px-6 pb-2">
              <button
                type="button"
                onClick={() => setShowRawOutput(!showRawOutput)}
                className="text-xs font-mono text-ink-lighter hover:text-ink-light transition-colors"
              >
                {showRawOutput ? "▼ Hide" : "▶ Show"} raw output
              </button>
              {showRawOutput && (
                <pre className="mt-2 p-3 bg-parchment-dark/40 rounded-lg text-xs font-mono text-ink-light overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {preview.rawOutput}
                </pre>
              )}
            </div>

            {/* Action buttons */}
            <div className="px-6 py-4 border-t border-border bg-parchment-dark/20 flex items-center justify-between">
              <button
                type="button"
                onClick={handleReject}
                disabled={rejecting}
                className="inline-flex items-center gap-1.5 text-sm font-body text-ink-lighter hover:text-red-700 transition-colors disabled:opacity-50"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                {rejecting ? "Discarding..." : "Reject & Discard"}
              </button>

              <button
                type="button"
                onClick={handleApprove}
                disabled={
                  approving || (!preview.data.content && !preview.data.posts)
                }
                className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-body font-medium text-sm px-5 py-2 rounded-lg shadow-sm transition-colors"
              >
                {approving ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                    Approve &amp; Save as Post
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Generation Log ──────────────────────────────────────────── */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg font-bold text-ink">
            Generation Log
            {selectedPhilosopher && (
              <span className="text-ink-lighter font-normal text-base ml-2">
                — {selectedPhilosopher.name}
              </span>
            )}
          </h2>
          {selectedPhilosopherId && (
            <button
              type="button"
              onClick={() => fetchLogEntries(selectedPhilosopherId)}
              className="text-xs font-mono text-terracotta hover:text-terracotta-light transition-colors"
            >
              Refresh
            </button>
          )}
        </div>

        {!selectedPhilosopherId ? (
          <div className="bg-white border border-border rounded-xl px-6 py-10 text-center">
            <p className="text-ink-lighter text-sm">
              Select a philosopher above to view their generation log.
            </p>
          </div>
        ) : logLoading ? (
          <div className="bg-white border border-border rounded-xl px-6 py-10 text-center">
            <p className="text-ink-lighter text-sm">Loading log entries...</p>
          </div>
        ) : logEntries.length === 0 ? (
          <div className="bg-white border border-border rounded-xl px-6 py-10 text-center">
            <p className="text-ink-lighter text-sm">
              No generation log entries yet for this philosopher.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-parchment-dark/30">
                  <th className="text-left px-5 py-3 font-mono text-xs uppercase tracking-wider text-ink-lighter">
                    Type
                  </th>
                  <th className="text-left px-5 py-3 font-mono text-xs uppercase tracking-wider text-ink-lighter">
                    Input Preview
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
                {logEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-border-light last:border-b-0 hover:bg-parchment-dark/20 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-parchment-dark text-ink-light">
                        {CONTENT_TYPE_LABELS[entry.content_type] ??
                          entry.content_type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink-light font-body max-w-xs">
                      <span
                        className="block truncate"
                        title={entry.user_input}
                      >
                        {entry.user_input && entry.user_input.length > 100
                          ? entry.user_input.slice(0, 100) + "..."
                          : entry.user_input || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          STATUS_STYLES[entry.status] ??
                          "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink-lighter text-xs font-mono whitespace-nowrap">
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

export default function ContentGenerationPage() {
  return (
    <Suspense>
      <ContentGenerationPageInner />
    </Suspense>
  );
}
