"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type TemplateKey =
  | "news_reaction"
  | "quip"
  | "timeless_reflection"
  | "cross_philosopher_reply"
  | "historical_reaction"
  | "debate_opening"
  | "debate_rebuttal"
  | "agora_response"
  | "debate_synthesis"
  | "agora_synthesis";

type SelectedSection = TemplateKey | "house_rules";

interface ContentTemplateVersion {
  id: number;
  template_key: TemplateKey;
  version: number;
  instructions: string;
  is_active: number;
  created_at: string;
  notes: string;
}

interface HouseRulesVersion {
  id: number;
  version: number;
  rules_text: string;
  is_active: number;
  created_at: string;
  notes: string;
}

interface TemplateDetailResponse {
  template_key: TemplateKey;
  label: string;
  active_template: ContentTemplateVersion | null;
  versions: ContentTemplateVersion[];
  code_default?: string;
}

interface HouseRulesResponse {
  active_rules: HouseRulesVersion | null;
  versions: HouseRulesVersion[];
}

const TEMPLATE_ITEMS: Array<{ key: TemplateKey; label: string }> = [
  { key: "news_reaction", label: "News Reaction" },
  { key: "quip", label: "Quip" },
  { key: "timeless_reflection", label: "Timeless Reflection" },
  { key: "cross_philosopher_reply", label: "Cross-Philosopher Reply" },
  { key: "historical_reaction", label: "Historical Reaction" },
  { key: "debate_opening", label: "Debate Opening" },
  { key: "debate_rebuttal", label: "Debate Rebuttal" },
  { key: "agora_response", label: "Agora Response" },
  { key: "debate_synthesis", label: "Debate Synthesis" },
  { key: "agora_synthesis", label: "Agora Synthesis" },
];

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
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

function truncateText(text: string, maxLen: number = 360): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "...";
}

