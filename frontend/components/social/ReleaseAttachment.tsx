"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/app/ui";
import { api, errorMessage } from "@/lib/client-api";
import type { CreditView } from "@/lib/credits";
import { useState } from "react";
import TakePlayer from "@/components/riffs/TakePlayer";
import ManageRelease from "@/components/social/ManageRelease";
import ChordChart from "@/components/canvas/ChordChart";
import type { PostView } from "@/lib/posts";

/** Published music on a post: the recording, the song's chart, and who made it. */
export default function ReleaseAttachment({ postId, release, detail, isAuthor = false }: { postId: string; release: NonNullable<PostView["release"]>; detail: boolean; isAuthor?: boolean }) {
  const [chart, setChart] = useState(detail);
  const [mix, setMix] = useState(0);
  const [managing, setManaging] = useState(false);
  const take = release.takes[mix] ?? release.takes[0];
  return (
    <div className="space-y-3 rounded-2xl border border-copper/25 bg-copper/[0.04] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-copper">
        {release.kind === "song" ? "Original song" : "Recording"}{[release.key && ` · ${release.key}`, release.bpm && ` · ${release.bpm} BPM`].filter(Boolean).join("")}
      </p>
      {release.takes.length > 1 && (
        <div role="radiogroup" aria-label="Mix" className="flex flex-wrap gap-1.5">
          {release.takes.map((t, i) => <button key={t.id} type="button" role="radio" aria-checked={i === mix} onClick={() => setMix(i)} className={`focus-ring h-8 rounded-full border px-3 font-body text-xs ${i === mix ? "border-copper/60 bg-copper/15 text-ink" : "border-line text-muted hover:text-ink"}`}>{t.mix ?? `Mix ${i + 1}`}</button>)}
        </div>
      )}
      {take ? (
        <TakePlayer key={take.id} take={{ ...take, sizeBytes: 0, createdAt: "" }} title={`${release.title}${release.takes.length > 1 ? ` (${take.mix})` : ""}`} />
      ) : release.kind === "take" ? <p className="font-body text-sm text-muted">This recording has been removed.</p> : null}
      {release.chart && (
        chart ? <div className="max-h-[32rem] overflow-y-auto rounded-xl bg-bg-0 p-4"><ChordChart content={release.chart} /></div>
          : <button type="button" onClick={() => setChart(true)} className="focus-ring font-body text-sm font-medium text-copper hover:underline">Show lyrics and chords</button>
      )}
      {release.credits.length > 0 && <Credits postId={postId} credits={release.credits} />}
      {isAuthor && (
        <>
          <Button size="sm" variant="ghost" icon="settings" onClick={() => setManaging(true)}>Manage release</Button>
          {managing && <ManageRelease postId={postId} open onClose={() => setManaging(false)} />}
        </>
      )}
    </div>
  );
}

/** Who made it. Pending credits say so; the credited musician confirms or disputes here; the author sees disputes and why. */
function Credits({ postId, credits }: { postId: string; credits: CreditView[] }) {
  const router = useRouter();
  const me = useSession().data?.user?.id;
  const [disputing, setDisputing] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mine = credits.find((c) => c.userId === me && c.status === "PENDING");
  async function respond(action: "confirm" | "dispute") {
    try {
      await api(`/api/posts/${postId}/credit`, { body: { action, ...(note.trim() && { note }) } });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  return (
    <div className="space-y-2">
      <p className="font-body text-sm text-ink-dim">
        <span className="text-muted">Credits: </span>
        {credits.map((c, i) => (
          <span key={c.userId}>
            {i > 0 && " · "}
            <Link href={`/u/${c.handle}`} className={`hover:underline ${c.status === "DISPUTED" ? "text-muted line-through" : "text-ink"}`}>{c.name ?? `@${c.handle}`}</Link> <span className="text-muted">({c.role}){c.status === "PENDING" ? ", awaiting confirmation" : ""}</span>
            {c.status === "DISPUTED" && <span className="text-danger"> disputed{c.note ? `: “${c.note}”` : ""}</span>}
          </span>
        ))}
      </p>
      {mine && (
        <div className="space-y-2 rounded-xl border border-amber/40 bg-amber/10 p-3 font-body text-sm" role="group" aria-label="Your credit">
          <p>You&apos;re credited as <strong>{mine.role}</strong>. Confirm it to list this release on your profile.</p>
          {disputing && <label className="block"><span className="sr-only">Why (optional)</span><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Why (optional, only the author sees this)" className="panel-inset h-10 w-full rounded-lg px-3 outline-none" /></label>}
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={() => respond("confirm")}>Confirm</Button>
            {disputing ? <Button size="sm" onClick={() => respond("dispute")}>Send dispute</Button> : <Button size="sm" variant="ghost" onClick={() => setDisputing(true)}>That&apos;s not right</Button>}
          </div>
          {error && <p role="alert" className="text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
