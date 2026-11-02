"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminDialog, AdminField, AdminNotice } from "@/components/admin/AdminUI";
import { formatDateTime } from "@/lib/date-utils";
import type { FocusExperiment, FocusSummary } from "@/lib/in-focus";
import { workshopRequest } from "./client";
import "./workshop.css";

export default function InFocusPage() {
  const router = useRouter();
  const [items, setItems] = useState<FocusSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [createError, setCreateError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setItems((await workshopRequest<{ experiments: FocusSummary[] }>("/api/admin/in-focus")).experiments); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not load experiments."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function create(event: React.FormEvent) {
    event.preventDefault(); setCreating(true); setCreateError("");
    try {
      const result = await workshopRequest<{ experiment: FocusExperiment }>("/api/admin/in-focus", "POST", { title });
      router.push(`/admin/in-focus/${result.experiment.id}`);
    } catch (err) { setCreateError(err instanceof Error ? err.message : "Could not create the experiment."); setCreating(false); }
  }
  const visible = items.filter((item) => item.archived === archived && `${item.title} ${item.question}`.toLowerCase().includes(search.toLowerCase()));
  return <div>
    <header className="admin-page-header">
      <div><h1>In Focus Workshop</h1><p>Research a story. Test a question. Put a philosophical argument to the test.</p></div>
      <button className="admin-button admin-button-primary" onClick={() => { setOpen(true); setTitle(""); setCreateError(""); }}>New experiment</button>
    </header>
    <div className="focus-private-note">Private workspace · Experiments and their alternatives are visible only to admins.</div>
    {error && <AdminNotice error>{error} <button className="admin-button" onClick={() => void load()}>Retry</button></AdminNotice>}
    <div className="admin-toolbar">
      <div className="admin-field flex-1"><AdminField label="Search experiments"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Story or question…" /></AdminField></div>
      <div className="admin-field"><AdminField label="Show"><select value={archived ? "archived" : "active"} onChange={(e) => setArchived(e.target.value === "archived")}><option value="active">Active experiments</option><option value="archived">Archived experiments</option></select></AdminField></div>
      <span className="text-ink-lighter text-sm">{visible.length} experiment{visible.length === 1 ? "" : "s"}</span>
    </div>
    <div className="admin-panel">
      {loading ? <p className="admin-empty" role="status">Loading experiments…</p> : visible.length ? <table className="w-full">
        <thead><tr><th>Experiment</th><th>Alternatives</th><th>Last saved</th><th><span className="sr-only">Open</span></th></tr></thead>
        <tbody>{visible.map((item) => <tr key={item.id}>
          <td><Link className="admin-post-title" href={`/admin/in-focus/${item.id}`}>{item.title}</Link><p className="admin-post-excerpt">{item.question || "Question not chosen yet"}</p></td>
          <td>{item.versionCount}</td><td>{formatDateTime(item.updatedAt)}</td>
          <td><Link className="admin-button" href={`/admin/in-focus/${item.id}`}>Open workshop →</Link></td>
        </tr>)}</tbody>
      </table> : <div className="admin-empty"><h2>{search ? "No matching experiments" : archived ? "No archived experiments" : "Start with a story you want to understand"}</h2><p className="mt-2">{search || archived ? "Try changing the search or filter." : "Bring your source material, shape a briefing, and explore it with the philosophers."}</p>{!search && !archived && <button className="admin-button admin-button-primary mt-5" onClick={() => setOpen(true)}>Create your first experiment</button>}</div>}
    </div>
    <AdminDialog open={open} title="New In Focus experiment" busy={creating} onClose={() => setOpen(false)}>
      <form onSubmit={create} className="grid gap-4">
        <p className="text-ink-lighter">A working title is enough to begin. You can add sources and refine the question inside.</p>
        {createError && <AdminNotice error>{createError}</AdminNotice>}
        <div className="admin-field"><AdminField label="Working title"><input data-autofocus required maxLength={200} value={title} disabled={creating} onChange={(e) => setTitle(e.target.value)} placeholder="For example: Romania’s government crisis" /></AdminField></div>
        <div className="flex justify-end gap-2"><button type="button" className="admin-button" disabled={creating} onClick={() => setOpen(false)}>Cancel</button><button className="admin-button admin-button-primary" disabled={creating || !title.trim()}>{creating ? "Creating…" : "Create experiment"}</button></div>
      </form>
    </AdminDialog>
  </div>;
}
