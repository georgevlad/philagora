"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminField, AdminNotice, useAdminConfirm, useUnsavedChanges } from "@/components/admin/AdminUI";
import { formatDateTime } from "@/lib/date-utils";
import { FOCUS_KINDS, FOCUS_LABELS, focusVersionIsStale, selectedFocusVersion,
  type FocusExperiment, type FocusKind, type FocusPhilosopher, type FocusState, type FocusVersion } from "@/lib/in-focus";
import { workshopRequest } from "./client";
import { FocusInspector, FocusOutput, FocusSources, FocusVersionPanel } from "./FocusPanels";
import { FocusArticle } from "@/components/in-focus/FocusArticle";
import { focusEditionPath, type FocusEdition } from "@/lib/in-focus-publication";
import "./workshop.css";

type Stage = "sources" | "briefing" | "discussion" | "preview" | "history";
type Loaded = { experiment: FocusExperiment; philosophers?: FocusPhilosopher[]; publishedEdition?: FocusEdition | null };
const STAGES: [Stage, string][] = [["sources", "1. Sources"], ["briefing", "2. Briefing"], ["discussion", "3. Discussion"], ["preview", "Reading preview"], ["history", "Saved alternatives"]];

export function FocusEditor({ id }: { id: string }) {
  const [experiment, setExperiment] = useState<FocusExperiment | null>(null);
  const [draft, setDraft] = useState<FocusState | null>(null);
  const [philosophers, setPhilosophers] = useState<FocusPhilosopher[]>([]);
  const [stage, setStage] = useState<Stage>("sources");
  const [exchangeStep, setExchangeStep] = useState<"argument" | "challenge" | "reply">("argument");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [contentDirty, setContentDirty] = useState(false);
  const [editorRevision, setEditorRevision] = useState(0);
  const [inspected, setInspected] = useState<FocusVersion | null>(null);
  const [historyKind, setHistoryKind] = useState<FocusKind | "all">("all");
  const [clock, setClock] = useState(() => Date.now());
  const [questionFeedback, setQuestionFeedback] = useState("");
  const [voiceFeedback, setVoiceFeedback] = useState("");
  const [publishedEdition, setPublishedEdition] = useState<FocusEdition | null>(null);
  const [showPublished, setShowPublished] = useState(true);
  const stateDirty = !!draft && !!experiment && JSON.stringify(draft) !== JSON.stringify(experiment.state);
  const dirtyRef = useRef(false);
  useEffect(() => { dirtyRef.current = stateDirty || contentDirty; }, [stateDirty, contentDirty]);
  const confirmDiscard = useUnsavedChanges(stateDirty || contentDirty);
  const confirm = useAdminConfirm();
  const endpoint = `/api/admin/in-focus/${id}`;

  const adopt = useCallback((value: FocusExperiment) => { setExperiment(value); setDraft(value.state); }, []);
  const load = useCallback(async (poll = false) => {
    const result = await workshopRequest<Loaded>(endpoint);
    setExperiment(result.experiment);
    if (!poll || !dirtyRef.current) setDraft(result.experiment.state);
    if (result.philosophers) setPhilosophers(result.philosophers);
    if ("publishedEdition" in result) setPublishedEdition(result.publishedEdition ?? null);
  }, [endpoint]);
  useEffect(() => {
    let cancelled = false;
    workshopRequest<Loaded>(endpoint).then((result) => {
      if (cancelled) return;
      adopt(result.experiment); setPhilosophers(result.philosophers ?? []);
      setPublishedEdition(result.publishedEdition ?? null);
    }).catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the experiment."); });
    return () => { cancelled = true; };
  }, [endpoint, adopt]);
  const hasPending = experiment?.versions.some((v) => v.status === "generating") ?? false;
  useEffect(() => {
    if (!hasPending || busy) return;
    const timer = window.setInterval(() => {
      setClock(Date.now());
      void load(true).catch(() => setError("Could not check the generation result. Your edits are still here; use Reload to try again."));
    }, 5000);
    return () => window.clearInterval(timer);
  }, [hasPending, busy, load]);

  async function perform(label: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(label); setError(""); setMessage("");
    try { await action(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not complete the action. Your edits are still here."); }
    finally { setBusy(""); setClock(Date.now()); }
  }
  function update<K extends keyof FocusState>(key: K, value: FocusState[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current); setMessage("");
  }
  async function saveWorking() {
    if (!experiment || !draft) throw new Error("Wait for the experiment to load.");
    if (!stateDirty) return experiment;
    const result = await workshopRequest<Loaded>(endpoint, "PUT", { state: draft, expected_revision: experiment.revision });
    adopt(result.experiment);
    return result.experiment;
  }
  async function discardText() {
    if (!contentDirty) return true;
    return confirm({ title: "Discard unsaved text?", description: "Save this text as an alternative before leaving it, or discard the text edits. Your source and setup edits will stay here.", confirmLabel: "Discard text edits", destructive: true });
  }
  async function changeStage(next: Stage) {
    if (next === stage || !(await discardText())) return;
    setContentDirty(false); setStage(next);
  }
  function generate(kind: FocusKind, feedback = "") {
    void perform(`Generating ${FOCUS_LABELS[kind].toLowerCase()}…`, async () => {
      const saved = await saveWorking();
      const result = await workshopRequest<Loaded & { version: FocusVersion; selected: boolean }>(`${endpoint}/generate`, "POST", {
        kind, feedback, request_id: crypto.randomUUID(), expected_revision: saved.revision,
      });
      adopt(result.experiment);
      if (result.version.status === "failed") throw new Error(result.version.error || "Generation failed. You can try again.");
      setMessage(result.version.status === "generating" ? "Generation is running. Its result will appear here." : result.selected ? "New alternative saved and selected." : "Alternative saved in history. The experiment changed during generation, so your current selection was kept.");
    });
  }
  function saveText(kind: FocusKind, content: string, baseId?: string) {
    void perform("Saving alternative…", async () => {
      const saved = await saveWorking();
      const result = await workshopRequest<Loaded>(`${endpoint}/versions`, "POST", { kind, content, base_version_id: baseId, expected_revision: saved.revision });
      adopt(result.experiment); setContentDirty(false); setMessage("Edited alternative saved. The previous text is still in Saved alternatives.");
    });
  }
  async function selectVersion(version: FocusVersion) {
    if (!(await discardText())) return;
    void perform("Selecting alternative…", async () => {
      const saved = await saveWorking();
      const result = await workshopRequest<Loaded>(endpoint, "PUT", {
        state: { ...saved.state, selected: { ...saved.state.selected, [version.kind]: version.id } }, expected_revision: saved.revision,
      });
      adopt(result.experiment); setContentDirty(false); setInspected(null); setMessage("Alternative selected. Dependent contributions may need review.");
    });
  }
  async function reload() {
    if (!(await confirmDiscard())) return;
    void perform("Reloading…", async () => { await load(); setContentDirty(false); setEditorRevision((value) => value + 1); setMessage("Latest saved experiment loaded."); });
  }
  async function archive() {
    if (!experiment) return;
    if (!(await discardText())) return;
    const next = !experiment.archived;
    if (next && !(await confirm({ title: "Archive this experiment?", description: "The experiment and all its alternatives will stay saved. You can restore it from the archived list.", confirmLabel: "Archive experiment" }))) return;
    void perform(next ? "Archiving…" : "Restoring…", async () => {
      const saved = await saveWorking();
      const result = await workshopRequest<Loaded>(endpoint, "PUT", { state: saved.state, expected_revision: saved.revision, archived: next });
      adopt(result.experiment); setContentDirty(false); setEditorRevision((value) => value + 1); setMessage(next ? "Experiment archived." : "Experiment restored.");
    });
  }

  if (!experiment || !draft) return <div><Link href="/admin/in-focus" className="text-terracotta">← All experiments</Link><h1 className="mt-4">In Focus Workshop</h1>{error ? <AdminNotice error>{error} <button className="admin-button" onClick={() => void load().catch((err) => setError(err.message))}>Retry</button></AdminNotice> : <p className="admin-empty" role="status">Loading experiment…</p>}</div>;
  const view = { ...experiment, state: draft };
  const briefing = selectedFocusVersion(view, "briefing");
  const questions = selectedFocusVersion(view, "questions");
  const voices = selectedFocusVersion(view, "voices");
  const pending = experiment.versions.some((v) => v.status === "generating" && clock - Date.parse(v.createdAt) < 600000);
  const waiting = hasPending && !pending;
  const canGenerate = !busy && !pending && !experiment.archived && !contentDirty;
  const briefingReady = !!briefing && !focusVersionIsStale(draft, briefing);
  const selectedStale = FOCUS_KINDS.filter((kind) => {
    const v = selectedFocusVersion(view, kind); return !!v && focusVersionIsStale(draft, v);
  });
  const argument = selectedFocusVersion(view, "argument");
  const challenge = selectedFocusVersion(view, "challenge");
  const panel = (kind: FocusKind) => <FocusVersionPanel key={`${kind}-${draft.selected[kind] ?? "new"}-${editorRevision}`}
    experiment={view} kind={kind} busy={!!busy} pending={pending} onGenerate={generate} onSave={saveText}
    onSelect={(v) => void selectVersion(v)} onDirty={setContentDirty} onInspect={setInspected} />;

  return <div className="focus-workshop">
    <Link href="/admin/in-focus" className="focus-back">← All experiments</Link>
    <header className="admin-page-header">
      <div><div className="flex items-center gap-3"><h1>{experiment.state.title}</h1><span className="focus-private-badge">{experiment.archived ? "Archived" : "Private experiment"}</span></div><p>Saved {formatDateTime(experiment.updatedAt)} · {experiment.versions.filter((v) => v.status === "complete").length} alternatives</p></div>
      <div className="flex gap-2"><button className="admin-button" disabled={!!busy} onClick={() => void reload()}>Reload</button><button className="admin-button" disabled={!!busy || pending} onClick={() => void archive()}>{experiment.archived ? "Restore experiment" : "Archive"}</button></div>
    </header>
    {error && <AdminNotice error>{error}</AdminNotice>}
    {message && <AdminNotice>{message}</AdminNotice>}
    {busy && <AdminNotice><span className="focus-busy-dot" aria-hidden="true" />{busy} {busy.startsWith("Generating") && "This can take a minute or two. The result is saved on the server."}</AdminNotice>}
    {pending && !busy && <AdminNotice>Generation is still running. This page checks for its saved result automatically. You can leave and return.</AdminNotice>}
    {waiting && !busy && <div className="focus-warning">A previous generation may have been interrupted. You can generate again; earlier completed alternatives are safe.</div>}
    {selectedStale.length > 0 && <div className="focus-warning">Earlier context: {selectedStale.map((k) => FOCUS_LABELS[k].toLowerCase()).join(", ")}. Review these alternatives before building on them.</div>}
    {experiment.archived && <div className="focus-private-note">This experiment is archived. Restore it to make changes.</div>}
    <nav className="admin-tabs" aria-label="Workshop sections">{STAGES.map(([key, label]) => <button key={key} aria-current={stage === key ? "page" : undefined} disabled={!!busy} onClick={() => void changeStage(key)}>{label}</button>)}</nav>

    <fieldset disabled={!!busy || experiment.archived} className="focus-fieldset">
      {stage === "sources" && <div className="focus-context-grid">
        <section className="admin-panel"><header className="admin-panel-header"><h2>The story</h2></header><div className="focus-panel-body">
          <div className="admin-field"><AdminField label="Working title"><input maxLength={200} value={draft.title} onChange={(e) => update("title", e.target.value)} /></AdminField></div>
          <div className="admin-field"><AdminField label="What are you trying to understand?"><textarea rows={7} maxLength={6000} value={draft.topic} onChange={(e) => update("topic", e.target.value)} placeholder="Describe the story, the decision you want to examine, and the perspectives you want to include." /></AdminField></div>
          <div className="admin-field"><AdminField label="Briefing as of"><input type="date" value={draft.asOf} onChange={(e) => update("asOf", e.target.value)} /></AdminField><small>The date the research describes, not necessarily today.</small></div>
          <div className="focus-hint"><strong>Start with the evidence</strong><p>Bring reporting, original statements, or research notes from different perspectives. The model drafts from the text you supply. Adding a link alone does not fetch the article.</p></div>
          <button className="admin-button admin-button-primary" onClick={() => void changeStage("briefing")}>Continue to briefing →</button>
        </div></section>
        <section className="admin-panel"><header className="admin-panel-header"><div><h2>Source material</h2><p className="text-xs text-ink-lighter">{draft.sources.length} of 12 sources · Up to 20,000 characters each</p></div><button className="admin-button" disabled={draft.sources.length >= 12} onClick={() => update("sources", [...draft.sources, { id: crypto.randomUUID(), title: "", url: "", publisher: "", date: "", excerpt: "" }])}>Add source</button></header>
          <div className="focus-panel-body">{!draft.sources.length && <div className="focus-hint"><h3>No sources yet</h3><p>Add a source and paste the passages you want the briefing to use. Every source gets a reference such as [S1].</p><button className="admin-button mt-3" onClick={() => update("sources", [{ id: crypto.randomUUID(), title: "", url: "", publisher: "", date: "", excerpt: "" }])}>Add first source</button></div>}
            {draft.sources.map((s, i) => <details className="focus-source-editor" key={s.id} open={true}>
              <summary><span>[S{i + 1}] {s.title || "Untitled source"}</span><span className="text-xs text-ink-lighter">{s.excerpt.length.toLocaleString()} characters</span></summary>
              <div className="grid gap-3 pt-3">
                {([['title', 'Source title', 300], ['url', 'Source URL (optional)', 2000], ['publisher', 'Publisher or author (optional)', 160]] as const).map(([key, label, limit]) => <div className="admin-field" key={key}><AdminField label={label}><input type={key === "url" ? "url" : "text"} maxLength={limit} value={s[key]} onChange={(e) => update("sources", draft.sources.map((item) => item.id === s.id ? { ...item, [key]: e.target.value } : item))} /></AdminField></div>)}
                <div className="admin-field"><AdminField label="Source date (optional)"><input type="date" value={s.date} onChange={(e) => update("sources", draft.sources.map((item) => item.id === s.id ? { ...item, date: e.target.value } : item))} /></AdminField></div>
                <div className="admin-field"><AdminField label="Relevant excerpts or research notes"><textarea rows={7} maxLength={20000} value={s.excerpt} onChange={(e) => update("sources", draft.sources.map((item) => item.id === s.id ? { ...item, excerpt: e.target.value } : item))} placeholder="Paste the material the model should use. Attribute claims and distinguish your notes from direct quotations." /></AdminField></div>
                <button className="admin-button self-start justify-self-start" onClick={async () => {
                  if (s.excerpt && !(await confirm({ title: "Remove this source?", description: "It will be removed from the working research. Saved alternatives retain their original source material.", confirmLabel: "Remove source" }))) return;
                  update("sources", draft.sources.filter((item) => item.id !== s.id));
                }}>Remove source</button>
              </div>
            </details>)}
          </div>
        </section>
      </div>}

      {stage === "briefing" && <div className="focus-writing-grid">
        <aside className="admin-panel"><header className="admin-panel-header"><h2>Prepare shared context</h2></header><div className="focus-panel-body"><p>A short account of what happened, the background, competing accounts, and what remains uncertain.</p><p className="text-ink-lighter">Check the source references and edit the draft before building the discussion. You can also write the briefing yourself.</p><FocusSources sources={draft.sources} /><button className="admin-button" onClick={() => void changeStage("sources")}>Edit sources</button><button className="admin-button admin-button-primary" onClick={() => void changeStage("discussion")}>Continue to discussion →</button></div></aside>
        {panel("briefing")}
      </div>}

      {stage === "discussion" && <>
        <div className="focus-discussion-setup">
          <section className="admin-panel"><header className="admin-panel-header"><h2>The question</h2><button className="admin-button" disabled={!canGenerate || !briefingReady} onClick={() => generate("questions", questionFeedback)}>Suggest questions</button></header><div className="focus-panel-body">
            {!briefingReady && <p className="text-ink-lighter">Prepare a briefing using your current sources to enable suggestions.</p>}
            <div className="admin-field"><AdminField label="Question to explore"><textarea rows={3} maxLength={1200} value={draft.question} onChange={(e) => update("question", e.target.value)} placeholder="What should a citizen consider when judging this decision?" /></AdminField></div>
            <details><summary className="text-ink-lighter">Guide the question suggestions</summary><div className="admin-field mt-2"><AdminField label="Feedback for question suggestions"><textarea rows={2} maxLength={4000} value={questionFeedback} onChange={(e) => setQuestionFeedback(e.target.value)} placeholder="For example: focus on public responsibility rather than electoral tactics." /></AdminField></div></details>
            {questions?.output.questions?.map((q, i) => <div className="focus-suggestion" key={i}><strong>{q.question}</strong><p>{q.reason}</p><button className="admin-button" onClick={() => update("question", q.question)}>Use this question</button></div>)}
          </div></section>
          <section className="admin-panel"><header className="admin-panel-header"><h2>The voices</h2><button className="admin-button" disabled={!canGenerate || !briefingReady || !draft.question.trim()} onClick={() => generate("voices", voiceFeedback)}>Suggest philosophers</button></header><div className="focus-panel-body">
            {([['leadId', 'Main philosopher'], ['challengerId', 'Challenger']] as const).map(([key, label]) => <div className="admin-field" key={key}><AdminField label={label}><select value={draft[key]} onChange={(e) => update(key, e.target.value)}><option value="">Choose a philosopher</option>{philosophers.map((p) => <option key={p.id} value={p.id} disabled={!p.ready || p.id === draft[key === "leadId" ? "challengerId" : "leadId"]}>{p.name}{!p.ready ? " — needs persona prompt" : ""}</option>)}</select></AdminField></div>)}
            <details><summary className="text-ink-lighter">Guide the philosopher suggestions</summary><div className="admin-field mt-2"><AdminField label="Feedback for philosopher suggestions"><textarea rows={2} maxLength={4000} value={voiceFeedback} onChange={(e) => setVoiceFeedback(e.target.value)} placeholder="For example: find someone who would challenge the proposed standard of judgment." /></AdminField></div></details>
            {voices?.output.voices?.map((v) => <div className="focus-suggestion" key={v.philosopherId}><strong>{philosophers.find((p) => p.id === v.philosopherId)?.name || v.philosopherId}</strong><p>{v.reason}</p><div className="flex gap-2"><button className="admin-button" disabled={v.philosopherId === draft.challengerId} onClick={() => update("leadId", v.philosopherId)}>Use as main</button><button className="admin-button" disabled={v.philosopherId === draft.leadId} onClick={() => update("challengerId", v.philosopherId)}>Use as challenger</button></div></div>)}
          </div></section>
        </div>
        <nav className="admin-tabs mt-6" aria-label="Exchange steps">{(["argument", "challenge", "reply"] as const).map((kind, i) => <button key={kind} aria-current={exchangeStep === kind ? "page" : undefined} onClick={async () => { if (exchangeStep !== kind && await discardText()) { setContentDirty(false); setExchangeStep(kind); } }}>{i + 1}. {FOCUS_LABELS[kind]}{kind === "reply" ? " (optional)" : ""}</button>)}</nav>
        <div className="focus-writing-grid"><aside className="admin-panel"><header className="admin-panel-header"><h2>{exchangeStep === "argument" ? "Make the case" : exchangeStep === "challenge" ? "Test the argument" : "Answer the challenge"}</h2></header><div className="focus-panel-body"><p>{exchangeStep === "argument" ? "Develop a judgment grounded in the briefing and the philosopher’s work. The argument should explain its assumptions and what would change it." : exchangeStep === "challenge" ? "The challenger reads the selected main argument and presses on a specific weakness. Choose the main alternative you want challenged first." : "The main philosopher responds to the selected challenge, with room to concede or revise a claim."}</p>
          <p className="text-ink-lighter text-sm">{!briefingReady ? "Next: review and save the briefing against your current sources." : !draft.question ? "Next: choose a question." : !draft.leadId ? "Next: choose the main philosopher." : exchangeStep !== "argument" && !argument ? "Next: generate a main argument." : exchangeStep !== "argument" && !draft.challengerId ? "Next: choose a challenger." : exchangeStep === "reply" && !challenge ? "Next: generate a challenge." : "Ready to experiment. Add feedback to steer a new alternative."}</p>
          {exchangeStep !== "argument" && argument && <details><summary>Main argument · {argument.snapshot.philosopherName}</summary><FocusOutput version={argument} philosophers={philosophers} /></details>}
          {exchangeStep === "reply" && challenge && <details><summary>Selected challenge</summary><FocusOutput version={challenge} philosophers={philosophers} /></details>}
        </div></aside>{panel(exchangeStep)}</div>
      </>}
    </fieldset>

    {stage === "preview" && <>
      {publishedEdition && <div className="admin-panel mb-5 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{showPublished ? "Published edition" : "Working selection"}</h2><p className="text-sm text-ink-lighter">The published edition is a reviewed, shortened version. Workshop edits and new alternatives do not change it.</p></div><div className="flex flex-wrap gap-3"><button className="admin-button" onClick={() => setShowPublished(!showPublished)}>{showPublished ? "Preview working selection" : "Preview published edition"}</button><Link className="admin-button" href={focusEditionPath(publishedEdition)}>Open public page →</Link></div></div></div>}
      {publishedEdition && showPublished ? <div className="agora-design in-focus-admin-preview"><FocusArticle edition={publishedEdition} /></div> : <div className="admin-panel focus-preview"><div className="focus-private-note">{publishedEdition ? "Private working selection · Changes here do not update the published edition" : "Internal reading preview · AI interpretations of historical thinkers · Nothing is published"}</div><h2>{draft.question || draft.title}</h2><p className="text-ink-lighter mb-6">{draft.title} · Working research as of {draft.asOf}</p>
      {(["briefing", "argument", "challenge", "reply"] as const).map((kind) => {
        const v = selectedFocusVersion(view, kind);
        return <section key={kind}><h3>{FOCUS_LABELS[kind]}{v?.snapshot.philosopherName ? ` · ${v.snapshot.philosopherName}` : ""}</h3>{v ? <>{focusVersionIsStale(draft, v) && <p className="focus-warning">Earlier context · Read this contribution against its saved briefing and question.</p>}<p className="text-xs text-ink-lighter mb-3">As of {v.snapshot.asOf}{v.snapshot.question && kind !== "briefing" ? ` · ${v.snapshot.question}` : ""}</p><FocusOutput version={v} philosophers={philosophers} /><FocusSources sources={v.snapshot.sources} /></> : <p className="text-ink-lighter">{kind === "reply" ? "No reply selected. This step is optional." : "No alternative selected yet."}</p>}</section>;
      })}
    </div>}
    </>}

    {stage === "history" && <section className="admin-panel"><header className="admin-panel-header"><div><h2>Saved alternatives</h2><p className="text-sm text-ink-lighter">Inspect the original context and compare any alternative with the current selection.</p></div><div className="admin-field"><AdminField label="Filter by step"><select value={historyKind} onChange={(e) => setHistoryKind(e.target.value as FocusKind | "all")}><option value="all">All steps</option>{FOCUS_KINDS.map((kind) => <option key={kind} value={kind}>{FOCUS_LABELS[kind]}</option>)}</select></AdminField></div></header>
      {experiment.versions.length ? <table className="w-full"><thead><tr><th>Step / philosopher</th><th>Saved</th><th>State</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{experiment.versions.filter((v) => historyKind === "all" || v.kind === historyKind).map((v) => <tr key={v.id} className={draft.selected[v.kind] === v.id ? "admin-row-selected" : ""}><td><strong>{FOCUS_LABELS[v.kind]}</strong><p className="text-xs text-ink-lighter">{v.snapshot.philosopherName || "Editorial"} · {v.origin}</p></td><td>{formatDateTime(v.createdAt)}</td><td>{v.status === "complete" ? draft.selected[v.kind] === v.id ? "Selected" : "Saved" : v.status}{v.status === "complete" && focusVersionIsStale(draft, v) && <p className="text-xs text-ink-lighter">Earlier context</p>}</td><td><button className="admin-button" onClick={() => setInspected(v)}>Inspect{v.status === "complete" ? " / compare" : ""}</button></td></tr>)}</tbody></table> : <p className="admin-empty">Generated drafts and edited alternatives will appear here.</p>}
    </section>}

    <div className="admin-save-bar mt-5"><div><strong>{contentDirty ? "Unsaved text edits" : stateDirty ? "Unsaved setup changes" : "All changes saved"}</strong><p className="text-xs text-ink-lighter">{contentDirty ? "Save the text as an alternative in its editor." : "Setup changes are also saved before generating. Workshop content stays private."}</p></div><button className="admin-button admin-button-primary" disabled={!!busy || !stateDirty || experiment.archived} onClick={() => void perform("Saving experiment…", async () => { await saveWorking(); setMessage("Experiment saved."); })}>Save experiment</button></div>
    <FocusInspector version={inspected} experiment={view} philosophers={philosophers} onClose={() => setInspected(null)} onSelect={(v) => void selectVersion(v)} busy={!!busy} />
  </div>;
}
