"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

interface CorePrinciple {
  title: string;
  description: string;
}

interface PhilosopherData {
  id: string;
  name: string;
  tradition: string;
  color: string;
  initials: string;
  bio: string;
  era: string;
  key_works: string[];
  core_principles: CorePrinciple[];
  followers: number;
  posts_count: number;
  debates_count: number;
}

export default function EditPhilosopherPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [tradition, setTradition] = useState("");
  const [color, setColor] = useState("#000000");
  const [initials, setInitials] = useState("");
  const [bio, setBio] = useState("");
  const [era, setEra] = useState("");
  const [keyWorksText, setKeyWorksText] = useState("");
  const [corePrinciples, setCorePrinciples] = useState<CorePrinciple[]>([]);

  const fetchPhilosopher = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/philosophers?id=${encodeURIComponent(id)}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch philosopher (${res.status})`);
      }
      const data = await res.json();

      // DB stores key_works and core_principles as JSON strings — parse them
      const keyWorks = typeof data.key_works === "string"
        ? JSON.parse(data.key_works)
        : (data.key_works ?? []);
      const principles = typeof data.core_principles === "string"
        ? JSON.parse(data.core_principles)
        : (data.core_principles ?? []);

      setName(data.name);
      setTradition(data.tradition);
      setColor(data.color);
      setInitials(data.initials);
      setBio(data.bio);
      setEra(data.era);
      setKeyWorksText(keyWorks.join("\n"));
      setCorePrinciples(principles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load philosopher");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPhilosopher();
  }, [fetchPhilosopher]);

  // --- Core principles helpers ---

  function updatePrinciple(index: number, field: keyof CorePrinciple, value: string) {
    setCorePrinciples((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  }

  function removePrinciple(index: number) {
    setCorePrinciples((prev) => prev.filter((_, i) => i !== index));
  }

  function addPrinciple() {
    setCorePrinciples((prev) => [...prev, { title: "", description: "" }]);
  }

  // --- Save ---

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const keyWorks = keyWorksText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const body = {
      id,
      name,
      tradition,
      color,
      initials,
      bio,
      era,
      key_works: keyWorks,
      core_principles: corePrinciples.filter(
        (p) => p.title.trim() || p.description.trim()
      ),
    };

    try {
      const res = await fetch("/api/admin/philosophers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error ?? `Save failed (${res.status})`);
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // --- Render ---

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-sm text-ink-lighter font-mono animate-pulse">
          Loading philosopher...
        </div>
      </div>
    );
  }

  if (error && !name) {
    return (
      <div className="py-12">
        <Link
          href="/admin/philosophers"
          className="inline-flex items-center gap-1.5 text-sm text-ink-lighter hover:text-terracotta transition-colors duration-150 font-mono mb-6"
        >
          &larr; Back to list
        </Link>
        <div className="border border-existential/30 bg-existential/5 rounded-lg px-5 py-4 text-sm text-existential">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link
            href="/admin/philosophers"
            className="inline-flex items-center gap-1.5 text-xs text-ink-lighter hover:text-terracotta transition-colors duration-150 font-mono mb-2"
          >
            &larr; Back to list
          </Link>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-serif font-bold shrink-0"
              style={{ backgroundColor: color }}
            >
              {initials}
            </div>
            <h1 className="font-serif text-2xl font-bold text-ink">
              {name || "Edit Philosopher"}
            </h1>
          </div>
        </div>
      </div>

      {/* Feedback banners */}
      {error && (
        <div className="border border-existential/30 bg-existential/5 rounded-lg px-5 py-3 text-sm text-existential mb-6">
          {error}
        </div>
      )}
      {success && (
        <div className="border border-stoic/30 bg-stoic/5 rounded-lg px-5 py-3 text-sm text-stoic mb-6">
          Changes saved successfully.
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSave} className="space-y-8">
        {/* Basic info section */}
        <section className="border border-border rounded-xl bg-white/40 overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-parchment-dark/30">
            <h2 className="text-[10px] font-mono tracking-wider uppercase text-ink-lighter">
              Basic Information
            </h2>
          </div>
          <div className="p-5 space-y-5">
            {/* Name + Initials row */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-4">
              <div>
                <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                  Initials
                </label>
                <input
                  type="text"
                  value={initials}
                  onChange={(e) => setInitials(e.target.value)}
                  maxLength={3}
                  required
                  className="w-full px-3 py-2 text-sm font-mono text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                />
              </div>
            </div>

            {/* Tradition + Era row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                  Tradition
                </label>
                <input
                  type="text"
                  value={tradition}
                  onChange={(e) => setTradition(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                  Era
                </label>
                <input
                  type="text"
                  value={era}
                  onChange={(e) => setEra(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                />
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  pattern="^#[0-9a-fA-F]{6}$"
                  className="w-32 px-3 py-2 text-sm font-mono text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                />
                <div
                  className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-white text-xs font-serif font-bold"
                  style={{ backgroundColor: color }}
                >
                  {initials}
                </div>
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                required
                className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors resize-y leading-relaxed"
              />
            </div>
          </div>
        </section>

        {/* Key Works section */}
        <section className="border border-border rounded-xl bg-white/40 overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-parchment-dark/30">
            <h2 className="text-[10px] font-mono tracking-wider uppercase text-ink-lighter">
              Key Works
            </h2>
          </div>
          <div className="p-5">
            <p className="text-xs text-ink-lighter font-body mb-2">
              One work per line.
            </p>
            <textarea
              value={keyWorksText}
              onChange={(e) => setKeyWorksText(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors resize-y leading-relaxed"
              placeholder={"Meditations\nLetters to Fronto"}
            />
          </div>
        </section>

        {/* Core Principles section */}
        <section className="border border-border rounded-xl bg-white/40 overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-parchment-dark/30 flex items-center justify-between">
            <h2 className="text-[10px] font-mono tracking-wider uppercase text-ink-lighter">
              Core Principles
            </h2>
            <button
              type="button"
              onClick={addPrinciple}
              className="text-xs font-mono text-terracotta hover:text-terracotta-light transition-colors"
            >
              + Add principle
            </button>
          </div>
          <div className="p-5 space-y-4">
            {corePrinciples.length === 0 && (
              <p className="text-sm text-ink-lighter font-body text-center py-4">
                No principles yet. Click &ldquo;+ Add principle&rdquo; to begin.
              </p>
            )}
            {corePrinciples.map((principle, index) => (
              <div
                key={index}
                className="border border-border-light rounded-lg p-4 space-y-3 bg-parchment/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono tracking-wider uppercase text-ink-lighter">
                    Principle {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removePrinciple(index)}
                    className="text-xs font-mono text-ink-lighter hover:text-existential transition-colors"
                  >
                    Remove
                  </button>
                </div>
                <div>
                  <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={principle.title}
                    onChange={(e) => updatePrinciple(index, "title", e.target.value)}
                    className="w-full px-3 py-2 text-sm font-serif font-semibold text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                    placeholder="Principle title"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1">
                    Description
                  </label>
                  <textarea
                    value={principle.description}
                    onChange={(e) => updatePrinciple(index, "description", e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors resize-y leading-relaxed"
                    placeholder="Describe this core principle..."
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Save bar */}
        <div className="flex items-center justify-between pt-2 pb-8">
          <Link
            href="/admin/philosophers"
            className="text-sm font-mono text-ink-lighter hover:text-terracotta transition-colors"
          >
            &larr; Back to list
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-terracotta hover:bg-terracotta-light disabled:opacity-50 text-white text-sm font-serif font-semibold rounded-lg transition-colors duration-150 shadow-sm"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
