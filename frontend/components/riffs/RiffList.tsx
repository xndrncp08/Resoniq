"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { RiffStage } from "@prisma/client";
import Icon from "@/components/icons/Icon";
import { Button, EmptyState, Spinner } from "@/components/app/ui";
import { errorMessage } from "@/lib/client-api";
import { riffsQuery, useCreateRiff } from "@/lib/queries/riffs";
import type { RiffSummary } from "@/lib/riffs/service";
import { Waveform } from "@/components/riffs/TakePlayer";

export const STAGE_LABEL: Record<RiffStage, string> = { IDEA: "Idea", DEVELOPING: "Developing", READY: "Ready", ARCHIVED: "Archived" };

export default function RiffList({ userId, initial }: { userId: string; initial: RiffSummary[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<RiffStage | "">("");
  const [tag, setTag] = useState("");
  const query = useDeferredValue(q.trim());
  const filters = { ...(query && { q: query }), ...(stage && { stage }), ...(tag && { tag }) };
  const unfiltered = !query && !stage && !tag;
  const list = useQuery({ ...riffsQuery(userId, filters), placeholderData: keepPreviousData, ...(unfiltered && { initialData: initial }) });
  const create = useCreateRiff(userId);
  const tags = [...new Set((list.data ?? []).flatMap((r) => r.tags))].sort();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" icon="plus" disabled={create.isPending} onClick={() => create.mutate({ title: `Idea ${new Date().toLocaleDateString(undefined, { day: "numeric", month: "short" })}` }, { onSuccess: (r) => router.push(`/riffs/${r.id}?record=1`) })}>
          {create.isPending ? "Creating…" : "New riff"}
        </Button>
        <label className="min-w-[10rem] flex-1"><span className="sr-only">Search riffs</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles and notes" className="panel-inset h-10 w-full rounded-full px-4 font-body text-sm outline-none" /></label>
        <label><span className="sr-only">Stage</span>
          <select value={stage} onChange={(e) => setStage(e.target.value as RiffStage | "")} className="panel-inset h-10 rounded-full px-3 font-body text-sm">
            <option value="">All active</option>
            {(Object.keys(STAGE_LABEL) as RiffStage[]).map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
          </select>
        </label>
      </div>
      {create.error && <p role="alert" className="font-body text-sm text-danger">{errorMessage(create.error)}</p>}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by tag">
          {tags.map((t) => <button key={t} type="button" aria-pressed={tag === t} onClick={() => setTag(tag === t ? "" : t)} className={`focus-ring h-7 rounded-full border px-2.5 font-mono text-xs ${tag === t ? "border-copper/60 bg-copper/10 text-ink" : "border-line text-muted hover:text-ink"}`}>#{t}</button>)}
        </div>
      )}
      {list.isPending ? <Spinner /> : list.isError ? (
        <div className="flex items-center gap-3"><p role="alert" className="font-body text-sm text-danger">{errorMessage(list.error)}</p><Button size="sm" onClick={() => list.refetch()}>Retry</Button></div>
      ) : list.data.length === 0 ? (
        unfiltered ? <EmptyState icon="mic" title="Your vault is empty">Catch the riff before it&apos;s gone: record a take on your phone or computer, tag it, and come back to develop it. Everything here is private.</EmptyState> : <p className="font-body text-sm text-muted">Nothing matches.</p>
      ) : (
        <ul className={`grid gap-3 sm:grid-cols-2 ${list.isPlaceholderData ? "opacity-60" : ""}`}>
          {list.data.map((r) => (
            <li key={r.id}>
              <Link href={`/riffs/${r.id}`} className="focus-ring block h-full rounded-2xl border border-line bg-surface/50 p-4 transition-colors hover:border-line-strong">
                <div className="flex items-start gap-2">
                  {r.pinned && <Icon name="bookmark-filled" size={14} className="mt-1 text-copper" aria-label="Pinned" />}
                  <span className="min-w-0 flex-1 truncate font-display text-lg font-semibold">{r.title}</span>
                  <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{STAGE_LABEL[r.stage]}</span>
                </div>
                <p className="mt-1 font-body text-xs text-muted">{[r.key, r.bpm && `${r.bpm} BPM`, `${r.takes} take${r.takes === 1 ? "" : "s"}`, r.shared && r.owner && `shared by @${r.owner.handle}`].filter(Boolean).join(" · ")}</p>
                {r.lastTake && <div className="mt-3 flex"><Waveform peaks={r.lastTake.peaks} progress={0} label={`Latest take of ${r.title}`} /></div>}
                {r.tags.length > 0 && <p className="mt-2 truncate font-mono text-[11px] text-muted">{r.tags.map((t) => `#${t}`).join(" ")}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
