"use client";

import Link from "next/link";
import { useState } from "react";
import TakePlayer from "@/components/riffs/TakePlayer";
import ChordChart from "@/components/canvas/ChordChart";
import type { PostView } from "@/lib/posts";

/** Published music on a post: the recording, the song's chart, and who made it. */
export default function ReleaseAttachment({ release, detail }: { release: NonNullable<PostView["release"]>; detail: boolean }) {
  const [chart, setChart] = useState(detail);
  return (
    <div className="space-y-3 rounded-2xl border border-copper/25 bg-copper/[0.04] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-copper">
        {release.kind === "song" ? "Original song" : "Recording"}{[release.key && ` · ${release.key}`, release.bpm && ` · ${release.bpm} BPM`].filter(Boolean).join("")}
      </p>
      {release.take && release.src ? (
        <TakePlayer take={{ ...release.take, src: release.src, sizeBytes: 0, createdAt: "" }} title={release.title} />
      ) : release.kind === "take" ? <p className="font-body text-sm text-muted">This recording has been removed.</p> : null}
      {release.chart && (
        chart ? <div className="max-h-[32rem] overflow-y-auto rounded-xl bg-bg-0 p-4"><ChordChart content={release.chart} /></div>
          : <button type="button" onClick={() => setChart(true)} className="focus-ring font-body text-sm font-medium text-copper hover:underline">Show lyrics and chords</button>
      )}
      {release.credits.length > 0 && (
        <p className="font-body text-sm text-ink-dim">
          <span className="text-muted">Credits: </span>
          {release.credits.map((c, i) => (
            <span key={`${c.userId}-${c.role}`}>{i > 0 && " · "}<Link href={`/u/${c.handle}`} className="text-ink hover:underline">{c.name ?? `@${c.handle}`}</Link> <span className="text-muted">({c.role})</span></span>
          ))}
        </p>
      )}
    </div>
  );
}
