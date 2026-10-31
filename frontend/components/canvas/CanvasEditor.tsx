"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Dialog from "@/components/app/Dialog";
import { Button, IconButton, Spinner, TimeAgo } from "@/components/app/ui";
import { useUnsavedChanges } from "@/components/app/UnsavedChanges";
import { api, errorMessage } from "@/lib/client-api";
import { SECTION_KINDS, type CanvasContent, type CanvasSection, type SectionKind } from "@/lib/canvas/merge";
import { transposeKey, transposeText } from "@/lib/canvas/chords";
import { revisionsQuery, useCanvasProject, useDeleteCanvas } from "@/lib/queries/canvases";
import { riffsQuery } from "@/lib/queries/riffs";
import { setlistsQuery } from "@/lib/queries/setlists";
import { SONG_KEYS } from "@/lib/setlists";
import type { CanvasView } from "@/lib/canvas/service";
import { conversationsQuery } from "@/lib/queries/conversations";
import ChordChart from "@/components/canvas/ChordChart";
import PublishDialog from "@/components/social/PublishDialog";
import TakePlayer from "@/components/riffs/TakePlayer";
import { useCanvasDraft } from "@/components/canvas/useCanvasDraft";

const KIND_LABEL: Record<SectionKind, string> = { intro: "Intro", verse: "Verse", "pre-chorus": "Pre-chorus", chorus: "Chorus", bridge: "Bridge", solo: "Solo", breakdown: "Breakdown", outro: "Outro", other: "Other" };
const STATUS: Record<string, string> = { saved: "Saved", saving: "Saving…", unsaved: "Unsaved", offline: "Offline · retrying", error: "Not saved" };
const input = "panel-inset h-10 w-full rounded-lg px-3 font-body text-sm outline-none";
let n = 0;
const sectionId = () => `s${Date.now().toString(36)}${(n++).toString(36)}`;

