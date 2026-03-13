"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/Spinner";
import { STANCE_CONFIG } from "@/lib/constants";
import {
  DEFAULT_SCORING_MODEL,
  DEFAULT_SCORE_TIERS,
  DEFAULT_STANCE_GUIDANCE,
  DEFAULT_TENSION_VOCABULARY,
  SCORING_MODEL_OPTIONS,
  slugifyTensionLabel,
  type ScoreTierKey,
  type ScoreTierMap,
  type ScoringConfigKey,
  type ScoringModelName,
  type StanceGuidanceConfig,
  type TensionVocabularyItem,
} from "@/lib/scoring-config";
import type { Stance } from "@/lib/types";

interface ScoringConfigResponse {
  scoring_model: ScoringModelName;
  score_tiers: ScoreTierMap;
  tension_vocabulary: TensionVocabularyItem[];
  stance_guidance: StanceGuidanceConfig;
}

const TIER_ORDER: ScoreTierKey[] = ["reject", "low", "decent", "good", "excellent"];
const STANCE_KEYS = Object.keys(STANCE_CONFIG) as Stance[];

export default function ScoringSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<ScoringConfigKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [scoringModel, setScoringModel] = useState<ScoringModelName>(DEFAULT_SCORING_MODEL);
  const [scoreTiers, setScoreTiers] = useState<ScoreTierMap>(DEFAULT_SCORE_TIERS);
  const [tensionVocabulary, setTensionVocabulary] = useState<TensionVocabularyItem[]>(DEFAULT_TENSION_VOCABULARY);
  const [stanceGuidance, setStanceGuidance] = useState<StanceGuidanceConfig>(DEFAULT_STANCE_GUIDANCE);
  const [openSections, setOpenSections] = useState({
    tiers: true,
    tensions: true,
    stances: true,
  });

  useEffect(() => {
    async function loadConfig() {
      try {
        setError(null);
        const response = await fetch("/api/admin/scoring-config");
        const data = (await response.json()) as ScoringConfigResponse | { error?: string };

        if (!response.ok) {
          throw new Error("error" in data ? data.error || "Failed to load scoring config" : "Failed to load scoring config");
        }

        if ("score_tiers" in data) {
          setScoringModel(data.scoring_model);
          setScoreTiers(data.score_tiers);
          setTensionVocabulary(data.tension_vocabulary);
          setStanceGuidance(data.stance_guidance);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load scoring config");
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

  async function saveSection(key: ScoringConfigKey, value: unknown, successText: string) {
    setSavingKey(key);
    setError(null);

    try {
      const response = await fetch("/api/admin/scoring-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });

      const data = (await response.json()) as ScoringConfigResponse | { error?: string };

      if (!response.ok) {
        throw new Error("error" in data ? data.error || "Failed to save scoring config" : "Failed to save scoring config");
      }

      if ("score_tiers" in data) {
        setScoringModel(data.scoring_model);
        setScoreTiers(data.score_tiers);
        setTensionVocabulary(data.tension_vocabulary);
        setStanceGuidance(data.stance_guidance);
      }

      setSuccessMessage(successText);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save scoring config");
    } finally {
      setSavingKey(null);
    }
  }

  function updateTier(tierKey: ScoreTierKey, field: "label" | "description" | "min" | "max", value: string) {
    setScoreTiers((current) => ({
      ...current,
      [tierKey]: {
        ...current[tierKey],
        [field]:
          field === "label" || field === "description"
            ? value
            : value === ""
            ? undefined
            : Number(value),
      },
    }));
  }

  function updateTension(index: number, field: "label" | "description", value: string) {
    setTensionVocabulary((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        if (field === "label") {
          return {
            ...item,
            label: value,
            id: slugifyTensionLabel(value),
          };
        }

        return {
          ...item,
          description: value,
        };
      })
    );
  }

  function addTension() {
    setTensionVocabulary((current) => [
      ...current,
      { id: "", label: "", description: "" },
    ]);
  }

  function removeTension(index: number) {
    setTensionVocabulary((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function updateFrictionPair(index: number, position: 0 | 1, value: Stance) {
    setStanceGuidance((current) => ({
      ...current,
      preferred_friction_pairs: current.preferred_friction_pairs.map((pair, pairIndex) =>
        pairIndex === index
          ? position === 0
            ? [value, pair[1]]
            : [pair[0], value]
          : pair
      ),
    }));
  }

  function addFrictionPair() {
    setStanceGuidance((current) => ({
      ...current,
      preferred_friction_pairs: [
        ...current.preferred_friction_pairs,
        ["challenges", "defends"],
      ],
    }));
  }

  function removeFrictionPair(index: number) {
    setStanceGuidance((current) => ({
      ...current,
      preferred_friction_pairs: current.preferred_friction_pairs.filter((_, pairIndex) => pairIndex !== index),
    }));
  }

  function toggleDeprioritizedStance(stance: Stance) {
    setStanceGuidance((current) => ({
      ...current,
      deprioritize: current.deprioritize.includes(stance)
        ? current.deprioritize.filter((item) => item !== stance)
        : [...current.deprioritize, stance],
    }));
  }

  function toggleSection(section: keyof typeof openSections) {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
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
            href="/admin/news-scout"
            className="inline-flex items-center gap-1.5 text-xs text-ink-lighter hover:text-terracotta transition-colors duration-150 font-mono mb-2"
          >
            &larr; Back to News Scout
          </Link>
          <h1 className="font-serif text-2xl font-bold text-ink">Scoring Settings</h1>
          <p className="text-sm text-ink-lighter mt-1">
            Configure the scoring prompt inputs used by News Scout at scoring time.
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
          <h2 className="font-serif text-lg font-semibold text-ink">Scoring Model</h2>
          <p className="text-sm text-ink-lighter mt-1">
            Choose which Anthropic model scores News Scout article candidates.
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-end">
            <div>
              <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                Model
              </label>
              <select
                value={scoringModel}
                onChange={(event) => setScoringModel(event.target.value as ScoringModelName)}
                className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
              >
                {SCORING_MODEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => saveSection("scoring_model", scoringModel, "Scoring model saved.")}
              disabled={savingKey !== null}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-terracotta hover:bg-terracotta-light disabled:opacity-50 text-white text-sm font-serif font-semibold rounded-lg transition-colors duration-150 shadow-sm"
            >
              {savingKey === "scoring_model" ? <Spinner className="h-4 w-4" /> : null}
              Save Model
            </button>
          </div>

          <p className="text-xs text-ink-lighter">
            Affects all future scoring runs. Haiku: ~$0.01/batch. Sonnet: ~$0.10/batch.
          </p>
        </div>
      </section>

      <section className="border border-border rounded-xl bg-white/40 overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection("tiers")}
          className="w-full px-5 py-4 border-b border-border bg-parchment-dark/30 flex items-center justify-between text-left"
        >
          <div>
            <h2 className="font-serif text-lg font-semibold text-ink">Score Tiers</h2>
            <p className="text-sm text-ink-lighter mt-1">
              These ranges and descriptions are injected into the AI scoring prompt.
            </p>
          </div>
          <span className="text-ink-lighter font-mono">{openSections.tiers ? "-" : "+"}</span>
        </button>
        {openSections.tiers && (
          <div className="p-5 space-y-4">
            {TIER_ORDER.map((tierKey) => {
              const tier = scoreTiers[tierKey];

              return (
                <div key={tierKey} className="grid grid-cols-1 lg:grid-cols-[140px_120px_120px_1fr] gap-4 items-end">
                  <div>
                    <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                      Label
                    </label>
                    <input
                      type="text"
                      value={tier.label}
                      onChange={(event) => updateTier(tierKey, "label", event.target.value)}
                      className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                      Min
                    </label>
                    <input
                      type="number"
                      value={tier.min ?? ""}
                      onChange={(event) => updateTier(tierKey, "min", event.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                      Max
                    </label>
                    <input
                      type="number"
                      value={tier.max ?? ""}
                      onChange={(event) => updateTier(tierKey, "max", event.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                      Description
                    </label>
                    <input
                      type="text"
                      value={tier.description}
                      onChange={(event) => updateTier(tierKey, "description", event.target.value)}
                      className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                    />
                  </div>
                </div>
              );
            })}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => saveSection("score_tiers", scoreTiers, "Score tiers saved.")}
                disabled={savingKey !== null}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-terracotta hover:bg-terracotta-light disabled:opacity-50 text-white text-sm font-serif font-semibold rounded-lg transition-colors duration-150 shadow-sm"
              >
                {savingKey === "score_tiers" ? <Spinner className="h-4 w-4" /> : null}
                Save Score Tiers
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="border border-border rounded-xl bg-white/40 overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection("tensions")}
          className="w-full px-5 py-4 border-b border-border bg-parchment-dark/30 flex items-center justify-between text-left"
        >
          <div>
            <h2 className="font-serif text-lg font-semibold text-ink">Tension Vocabulary</h2>
            <p className="text-sm text-ink-lighter mt-1">
              These are the only canonical tension labels the scorer can use.
            </p>
          </div>
          <span className="text-ink-lighter font-mono">{openSections.tensions ? "-" : "+"}</span>
        </button>
        {openSections.tensions && (
          <div className="p-5 space-y-4">
            {tensionVocabulary.map((item, index) => (
              <div key={`${item.id}-${index}`} className="border border-border-light rounded-lg p-4 bg-parchment/40 space-y-3">
                <div className="grid grid-cols-1 lg:grid-cols-[180px_180px_1fr_auto] gap-3 items-end">
                  <div>
                    <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                      ID
                    </label>
                    <input
                      type="text"
                      value={item.id}
                      readOnly
                      className="w-full px-3 py-2 text-sm font-mono text-ink-lighter bg-parchment-dark/40 border border-border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                      Label
                    </label>
                    <input
                      type="text"
                      value={item.label}
                      onChange={(event) => updateTension(index, "label", event.target.value)}
                      className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                      Description
                    </label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(event) => updateTension(index, "description", event.target.value)}
                      className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTension(index)}
                    className="px-3 py-2 text-sm font-mono text-red-600 hover:text-red-700 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={addTension}
                className="text-sm font-mono text-terracotta hover:text-terracotta-light transition-colors"
              >
                + Add tension
              </button>

              <button
                type="button"
                onClick={() => saveSection("tension_vocabulary", tensionVocabulary, "Tension vocabulary saved.")}
                disabled={savingKey !== null}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-terracotta hover:bg-terracotta-light disabled:opacity-50 text-white text-sm font-serif font-semibold rounded-lg transition-colors duration-150 shadow-sm"
              >
                {savingKey === "tension_vocabulary" ? <Spinner className="h-4 w-4" /> : null}
                Save Tension Vocabulary
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="border border-border rounded-xl bg-white/40 overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection("stances")}
          className="w-full px-5 py-4 border-b border-border bg-parchment-dark/30 flex items-center justify-between text-left"
        >
          <div>
            <h2 className="font-serif text-lg font-semibold text-ink">Stance Preferences</h2>
            <p className="text-sm text-ink-lighter mt-1">
              Tune the friction guidance the scorer uses when proposing philosopher stances.
            </p>
          </div>
          <span className="text-ink-lighter font-mono">{openSections.stances ? "-" : "+"}</span>
        </button>
        {openSections.stances && (
          <div className="p-5 space-y-5">
            <div>
              <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                Guidance Text
              </label>
              <textarea
                value={stanceGuidance.guidance_text}
                onChange={(event) =>
                  setStanceGuidance((current) => ({
                    ...current,
                    guidance_text: event.target.value,
                  }))
                }
                rows={5}
                className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors resize-y leading-relaxed"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter">
                  Preferred Friction Pairs
                </label>
                <button
                  type="button"
                  onClick={addFrictionPair}
                  className="text-xs font-mono text-terracotta hover:text-terracotta-light transition-colors"
                >
                  + Add pair
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                {stanceGuidance.preferred_friction_pairs.map((pair, index) => (
                  <div
                    key={`${pair[0]}-${pair[1]}-${index}`}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-border bg-parchment"
                  >
                    <select
                      value={pair[0]}
                      onChange={(event) => updateFrictionPair(index, 0, event.target.value as Stance)}
                      className="bg-transparent text-sm font-mono text-ink focus:outline-none"
                    >
                      {STANCE_KEYS.map((stance) => (
                        <option key={stance} value={stance}>
                          {STANCE_CONFIG[stance].label}
                        </option>
                      ))}
                    </select>
                    <span className="text-ink-lighter font-mono">vs</span>
                    <select
                      value={pair[1]}
                      onChange={(event) => updateFrictionPair(index, 1, event.target.value as Stance)}
                      className="bg-transparent text-sm font-mono text-ink focus:outline-none"
                    >
                      {STANCE_KEYS.map((stance) => (
                        <option key={stance} value={stance}>
                          {STANCE_CONFIG[stance].label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeFrictionPair(index)}
                      className="text-xs font-mono text-red-600 hover:text-red-700 transition-colors"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-2">
                Deprioritized Stances
              </label>
              <div className="flex flex-wrap gap-2">
                {STANCE_KEYS.map((stance) => {
                  const active = stanceGuidance.deprioritize.includes(stance);
                  const style = STANCE_CONFIG[stance];

                  return (
                    <button
                      key={stance}
                      type="button"
                      onClick={() => toggleDeprioritizedStance(stance)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono transition-colors ${
                        active ? "" : "opacity-45 hover:opacity-80"
                      }`}
                      style={{
                        backgroundColor: active ? style.bg : "#F6F1E8",
                        borderColor: active ? style.border : "#D8CFC1",
                        color: active ? style.color : "#7C7267",
                      }}
                    >
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: active ? style.color : "#B2A79A" }}
                      />
                      {style.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => saveSection("stance_guidance", stanceGuidance, "Stance preferences saved.")}
                disabled={savingKey !== null}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-terracotta hover:bg-terracotta-light disabled:opacity-50 text-white text-sm font-serif font-semibold rounded-lg transition-colors duration-150 shadow-sm"
              >
                {savingKey === "stance_guidance" ? <Spinner className="h-4 w-4" /> : null}
                Save Stance Preferences
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
