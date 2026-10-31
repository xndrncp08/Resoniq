"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { IconButton } from "@/components/app/ui";

const KEY = "resoniq:welcome-dismissed";
const read = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); };

/** A nudge back to the welcome steps until they're done. shortcut: hiding it is per browser; store it on the account if people ask. */
export default function GettingStartedCard({ done, total }: { done: number; total: number }) {
  // Hidden on the server and until storage is read, so a dismissed card never flashes.
  const dismissed = useSyncExternalStore(subscribe, read, () => true);
  if (dismissed) return null;
  const dismiss = () => { try { localStorage.setItem(KEY, "1"); } catch {} listeners.forEach((fn) => fn()); };
  return (
    <section aria-label="Getting started" className="panel flex items-center gap-4 p-4">
      <div className="min-w-0 flex-1">
        <p className="label-engraved">Getting started · {done} of {total}</p>
        <p className="mt-1 font-body text-sm text-ink-dim">Tell people what you play, follow a few musicians and make your first thing.</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden><div className="h-full rounded-full bg-copper" style={{ width: `${(done / total) * 100}%` }} /></div>
      </div>
      <Link href="/welcome" className="focus-ring shrink-0 rounded-full border border-copper/50 px-4 py-2 text-sm text-copper">Continue</Link>
      <IconButton icon="close" label="Hide getting started" onClick={dismiss} size={36} />
    </section>
  );
}
