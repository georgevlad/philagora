"use client";
import { AdminField } from "@/components/admin/AdminUI";
import { AdminDialog, useAdminConfirm } from "@/components/admin/AdminUI";

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
  const confirm = useAdminConfirm();
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

  async function closeModal(force = false) {
    if (saving && !force) return;
    if (!force && JSON.stringify(form) !== JSON.stringify(EMPTY_FORM) && !await confirm({ title: "Discard this new philosopher?", description: "The profile has not been created. Your entered details will be discarded.", confirmLabel: "Discard details", destructive: true })) return;
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
                      data-admin-tag=""
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

      <AdminDialog open={isModalOpen} title="Add philosopher" wide busy={saving} onClose={() => void closeModal()} footer={<>
        <span className="mr-auto text-xs text-ink-lighter">Name, ID, tradition, and era are required.</span>
        <button type="button" className="admin-button" disabled={saving} onClick={() => void closeModal()}>Cancel</button>
        <button type="submit" form="add-philosopher" className="admin-button admin-button-primary" disabled={isCreateDisabled}>{saving ? "Creating…" : "Create Philosopher"}</button>
      </>}>
            <form id="add-philosopher" onSubmit={handleCreatePhilosopher} className="grid grid-cols-2 gap-5">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {formError}
                </div>
              )}

              <div>
                <AdminField label={<>
                  Name
                </>} labelClassName="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5"><input
                  type="text"
                  value={form.name}
                  onChange={(event) => handleNameChange(event.target.value)}
                  className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                  required
                /></AdminField>
              </div>

              <div>
                <AdminField label={<>
                  ID / Slug
                </>} labelClassName="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5"><input
                  type="text"
                  value={form.id}
                  onChange={(event) => {
                    setIdTouched(true);
                    updateForm("id", event.target.value.toLowerCase());
                  }}
                  className="w-full px-3 py-2 text-sm font-mono text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                  required
                /></AdminField>
                {form.id && !isIdValid && (
                  <p className="mt-1.5 text-xs text-red-700 font-body">
                    Use lowercase letters, numbers, and hyphens only.
                  </p>
                )}
              </div>

              <div>
                <AdminField label={<>
                  Tradition
                </>} labelClassName="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5"><input
                  type="text"
                  value={form.tradition}
                  onChange={(event) => updateForm("tradition", event.target.value)}
                  placeholder="Stoicism"
                  className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                  required
                /></AdminField>
              </div>

              <div>
                <AdminField label={<>
                  Era
                </>} labelClassName="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5"><input
                  type="text"
                  value={form.era}
                  onChange={(event) => updateForm("era", event.target.value)}
                  placeholder="428-348 BCE"
                  className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                  required
                /></AdminField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-end">
                <div>
                  <AdminField label={<>
                    Initials
                  </>} labelClassName="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5"><input
                    type="text"
                    value={form.initials}
                    onChange={(event) => {
                      setInitialsTouched(true);
                      updateForm("initials", event.target.value.toUpperCase().slice(0, 2));
                    }}
                    className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                  /></AdminField>
                </div>

                <div>
                  <AdminField label={<>
                    Color
                  </>} labelClassName="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5"><input
                    type="color"
                    value={form.color}
                    onChange={(event) => updateForm("color", event.target.value)}
                    className="h-10 w-20 rounded-lg border border-border bg-parchment p-1 cursor-pointer"
                  /></AdminField>
                </div>
              </div>

              <div>
                <AdminField label={<>
                  Bio
                </>} labelClassName="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5"><textarea
                  value={form.bio}
                  onChange={(event) => updateForm("bio", event.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors resize-y"
                /></AdminField>
              </div>

              <div>
                <AdminField label={<>
                  Followers
                </>} labelClassName="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5"><input
                  type="number"
                  min="0"
                  value={form.followers}
                  onChange={(event) => updateForm("followers", event.target.value)}
                  className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                /></AdminField>
              </div>

            </form>
      </AdminDialog>
    </div>
  );
}
