"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Spinner, TimeAgo } from "@/components/app/ui";
import { DnaStrand } from "@/components/tone/ToneDnaPanel";
import { errorMessage } from "@/lib/client-api";
import { useRestoreVersion, useVersionNote, versionsQuery } from "@/lib/queries/tone-versions";
import { diffPatches } from "@/lib/tone-diff";
import type { ToneVersionView } from "@/lib/tone-versions";
import type { ToneView } from "@/lib/tones";

const KIND: Record<ToneVersionView["kind"], string> = { BASELINE: "Before history", CREATED: "Created", SAVED: "Saved", RESTORED: "Restored" };

/**
 * A tone's version history: what changed each time, notes, any two versions
 * compared, and restore (which saves the old settings as a new version).
 * `onHear` (the Amp Studio) loads a version into compare slot B.
 */
export default function ToneHistory({ userId, toneId, onRestored, onHear, dirty = false }: { userId: string; toneId: string; onRestored?: (tone: ToneView) => void; onHear?: (v: ToneVersionView) => void; dirty?: boolean }) {
  const router = useRouter();
  const list = useQuery(versionsQuery(userId, toneId));
  const restore = useRestoreVersion(userId, toneId);
  const note = useVersionNote(userId, toneId);
  const [picked, setPicked] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  if (list.isPending) return <Spinner />;
  if (list.isError) return <div className="flex items-center gap-3"><p role="alert" className="font-body text-sm text-danger">{errorMessage(list.error)}</p><Button size="sm" onClick={() => list.refetch()}>Retry</Button></div>;
  const versions = list.data;
  const [older, newer] = picked.map((id) => versions.find((v) => v.id === id)!).filter(Boolean).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p.slice(-1), id]));

  return (
    <div className="space-y-4">
      {older && newer && (
        <div className="space-y-3 rounded-xl border border-copper/30 bg-copper/5 p-4">
          <p className="font-body text-sm"><span className="text-muted">From</span> <TimeAgo iso={older.createdAt} /> <span className="text-muted">to</span> <TimeAgo iso={newer.createdAt} /></p>
          {(() => {
            const changes = diffPatches(older.patch, newer.patch);
            return changes.length ? <ul className="flex flex-wrap gap-1.5">{changes.map((c) => <li key={c} className="rounded-full border border-line px-2.5 py-1 font-mono text-xs">{c}</li>)}</ul> : <p className="font-body text-sm text-muted">The settings are the same.</p>;
          })()}
          <div><p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Tone DNA · bar = newer, line = older</p><DnaStrand dna={newer.dna} compare={older.dna} size="sm" /></div>
        </div>
      )}
      {dirty && <p className="font-body text-xs text-amber">You have unsaved changes. Save or revert them before restoring an old version.</p>}
      {versions.length <= 1 && <p className="font-body text-sm text-muted">History starts here. Each time you save a change, the previous settings stay available.</p>}
      <ol className="divide-y divide-line rounded-xl border border-line">
        {versions.map((v, i) => (
          <li key={v.id} className="space-y-2 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 font-body text-sm">
                <input type="checkbox" checked={picked.includes(v.id)} onChange={() => toggle(v.id)} className="accent-copper" aria-label={`Compare the version from ${new Date(v.createdAt).toLocaleString()}`} />
                <span className="font-medium">{i === 0 ? "Current" : <TimeAgo iso={v.createdAt} />}</span>
              </label>
              <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{KIND[v.kind]}</span>
              <span className="ml-auto flex gap-1.5">
                {onHear && i > 0 && <Button size="sm" variant="ghost" onClick={() => onHear(v)}>Hear in B</Button>}
                {i > 0 && <Button size="sm" disabled={restore.isPending || dirty} title={dirty ? "Save or revert your changes first" : undefined} onClick={() => restore.mutate(v.id, { onSuccess: onRestored ?? (() => router.refresh()) })}>Restore</Button>}
              </span>
            </div>
            {v.changes.length > 0 && <p className="font-body text-xs text-muted">{v.changes.slice(0, 6).join(" · ")}{v.changes.length > 6 ? ` · and ${v.changes.length - 6} more` : ""}</p>}
            {editing === v.id ? (
              <form onSubmit={(e) => { e.preventDefault(); const t = new FormData(e.currentTarget).get("note"); note.mutate({ versionId: v.id, note: typeof t === "string" ? t.trim() || null : null }); setEditing(null); }} className="flex gap-2">
                <input name="note" defaultValue={v.note ?? ""} maxLength={200} autoFocus aria-label="Revision note" className="panel-inset h-9 min-w-0 flex-1 rounded-lg px-3 font-body text-sm outline-none" />
                <Button size="sm" type="submit" variant="primary">Save note</Button>
              </form>
            ) : (
              <button type="button" onClick={() => setEditing(v.id)} className="focus-ring rounded text-left font-body text-sm text-ink-dim hover:text-ink">{v.note ?? <span className="text-muted">Add a note</span>}</button>
            )}
          </li>
        ))}
      </ol>
      {restore.error && <p role="alert" className="font-body text-sm text-danger">{errorMessage(restore.error)}</p>}
      {restore.isSuccess && !onRestored && <p role="status" className="font-body text-sm text-signal">Restored. The version you replaced is still in the history.</p>}
      {!onHear && <p className="font-body text-xs text-muted">To hear an old version against the current one, open the tone in the <Link href={`/studio?tone=${toneId}`} className="text-copper hover:underline">Amp Studio</Link> and use History there.</p>}
    </div>
  );
}
