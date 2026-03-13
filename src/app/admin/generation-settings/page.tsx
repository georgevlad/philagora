"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/Spinner";
import {
  DEFAULT_GENERATION_MODEL,
  GENERATION_MODEL_OPTIONS,
  type GenerationModelName,
  type ScoringConfigKey,
} from "@/lib/scoring-config";

interface GenerationConfigResponse {
  generation_model: GenerationModelName;
  synthesis_model: GenerationModelName;
}

export default function GenerationSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<ScoringConfigKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [generationModel, setGenerationModel] =
    useState<GenerationModelName>(DEFAULT_GENERATION_MODEL);
  const [synthesisModel, setSynthesisModel] =
    useState<GenerationModelName>(DEFAULT_GENERATION_MODEL);

  useEffect(() => {
    async function loadConfig() {
      try {
        setError(null);
        const response = await fetch("/api/admin/scoring-config");
        const data = (await response.json()) as
          | GenerationConfigResponse
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in data
              ? data.error || "Failed to load generation settings"
              : "Failed to load generation settings"
          );
        }

        if ("generation_model" in data) {
          setGenerationModel(data.generation_model);
          setSynthesisModel(data.synthesis_model);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load generation settings"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadConfig();
  }, []);

  useEffect(() => {
    if (!successMessage) return;

    const timeout = window.setTimeout(() => {
      setSuccessMessage("");
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  async function saveSection(
    key: "generation_model" | "synthesis_model",
    value: GenerationModelName,
    successText: string
  ) {
    setSavingKey(key);
    setError(null);

    try {
      const response = await fetch("/api/admin/scoring-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });

      const data = (await response.json()) as
        | GenerationConfigResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in data
            ? data.error || "Failed to save generation settings"
            : "Failed to save generation settings"
        );
      }

      if ("generation_model" in data) {
        setGenerationModel(data.generation_model);
        setSynthesisModel(data.synthesis_model);
      }

      setSuccessMessage(successText);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save generation settings"
      );
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-6 w-6 text-terracotta" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/content"
            className="inline-flex items-center gap-1.5 text-xs text-ink-lighter hover:text-terracotta transition-colors duration-150 font-mono mb-2"
          >
            &larr; Back to Generate Content
          </Link>
          <h1 className="font-serif text-2xl font-bold text-ink">
            Generation Settings
          </h1>
          <p className="text-sm text-ink-lighter mt-1">
            Choose which model powers philosopher writing and editorial
            synthesis.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {successMessage}
        </div>
      )}

      <section className="border border-border rounded-xl bg-white/40 overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-parchment-dark/30">
          <h2 className="font-serif text-lg font-semibold text-ink">
            Content Generation Model
          </h2>
          <p className="text-sm text-ink-lighter mt-1">
            Used for philosopher posts, replies, debate openings, and agora
            responses.
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-end">
            <div>
              <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                Model
              </label>
              <select
                value={generationModel}
                onChange={(event) =>
                  setGenerationModel(
                    event.target.value as GenerationModelName
                  )
                }
                className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
              >
                {GENERATION_MODEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() =>
                saveSection(
                  "generation_model",
                  generationModel,
                  "Content generation model saved."
                )
              }
              disabled={savingKey !== null}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-terracotta hover:bg-terracotta-light disabled:opacity-50 text-white text-sm font-serif font-semibold rounded-lg transition-colors duration-150 shadow-sm"
            >
              {savingKey === "generation_model" ? (
                <Spinner className="h-4 w-4" />
              ) : null}
              Save Model
            </button>
          </div>
        </div>
      </section>

      <section className="border border-border rounded-xl bg-white/40 overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-parchment-dark/30">
          <h2 className="font-serif text-lg font-semibold text-ink">
            Synthesis Model
          </h2>
          <p className="text-sm text-ink-lighter mt-1">
            Used for debate synthesis and agora editorial synthesis. Lower
            temperature, more analytical.
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-end">
            <div>
              <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                Model
              </label>
              <select
                value={synthesisModel}
                onChange={(event) =>
                  setSynthesisModel(
                    event.target.value as GenerationModelName
                  )
                }
                className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
              >
                {GENERATION_MODEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() =>
                saveSection(
                  "synthesis_model",
                  synthesisModel,
                  "Synthesis model saved."
                )
              }
              disabled={savingKey !== null}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-terracotta hover:bg-terracotta-light disabled:opacity-50 text-white text-sm font-serif font-semibold rounded-lg transition-colors duration-150 shadow-sm"
            >
              {savingKey === "synthesis_model" ? (
                <Spinner className="h-4 w-4" />
              ) : null}
              Save Model
            </button>
          </div>
        </div>
      </section>

      <div className="rounded-xl border border-border bg-parchment-dark/20 px-5 py-4">
        <p className="text-xs font-mono uppercase tracking-[0.18em] text-ink-lighter">
          Affects all future generation runs. Haiku is the cheapest. Opus is
          the most expensive and slowest.
        </p>
      </div>
    </div>
  );
}
