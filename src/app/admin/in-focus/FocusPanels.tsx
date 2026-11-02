"use client";

import { useEffect, useState } from "react";
import { AdminDialog, AdminField } from "@/components/admin/AdminUI";
import { formatDateTime } from "@/lib/date-utils";
import { FOCUS_LABELS, focusVersionIsStale, selectedFocusVersion,
  type FocusExperiment, type FocusKind, type FocusPhilosopher, type FocusSource, type FocusVersion } from "@/lib/in-focus";

export function FocusText({ content, sources }: { content: string; sources: FocusSource[] }) {
  return <div className="focus-reading">{content.split(/\n\s*\n/).map((paragraph, p) => <p key={p}>
    {paragraph.split(/(\[S\d+\])/g).map((part, i) => {
      const match = /^\[S(\d+)\]$/.exec(part);
      const source = match ? sources[Number(match[1]) - 1] : undefined;
      return source?.url ? <a key={i} href={source.url} title={source.title} target="_blank" rel="noopener noreferrer">{part}</a> : part;
    })}
  </p>)}</div>;
}

export function FocusSources({ sources }: { sources: FocusSource[] }) {
  return <details className="focus-source-details"><summary>Source material ({sources.length})</summary>
    {sources.map((s, i) => <div key={s.id} className="focus-source-reference">
      <strong>[S{i + 1}] {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a> : s.title}</strong>
      <p className="text-ink-lighter text-xs">{[s.publisher, s.date].filter(Boolean).join(" · ")}</p>
      <p className="whitespace-pre-wrap mt-2">{s.excerpt || "Link only; no source text supplied."}</p>
    </div>)}
  </details>;
}

export function FocusOutput({ version, philosophers }: { version: FocusVersion; philosophers: FocusPhilosopher[] }) {
  if (version.status !== "complete") return <p className="text-ink-lighter">{version.error || "Generation in progress…"}</p>;
  return <>
    {version.output.content && <FocusText content={version.output.content} sources={version.snapshot.sources} />}
    {version.output.questions?.map((q, i) => <div key={i} className="focus-suggestion"><strong>{q.question}</strong><p>{q.reason}</p></div>)}
    {version.output.voices?.map((v) => <div key={v.philosopherId} className="focus-suggestion"><strong>{philosophers.find((p) => p.id === v.philosopherId)?.name || v.philosopherId}</strong><p>{v.reason}</p></div>)}
  </>;
}

export function FocusVersionPanel({ experiment, kind, busy, pending, onGenerate, onSave, onSelect, onDirty, onInspect }: {
  experiment: FocusExperiment; kind: FocusKind; busy: boolean; pending: boolean;
  onGenerate: (kind: FocusKind, feedback: string) => void;
  onSave: (kind: FocusKind, content: string, baseId?: string) => void;
  onSelect: (version: FocusVersion) => void;
  onDirty: (dirty: boolean) => void;
  onInspect: (version: FocusVersion) => void;
}) {
  const current = selectedFocusVersion(experiment, kind);
  const alternatives = experiment.versions.filter((v) => v.kind === kind && v.status === "complete");
  const [editing, setEditing] = useState(!current);
  const [content, setContent] = useState(current?.output.content ?? "");
  const [feedback, setFeedback] = useState("");
  const dirty = content !== (current?.output.content ?? "");
  useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [dirty, onDirty]);
  const stale = current && focusVersionIsStale(experiment.state, current);
  return <section className="admin-panel">
    <header className="admin-panel-header"><h2>{FOCUS_LABELS[kind]}</h2><span className="text-xs text-ink-lighter">{alternatives.length} saved alternative{alternatives.length === 1 ? "" : "s"}</span></header>
    <div className="focus-panel-body">
      {alternatives.length > 0 && <div className="admin-field"><AdminField label="Selected alternative"><select value={current?.id ?? ""} disabled={busy} onChange={(e) => { const v = alternatives.find((v) => v.id === e.target.value); if (v) onSelect(v); }}>
        {!current && <option value="">Choose an alternative</option>}
        {alternatives.map((v, index) => <option key={v.id} value={v.id}>Alternative {alternatives.length - index} · {v.origin === "edited" ? "Edited" : "Generated"} · {formatDateTime(v.createdAt)}{focusVersionIsStale(experiment.state, v) ? " · Earlier context" : ""}</option>)}
      </select></AdminField></div>}
      {stale && <div className="focus-warning" role="status">This alternative uses earlier context. {kind === "briefing" ? "Review the text against your current sources and save a reviewed version, or generate a new draft." : "Generate a new alternative to address the current briefing, question, or exchange."}</div>}
      {current && <div className="flex justify-between items-center gap-3"><p className="text-xs text-ink-lighter">{current.snapshot.philosopherName || "Editorial draft"} · Briefing date {current.snapshot.asOf}</p><div className="flex gap-2"><button className="admin-button" disabled={busy} onClick={() => onInspect(current)}>View context</button><button className="admin-button" disabled={busy} onClick={() => setEditing(!editing)}>{editing ? "Read" : "Edit text"}</button></div></div>}
      {editing ? <div className="admin-field"><AdminField label={kind === "briefing" ? "Briefing text" : `${FOCUS_LABELS[kind]} text`}><textarea rows={kind === "briefing" ? 16 : 14} maxLength={40000} value={content} disabled={busy || experiment.archived} onChange={(e) => setContent(e.target.value)} placeholder={kind === "briefing" ? "Generate a draft from your sources, or write a briefing here. Use [S1], [S2], etc. to refer to the sources." : "Generate an argument to begin, then edit the text here."} /></AdminField></div> : current?.output.content && <FocusText content={content} sources={current.snapshot.sources} />}
      {(dirty || (kind === "briefing" && stale)) && <div className="flex items-center justify-between gap-3"><span className="text-xs text-ink-lighter">{kind === "briefing" ? "Saving confirms this text was reviewed against the current sources." : "Edits keep the original context and preserve the previous alternative."}</span><button className="admin-button admin-button-primary" disabled={busy || experiment.archived || !content.trim() || (kind !== "briefing" && !current)} onClick={() => onSave(kind, content, current?.id)}>{kind === "briefing" ? "Save reviewed briefing" : "Save edited alternative"}</button></div>}
      <div className="focus-generation-controls">
        <div className="admin-field"><AdminField label="Editorial feedback (optional)"><textarea rows={2} maxLength={4000} value={feedback} disabled={busy || experiment.archived} onChange={(e) => setFeedback(e.target.value)} placeholder={kind === "challenge" ? "For example: test the historical analogy and its limits." : "For example: make the judgment more specific and explain what would change it."} /></AdminField></div>
        <div className="flex items-center justify-between gap-3"><p className="text-xs text-ink-lighter">{dirty ? "Save your text edits before generating another alternative." : "Each generation adds an alternative. Earlier work stays saved."}</p><button className="admin-button admin-button-primary" disabled={busy || pending || dirty || experiment.archived} onClick={() => onGenerate(kind, feedback)}>{current ? "Generate another alternative" : `Generate ${FOCUS_LABELS[kind].toLowerCase()}`}</button></div>
      </div>
    </div>
  </section>;
}

