"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
  const [state, setState] = useState({ vote: initialVote, score: initialScore, ups: initialUps });
  const { vote, score, ups } = state;
  // Optimistic, rolled back on failure, and queued per target so fast taps land in order.
  const { mutate } = useMutation({
    scope: { id: url },
    mutationFn: (value: -1 | 0 | 1) => api<{ score: number; vote: -1 | 0 | 1 }>(url, { method: "PUT", body: { value } }),
    onMutate: (next) => {
      const previous = state;
      setState((s) => ({ vote: next, score: s.score + next - s.vote, ups: s.ups + (next === 1 ? 1 : 0) - (s.vote === 1 ? 1 : 0) }));
      return previous;
    },
    onSuccess: (res) => setState((s) => ({ ...s, score: res.score, vote: res.vote })),
    onError: (_err, _next, previous) => previous && setState(previous),
  });

  function cast(next: -1 | 0 | 1) {
    if (!signedIn) return router.push(`/login?callbackUrl=${encodeURIComponent(location.pathname)}`);
    mutate(next);
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
