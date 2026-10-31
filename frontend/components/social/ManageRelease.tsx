"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Dialog from "@/components/app/Dialog";
import { Button, IconButton, Spinner, TimeAgo } from "@/components/app/ui";
import { api, errorMessage } from "@/lib/client-api";
import type { Release } from "@/lib/publishing";

type Data = { release: Release; candidates: { id: string; label: string }[]; revisions: { id: string; note: string | null; createdAt: string; mixes: string[] }[] };
type Row = { takeId: string; mix: string };

/** The author's controls for a published release: which mixes it carries, in what order, refreshed lyrics, and earlier versions. */
export default function ManageRelease({ postId, open, onClose }: { postId: string; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const client = useQueryClient();
  const key = ["posts", postId, "release-admin"];
  const q = useQuery({ queryKey: key, queryFn: ({ signal }) => api<Data>(`/api/posts/${postId}/release`, { signal }), enabled: open });
  const [rows, setRows] = useState<Row[] | null>(null);
  const [refresh, setRefresh] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = rows ?? q.data?.release.takes.map((t) => ({ takeId: t.id, mix: t.mix ?? "Main" })) ?? [];
  const labelOf = (id: string) => q.data?.candidates.find((c) => c.id === id)?.label ?? q.data?.release.takes.find((t) => t.id === id)?.label ?? "Take";
  const move = (i: number, d: number) => { const r = [...list]; [r[i], r[i + d]] = [r[i + d], r[i]]; setRows(r); };

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await client.invalidateQueries({ queryKey: key });
      setRows(null);
      setNote("");
      setRefresh(false);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} title="Manage release" onClose={onClose} wide>
      {q.isPending ? <Spinner /> : q.isError ? <p role="alert" className="text-danger">{errorMessage(q.error)}</p> : (
        <div className="space-y-5">
          <fieldset className="space-y-2">
            <legend className="label-engraved">Mixes · the first one plays by default</legend>
            {list.map((r, i) => (
              <div key={r.takeId} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-2">
                <label className="w-36"><span className="sr-only">Mix name</span><input value={r.mix} onChange={(e) => setRows(list.map((x, k) => (k === i ? { ...x, mix: e.target.value } : x)))} maxLength={40} className="panel-inset h-9 w-full rounded-lg px-2 font-body text-sm outline-none" /></label>
                <span className="min-w-0 flex-1 truncate font-body text-sm text-muted">{labelOf(r.takeId)}</span>
                <IconButton icon="arrow-up" label={`Move ${r.mix} up`} onClick={() => move(i, -1)} size={32} disabled={i === 0} />
                <IconButton icon="arrow-down" label={`Move ${r.mix} down`} onClick={() => move(i, 1)} size={32} disabled={i === list.length - 1} />
                <IconButton icon="close" label={`Remove ${r.mix}`} onClick={() => setRows(list.filter((_, k) => k !== i))} size={32} />
              </div>
            ))}
            {list.length < 6 && (
              <label className="block"><span className="sr-only">Add a take</span>
                <select value="" onChange={(e) => e.target.value && setRows([...list, { takeId: e.target.value, mix: list.length ? "Alternate" : "Main" }])} className="panel-inset h-10 w-full rounded-lg px-2 font-body text-sm">
                  <option value="">+ Add a take as another mix…</option>
                  {q.data.candidates.filter((c) => !list.some((r) => r.takeId === c.id)).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </label>
            )}
          </fieldset>
          {q.data.release.canvasId && <label className="flex items-center gap-2 font-body text-sm"><input type="checkbox" checked={refresh} onChange={(e) => setRefresh(e.target.checked)} className="accent-copper" /> Update the lyrics and chords from the song as it is now</label>}
          <label className="block"><span className="label-engraved">What changed (optional)</span><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Added the acoustic version" className="panel-inset mt-2 h-10 w-full rounded-lg px-3 font-body text-sm outline-none" /></label>
          {error && <p role="alert" className="font-body text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button onClick={onClose}>Close</Button>
            <Button variant="primary" disabled={busy || (!rows && !refresh)} onClick={() => run(() => api(`/api/posts/${postId}/release`, { method: "PATCH", body: { takes: list, refreshChart: refresh, note } }))}>{busy ? "Saving…" : "Save changes"}</Button>
          </div>
          {q.data.revisions.length > 0 && (
            <section aria-label="Earlier versions" className="space-y-2 border-t border-line pt-4">
              <h3 className="label-engraved">Earlier versions</h3>
              <ol className="space-y-1.5">
                {q.data.revisions.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 font-body text-sm">
                    <TimeAgo iso={r.createdAt} />
                    <span className="min-w-0 flex-1 truncate text-muted">{r.mixes.join(", ") || "No recording"}{r.note ? ` · ${r.note}` : ""}</span>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => api(`/api/posts/${postId}/release/revisions/${r.id}`, { method: "POST" }))}>Restore</Button>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}
    </Dialog>
  );
}
