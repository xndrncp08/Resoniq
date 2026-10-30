"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { RiffStage } from "@prisma/client";
import Icon from "@/components/icons/Icon";
import { Button, IconButton } from "@/components/app/ui";
import { useUnsavedChanges } from "@/components/app/UnsavedChanges";
import { api, errorMessage } from "@/lib/client-api";
import { presetsQuery } from "@/lib/queries/studio";
import { riffQuery, useDeleteRiff, useDeleteTake, useRenameTake, useSaveRiff, useUploadTake } from "@/lib/queries/riffs";
import { SONG_KEYS } from "@/lib/setlists";
import type { RiffView } from "@/lib/riffs/service";
import Recorder from "@/components/riffs/Recorder";
import TakePlayer, { TakeCompare } from "@/components/riffs/TakePlayer";
import { STAGE_LABEL } from "@/components/riffs/RiffList";

type Draft = { title: string; notes: string; tags: string; key: string; bpm: string; stage: RiffStage; toneId: string };
const draftOf = (r: RiffView): Draft => ({ title: r.title, notes: r.notes ?? "", tags: r.tags.join(", "), key: r.key ?? "", bpm: r.bpm ? String(r.bpm) : "", stage: r.stage, toneId: r.tone?.id ?? "" });
const input = "panel-inset h-10 w-full rounded-lg px-3 font-body text-sm outline-none";

