"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TOPIC_CLUSTER_LABELS } from "@/app/admin/daily/types";
import { Spinner } from "@/components/Spinner";
import { STANCE_CONFIG } from "@/lib/constants";
import type { MoodRegister } from "@/lib/mood-data";
import type { Stance } from "@/lib/types";

interface PhilosopherOption {
  id: string;
  name: string;
}

interface MoodPaletteRecord {
  philosopher_id: string;
  philosopher_name: string;
  registers: MoodRegister[];
  is_active: boolean;
}

interface EditableMoodRegister {
  name: string;
  directive: string;
  tensions: string[];
  stances: string[];
  clusters: string[];
}

interface EditablePalette {
  is_active: boolean;
  registers: EditableMoodRegister[];
}

interface MoodConfigResponse {
  mood_enabled: boolean;
  mood_content_types: string[];
  error?: string;
}

interface MoodTestResult {
  register: string;
  directive: string;
  line: string;
  pass: number;
}

interface MoodTestResponse {
  result: MoodTestResult | null;
  reason?: string;
  error?: string;
}

const CONTENT_TYPE_OPTIONS = [
  { value: "news_reaction", label: "News Reaction" },
  { value: "cross_philosopher_reply", label: "Cross-Philosopher Reply" },
] as const;

const STANCE_OPTIONS = Object.entries(STANCE_CONFIG) as Array<
  [Stance, { label: string; color: string; bg: string; border: string }]
>;

const TOPIC_CLUSTER_OPTIONS = Object.entries(TOPIC_CLUSTER_LABELS).map(
  ([value, config]) => ({ value, label: config.label })
);

function splitCommaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinCommaSeparated(values: string[]): string {
  return values.join(", ");
}

function toEditableRegister(register: MoodRegister): EditableMoodRegister {
  return {
    name: register.name,
    directive: register.directive,
    tensions: [...(register.tensions ?? [])],
    stances: [...(register.stances ?? [])],
    clusters: [...(register.clusters ?? [])],
  };
}

function createEmptyRegister(): EditableMoodRegister {
  return {
    name: "",
    directive: "",
    tensions: [],
    stances: [],
    clusters: [],
  };
}

function createPaletteDraft(palette?: MoodPaletteRecord): EditablePalette {
  return {
    is_active: palette?.is_active ?? true,
    registers: palette?.registers.map(toEditableRegister) ?? [],
  };
}