export function FocusInspector({ version, experiment, philosophers, onClose, onSelect, busy }: {
  version: FocusVersion | null; experiment: FocusExperiment; philosophers: FocusPhilosopher[];
  onClose: () => void; onSelect: (version: FocusVersion) => void; busy: boolean;
}) {
  const current = version ? selectedFocusVersion(experiment, version.kind) : undefined;
  const compare = !!current && current.id !== version?.id;
  return <AdminDialog open={!!version} wide title={version ? `${FOCUS_LABELS[version.kind]} · Saved alternative` : "Saved alternative"} onClose={onClose} busy={busy}
    footer={version && <><button className="admin-button" disabled={busy} onClick={onClose}>Close</button><button className="admin-button admin-button-primary" disabled={busy || experiment.archived || version.status !== "complete" || current?.id === version.id} onClick={() => onSelect(version)}>Use this alternative</button></>}>
    {version && <>
      <p className="text-sm text-ink-lighter mb-4">{formatDateTime(version.createdAt)} · {version.origin} · {version.snapshot.philosopherName || "Editorial"}</p>
      <div className={compare ? "focus-comparison" : ""}>
        <section><h3 className="mb-3 font-semibold">{compare ? "This alternative" : "Saved text"}</h3><FocusOutput version={version} philosophers={philosophers} /></section>
        {compare && <section><h3 className="mb-3 font-semibold">Currently selected</h3><FocusOutput version={current!} philosophers={philosophers} /></section>}
      </div>
      <details className="focus-source-details" open><summary>Context used for this alternative</summary><div className="grid gap-3 mt-3">
        <p><strong>{version.snapshot.title}</strong> · As of {version.snapshot.asOf}</p>
        {version.snapshot.topic && <p className="whitespace-pre-wrap">{version.snapshot.topic}</p>}
        {version.snapshot.question && <p><strong>Question:</strong> {version.snapshot.question}</p>}
        {version.feedback && <p className="whitespace-pre-wrap"><strong>Editorial feedback:</strong> {version.feedback}</p>}
        {(["briefing", "argument", "challenge", "previous"] as const).map((key) => version.snapshot[key] && <details key={key}><summary>{key === "previous" ? "Previous alternative" : FOCUS_LABELS[key]}{version.snapshot[key]?.philosopherName ? ` · ${version.snapshot[key]?.philosopherName}` : ""}</summary><FocusText content={version.snapshot[key]!.content} sources={version.snapshot.sources} /></details>)}
        <FocusSources sources={version.snapshot.sources} />
      </div></details>
    </>}
  </AdminDialog>;
}
