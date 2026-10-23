"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/icons/Icon";
import { compact } from "@/components/app/ui";
import { api } from "@/lib/client-api";

/**
 * One vote, two faces. "amp" (feeds) shows only the upvote as an Amp with the
 * count; "updown" (discussions) adds the downvote and shows the net score.
 */
export default function VoteControl({
  url,
  initialVote,
  initialScore,
  initialUps,
  mode = "amp",
  signedIn,
}: {
  url: string;
  initialVote: -1 | 0 | 1;
  initialScore: number;
  initialUps: number;
  mode?: "amp" | "updown";
  signedIn: boolean;
}) {
  const router = useRouter();
  const [vote, setVote] = useState(initialVote);
  const [score, setScore] = useState(initialScore);
  const [ups, setUps] = useState(initialUps);
  const [busy, setBusy] = useState(false);

  async function cast(next: -1 | 0 | 1) {
    if (!signedIn) return router.push(`/login?callbackUrl=${encodeURIComponent(location.pathname)}`);
    if (busy) return;
    const prev = { vote, score, ups };
    // Optimistic: the server's answer replaces it either way.
    setVote(next);
    setScore(score + next - vote);
    setUps(ups + (next === 1 ? 1 : 0) - (vote === 1 ? 1 : 0));
    setBusy(true);
    try {
      const res = await api<{ score: number; vote: -1 | 0 | 1 }>(url, { method: "PUT", body: { value: next } });
      setScore(res.score);
      setVote(res.vote);
    } catch {
      setVote(prev.vote);
      setScore(prev.score);
      setUps(prev.ups);
    } finally {
      setBusy(false);
    }
  }

  const up = vote === 1;
  if (mode === "amp") {
    return (
      <button type="button" onClick={() => cast(up ? 0 : 1)} aria-pressed={up} aria-label={up ? `Amped, ${ups} amps. Remove amp` : `Amp this, ${ups} amps`} className={`focus-ring tap-clean group inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 font-mono text-sm transition-colors ${up ? "bg-copper/15 text-copper" : "text-muted hover:bg-copper/10 hover:text-copper"}`}>
        <span key={String(up)} className={`inline-flex ${up ? "fx-pop" : ""}`}>
          <Icon name={up ? "amp-up-filled" : "amp-up"} size={20} />
        </span>
        {compact(ups)}
      </button>
    );
  }
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-surface-2/60">
      <button type="button" onClick={() => cast(up ? 0 : 1)} aria-pressed={up} aria-label="Upvote" className={`focus-ring tap-clean flex h-9 w-9 items-center justify-center rounded-full ${up ? "text-copper" : "text-muted hover:text-copper"}`}>
        <Icon name={up ? "amp-up-filled" : "amp-up"} size={19} />
      </button>
      <span className={`min-w-[2ch] text-center font-mono text-sm ${vote === 1 ? "text-copper" : vote === -1 ? "text-signal" : "text-ink-dim"}`} aria-live="polite">{compact(score)}</span>
      <button type="button" onClick={() => cast(vote === -1 ? 0 : -1)} aria-pressed={vote === -1} aria-label="Downvote" className={`focus-ring tap-clean flex h-9 w-9 items-center justify-center rounded-full ${vote === -1 ? "text-signal" : "text-muted hover:text-signal"}`}>
        <Icon name="amp-down" size={19} />
      </button>
    </div>
  );
}
