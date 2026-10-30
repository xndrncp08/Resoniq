"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Icon from "@/components/icons/Icon";
import { Button, IconButton } from "@/components/app/ui";
import { useUnsavedChanges } from "@/components/app/UnsavedChanges";
import { errorMessage } from "@/lib/client-api";
import { presetsQuery } from "@/lib/queries/studio";
import { setlistQuery, useSaveSetlist } from "@/lib/queries/setlists";
import { MAX_SONGS, SONG_KEYS, type SetlistSong, type SetlistView } from "@/lib/setlists";

type Draft = { name: string; venue: string; date: string; notes: string; items: SetlistSong[] };
const draftOf = (s: SetlistView): Draft => ({ name: s.name, venue: s.venue ?? "", date: s.date ?? "", notes: s.notes ?? "", items: s.items.map(({ tone: _t, chart: _c, ...song }) => song) });
const songId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const num = (v: string) => (v === "" ? undefined : Number(v));
const input = "panel-inset h-10 w-full rounded-lg px-2.5 font-body text-sm outline-none";

export default function SetlistEditor({ userId, initial }: { userId: string; initial: SetlistView }) {
  const router = useRouter();
  const saved = useQuery({ ...setlistQuery(userId, initial.id), initialData: initial });
  const tones = useQuery(presetsQuery(userId));
  const save = useSaveSetlist(userId, initial.id);
  const [draft, setDraft] = useState<Draft>(() => draftOf(initial));
  const [open, setOpen] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftOf(saved.data));
  const body = () => ({ name: draft.name, venue: draft.venue || null, date: draft.date || null, notes: draft.notes || null, items: draft.items });
  useUnsavedChanges({ dirty, label: "this setlist", save: () => save.mutateAsync(body()) });

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setSong = (id: string, patch: Partial<SetlistSong>) => set({ items: draft.items.map((s) => (s.id === id ? clean({ ...s, ...patch }) : s)) });
  const move = (i: number, d: number) => {
    const items = [...draft.items];
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    set({ items });
  };
  const add = () => {
    const s = { id: songId(), title: "" };
    set({ items: [...draft.items, s] });
    setOpen(s.id);
  };
  const minutes = draft.items.reduce((t, s) => t + (s.minutes ?? 0), 0);
  const untitled = draft.items.some((s) => !s.title.trim());

  return (
    <div className="space-y-6">
      <div className="panel grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="sm:col-span-2"><span className="label-engraved">Name</span><input value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} className={`${input} mt-1.5`} /></label>
        <label><span className="label-engraved">Venue</span><input value={draft.venue} onChange={(e) => set({ venue: e.target.value })} maxLength={120} className={`${input} mt-1.5`} /></label>
        <label><span className="label-engraved">Date</span><input type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} className={`${input} mt-1.5`} /></label>
        <label className="sm:col-span-2 lg:col-span-4"><span className="label-engraved">Show notes</span><textarea value={draft.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={2000} rows={2} placeholder="Load-in 6pm, soundcheck 6:30, backline provided" className="panel-inset mt-1.5 w-full rounded-lg p-2.5 font-body text-sm outline-none" /></label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-display text-xl font-semibold">{draft.items.length} song{draft.items.length === 1 ? "" : "s"}{minutes ? <span className="font-body text-sm text-muted"> · {Math.round(minutes)} min</span> : null}</h2>
        <span aria-live="polite" className={`font-mono text-[10px] uppercase tracking-[0.14em] ${dirty ? "text-amber" : "text-muted"}`}>{save.isPending ? "Saving…" : dirty ? "Unsaved" : "Saved"}</span>
        <Button variant="primary" icon="check" onClick={() => save.mutate(body())} disabled={!dirty || save.isPending || untitled || !draft.name.trim()}>Save</Button>
        <Button variant="signal" icon="play" onClick={async () => { if (dirty) await save.mutateAsync(body()); router.push(`/gigs/${initial.id}/stage`); }} disabled={draft.items.length === 0 || untitled || save.isPending}>Gig Mode</Button>
      </div>
      {save.error && <p role="alert" className="font-body text-sm text-danger">{errorMessage(save.error)} Your edits are still here.</p>}
      {untitled && <p className="font-body text-sm text-amber">Every song needs a title before saving.</p>}

      <ol className="space-y-2">
        {draft.items.map((s, i) => {
          const tone = saved.data.items.find((x) => x.id === s.id)?.tone;
          const expanded = open === s.id;
          return (
            <li key={s.id} className="rounded-xl border border-line bg-surface/50">
              <div className="flex items-center gap-2 p-2">
                <span className="w-7 text-center font-mono text-sm text-muted">{i + 1}</span>
                <input aria-label={`Song ${i + 1} title`} value={s.title} onChange={(e) => setSong(s.id, { title: e.target.value })} placeholder="Song title" maxLength={120} className={`${input} min-w-0 flex-1`} />
                <span className="hidden font-mono text-xs text-muted sm:block">{[s.key, s.bpm && `${s.bpm} BPM`].filter(Boolean).join(" · ")}</span>
                <IconButton icon="arrow-up" label={`Move ${s.title || "song"} up`} onClick={() => move(i, -1)} size={34} />
                <IconButton icon="arrow-down" label={`Move ${s.title || "song"} down`} onClick={() => move(i, 1)} size={34} />
                <IconButton icon={expanded ? "chevron-down" : "settings"} label={expanded ? "Hide details" : `Details for ${s.title || "song"}`} onClick={() => setOpen(expanded ? null : s.id)} size={34} />
              </div>
              {expanded && (
                <div className="grid gap-3 border-t border-line p-3 sm:grid-cols-3 lg:grid-cols-6">
                  <label className="lg:col-span-2"><span className="label-engraved">Artist</span><input value={s.artist ?? ""} onChange={(e) => setSong(s.id, { artist: e.target.value })} maxLength={80} className={`${input} mt-1`} /></label>
                  <label><span className="label-engraved">BPM</span><input type="number" min={20} max={300} value={s.bpm ?? ""} onChange={(e) => setSong(s.id, { bpm: num(e.target.value) })} className={`${input} mt-1`} /></label>
                  <label><span className="label-engraved">Key</span><select value={s.key ?? ""} onChange={(e) => setSong(s.id, { key: e.target.value || undefined })} className={`${input} mt-1`}><option value="">—</option>{SONG_KEYS.map((k) => <option key={k}>{k}</option>)}</select></label>
                  <label><span className="label-engraved">Minutes</span><input type="number" min={0.5} max={60} step={0.5} value={s.minutes ?? ""} onChange={(e) => setSong(s.id, { minutes: num(e.target.value) })} className={`${input} mt-1`} /></label>
                  <label><span className="label-engraved">MIDI program</span><input type="number" min={1} max={128} value={s.midiProgram ?? ""} onChange={(e) => setSong(s.id, { midiProgram: num(e.target.value) })} placeholder="1–128" className={`${input} mt-1`} /></label>
                  <label className="sm:col-span-3 lg:col-span-3">
                    <span className="label-engraved">Tone</span>
                    <select value={s.toneId ?? ""} onChange={(e) => setSong(s.id, { toneId: e.target.value || undefined })} className={`${input} mt-1`}>
                      <option value="">No tone</option>
                      {s.toneId && !tones.data?.some((t) => t.id === s.toneId) && <option value={s.toneId}>{tone?.name ?? "A tone that's no longer available"}</option>}
                      {tones.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </label>
                  <label className="sm:col-span-3 lg:col-span-3"><span className="label-engraved">Stage notes</span><textarea value={s.notes ?? ""} onChange={(e) => setSong(s.id, { notes: e.target.value })} maxLength={1000} rows={2} placeholder="Capo 2. Drop to clean for the bridge." className="panel-inset mt-1 w-full rounded-lg p-2 font-body text-sm outline-none" /></label>
                  <div className="flex items-end gap-2 sm:col-span-3 lg:col-span-6">
                    {s.toneId && <Link href={`/studio?tone=${s.toneId}`} className="focus-ring inline-flex items-center gap-1.5 font-body text-sm text-copper hover:underline"><Icon name="amp" size={15} /> Open tone in the Amp Studio</Link>}
                    <Button size="sm" variant="ghost" icon="trash" className="ml-auto" onClick={() => set({ items: draft.items.filter((x) => x.id !== s.id) })}>Remove</Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <Button icon="plus" onClick={add} disabled={draft.items.length >= MAX_SONGS}>Add song</Button>
    </div>
  );
}

/** Empty fields leave the song rather than being saved as blanks. */
function clean(s: SetlistSong): SetlistSong {
  const out = { ...s } as Record<string, unknown>;
  for (const [k, v] of Object.entries(out)) if (k !== "title" && k !== "id" && (v === undefined || v === "" || (typeof v === "number" && !Number.isFinite(v)))) delete out[k];
  return out as SetlistSong;
}
