"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/client-api";
import { toneKeys } from "@/lib/queries/tones";
import { Button, Spinner } from "@/components/app/ui";
import { DNA_AXES, type MeasuredCharacter, type ToneDna } from "@/lib/tone-dna";
import type { SimilarTone } from "@/lib/similar-tones";
import type { StudioPatch } from "@/lib/studio/patch";

type Result = { dna: ToneDna; similar: SimilarTone[] };

/** The seven axes as a strand of bars: what the settings do, low to high. */
export function DnaStrand({ dna, compare, size = "md" }: { dna: ToneDna; compare?: ToneDna; size?: "sm" | "md" }) {
  return (
    <ul className={size === "sm" ? "space-y-1" : "space-y-2"}>
      {DNA_AXES.map((ax) => (
        <li key={ax.key} className="grid grid-cols-[5.5rem_1fr] items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{ax.label}</span>
          <span className="relative block h-2 rounded-full bg-bg-0 ring-1 ring-line" role="img" aria-label={`${ax.label}: ${Math.round(dna[ax.key] * 10)} of 10 (${ax.low} to ${ax.high})${compare ? `; the other sound ${Math.round(compare[ax.key] * 10)}` : ""}`}>
            <span className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-signal to-copper" style={{ width: `${Math.max(3, dna[ax.key] * 100)}%` }} />
            {compare && <span className="absolute -top-1 h-4 w-0.5 rounded bg-ink" style={{ left: `calc(${compare[ax.key] * 100}% - 1px)` }} />}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Tone DNA for a saved tone (by id) or an unsaved studio patch, with the
 * closest public sounds. Measured character, when given, is shown apart and
 * labelled as such.
 */
export default function ToneDnaPanel({ toneId, patch, measured, initialDna }: { toneId?: string; patch?: StudioPatch; measured?: MeasuredCharacter | null; initialDna?: ToneDna }) {
  const q = useQuery({
    queryKey: toneId ? toneKeys.similar(toneId) : ["studio", "similar", JSON.stringify(patch)],
    queryFn: ({ signal }) => (toneId ? api<Result>(`/api/tones/${toneId}/similar`, { signal }) : api<Result>("/api/tones/similar", { body: { studio: patch }, signal })),
    staleTime: 5 * 60_000,
  });
  const dna = q.data?.dna ?? initialDna;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <div className="space-y-4">
        {dna ? <DnaStrand dna={dna} /> : <Spinner />}
        <p className="font-body text-xs leading-relaxed text-muted">Estimated from the settings, as Resoniq&apos;s studio engine would play them. It describes the rig, not a recording.</p>
        {measured && (
          <div className="rounded-xl border border-signal/30 bg-signal/[0.06] p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-signal">Measured from your recording · only you see this</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
              <dt className="text-muted">Brightness (centroid)</dt><dd className="text-ink">{measured.centroidHz} Hz</dd>
              <dt className="text-muted">Low / mid / high</dt><dd className="text-ink">{measured.lowDb.toFixed(0)} / {measured.midDb.toFixed(0)} / {measured.highDb.toFixed(0)} dB</dd>
              <dt className="text-muted">Level (RMS)</dt><dd className="text-ink">{measured.rmsDb.toFixed(1)} dBFS</dd>
            </dl>
            <p className="mt-2 font-body text-[11px] text-muted">Of the whole mix in the main section, not the guitar alone.</p>
          </div>
        )}
      </div>
      <div>
        <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Closest sounds in the community</h3>
        {q.isPending ? (
          <div className="mt-3"><Spinner /></div>
        ) : q.isError ? (
          <div className="mt-3 flex items-center gap-3"><p role="alert" className="font-body text-sm text-danger">{errorMessage(q.error)}</p><Button size="sm" onClick={() => q.refetch()}>Retry</Button></div>
        ) : q.data.similar.length === 0 ? (
          <p className="mt-3 font-body text-sm text-muted">No public tones to compare with yet.</p>
        ) : (
          <ol className="mt-3 divide-y divide-line rounded-xl border border-line">
            {q.data.similar.map((t) => (
              <li key={t.id}>
                <Link href={`/t/${t.id}`} className="focus-ring flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.03]">
                  <span className="w-11 shrink-0 text-right font-mono text-sm tabular-nums text-copper">{t.match}%</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-body text-sm text-ink">{t.name}</span>
                    <span className="block truncate font-body text-[11px] text-muted">{t.anonymous ? t.author.name : `@${t.author.handle}`}{t.generated ? " · Resoniq-generated" : ""}{t.differs.length ? ` · ${t.differs.join(", ")}` : " · nearly identical"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
