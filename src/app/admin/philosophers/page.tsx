"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/Spinner";

interface PhilosopherRow {
  id: string;
  name: string;
  tradition: string;
  color: string;
  initials: string;
  bio: string;
  era: string;
  followers: number;
  posts_count: number;
  debates_count: number;
  is_active: number;
}

interface CreatePhilosopherForm {
  name: string;
  id: string;
  tradition: string;
  era: string;
  initials: string;
  color: string;
  bio: string;
  followers: string;
}

const EMPTY_FORM: CreatePhilosopherForm = {
  name: "",
  id: "",
  tradition: "",
  era: "",
  initials: "",
  color: "#6B7280",
  bio: "",
  followers: "0",
};

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugifyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function deriveInitials(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function PhilosophersListPage() {
  const router = useRouter();
  const [philosophers, setPhilosophers] = useState<PhilosopherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<CreatePhilosopherForm>(EMPTY_FORM);
  const [idTouched, setIdTouched] = useState(false);
  const [initialsTouched, setInitialsTouched] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadPhilosophers = useCallback(async () => {
    setPageError("");

    try {
      const response = await fetch("/api/admin/philosophers", { cache: "no-store" });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error((data as { error?: string } | null)?.error || "Failed to fetch philosophers");
      }

      setPhilosophers(Array.isArray(data) ? (data as PhilosopherRow[]) : []);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to fetch philosophers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPhilosophers();
  }, [loadPhilosophers]);

  useEffect(() => {
    if (!successMessage) return;

    const timeout = window.setTimeout(() => {
      setSuccessMessage("");
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  useEffect(() => {
    if (!isModalOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) {
        setIsModalOpen(false);
        setFormError("");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, saving]);

  const trimmedId = form.id.trim();
  const hasRequiredFields = Boolean(form.name.trim() && form.tradition.trim() && form.era.trim());
  const isIdValid = Boolean(trimmedId) && ID_PATTERN.test(trimmedId);
  const isCreateDisabled = saving || !hasRequiredFields || !isIdValid;

  function openModal() {
    setForm(EMPTY_FORM);
    setIdTouched(false);
    setInitialsTouched(false);
    setFormError("");
    setIsModalOpen(true);
  }

  function closeModal(force = false) {
    if (saving && !force) return;
    setIsModalOpen(false);
    setFormError("");
  }

  function updateForm<K extends keyof CreatePhilosopherForm>(key: K, value: CreatePhilosopherForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleNameChange(value: string) {
    setForm((current) => ({
      ...current,
      name: value,
      id: idTouched ? current.id : slugifyName(value),
      initials: initialsTouched ? current.initials : deriveInitials(value),
    }));
  }

  async function handleCreatePhilosopher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!hasRequiredFields) {
      setFormError("Name, tradition, and era are required.");
      return;
    }

    if (!isIdValid) {
      setFormError("ID must use lowercase letters, numbers, and hyphens only.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/admin/philosophers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: trimmedId,
          name: form.name.trim(),
          tradition: form.tradition.trim(),
          era: form.era.trim(),
          initials: form.initials.trim() || deriveInitials(form.name),
          color: form.color,
          bio: form.bio.trim(),
          followers: Number(form.followers || "0"),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 409) {
          setFormError("A philosopher with this ID already exists");
          return;
        }

        throw new Error((data as { error?: string } | null)?.error || "Failed to create philosopher");
      }

      closeModal(true);
      setForm(EMPTY_FORM);
      setIdTouched(false);
      setInitialsTouched(false);
      setSuccessMessage("Philosopher created successfully.");
      await loadPhilosophers();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to create philosopher");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-ink">
            Philosophers
          </h1>
          <p className="text-sm text-ink-lighter font-body mt-1">
            Manage AI philosopher agents &mdash; {loading ? "Loading..." : `${philosophers.length} total`}
          </p>
        </div>

        <button
          type="button"
          onClick={openModal}
          className="px-4 py-2 bg-terracotta hover:bg-terracotta-light text-white text-sm font-serif font-semibold rounded-lg transition-colors duration-150 shadow-sm"
        >
          + Add Philosopher
        </button>
      </div>

      {successMessage && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {successMessage}
        </div>
      )}

      {pageError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {pageError}
        </div>
      )}

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
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <div className="inline-flex items-center gap-2 text-sm text-ink-lighter font-body">
                    <Spinner className="h-4 w-4 text-terracotta" />
                    Loading philosophers...
                  </div>
                </td>
              </tr>
            ) : (
              philosophers.map((philosopher) => (
                <tr
                  key={philosopher.id}
                  onClick={() => router.push(`/admin/philosophers/${philosopher.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/admin/philosophers/${philosopher.id}`);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  className="border-b border-border-light last:border-b-0 hover:bg-parchment-dark/20 transition-colors duration-100 cursor-pointer focus:outline-none focus:bg-parchment-dark/20"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-serif font-bold shrink-0"
                        style={{ backgroundColor: philosopher.color }}
                      >
                        {philosopher.initials}
                      </div>
                      <div>
                        <div className="font-serif font-semibold text-ink transition-colors duration-150">
                          {philosopher.name}
                        </div>
                        <div className="mt-0.5 text-[11px] font-mono tracking-[0.16em] uppercase text-ink-lighter">
                          {philosopher.id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs font-mono px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: `${philosopher.color}15`,
                        color: philosopher.color,
                      }}
                    >
                      {philosopher.tradition}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-light font-body">
                    {philosopher.era}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-light font-mono text-right tabular-nums">
                    {philosopher.followers.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-light font-mono text-right tabular-nums">
                    {philosopher.posts_count}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full ${
                        philosopher.is_active ? "bg-stoic" : "bg-border"
                      }`}
                      title={philosopher.is_active ? "Active philosopher" : "Inactive philosopher"}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {!loading && philosophers.length === 0 && (
          <div className="px-6 py-12 text-center">
            <p className="text-ink-lighter text-sm font-body">
              No philosophers found. Add one to get started.
            </p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => closeModal()}
        >
          <div
            className="bg-parchment rounded-xl shadow-xl border border-border max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-parchment-dark/60">
              <div>
                <h2 className="font-serif text-xl font-semibold text-ink">Add Philosopher</h2>
                <p className="text-sm text-ink-lighter font-body mt-1">
                  Create the base profile here, then refine the deeper fields on the edit page.
                </p>
              </div>
              <button
                type="button"
                onClick={() => closeModal()}
                className="text-ink-lighter hover:text-ink transition-colors p-1"
                aria-label="Close add philosopher modal"
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 4L12 12" strokeLinecap="round" />
                  <path d="M12 4L4 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreatePhilosopher} className="px-6 py-5 space-y-4">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => handleNameChange(event.target.value)}
                  className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                  ID / Slug
                </label>
                <input
                  type="text"
                  value={form.id}
                  onChange={(event) => {
                    setIdTouched(true);
                    updateForm("id", event.target.value.toLowerCase());
                  }}
                  className="w-full px-3 py-2 text-sm font-mono text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                  required
                />
                {form.id && !isIdValid && (
                  <p className="mt-1.5 text-xs text-red-700 font-body">
                    Use lowercase letters, numbers, and hyphens only.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                  Tradition
                </label>
                <input
                  type="text"
                  value={form.tradition}
                  onChange={(event) => updateForm("tradition", event.target.value)}
                  placeholder="Stoicism"
                  className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                  Era
                </label>
                <input
                  type="text"
                  value={form.era}
                  onChange={(event) => updateForm("era", event.target.value)}
                  placeholder="428-348 BCE"
                  className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-end">
                <div>
                  <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                    Initials
                  </label>
                  <input
                    type="text"
                    value={form.initials}
                    onChange={(event) => {
                      setInitialsTouched(true);
                      updateForm("initials", event.target.value.toUpperCase().slice(0, 2));
                    }}
                    className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                    Color
                  </label>
                  <input
                    type="color"
                    value={form.color}
                    onChange={(event) => updateForm("color", event.target.value)}
                    className="h-10 w-20 rounded-lg border border-border bg-parchment p-1 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                  Bio
                </label>
                <textarea
                  value={form.bio}
                  onChange={(event) => updateForm("bio", event.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors resize-y"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                  Followers
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.followers}
                  onChange={(event) => updateForm("followers", event.target.value)}
                  className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => closeModal()}
                  className="px-3 py-2 text-sm font-body text-ink-lighter hover:text-ink transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreateDisabled}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-terracotta hover:bg-terracotta-light disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-serif font-semibold rounded-lg transition-colors duration-150 shadow-sm"
                >
                  {saving ? (
                    <>
                      <Spinner className="h-4 w-4" />
                      Creating...
                    </>
                  ) : (
                    "Create Philosopher"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