export default function CanvasEditor({ userId, initial }: { userId: string; initial: CanvasView }) {
  const router = useRouter();
  const { canvas, draft, setDraft, status, notices, dismissNotices, flush, dirty } = useCanvasDraft(userId, initial);
  useUnsavedChanges({ dirty, label: "this song", save: flush });
  const [mode, setMode] = useState<"write" | "chart">("write");
  const [transpose, setTranspose] = useState(0);
  const [dialog, setDialog] = useState<"revisions" | "setlist" | "share" | "publish" | null>(null);
  const riffs = useQuery(riffsQuery(userId));
  const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setSection = (id: string, patch: Partial<CanvasSection>) => setDraft((d) => ({ ...d, sections: d.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const nameOf = (id: string) => draft.sections.find((s) => s.id === id)?.name ?? "?";

  function addSection(kind: SectionKind) {
    const count = draft.sections.filter((s) => s.kind === kind).length + 1;
    const s: CanvasSection = { id: sectionId(), kind, name: kind === "verse" ? `Verse ${count}` : `${KIND_LABEL[kind]}${count > 1 ? ` ${count}` : ""}`, lyrics: "" };
    setDraft((d) => ({ ...d, sections: [...d.sections, s], arrangement: [...d.arrangement, s.id] }));
  }
  function removeSection(id: string) {
    setDraft((d) => ({ ...d, sections: d.sections.filter((s) => s.id !== id), arrangement: d.arrangement.filter((x) => x !== id) }));
  }
  const moveArr = (i: number, d: number) => {
    const a = [...draft.arrangement];
    const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    set({ arrangement: a });
  };
  // Applying a transposition rewrites every chord and the key; it's an ordinary edit (undoable through revisions).
  const applyTranspose = () => {
    setDraft((d) => ({ ...d, key: transposeKey(d.key, transpose), sections: d.sections.map((s) => ({ ...s, lyrics: transposeText(s.lyrics, transpose) })) }));
    setTranspose(0);
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start gap-3">
        <label className="min-w-0 flex-1"><span className="sr-only">Song title</span><input value={draft.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} className="w-full bg-transparent font-display text-display-sm font-semibold tracking-tight outline-none focus:underline" /></label>
        <span role="status" aria-live="polite" className={`mt-3 font-mono text-[10px] uppercase tracking-[0.14em] ${status === "saved" ? "text-muted" : status === "error" || status === "offline" ? "text-danger" : "text-amber"}`}>{STATUS[status]}</span>
      </header>
      <p className="-mt-3 font-body text-sm text-muted">
        {canvas.project ? <>In <Link href={`/messages/${canvas.project.id}`} className="text-copper hover:underline">{canvas.project.title ?? "a project"}</Link>: everyone in it can edit.</> : "Private to you."}
        {canvas.updatedBy && <> Last saved by @{canvas.updatedBy.handle} <TimeAgo iso={canvas.updatedAt} />.</>}
      </p>
      {notices.length > 0 && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber/40 bg-amber/10 p-3 font-body text-sm">
          <ul className="flex-1 space-y-1">{notices.map((m, i) => <li key={i}>{m}</li>)}</ul>
          <IconButton icon="close" label="Dismiss" onClick={dismissNotices} size={30} />
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="w-28"><span className="label-engraved">Key</span><select value={draft.key ?? ""} onChange={(e) => set({ key: e.target.value || null })} className={`${input} mt-1`}><option value="">—</option>{SONG_KEYS.map((k) => <option key={k}>{k}</option>)}</select></label>
        <label className="w-24"><span className="label-engraved">BPM</span><input type="number" min={20} max={300} value={draft.bpm ?? ""} onChange={(e) => set({ bpm: e.target.value ? Number(e.target.value) : null })} className={`${input} mt-1`} /></label>
        <div role="radiogroup" aria-label="View" className="flex overflow-hidden rounded-full border border-line-strong">
          {(["write", "chart"] as const).map((m) => <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`focus-ring h-10 px-4 font-body text-sm ${mode === m ? "bg-surface-3 text-ink" : "text-muted hover:text-ink"}`}>{m === "write" ? "Write" : "Chart"}</button>)}
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Transpose">
          <IconButton icon="chevron-down" label="Transpose down a semitone" onClick={() => setTranspose((t) => t - 1)} size={36} />
          <span className="w-24 text-center font-mono text-xs" aria-live="polite">{transpose ? `${transpose > 0 ? "+" : ""}${transpose} → ${transposeKey(draft.key, transpose) ?? "?"}` : "Transpose"}</span>
          <IconButton icon="arrow-up" label="Transpose up a semitone" onClick={() => setTranspose((t) => t + 1)} size={36} />
          {transpose !== 0 && <Button size="sm" variant="ghost" onClick={applyTranspose}>Apply</Button>}
        </div>
        <span className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" icon="clock" onClick={() => setDialog("revisions")}>Revisions</Button>
          <Button size="sm" icon="signal-chain" onClick={() => setDialog("setlist")}>Add to a setlist</Button>
          {canvas.isOwner && <Button size="sm" icon="users" onClick={() => setDialog("share")}>{canvas.project ? "Project" : "Write together"}</Button>}
          {canvas.isOwner && <Button size="sm" variant="primary" icon="share" disabled={dirty} title={dirty ? "Wait for your changes to save" : undefined} onClick={() => setDialog("publish")}>Publish</Button>}
        </span>
      </div>

      <section aria-label="Arrangement" className="rounded-xl border border-line p-3">
        <h2 className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Arrangement · the order it&apos;s played</h2>
        <ol className="flex flex-wrap items-center gap-1.5">
          {draft.arrangement.map((id, i) => (
            <li key={`${id}-${i}`} className="flex items-center gap-0.5 rounded-full border border-line bg-surface/60 py-0.5 pl-3 pr-1 font-body text-sm">
              {nameOf(id)}
              <IconButton icon="chevron-left" label={`Move ${nameOf(id)} earlier`} onClick={() => moveArr(i, -1)} size={26} />
              <IconButton icon="chevron-right" label={`Move ${nameOf(id)} later`} onClick={() => moveArr(i, 1)} size={26} />
              <IconButton icon="close" label={`Take this ${nameOf(id)} out of the arrangement`} onClick={() => set({ arrangement: draft.arrangement.filter((_, k) => k !== i) })} size={26} />
            </li>
          ))}
          <li>
            <label><span className="sr-only">Play a section again</span>
              <select value="" onChange={(e) => e.target.value && set({ arrangement: [...draft.arrangement, e.target.value] })} className="panel-inset h-8 rounded-full px-3 font-body text-xs">
                <option value="">+ Add a section to the order…</option>
                {draft.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          </li>
        </ol>
      </section>

      {mode === "chart" ? (
        <div className="panel p-5"><ChordChart content={draft} transpose={transpose} /></div>
      ) : (
        <>
          <p className="font-body text-xs text-muted">Put chords in square brackets right before the word they land on: <code className="font-mono text-ink-dim">[Am]Hold the [F]line</code>. Saves as you type.</p>
          <ol className="space-y-3">
            {draft.sections.map((s) => {
              const riff = s.riffId ? canvas.riffs[s.riffId] ?? null : null;
              return (
                <li key={s.id} className="space-y-2 rounded-xl border border-line bg-surface/40 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="w-36"><span className="sr-only">Section type</span><select value={s.kind} onChange={(e) => setSection(s.id, { kind: e.target.value as SectionKind })} className={input}>{SECTION_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></label>
                    <label className="min-w-0 flex-1"><span className="sr-only">Section name</span><input value={s.name} onChange={(e) => setSection(s.id, { name: e.target.value })} maxLength={60} className={input} /></label>
                    <label className="w-24"><span className="sr-only">Bars</span><input type="number" min={1} max={256} placeholder="Bars" value={s.bars ?? ""} onChange={(e) => setSection(s.id, { bars: e.target.value ? Number(e.target.value) : undefined })} className={input} /></label>
                    <IconButton icon="trash" label={`Delete ${s.name}`} onClick={() => removeSection(s.id)} size={34} />
                  </div>
                  <label className="block"><span className="sr-only">Lyrics and chords for {s.name}</span>
                    <textarea value={s.lyrics} onChange={(e) => setSection(s.id, { lyrics: e.target.value })} rows={Math.max(3, s.lyrics.split("\n").length + 1)} maxLength={6000} placeholder="[G]Words and [D]chords…" className="panel-inset w-full rounded-lg p-3 font-mono text-sm leading-relaxed outline-none" />
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="min-w-[12rem] flex-1"><span className="sr-only">Notes</span><input value={s.notes ?? ""} onChange={(e) => setSection(s.id, { notes: e.target.value || undefined })} maxLength={1000} placeholder="Notes: feel, dynamics, who plays what" className={input} /></label>
                    <label className="min-w-[12rem]"><span className="sr-only">Riff for {s.name}</span>
                      <select value={s.riffId ?? ""} onChange={(e) => setSection(s.id, { riffId: e.target.value || undefined })} className={input}>
                        <option value="">No riff</option>
                        {s.riffId && !riffs.data?.some((r) => r.id === s.riffId) && <option value={s.riffId}>{riff?.title ?? "Linked riff"}</option>}
                        {riffs.data?.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                      </select>
                    </label>
                  </div>
                  {riff?.take && <div className="flex items-center gap-2"><TakePlayer take={riff.take} title={riff.title} /><Link href={`/riffs/${riff.id}`} className="font-body text-xs text-copper hover:underline">Open riff</Link></div>}
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap gap-1.5">
            {(["verse", "chorus", "pre-chorus", "bridge", "intro", "outro", "solo"] as const).map((k) => <Button key={k} size="sm" icon="plus" onClick={() => addSection(k)} disabled={draft.sections.length >= 40}>{KIND_LABEL[k]}</Button>)}
          </div>
        </>
      )}

      {dialog === "publish" && (
        <PublishDialog
          open
          onClose={() => setDialog(null)}
          userId={userId}
          title={canvas.title}
          projectId={canvas.project?.id ?? null}
          source={{ canvasId: canvas.id, takes: Object.values(canvas.riffs).flatMap((r) => (r.take ? [{ id: r.take.id, label: `${r.title}${r.take.label ? ` · ${r.take.label}` : ""}` }] : [])) }}
        />
      )}
      <Dialog open={dialog === "revisions"} title="Revisions" onClose={() => setDialog(null)} wide>
        {dialog === "revisions" && <Revisions userId={userId} id={canvas.id} onRestore={(c) => { setDraft(c); setDialog(null); }} />}
      </Dialog>
      <Dialog open={dialog === "setlist"} title="Add to a setlist" onClose={() => setDialog(null)}>
        {dialog === "setlist" && <AddToSetlist userId={userId} canvas={{ ...canvas, ...draft }} onDone={() => setDialog(null)} />}
      </Dialog>
      <Dialog open={dialog === "share"} title="Write together" onClose={() => setDialog(null)}>
        {dialog === "share" && <ShareCanvas userId={userId} canvas={canvas} onDeleted={() => router.push("/write")} />}
      </Dialog>
    </div>
  );
}

function Revisions({ userId, id, onRestore }: { userId: string; id: string; onRestore: (c: CanvasContent) => void }) {
  const list = useQuery(revisionsQuery(userId, id));
  const [open, setOpen] = useState<string | null>(null);
  if (list.isPending) return <Spinner />;
  if (list.isError) return <p role="alert" className="font-body text-sm text-danger">{errorMessage(list.error)}</p>;
  return (
    <ol className="space-y-2">
      {list.data.map((r, i) => (
        <li key={r.id} className="rounded-xl border border-line p-3">
          <div className="flex flex-wrap items-center gap-2 font-body text-sm">
            <span className="font-medium">{i === 0 ? "Current" : <TimeAgo iso={r.createdAt} />}</span>
            <span className="text-muted">{r.author ? `@${r.author.handle}` : ""} · {r.content.sections.length} sections</span>
            <span className="ml-auto flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? "Hide" : "View"}</Button>
              {i > 0 && <Button size="sm" onClick={() => onRestore(r.content)}>Restore</Button>}
            </span>
          </div>
          {open === r.id && <div className="mt-3 max-h-80 overflow-y-auto rounded-lg bg-bg-0 p-3"><ChordChart content={r.content} /></div>}
        </li>
      ))}
      <p className="font-body text-xs text-muted">Restoring brings that version back into the editor and saves it as a new revision; nothing is deleted.</p>
    </ol>
  );
}

function AddToSetlist({ userId, canvas, onDone }: { userId: string; canvas: CanvasView; onDone: () => void }) {
  const lists = useQuery(setlistsQuery(userId));
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function add(id: string) {
    setBusy(true);
    try {
      const { setlist } = await api<{ setlist: { items: Record<string, unknown>[] } }>(`/api/setlists/${id}`);
      const items = setlist.items.map(({ tone: _t, chart: _c, ...song }) => song);
      const song = { id: sectionId(), title: canvas.title, ...(canvas.key && { key: canvas.key }), ...(canvas.bpm && { bpm: canvas.bpm }), canvasId: canvas.id };
      await api(`/api/setlists/${id}`, { method: "PATCH", body: { items: [...items, song] } });
      setMsg("Added. Gig Mode shows its chords and lyrics on stage.");
    } catch (err) {
      setMsg(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  if (lists.isPending) return <Spinner />;
  return (
    <div className="space-y-3">
      {lists.data?.length ? (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {lists.data.map((s) => <li key={s.id} className="flex items-center gap-3 px-3 py-2"><span className="min-w-0 flex-1 truncate font-body text-sm">{s.name}</span><Button size="sm" disabled={busy} onClick={() => add(s.id)}>Add</Button></li>)}
        </ul>
      ) : <p className="font-body text-sm text-muted">No setlists yet. <Link href="/gigs" className="text-copper hover:underline">Create one in Gig Mode</Link>.</p>}
      {msg && <p role="status" className="font-body text-sm">{msg}</p>}
      <Button variant="ghost" onClick={onDone}>Done</Button>
    </div>
  );
}

function ShareCanvas({ userId, canvas, onDeleted }: { userId: string; canvas: CanvasView; onDeleted: () => void }) {
  const projects = useQuery(conversationsQuery(userId, "PROJECT"));
  const move = useCanvasProject(userId, canvas.id);
  const remove = useDeleteCanvas(userId);
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="space-y-4">
      <p className="font-body text-sm text-muted">Put the song in one of your projects and everyone in it can edit it with you; changes save as you type and merge if you both edit at once.</p>
      <label className="block"><span className="label-engraved">Project</span>
        <select value={canvas.project?.id ?? ""} disabled={move.isPending} onChange={(e) => move.mutate(e.target.value || null)} className={`${input} mt-2`}>
          <option value="">Private (just you)</option>
          {projects.data?.map((p) => <option key={p.id} value={p.id}>{p.title ?? "Untitled project"}</option>)}
        </select>
      </label>
      {move.error && <p role="alert" className="font-body text-sm text-danger">{errorMessage(move.error)}</p>}
      {!projects.isPending && !projects.data?.length && <p className="font-body text-xs text-muted">No projects yet. Start one from a riff in the <Link href="/riffs" className="text-copper hover:underline">Riff Vault</Link>, or accept a collaboration invite.</p>}
      <div className="border-t border-line pt-3">
        {confirming ? (
          <span className="flex flex-wrap items-center gap-2 font-body text-sm">Delete the song and its revisions? <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Keep it</Button><Button size="sm" onClick={() => remove.mutate(canvas.id, { onSuccess: onDeleted })}>Delete</Button></span>
        ) : <Button size="sm" variant="ghost" icon="trash" onClick={() => setConfirming(true)}>Delete song</Button>}
      </div>
    </div>
  );
}