export default function MoodPalettesPage() {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<
    "mood_enabled" | "mood_content_types" | "palette" | "test" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [moodEnabled, setMoodEnabled] = useState(false);
  const [moodContentTypes, setMoodContentTypes] = useState<string[]>([]);
  const [philosophers, setPhilosophers] = useState<PhilosopherOption[]>([]);
  const [palettes, setPalettes] = useState<MoodPaletteRecord[]>([]);
  const [selectedPhilosopherId, setSelectedPhilosopherId] = useState("");
  const [paletteDraft, setPaletteDraft] = useState<EditablePalette | null>(null);
  const [testTensions, setTestTensions] = useState("");
  const [testStance, setTestStance] = useState("");
  const [testTopicCluster, setTestTopicCluster] = useState("");
  const [testResponse, setTestResponse] = useState<MoodTestResponse | null>(null);
  const [openSections, setOpenSections] = useState({
    paletteEditor: true,
    testResolution: false,
  });

  useEffect(() => {
    async function loadPageData() {
      try {
        setError(null);

        const [configResponse, palettesResponse, philosophersResponse] =
          await Promise.all([
            fetch("/api/admin/scoring-config"),
            fetch("/api/admin/mood-palettes"),
            fetch("/api/admin/philosophers"),
          ]);

        const configData = (await configResponse.json()) as MoodConfigResponse;
        const paletteData =
          (await palettesResponse.json()) as MoodPaletteRecord[] | { error?: string };
        const philosopherData =
          (await philosophersResponse.json()) as PhilosopherOption[] | { error?: string };

        if (!configResponse.ok) {
          throw new Error(configData.error || "Failed to load mood settings.");
        }

        if (!palettesResponse.ok) {
          throw new Error(
            "error" in paletteData
              ? paletteData.error || "Failed to load mood palettes."
              : "Failed to load mood palettes."
          );
        }

        if (!philosophersResponse.ok) {
          throw new Error(
            "error" in philosopherData
              ? philosopherData.error || "Failed to load philosophers."
              : "Failed to load philosophers."
          );
        }

        const paletteList = Array.isArray(paletteData) ? paletteData : [];
        const philosopherList = Array.isArray(philosopherData)
          ? philosopherData.map((philosopher) => ({
              id: philosopher.id,
              name: philosopher.name,
            }))
          : [];

        setMoodEnabled(configData.mood_enabled);
        setMoodContentTypes(configData.mood_content_types);
        setPalettes(paletteList);
        setPhilosophers(philosopherList);
        setSelectedPhilosopherId((current) => {
          if (current) return current;
          return philosopherList[0]?.id ?? paletteList[0]?.philosopher_id ?? "";
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load mood settings.");
      } finally {
        setLoading(false);
      }
    }

    void loadPageData();
  }, []);

  useEffect(() => {
    if (!successMessage) return;

    const timeout = window.setTimeout(() => {
      setSuccessMessage("");
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  useEffect(() => {
    if (!selectedPhilosopherId) {
      setPaletteDraft(null);
      return;
    }

    const selectedPalette = palettes.find(
      (palette) => palette.philosopher_id === selectedPhilosopherId
    );

    setPaletteDraft(createPaletteDraft(selectedPalette));
    setTestResponse(null);
  }, [palettes, selectedPhilosopherId]);

  async function saveConfig(
    key: "mood_enabled" | "mood_content_types",
    value: boolean | string[],
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

      const data = (await response.json()) as MoodConfigResponse;
      if (!response.ok) {
        throw new Error(data.error || "Failed to save mood settings.");
      }

      setMoodEnabled(data.mood_enabled);
      setMoodContentTypes(data.mood_content_types);
      setSuccessMessage(successText);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save mood settings.");
    } finally {
      setSavingKey(null);
    }
  }

  async function savePalette() {
    if (!selectedPhilosopherId || !paletteDraft) {
      return;
    }

    setSavingKey("palette");
    setError(null);

    try {
      const response = await fetch("/api/admin/mood-palettes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          philosopher_id: selectedPhilosopherId,
          is_active: paletteDraft.is_active,
          registers: paletteDraft.registers.map((register) => ({
            name: register.name,
            directive: register.directive,
            tensions: register.tensions,
            stances: register.stances,
            clusters: register.clusters,
          })),
        }),
      });

      const data =
        (await response.json()) as MoodPaletteRecord | { error?: string } | null;

      if (!response.ok) {
        throw new Error(
          data && typeof data === "object" && "error" in data
            ? data.error || "Failed to save palette."
            : "Failed to save palette."
        );
      }

      if (data && !Array.isArray(data)) {
        const updated = data as MoodPaletteRecord;
        setPalettes((current) => {
          const next = current.some(
            (palette) => palette.philosopher_id === updated.philosopher_id
          )
            ? current.map((palette) =>
                palette.philosopher_id === updated.philosopher_id ? updated : palette
              )
            : [...current, updated];

          return [...next].sort((left, right) =>
            left.philosopher_name.localeCompare(right.philosopher_name)
          );
        });
      }

      setSuccessMessage("Mood palette saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save palette.");
    } finally {
      setSavingKey(null);
    }
  }

  async function testResolution() {
    if (!selectedPhilosopherId) {
      setError("Select a philosopher before testing resolution.");
      return;
    }

    setSavingKey("test");
    setError(null);

    try {
      const response = await fetch("/api/admin/mood-palettes/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          philosopher_id: selectedPhilosopherId,
          tensions: splitCommaSeparated(testTensions),
          stance: testStance || null,
          topic_cluster: testTopicCluster || null,
        }),
      });

      const data = (await response.json()) as MoodTestResponse;
      if (!response.ok) {
        throw new Error(data.error || "Failed to test resolution.");
      }

      setTestResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to test resolution.");
      setTestResponse(null);
    } finally {
      setSavingKey(null);
    }
  }

  function toggleSection(section: keyof typeof openSections) {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  function toggleContentType(value: string) {
    setMoodContentTypes((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  }

  function updateRegister(
    index: number,
    field: keyof EditableMoodRegister,
    value: string
  ) {
    setPaletteDraft((current) => {
      if (!current) return current;

      return {
        ...current,
        registers: current.registers.map((register, registerIndex) => {
          if (registerIndex !== index) return register;

          if (field === "name" || field === "directive") {
            return {
              ...register,
              [field]: value,
            };
          }

          return {
            ...register,
            [field]: splitCommaSeparated(value),
          };
        }),
      };
    });
  }

  function addRegister() {
    setPaletteDraft((current) => {
      if (!current) return current;

      return {
        ...current,
        registers: [...current.registers, createEmptyRegister()],
      };
    });
  }

  function removeRegister(index: number) {
    setPaletteDraft((current) => {
      if (!current) return current;

      return {
        ...current,
        registers: current.registers.filter((_, registerIndex) => registerIndex !== index),
      };
    });
  }

  const selectedPhilosopher = philosophers.find(
    (philosopher) => philosopher.id === selectedPhilosopherId
  );

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
            href="/admin/scoring"
            className="inline-flex items-center gap-1.5 text-xs text-ink-lighter hover:text-terracotta transition-colors duration-150 font-mono mb-2"
          >
            &larr; Back to Scoring Settings
          </Link>
          <h1 className="font-serif text-2xl font-bold text-ink">Mood Palettes</h1>
          <p className="text-sm text-ink-lighter mt-1">
            Control mood injection, edit philosopher palettes, and preview how a register resolves.
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
          <h2 className="font-serif text-lg font-semibold text-ink">Global Controls</h2>
          <p className="text-sm text-ink-lighter mt-1">
            Turn mood injection on or off, and choose which generation paths can use it.
          </p>
        </div>
        <div className="p-5 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-end">
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                  Mood System
                </p>
                <p className="text-sm text-ink">
                  Mood injection is <strong>{moodEnabled ? "enabled" : "disabled"}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMoodEnabled((current) => !current)}
                className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-mono transition-colors ${
                  moodEnabled
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-stone-200 text-ink hover:bg-stone-300"
                }`}
              >
                {moodEnabled ? "Enabled" : "Disabled"}
              </button>
            </div>

            <button
              type="button"
              onClick={() =>
                saveConfig("mood_enabled", moodEnabled, "Mood system setting saved.")
              }
              disabled={savingKey !== null}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-terracotta hover:bg-terracotta-light disabled:opacity-50 text-white text-sm font-serif font-semibold rounded-lg transition-colors duration-150 shadow-sm"
            >
              {savingKey === "mood_enabled" ? <Spinner className="h-4 w-4" /> : null}
              Save Toggle
            </button>
          </div>

          <div className="border-t border-border pt-6">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-end">
              <div>
                <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                  Enabled Content Types
                </label>
                <div className="flex flex-wrap gap-3">
                  {CONTENT_TYPE_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-parchment px-3 py-2 text-sm text-ink"
                    >
                      <input
                        type="checkbox"
                        checked={moodContentTypes.includes(option.value)}
                        onChange={() => toggleContentType(option.value)}
                        className="h-4 w-4 rounded border-border text-terracotta focus:ring-terracotta"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-ink-lighter mt-2">
                  Only checked content types can receive mood injection during generation.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  saveConfig(
                    "mood_content_types",
                    moodContentTypes,
                    "Mood content types saved."
                  )
                }
                disabled={savingKey !== null}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-terracotta hover:bg-terracotta-light disabled:opacity-50 text-white text-sm font-serif font-semibold rounded-lg transition-colors duration-150 shadow-sm"
              >
                {savingKey === "mood_content_types" ? <Spinner className="h-4 w-4" /> : null}
                Save Content Types
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="border border-border rounded-xl bg-white/40 overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection("paletteEditor")}
          className="w-full px-5 py-4 border-b border-border bg-parchment-dark/30 flex items-center justify-between text-left"
        >
          <div>
            <h2 className="font-serif text-lg font-semibold text-ink">Philosopher Palette Editor</h2>
            <p className="text-sm text-ink-lighter mt-1">
              Edit the registers, triggers, and live availability for each philosopher.
            </p>
          </div>
          <span className="text-ink-lighter font-mono">
            {openSections.paletteEditor ? "-" : "+"}
          </span>
        </button>
        {openSections.paletteEditor && (
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4 items-end">
              <div>
                <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                  Philosopher
                </label>
                <select
                  value={selectedPhilosopherId}
                  onChange={(event) => setSelectedPhilosopherId(event.target.value)}
                  className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                >
                  {philosophers.map((philosopher) => (
                    <option key={philosopher.id} value={philosopher.id}>
                      {philosopher.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border-light bg-parchment/40 px-4 py-3">
                <div>
                  <p className="text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                    Palette Status
                  </p>
                  <p className="text-sm text-ink">
                    {selectedPhilosopher?.name ?? "This philosopher"}&apos;s palette is currently{" "}
                    <strong>{paletteDraft?.is_active ? "active" : "inactive"}</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPaletteDraft((current) =>
                      current
                        ? {
                            ...current,
                            is_active: !current.is_active,
                          }
                        : current
                    )
                  }
                  className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-mono transition-colors ${
                    paletteDraft?.is_active
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : "bg-stone-200 text-ink hover:bg-stone-300"
                  }`}
                >
                  {paletteDraft?.is_active ? "Active" : "Inactive"}
                </button>
              </div>
            </div>

            {paletteDraft && paletteDraft.registers.length > 0 ? (
              <div className="space-y-4">
                {paletteDraft.registers.map((register, index) => (
                  <div
                    key={`${selectedPhilosopherId}-${index}`}
                    className="rounded-lg border border-border-light bg-parchment/40 p-4 space-y-3"
                  >
                    <div className="grid grid-cols-1 xl:grid-cols-[180px_1fr_1fr_1fr_1fr_auto] gap-3 items-end">
                      <div>
                        <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                          Name
                        </label>
                        <input
                          type="text"
                          value={register.name}
                          onChange={(event) =>
                            updateRegister(index, "name", event.target.value)
                          }
                          className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                          Directive
                        </label>
                        <input
                          type="text"
                          value={register.directive}
                          onChange={(event) =>
                            updateRegister(index, "directive", event.target.value)
                          }
                          className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                          Tensions
                        </label>
                        <input
                          type="text"
                          value={joinCommaSeparated(register.tensions)}
                          onChange={(event) =>
                            updateRegister(index, "tensions", event.target.value)
                          }
                          className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                          Stances
                        </label>
                        <input
                          type="text"
                          value={joinCommaSeparated(register.stances)}
                          onChange={(event) =>
                            updateRegister(index, "stances", event.target.value)
                          }
                          className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                          Clusters
                        </label>
                        <input
                          type="text"
                          value={joinCommaSeparated(register.clusters)}
                          onChange={(event) =>
                            updateRegister(index, "clusters", event.target.value)
                          }
                          className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => removeRegister(index)}
                        className="px-3 py-2 text-sm font-mono text-red-600 hover:text-red-700 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-parchment/30 px-4 py-6 text-sm text-ink-lighter">
                No registers yet. Add one to start building this palette.
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={addRegister}
                className="text-sm font-mono text-terracotta hover:text-terracotta-light transition-colors"
              >
                + Add register
              </button>

              <button
                type="button"
                onClick={savePalette}
                disabled={savingKey !== null || !paletteDraft}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-terracotta hover:bg-terracotta-light disabled:opacity-50 text-white text-sm font-serif font-semibold rounded-lg transition-colors duration-150 shadow-sm"
              >
                {savingKey === "palette" ? <Spinner className="h-4 w-4" /> : null}
                Save Palette
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="border border-border rounded-xl bg-white/40 overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection("testResolution")}
          className="w-full px-5 py-4 border-b border-border bg-parchment-dark/30 flex items-center justify-between text-left"
        >
          <div>
            <h2 className="font-serif text-lg font-semibold text-ink">Test Resolution</h2>
            <p className="text-sm text-ink-lighter mt-1">
              Preview which register would fire for a philosopher given tensions, stance, and cluster.
            </p>
          </div>
          <span className="text-ink-lighter font-mono">
            {openSections.testResolution ? "-" : "+"}
          </span>
        </button>
        {openSections.testResolution && (
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                  Philosopher
                </label>
                <select
                  value={selectedPhilosopherId}
                  onChange={(event) => setSelectedPhilosopherId(event.target.value)}
                  className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                >
                  {philosophers.map((philosopher) => (
                    <option key={philosopher.id} value={philosopher.id}>
                      {philosopher.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                  Tensions
                </label>
                <input
                  type="text"
                  value={testTensions}
                  onChange={(event) => setTestTensions(event.target.value)}
                  placeholder="freedom_vs_order, truth_vs_power"
                  className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                  Stance
                </label>
                <select
                  value={testStance}
                  onChange={(event) => setTestStance(event.target.value)}
                  className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                >
                  <option value="">Any stance</option>
                  {STANCE_OPTIONS.map(([value, config]) => (
                    <option key={value} value={value}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5">
                  Topic Cluster
                </label>
                <select
                  value={testTopicCluster}
                  onChange={(event) => setTestTopicCluster(event.target.value)}
                  className="w-full px-3 py-2 text-sm font-body text-ink bg-parchment border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition-colors"
                >
                  <option value="">Any cluster</option>
                  {TOPIC_CLUSTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={testResolution}
                disabled={savingKey !== null || !selectedPhilosopherId}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-terracotta hover:bg-terracotta-light disabled:opacity-50 text-white text-sm font-serif font-semibold rounded-lg transition-colors duration-150 shadow-sm"
              >
                {savingKey === "test" ? <Spinner className="h-4 w-4" /> : null}
                Test
              </button>
            </div>

            {testResponse && testResponse.result && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-4 space-y-3">
                <div>
                  <p className="text-[11px] font-mono tracking-wider uppercase text-green-800/70 mb-1.5">
                    Resolved Register
                  </p>
                  <p className="font-serif text-lg font-semibold text-green-900">
                    {testResponse.result.register}
                  </p>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-mono tracking-wider uppercase text-green-800/70 mb-1.5">
                      Directive
                    </p>
                    <p className="text-sm text-green-900">{testResponse.result.directive}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-mono tracking-wider uppercase text-green-800/70 mb-1.5">
                      Resolution Pass
                    </p>
                    <p className="text-sm text-green-900">Matched on pass {testResponse.result.pass}.</p>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-mono tracking-wider uppercase text-green-800/70 mb-1.5">
                    Injected Line
                  </p>
                  <div className="rounded-lg border border-green-200 bg-white/70 px-3 py-3 text-sm font-mono text-green-900">
                    {testResponse.result.line}
                  </div>
                </div>
                {testResponse.reason && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                    {testResponse.reason}
                  </div>
                )}
              </div>
            )}

            {testResponse && !testResponse.result && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
                <p className="font-semibold text-red-900">No mood would be injected.</p>
                <p className="mt-1">{testResponse.reason || "No register matches this combination."}</p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