export default function TemplatesPage() {
  const [selectedSection, setSelectedSection] =
    useState<SelectedSection>("news_reaction");
  const [templateDetail, setTemplateDetail] =
    useState<TemplateDetailResponse | null>(null);
  const [houseRulesDetail, setHouseRulesDetail] =
    useState<HouseRulesResponse | null>(null);
  const [editorText, setEditorText] = useState("");
  const [notes, setNotes] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isHouseRules = selectedSection === "house_rules";

  const loadTemplateDetail = useCallback(async (key: TemplateKey) => {
    const res = await fetch(
      `/api/admin/content-templates?key=${encodeURIComponent(
        key
      )}&include_default=true`
    );
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error ?? "Failed to fetch template");
    }

    const data = (await res.json()) as TemplateDetailResponse;
    setTemplateDetail(data);
    setEditorText(data.active_template?.instructions ?? data.code_default ?? "");
    setNotes("");
  }, []);

  const loadHouseRules = useCallback(async () => {
    const res = await fetch("/api/admin/house-rules");
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error ?? "Failed to fetch house rules");
    }

    const data = (await res.json()) as HouseRulesResponse;
    setHouseRulesDetail(data);
    setEditorText(data.active_rules?.rules_text ?? "");
    setNotes("");
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const promise = isHouseRules
      ? loadHouseRules()
      : loadTemplateDetail(selectedSection as TemplateKey);

    promise
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load data")
      )
      .finally(() => setLoading(false));
  }, [isHouseRules, loadHouseRules, loadTemplateDetail, selectedSection]);

  const activeTemplateText = useMemo(() => {
    if (isHouseRules) {
      return houseRulesDetail?.active_rules?.rules_text ?? "";
    }

    return (
      templateDetail?.active_template?.instructions ??
      templateDetail?.code_default ??
      ""
    );
  }, [houseRulesDetail, isHouseRules, templateDetail]);

  const activeVersionId = isHouseRules
    ? houseRulesDetail?.active_rules?.id ?? null
    : templateDetail?.active_template?.id ?? null;

  const activeBadgeLabel = isHouseRules
    ? houseRulesDetail?.active_rules
      ? `v${houseRulesDetail.active_rules.version}`
      : "Inactive"
    : templateDetail?.active_template
    ? `v${templateDetail.active_template.version} (DB)`
    : "Code Default";

  const versions = isHouseRules
    ? houseRulesDetail?.versions ?? []
    : templateDetail?.versions ?? [];

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function refreshCurrentSection() {
    if (isHouseRules) {
      await loadHouseRules();
    } else {
      await loadTemplateDetail(selectedSection as TemplateKey);
    }
  }

  async function handleSaveVersion() {
    if (!editorText.trim()) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(
        isHouseRules ? "/api/admin/house-rules" : "/api/admin/content-templates",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isHouseRules
              ? { rules_text: editorText.trim(), notes: notes.trim() }
              : {
                  template_key: selectedSection,
                  instructions: editorText.trim(),
                  notes: notes.trim(),
                }
          ),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? "Failed to save version");
      }

      setSuccess("New version saved.");
      await refreshCurrentSection();
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save version");
    } finally {
      setSaving(false);
    }
  }

  async function handleActivateVersion(id: number) {
    setActivatingId(id);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(
        isHouseRules ? "/api/admin/house-rules" : "/api/admin/content-templates",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action: "set_active" }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? "Failed to activate version");
      }

      setSuccess("Active version updated.");
      await refreshCurrentSection();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate version");
    } finally {
      setActivatingId(null);
    }
  }

  async function handleDeactivateActive(id: number) {
    const confirmed = window.confirm(
      isHouseRules
        ? "This will turn house rules off entirely. Continue?"
        : "This will revert this template to the code default. Continue?"
    );
    if (!confirmed) return;

    setDeactivatingId(id);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(
        isHouseRules ? "/api/admin/house-rules" : "/api/admin/content-templates",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action: "deactivate" }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? "Failed to deactivate version");
      }

      setSuccess(
        isHouseRules
          ? "House rules deactivated."
          : "Template deactivated. Code default will be used."
      );
      await refreshCurrentSection();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to deactivate version"
      );
    } finally {
      setDeactivatingId(null);
    }
  }

  async function handleDeleteVersion(id: number) {
    setDeletingId(id);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(
        isHouseRules ? "/api/admin/house-rules" : "/api/admin/content-templates",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? "Failed to delete version");
      }

      setConfirmDeleteId(null);
      setSuccess("Version deleted.");
      await refreshCurrentSection();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete version");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-ink">Templates</h1>
        <p className="mt-1 font-body text-sm text-ink-lighter">
          Manage admin-editable content templates and global house rules for
          generation.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-existential/30 bg-existential/10 px-4 py-3 text-sm font-body text-existential">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-3 underline hover:no-underline"
          >
            dismiss
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-lg border border-stoic/30 bg-stoic/10 px-4 py-3 text-sm font-body text-stoic">
          {success}
          <button
            onClick={() => setSuccess(null)}
            className="ml-3 underline hover:no-underline"
          >
            dismiss
          </button>
        </div>
      )}

      <div className="flex items-start gap-6">
        <div className="w-64 shrink-0">
          <h2 className="mb-3 px-1 font-serif text-sm font-semibold text-ink">
            Template Types
          </h2>
          <ul className="space-y-1">
            {TEMPLATE_ITEMS.map((item) => {
              const selected = selectedSection === item.key;
              return (
                <li key={item.key}>
                  <button
                    onClick={() => setSelectedSection(item.key)}
                    className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors duration-150 ${
                      selected
                        ? "border-border bg-parchment-dark text-ink"
                        : "border-transparent text-ink-light hover:bg-parchment-dark/60 hover:text-ink"
                    }`}
                  >
                    <span className="font-body">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="my-4 border-t border-border-light" />

          <button
            onClick={() => setSelectedSection("house_rules")}
            className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors duration-150 ${
              selectedSection === "house_rules"
                ? "border-border bg-parchment-dark text-ink"
                : "border-transparent text-ink-light hover:bg-parchment-dark/60 hover:text-ink"
            }`}
          >
            <span className="font-body">House Rules</span>
          </button>
        </div>

        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="rounded-xl border border-border-light bg-parchment-dark/30 px-8 py-16 text-center">
              <p className="text-sm font-body text-ink-lighter">Loading...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="font-serif text-lg font-bold text-ink">
                  {isHouseRules
                    ? "House Rules"
                    : templateDetail?.label ?? "Template"}
                </h2>
                <p className="mt-1 font-mono text-xs text-ink-lighter">
                  {isHouseRules
                    ? "Global generation constraints applied across philosopher personas."
                    : "Template instructions are layered onto the active system prompt at generation time."}
                </p>
              </div>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-serif text-sm font-semibold text-ink">
                    Active {isHouseRules ? "Rules" : "Template"}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-mono font-semibold ${
                        isHouseRules
                          ? houseRulesDetail?.active_rules
                            ? "bg-terracotta/15 text-terracotta"
                            : "bg-parchment-dark text-ink-light"
                          : templateDetail?.active_template
                          ? "bg-terracotta/15 text-terracotta"
                          : "bg-parchment-dark text-ink-light"
                      }`}
                    >
                      {activeBadgeLabel}
                    </span>
                    {activeVersionId && (
                      <button
                        onClick={() => handleDeactivateActive(activeVersionId)}
                        disabled={deactivatingId === activeVersionId}
                        className="rounded-md border border-border px-3 py-1 text-xs font-body text-ink-light transition-colors hover:border-terracotta/50 hover:text-terracotta disabled:opacity-40"
                      >
                        {deactivatingId === activeVersionId
                          ? "Working..."
                          : "Deactivate"}
                      </button>
                    )}
                  </div>
                </div>

                {isHouseRules && !houseRulesDetail?.active_rules ? (
                  <div className="rounded-xl border border-border-light bg-parchment-dark/30 px-5 py-6">
                    <p className="text-sm font-body text-ink-lighter">
                      No house rules active. Content will be generated without
                      global constraints.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-white/40 p-5">
                    <pre className="whitespace-pre-wrap text-sm font-body leading-relaxed text-ink">
                      {expandedIds.has("active")
                        ? activeTemplateText
                        : truncateText(activeTemplateText)}
                    </pre>
                    {activeTemplateText.length > 360 && (
                      <button
                        onClick={() => toggleExpanded("active")}
                        className="mt-2 text-xs font-mono text-terracotta transition-colors hover:text-terracotta-light"
                      >
                        {expandedIds.has("active") ? "Show less" : "Show more"}
                      </button>
                    )}
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-3 font-serif text-sm font-semibold text-ink">
                  Create New Version
                </h3>
                <div className="rounded-xl border border-border bg-white/40 p-5">
                  {!isHouseRules && (
                    <p className="mb-3 text-[11px] font-mono text-ink-lighter">
                      Use {"{LENGTH_GUIDANCE}"} where you want the length
                      constraint inserted.
                    </p>
                  )}
                  <textarea
                    value={editorText}
                    onChange={(event) => setEditorText(event.target.value)}
                    rows={14}
                    className="w-full resize-y rounded-lg border border-border bg-parchment px-4 py-3 text-sm font-body leading-relaxed text-ink placeholder:text-ink-lighter/60 focus:border-terracotta/50 focus:outline-none focus:ring-2 focus:ring-terracotta/30"
                    placeholder={
                      isHouseRules
                        ? "Write the global house rules..."
                        : "Write the template instructions..."
                    }
                  />
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-mono uppercase tracking-wider text-ink-lighter">
                        Notes
                      </label>
                      <input
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Optional note: why this version was created"
                        className="w-full rounded-lg border border-border bg-parchment px-3 py-2 text-sm font-body text-ink placeholder:text-ink-lighter/60 focus:border-terracotta/50 focus:outline-none focus:ring-2 focus:ring-terracotta/30"
                      />
                    </div>
                    <button
                      onClick={handleSaveVersion}
                      disabled={saving || !editorText.trim()}
                      className="rounded-lg bg-terracotta px-5 py-2 text-sm font-body font-medium text-white transition-colors duration-150 hover:bg-terracotta-light disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {saving ? "Saving..." : "Save New Version"}
                    </button>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-3 font-serif text-sm font-semibold text-ink">
                  Version History
                  {versions.length > 0 && (
                    <span className="ml-2 text-xs font-mono font-normal text-ink-lighter">
                      ({versions.length} {versions.length === 1 ? "version" : "versions"})
                    </span>
                  )}
                </h3>

                {versions.length === 0 ? (
                  <div className="rounded-xl border border-border-light bg-parchment-dark/30 px-5 py-8 text-center">
                    <p className="text-sm font-body text-ink-lighter">
                      No saved versions yet. Create the first one above.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {versions.map((version) => {
                      const isActive = version.is_active === 1;
                      const expansionKey = `${selectedSection}-${version.id}`;
                      const expanded = expandedIds.has(expansionKey);
                      const bodyText = isHouseRules
                        ? (version as HouseRulesVersion).rules_text
                        : (version as ContentTemplateVersion).instructions;

                      return (
                        <div
                          key={version.id}
                          className={`rounded-xl border p-4 transition-colors ${
                            isActive
                              ? "border-terracotta/30 bg-terracotta/[0.03]"
                              : "border-border bg-white/30 hover:bg-white/50"
                          }`}
                        >
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-mono font-semibold ${
                                  isActive
                                    ? "bg-terracotta/15 text-terracotta"
                                    : "bg-parchment-dark text-ink-light"
                                }`}
                              >
                                v{version.version}
                              </span>
                              <span className="text-xs font-mono text-ink-lighter">
                                {formatDate(version.created_at)}
                              </span>
                              {isActive && (
                                <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-terracotta">
                                  Active
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {!isActive && (
                                <button
                                  onClick={() => handleActivateVersion(version.id)}
                                  disabled={activatingId === version.id}
                                  className="rounded-md border border-border px-3 py-1 text-xs font-body text-ink-light transition-colors hover:border-terracotta/50 hover:text-terracotta disabled:opacity-40"
                                >
                                  {activatingId === version.id
                                    ? "Activating..."
                                    : "Activate"}
                                </button>
                              )}

                              {confirmDeleteId === version.id ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleDeleteVersion(version.id)}
                                    disabled={deletingId === version.id}
                                    className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-mono tracking-wide text-white transition-all duration-200 hover:bg-red-700 disabled:opacity-50"
                                  >
                                    {deletingId === version.id
                                      ? "Deleting"
                                      : "Confirm"}
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="inline-flex items-center rounded-full border border-border-light px-2.5 py-1 text-[11px] font-mono tracking-wide text-ink-lighter transition-all duration-200 hover:bg-parchment-dark/50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                !isActive && (
                                  <button
                                    onClick={() => setConfirmDeleteId(version.id)}
                                    className="inline-flex items-center gap-1 rounded-full border border-border-light px-2 py-1 text-[11px] font-mono tracking-wide text-ink-lighter transition-all duration-200 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                                  >
                                    Delete
                                  </button>
                                )
                              )}
                            </div>
                          </div>

                          {version.notes && (
                            <p className="mb-2 text-xs font-mono text-ink-lighter">
                              {version.notes}
                            </p>
                          )}

                          <pre className="whitespace-pre-wrap text-sm font-body leading-relaxed text-ink">
                            {expanded ? bodyText : truncateText(bodyText)}
                          </pre>
                          {bodyText.length > 360 && (
                            <button
                              onClick={() => toggleExpanded(expansionKey)}
                              className="mt-2 text-xs font-mono text-terracotta transition-colors hover:text-terracotta-light"
                            >
                              {expanded ? "Show less" : "Show more"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
