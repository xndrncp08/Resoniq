"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, EmptyState } from "@/components/app/ui";
import { errorMessage } from "@/lib/client-api";
import { setlistsQuery, useCreateSetlist, useDeleteSetlist } from "@/lib/queries/setlists";
import type { SetlistSummary } from "@/lib/setlists";

const when = (d: string | null) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "No date");

export default function GigList({ userId, initial }: { userId: string; initial: SetlistSummary[] }) {
  const router = useRouter();
  const list = useQuery({ ...setlistsQuery(userId), initialData: initial });
  const create = useCreateSetlist(userId);
  const remove = useDeleteSetlist(userId);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ name: name.trim(), ...(date && { date }) }, { onSuccess: (s) => router.push(`/gigs/${s.id}`) });
        }}
        className="panel flex flex-wrap items-end gap-3 p-4"
      >
        <label className="min-w-[12rem] flex-1">
          <span className="label-engraved">New setlist</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="Friday at The Lantern" className="panel-inset mt-2 h-11 w-full rounded-xl px-3 font-body outline-none" />
        </label>
        <label>
          <span className="label-engraved">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="panel-inset mt-2 h-11 rounded-xl px-3 font-body outline-none" />
        </label>
        <Button type="submit" variant="primary" icon="plus" disabled={create.isPending || !name.trim()}>{create.isPending ? "Creating…" : "Create"}</Button>
        {create.error && <p role="alert" className="basis-full font-body text-sm text-danger">{errorMessage(create.error)}</p>}
      </form>
      {list.data.length === 0 ? (
        <EmptyState icon="audio" title="No setlists yet">Build one for your next show: songs in order, with tempo, key, the tone to load and notes you can read from the stage.</EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {list.data.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Link href={`/gigs/${s.id}`} className="focus-ring min-w-0 flex-1 rounded">
                <span className="block truncate font-display text-lg font-semibold">{s.name}</span>
                <span className="block font-body text-sm text-muted">{when(s.date)}{s.venue ? ` · ${s.venue}` : ""} · {s.songs} song{s.songs === 1 ? "" : "s"}{s.minutes ? ` · ${s.minutes} min` : ""}</span>
              </Link>
              <Link href={`/gigs/${s.id}/stage`} className="focus-ring inline-flex h-9 items-center rounded-full bg-signal px-4 font-body text-sm font-semibold text-bg">Gig Mode</Link>
              {confirming === s.id ? (
                <span className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>Keep</Button>
                  <Button size="sm" onClick={() => { setConfirming(null); remove.mutate(s.id); }}>Delete</Button>
                </span>
              ) : (
                <Button size="sm" variant="ghost" icon="trash" onClick={() => setConfirming(s.id)} aria-label={`Delete ${s.name}`} />
              )}
            </li>
          ))}
        </ul>
      )}
      {remove.error && <p role="alert" className="font-body text-sm text-danger">{errorMessage(remove.error)} It&apos;s back in the list.</p>}
    </div>
  );
}
