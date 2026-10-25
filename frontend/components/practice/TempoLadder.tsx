"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Button, IconButton, LinkButton, Spinner } from "@/components/app/ui";
import { errorMessage } from "@/lib/client-api";
import { bestClean, MAX_BPM, MIN_BPM, nextRung } from "@/lib/practice";
import type { PassageView } from "@/lib/practice-ladder";
import { passagesQuery, useCreatePassage, useDeletePassage, useDeleteTake, useLogTake, useUpdatePassage } from "@/lib/queries/practice";
import { usePreferences, usePreferencesHydration } from "@/lib/stores/preferences";

const clampBpm = (v: number) => Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(v)));

/** Tempo over takes: filled rungs were clean, hollow ones not yet; the dashed line is the goal. */
function Ladder({ passage }: { passage: PassageView }) {
  const [hover, setHover] = useState<number | null>(null);
  const takes = passage.takes;
  const W = 320;
  const H = 120;
  const pad = { l: 34, r: 10, t: 10, b: 16 };
  const values = [passage.targetBpm, ...takes.map((t) => t.bpm)];
  const lo = Math.max(MIN_BPM, Math.floor((Math.min(...values) - 6) / 10) * 10);
  const hi = Math.min(MAX_BPM, Math.ceil((Math.max(...values) + 6) / 10) * 10);
  const x = (i: number) => pad.l + (takes.length < 2 ? (W - pad.l - pad.r) / 2 : (i / (takes.length - 1)) * (W - pad.l - pad.r));
  const y = (bpm: number) => pad.t + (1 - (bpm - lo) / Math.max(1, hi - lo)) * (H - pad.t - pad.b);
  const shown = hover === null ? null : takes[hover];
  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img" aria-label={`${takes.length} takes logged; target ${passage.targetBpm} BPM; best clean ${bestClean(takes) ?? "none yet"}.`}>
        {[lo, hi].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={pad.l - 6} y={y(v)} textAnchor="end" dominantBaseline="middle" className="fill-muted font-mono text-[9px]">{v}</text>
          </g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(passage.targetBpm)} y2={y(passage.targetBpm)} stroke="var(--color-signal)" strokeWidth={1.5} strokeDasharray="4 4" />
        <text x={W - pad.r} y={y(passage.targetBpm) - 5} textAnchor="end" className="fill-ink-dim font-mono text-[9px]">target {passage.targetBpm}</text>
        {takes.length > 1 && <polyline points={takes.map((t, i) => `${x(i)},${y(t.bpm)}`).join(" ")} fill="none" stroke="var(--color-copper)" strokeOpacity={0.5} strokeWidth={2} strokeLinejoin="round" />}
        {takes.map((t, i) => (
          <g key={t.id} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
            <circle cx={x(i)} cy={y(t.bpm)} r={12} fill="transparent" />
            <circle cx={x(i)} cy={y(t.bpm)} r={hover === i ? 5.5 : 4.5} fill={t.clean ? "var(--color-copper)" : "var(--color-bg-0)"} stroke={t.clean ? "var(--color-surface)" : "var(--color-copper)"} strokeWidth={2} />
          </g>
        ))}
        {!takes.length && <text x={W / 2} y={H / 2 + 12} textAnchor="middle" className="fill-muted font-body text-[11px]">Your first take starts the ladder</text>}
      </svg>
      {shown && (
        <figcaption className="pointer-events-none absolute -top-1 right-0 rounded-lg border border-line bg-surface-3 px-2.5 py-1 font-mono text-[11px] text-ink shadow-panel">
          {shown.bpm} BPM · {shown.clean ? "clean" : "not yet"} · {new Date(shown.createdAt).toLocaleDateString()}
        </figcaption>
      )}
      <table className="sr-only">
        <caption>Takes for {passage.title}</caption>
        <thead><tr><th>Date</th><th>Tempo</th><th>Result</th></tr></thead>
        <tbody>{takes.map((t) => <tr key={t.id}><td>{new Date(t.createdAt).toLocaleDateString()}</td><td>{t.bpm} BPM</td><td>{t.clean ? "Clean" : "Not yet"}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

function PassageCard({ passage, userId }: { passage: PassageView; userId: string }) {
  const metronomeBpm = usePreferences((s) => s.metronome.bpm);
  const setMetronome = usePreferences((s) => s.setMetronome);
  const log = useLogTake(userId);
  const undo = useDeleteTake(userId);
  const update = useUpdatePassage(userId);
  const remove = useDeletePassage(userId);
  const [confirming, setConfirming] = useState(false);
  const best = bestClean(passage.takes);
  const rung = nextRung(passage.takes, passage.targetBpm);
  const last = passage.takes.at(-1);
  const reached = best !== null && best >= passage.targetBpm;
  const error = [log, undo, update, remove].find((m) => m.error)?.error;

  function practiseAt(bpm: number) {
    setMetronome({ bpm });
    document.getElementById("pulse-h")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  }

  return (
    <li className="panel flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg font-semibold">{passage.title}</h3>
          <p className="mt-0.5 font-mono text-xs text-muted">
            best clean <span className="text-ink">{best ?? "—"}</span> / target <span className="text-ink">{passage.targetBpm}</span> BPM
          </p>
        </div>
        {confirming ? (
          <span className="flex items-center gap-1">
            <Button size="sm" variant="danger" onClick={() => remove.mutate(passage.id)}>Remove</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Keep</Button>
          </span>
        ) : (
          <IconButton icon="trash" label={`Remove ${passage.title}`} onClick={() => setConfirming(true)} />
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-bg-0" role="progressbar" aria-label="Progress to target tempo" aria-valuemin={0} aria-valuemax={passage.targetBpm} aria-valuenow={best ?? 0}>
        <div className="h-full rounded-full bg-copper transition-[width] duration-500" style={{ width: `${Math.min(100, ((best ?? 0) / passage.targetBpm) * 100)}%` }} />
      </div>
      <Ladder passage={passage} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <Button size="sm" variant="signal" icon="play" onClick={() => practiseAt(rung)}>Practise at {rung}</Button>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Log a take at ${metronomeBpm} BPM`}>
          <span className="font-mono text-xs text-muted">Log <span className="text-ink">{metronomeBpm}</span> BPM</span>
          <Button size="sm" variant="primary" icon="check" disabled={log.isPending} onClick={() => log.mutate({ passageId: passage.id, bpm: metronomeBpm, clean: true })}>Clean</Button>
          <Button size="sm" disabled={log.isPending} onClick={() => log.mutate({ passageId: passage.id, bpm: metronomeBpm, clean: false })}>Not yet</Button>
          {last && !last.id.startsWith("pending-") && (
            <Button size="sm" variant="ghost" aria-label={`Undo last take, ${last.bpm} BPM`} onClick={() => undo.mutate(last.id)}>Undo</Button>
          )}
        </div>
      </div>
      {reached && (
        <p className="flex flex-wrap items-center gap-2 rounded-xl border border-signal/30 bg-signal/5 px-3 py-2 font-body text-sm text-ink-dim">
          Clean at your target. Lock it in, or reach further:
          <Button size="sm" onClick={() => update.mutate({ id: passage.id, targetBpm: clampBpm(passage.targetBpm + 10) })}>Raise target to {clampBpm(passage.targetBpm + 10)}</Button>
        </p>
      )}
      {error && <p role="alert" className="font-body text-sm text-danger">{errorMessage(error)}</p>}
    </li>
  );
}

function NewPassage({ userId, first }: { userId: string; first: boolean }) {
  const create = useCreatePassage(userId);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("120");
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate({ title, targetBpm: clampBpm(Number(target) || 120) }, { onSuccess: () => setTitle("") });
      }}
    >
      <label className="min-w-[14rem] flex-1">
        <span className="label-engraved">{first ? "What are you working up?" : "Another passage"}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} placeholder="Solo, bars 9–16 · alternate picking" className="panel-inset mt-2 h-11 w-full rounded-xl px-3 font-body text-sm text-ink outline-none placeholder:text-muted" />
      </label>
      <label className="w-28">
        <span className="label-engraved">Target BPM</span>
        <input type="number" inputMode="numeric" min={MIN_BPM} max={MAX_BPM} value={target} onChange={(e) => setTarget(e.target.value)} className="panel-inset mt-2 h-11 w-full rounded-xl px-3 font-mono text-sm text-ink outline-none" />
      </label>
      <Button type="submit" variant="primary" icon="plus" disabled={create.isPending}>{create.isPending ? "Adding…" : "Add passage"}</Button>
      {create.error && <p role="alert" className="w-full font-body text-sm text-danger">{errorMessage(create.error)}</p>}
    </form>
  );
}

/**
 * Work a passage up to speed: log the tempos you play it at, clean or not
 * yet, and the ladder shows the climb. Shares the metronome's tempo, so
 * "Practise at" sets the click and the log buttons record what's playing.
 */
export default function TempoLadder() {
  usePreferencesHydration();
  const { data: session, status } = useSession();
  const userId = session?.user?.id ?? null;
  const passages = useQuery({ ...passagesQuery(userId ?? ""), enabled: !!userId });

  return (
    <section aria-labelledby="ladder-h" className="panel p-5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="ladder-h" className="font-display text-2xl font-semibold">Climb the tempo ladder.</h2>
        <span className="label-engraved">03 / Progress</span>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted">Pick a passage and the tempo you want it at. Play it, log whether it was clean, and step up a few BPM at a time. Your ladder is private and syncs to your account.</p>
      <div className="mt-6">
        {status === "loading" || (userId && passages.isPending) ? (
          <div className="flex items-center gap-2 text-sm text-muted"><Spinner /> Loading your passages…</div>
        ) : !userId ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line p-5">
            <p className="flex-1 text-sm text-ink-dim">Sign in to keep a tempo ladder across sessions and devices. The metronome and loop player work without an account.</p>
            <LinkButton href="/login?callbackUrl=/practice" variant="primary">Sign in to track progress</LinkButton>
          </div>
        ) : passages.isError ? (
          <div role="alert" className="flex items-center gap-3 text-sm text-danger">{errorMessage(passages.error)} <Button size="sm" onClick={() => void passages.refetch()}>Retry</Button></div>
        ) : (
          <div className="space-y-6">
            {!!passages.data?.length && <ul className="grid gap-4 lg:grid-cols-2">{passages.data.map((p) => <PassageCard key={p.id} passage={p} userId={userId} />)}</ul>}
            <NewPassage userId={userId} first={!passages.data?.length} />
          </div>
        )}
      </div>
    </section>
  );
}
