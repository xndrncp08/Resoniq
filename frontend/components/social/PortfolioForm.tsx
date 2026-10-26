"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import type { GearKind } from "@prisma/client";
import Icon from "@/components/icons/Icon";
import { Button, IconButton } from "@/components/app/ui";
import { KIND_ICON, KIND_LABEL } from "@/components/tone/gear-icons";
import { api, errorMessage } from "@/lib/client-api";
import { MAX_INFLUENCES, MAX_LOCATION, MAX_RIG, MAX_RIG_NOTE, OPEN_TO, type OpenTo } from "@/lib/portfolio-options";

export type PortfolioValues = { location: string | null; openTo: OpenTo[]; influences: string[]; pinnedPostId: string | null; signatureToneId: string | null };
type Gear = { id: string; slug: string; kind: GearKind; brand: string; model: string };
type RigRow = { gear: Gear; note: string | null };
type Option = { id: string; label: string };

const field = "panel-inset mt-2 w-full rounded-xl px-3 font-body text-[15px] outline-none focus:border-copper/60";

function Status({ m }: { m: { isPending: boolean; isSuccess: boolean; error: Error | null } }) {
  return (
    <p role="status" aria-live="polite" className="font-body text-sm">
      {m.isPending ? <span className="text-muted">Saving…</span> : m.error ? <span className="text-danger">{errorMessage(m.error)}</span> : m.isSuccess ? <span className="text-signal">Saved.</span> : null}
    </p>
  );
}