export default function RiffEditor({ userId, initial }: { userId: string; initial: RiffView }) {
  const router = useRouter();
  const record = useSearchParams().get("record") === "1";
  const riff = useQuery({ ...riffQuery(userId, initial.id), initialData: initial }).data;
  const tones = useQuery({ ...presetsQuery(userId), enabled: riff.canEdit });
  const save = useSaveRiff(userId, riff.id);
  const remove = useDeleteRiff(userId);
  const upload = useUploadTake(userId, riff.id);
  const delTake = useDeleteTake(userId, riff.id);
  const rename = useRenameTake(userId, riff.id);
  const [draft, setDraft] = useState(() => draftOf(initial));
  const [progress, setProgress] = useState<number | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const body = () => ({ title: draft.title, notes: draft.notes || null, tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean), key: draft.key || null, bpm: draft.bpm ? Number(draft.bpm) : null, stage: draft.stage, toneId: draft.toneId || null });
  const dirty = riff.canEdit && JSON.stringify(draft) !== JSON.stringify(draftOf(riff));
  // The server tidies some fields (tags become lowercase-with-dashes): adopt its version after a save.
  useUnsavedChanges({ dirty, label: "this riff", save: () => save.mutateAsync(body()).then((saved) => setDraft(draftOf(saved))) });
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const takes = [...riff.allTakes].reverse();
  const pair = compare.length === 2 ? compare.map((id) => riff.allTakes.find((t) => t.id === id)!).filter(Boolean) : [];

  async function startProject() {
    setProjectError(null);
    try {
      const { projectId } = await api<{ projectId: string }>(`/api/riffs/${riff.id}/project`, { method: "POST" });
      router.push(`/messages/${projectId}`);
    } catch (err) {
      setProjectError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start gap-3">
        {riff.canEdit ? (
          <label className="min-w-0 flex-1"><span className="sr-only">Riff name</span><input value={draft.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} className="w-full bg-transparent font-display text-display-sm font-semibold tracking-tight outline-none focus:underline" /></label>
        ) : (
          <div className="min-w-0 flex-1"><h1 className="font-display text-display-sm font-semibold">{riff.title}</h1><p className="font-body text-sm text-muted">Shared by @{riff.owner?.handle} through {riff.project ? <Link href={`/messages/${riff.project.id}`} className="text-copper hover:underline">{riff.project.title}</Link> : "a project"}. You can listen; only they can edit.</p></div>
        )}
        {riff.canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <span aria-live="polite" className={`font-mono text-[10px] uppercase tracking-[0.14em] ${dirty ? "text-amber" : "text-muted"}`}>{save.isPending ? "Saving…" : dirty ? "Unsaved" : "Saved"}</span>
            <Button variant="primary" icon="check" onClick={() => save.mutate(body(), { onSuccess: (saved) => setDraft(draftOf(saved)) })} disabled={!dirty || save.isPending || !draft.title.trim()}>Save</Button>
            <IconButton icon={riff.pinned ? "bookmark-filled" : "bookmark"} label={riff.pinned ? "Unpin" : "Pin to the top"} onClick={() => save.mutate({ pinned: !riff.pinned })} />
          </div>
        )}
      </header>
      {save.error && <p role="alert" className="font-body text-sm text-danger">{errorMessage(save.error)} Your edits are still here.</p>}

      <section aria-labelledby="takes-h" className="space-y-3">
        <h2 id="takes-h" className="font-display text-xl font-semibold">Takes <span className="font-body text-sm font-normal text-muted">{riff.allTakes.length}</span></h2>
        {riff.canEdit && (
          <>
            <Recorder
              busy={upload.isPending}
              onTake={(take) => {
                abort.current = new AbortController();
                setProgress(0);
                upload.mutate({ take: { ...take, label: riff.allTakes.length ? `Take ${riff.allTakes.length + 1}` : "First idea" }, onProgress: setProgress, signal: abort.current.signal }, { onSettled: () => setProgress(null) });
              }}
            />
            {record && riff.allTakes.length === 0 && !upload.isPending && <p className="font-body text-xs text-muted">New riff: press Record and play the idea.</p>}
            {progress !== null && (
              <div className="flex items-center gap-3 font-body text-sm" role="status">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-0 ring-1 ring-line"><span className="block h-full bg-signal transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} /></span>
                Uploading {Math.round(progress * 100)}%
                <Button size="sm" variant="ghost" onClick={() => abort.current?.abort()}>Cancel</Button>
              </div>
            )}
            {upload.error && !(upload.error instanceof DOMException) && <p role="alert" className="font-body text-sm text-danger">{errorMessage(upload.error)}</p>}
          </>
        )}
        {pair.length === 2 && <TakeCompare a={pair[0]} b={pair[1]} />}
        {takes.length === 0 ? (
          <p className="font-body text-sm text-muted">No takes yet.</p>
        ) : (
          <ol className="space-y-2">
            {takes.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface/40 p-3">
                <TakePlayer take={t} title={t.label ?? "take"} />
                <div className="flex items-center gap-1">
                  {riff.canEdit ? (
                    <input aria-label="Take label" defaultValue={t.label ?? ""} maxLength={80} placeholder="Label" onBlur={(e) => e.target.value.trim() !== (t.label ?? "") && rename.mutate({ takeId: t.id, label: e.target.value.trim() || null })} className="panel-inset h-8 w-32 rounded-lg px-2 font-body text-xs outline-none" />
                  ) : <span className="font-body text-xs text-muted">{t.label}</span>}
                  <label className="flex items-center gap-1 px-1 font-body text-xs text-muted" title="Compare two takes">
                    <input type="checkbox" checked={compare.includes(t.id)} onChange={(e) => setCompare((c) => (e.target.checked ? [...c.slice(-1), t.id] : c.filter((x) => x !== t.id)))} className="accent-copper" /> A/B
                  </label>
                  <a href={t.src} download className="focus-ring rounded-full p-2 text-muted hover:text-ink" aria-label={`Download ${t.label ?? "take"}`}><Icon name="download" size={16} /></a>
                  {riff.canEdit && <IconButton icon="trash" label={`Delete ${t.label ?? "take"}`} onClick={() => delTake.mutate(t.id)} size={34} />}
                </div>
              </li>
            ))}
          </ol>
        )}
        {delTake.error && <p role="alert" className="font-body text-sm text-danger">{errorMessage(delTake.error)} The take is back.</p>}
      </section>

      <section aria-labelledby="dev-h" className="panel grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <h2 id="dev-h" className="sr-only">Details</h2>
        <label><span className="label-engraved">Stage</span><select disabled={!riff.canEdit} value={draft.stage} onChange={(e) => set({ stage: e.target.value as RiffStage })} className={`${input} mt-1.5`}>{(Object.keys(STAGE_LABEL) as RiffStage[]).map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select></label>
        <label><span className="label-engraved">Key</span><select disabled={!riff.canEdit} value={draft.key} onChange={(e) => set({ key: e.target.value })} className={`${input} mt-1.5`}><option value="">—</option>{SONG_KEYS.map((k) => <option key={k}>{k}</option>)}</select></label>
        <label><span className="label-engraved">BPM</span><input disabled={!riff.canEdit} type="number" min={20} max={300} value={draft.bpm} onChange={(e) => set({ bpm: e.target.value })} className={`${input} mt-1.5`} /></label>
        <label><span className="label-engraved">Tags</span><input disabled={!riff.canEdit} value={draft.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="verse, drop-d" className={`${input} mt-1.5`} /></label>
        <label className="sm:col-span-2 lg:col-span-4"><span className="label-engraved">Notes</span><textarea disabled={!riff.canEdit} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={4000} rows={4} placeholder="Where it could go, what to try next, the lyric it reminded you of…" className="panel-inset mt-1.5 w-full rounded-lg p-3 font-body text-sm outline-none" /></label>
        <label className="sm:col-span-2">
          <span className="label-engraved">Tone</span>
          {riff.canEdit ? (
            <select value={draft.toneId} onChange={(e) => set({ toneId: e.target.value })} className={`${input} mt-1.5`}>
              <option value="">No tone</option>
              {draft.toneId && !tones.data?.some((t) => t.id === draft.toneId) && <option value={draft.toneId}>{riff.tone?.name ?? "Linked tone"}</option>}
              {tones.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          ) : <p className="mt-1.5 font-body text-sm">{riff.tone?.name ?? "—"}</p>}
        </label>
        <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
          {riff.tone && <Link href={`/studio?tone=${riff.tone.id}`} className="focus-ring inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong px-4 font-body text-sm hover:border-copper/50"><Icon name="amp" size={16} /> Play it in the Amp Studio</Link>}
          <Button icon="edit" onClick={async () => { try { const { canvas } = await api<{ canvas: { id: string } }>("/api/canvases", { body: { fromRiffId: riff.id } }); router.push(`/write/${canvas.id}`); } catch (err) { setProjectError(errorMessage(err)); } }}>Write a song from it</Button>
          {riff.bpm && <Link href="/practice" className="focus-ring inline-flex h-10 items-center rounded-full border border-line-strong px-4 font-body text-sm hover:border-copper/50">Practice at {riff.bpm} BPM</Link>}
        </div>
      </section>

      {riff.canEdit && (
        <section aria-labelledby="share-h" className="flex flex-wrap items-center gap-3 rounded-2xl border border-line p-4">
          <div className="mr-auto">
            <h2 id="share-h" className="font-display text-lg font-semibold">{riff.project ? "In a project" : "Develop it with others"}</h2>
            <p className="font-body text-sm text-muted">{riff.project ? "Everyone in the project can listen to every take here. Add musicians from the project." : "Private until you choose. Starting a project lets the people you add listen to its takes and talk it through."}</p>
          </div>
          {riff.project ? <Link href={`/messages/${riff.project.id}`} className="focus-ring inline-flex h-10 items-center rounded-full bg-copper px-4 font-body text-sm font-medium text-bg">Open the project</Link> : <Button icon="users" onClick={startProject}>Start a project</Button>}
          {projectError && <p role="alert" className="basis-full font-body text-sm text-danger">{projectError}</p>}
          <div className="basis-full border-t border-line pt-3">
            {confirmDelete ? (
              <span className="flex flex-wrap items-center gap-2 font-body text-sm">Delete the riff and all its takes? This can&apos;t be undone.
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Keep it</Button>
                <Button size="sm" onClick={() => remove.mutate(riff.id, { onSuccess: () => router.push("/riffs") })}>Delete</Button>
              </span>
            ) : <Button size="sm" variant="ghost" icon="trash" onClick={() => setConfirmDelete(true)}>Delete riff</Button>}
          </div>
        </section>
      )}
    </div>
  );
}