/** Where they play, what they're open to, who shaped them, and what they lead with. */
export function MusicianshipForm({ initial, tones, posts }: { initial: PortfolioValues; tones: Option[]; posts: Option[] }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [influences, setInfluences] = useState(initial.influences.join(", "));
  const save = useMutation({
    mutationFn: () => api("/api/me", { method: "PATCH", body: { ...v, influences: influences.split(",").map((s) => s.trim()).filter(Boolean) } }),
    onSuccess: () => router.refresh(),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="panel space-y-5 p-5">
      <fieldset>
        <legend className="label-engraved mb-2">Open to</legend>
        <div className="flex flex-wrap gap-2">
          {OPEN_TO.map((o) => {
            const on = v.openTo.includes(o.id);
            return <button key={o.id} type="button" aria-pressed={on} onClick={() => setV({ ...v, openTo: on ? v.openTo.filter((x) => x !== o.id) : [...v.openTo, o.id] })} className={`focus-ring rounded-full border px-3 py-2 font-body text-sm transition-colors ${on ? "border-signal bg-signal/10 text-ink" : "border-line text-muted hover:text-ink"}`}>{o.label}</button>;
          })}
        </div>
        <p className="mt-2 font-body text-xs text-muted">Shown on your profile. Only musicians open to something are suggested to others as people to play with.</p>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="label-engraved">Where you play</span><input value={v.location ?? ""} onChange={(e) => setV({ ...v, location: e.target.value })} maxLength={MAX_LOCATION} placeholder="City or region, if you want" autoComplete="address-level2" className={`${field} h-11`} /></label>
        <label className="block"><span className="label-engraved">Influences, comma separated</span><input value={influences} onChange={(e) => setInfluences(e.target.value)} placeholder="Tosin Abasi, Carol Kaye, Nai Palm" className={`${field} h-11`} /><span className="mt-1 block font-body text-xs text-muted">Up to {MAX_INFLUENCES}.</span></label>
        <label className="block"><span className="label-engraved">Signature tone</span>
          <select value={v.signatureToneId ?? ""} onChange={(e) => setV({ ...v, signatureToneId: e.target.value || null })} className={`${field} h-11`}>
            <option value="">None</option>
            {tones.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <span className="mt-1 block font-body text-xs text-muted">{tones.length ? "One of your public tones, shown on its amp at the top of your profile." : "Make one of your tones public to feature it here."}</span>
        </label>
        <label className="block"><span className="label-engraved">Pinned post</span>
          <select value={v.pinnedPostId ?? ""} onChange={(e) => setV({ ...v, pinnedPostId: e.target.value || null })} className={`${field} h-11`}>
            <option value="">None</option>
            {posts.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <span className="mt-1 block font-body text-xs text-muted">The take or post people see first.</span>
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3"><Status m={save} /><Button type="submit" variant="primary" disabled={save.isPending}>Save musicianship</Button></div>
    </form>
  );
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** The gear on the profile, from the shared catalog, in the order the musician wants. */
export function RigBuilder({ initial }: { initial: RigRow[] }) {
  const router = useRouter();
  const [rig, setRig] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [q, setQ] = useState("");
  const term = useDebounced(q.trim(), 250);
  const results = useQuery<Gear[]>({
    queryKey: ["gear-search", term],
    queryFn: ({ signal }) => api<{ items: Gear[] }>(`/api/gear?q=${encodeURIComponent(term)}&limit=8`, { signal }).then((r) => r.items),
    enabled: term.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const save = useMutation({
    mutationFn: () => api<{ items: RigRow[] }>("/api/me/rig", { method: "PUT", body: { items: rig.map((r) => ({ gearId: r.gear.id, note: r.note })) } }),
    onSuccess: ({ items }) => { setRig(items); setSaved(items); router.refresh(); },
  });
  const dirty = JSON.stringify(rig) !== JSON.stringify(saved);
  const listed = new Set(rig.map((r) => r.gear.id));
  const move = (i: number, d: -1 | 1) => setRig((r) => { const n = [...r]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });

  return (
    <div className="panel space-y-4 p-5">
      <label className="block">
        <span className="label-engraved">Add gear</span>
        <div className="relative">
          <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 mt-1 -translate-y-1/2 text-muted" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guitars, amps, pedals, plugins" maxLength={80} aria-controls="rig-results" className={`${field} h-11 pl-10`} />
        </div>
      </label>
      {term.length >= 2 && (
        <ul id="rig-results" aria-label="Gear results" className="divide-y divide-line rounded-xl border border-line">
          {results.data?.length ? results.data.map((g) => (
            <li key={g.id} className="flex items-center gap-3 px-3 py-2">
              <Icon name={KIND_ICON[g.kind]} size={18} className="text-copper" />
              <span className="min-w-0 flex-1 truncate font-body text-sm">{g.brand} {g.model} <span className="font-mono text-[11px] text-muted">{KIND_LABEL[g.kind]}</span></span>
              <Button size="sm" icon={listed.has(g.id) ? "check" : "plus"} disabled={listed.has(g.id) || rig.length >= MAX_RIG} onClick={() => setRig((r) => [...r, { gear: g, note: null }])}>{listed.has(g.id) ? "Added" : "Add"}</Button>
            </li>
          )) : (
            <li className="px-3 py-3 font-body text-sm text-muted">{results.isFetching ? "Searching…" : <>Not in the catalog yet. <Link href="/gear" className="text-copper hover:underline">Suggest it</Link>.</>}</li>
          )}
        </ul>
      )}
      {rig.length ? (
        <ol aria-label="Your rig" className="space-y-2">
          {rig.map((r, i) => (
            <li key={r.gear.id} className="panel-inset flex flex-wrap items-center gap-2 rounded-xl p-2.5 sm:flex-nowrap">
              <Icon name={KIND_ICON[r.gear.kind]} size={20} className="ml-1 shrink-0 text-copper" />
              <span className="min-w-0 flex-1 basis-40 truncate font-body text-sm font-medium">{r.gear.brand} {r.gear.model}</span>
              <input value={r.note ?? ""} onChange={(e) => setRig((all) => all.map((x, j) => (j === i ? { ...x, note: e.target.value || null } : x)))} maxLength={MAX_RIG_NOTE} placeholder="Note, e.g. always on" aria-label={`Note for ${r.gear.brand} ${r.gear.model}`} className="panel-inset h-9 min-w-0 flex-1 basis-40 rounded-lg px-2.5 font-body text-sm outline-none" />
              <span className="flex shrink-0">
                <IconButton icon="arrow-up" label={`Move ${r.gear.model} up`} size={32} disabled={i === 0} onClick={() => move(i, -1)} />
                <IconButton icon="arrow-down" label={`Move ${r.gear.model} down`} size={32} disabled={i === rig.length - 1} onClick={() => move(i, 1)} />
                <IconButton icon="close" label={`Remove ${r.gear.model}`} size={32} onClick={() => setRig((all) => all.filter((_, j) => j !== i))} />
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="font-body text-sm text-muted">Nothing listed yet. Add the instruments, amps and pedals you actually play.</p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Status m={save} />
        <Button variant="primary" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>Save rig</Button>
      </div>
    </div>
  );
}
