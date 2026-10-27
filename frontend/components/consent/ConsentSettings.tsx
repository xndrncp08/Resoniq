"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import Dialog from "@/components/app/Dialog";
import { Button } from "@/components/app/ui";
import type { Consent } from "@/lib/consent";
import type { Choice } from "@/components/consent/Consent";

function Toggle({ id, label, on, onChange, disabled, children }: { id: string; label: string; on: boolean; onChange?: (v: boolean) => void; disabled?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4 border-t border-line py-4 first:border-t-0 first:pt-0">
      <div className="min-w-0 flex-1">
        <p id={`${id}-label`} className="font-body text-sm font-medium text-ink">{label}</p>
        <div id={`${id}-desc`} className="mt-1 font-body text-[13px] leading-relaxed text-muted">{children}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-desc`}
        disabled={disabled}
        onClick={() => onChange?.(!on)}
        className={`focus-ring relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${on ? "border-signal bg-signal/30" : "border-line-strong bg-surface-2"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full transition-transform motion-reduce:transition-none ${on ? "left-0.5 translate-x-5 bg-signal" : "left-0.5 bg-muted"}`} />
      </button>
    </div>
  );
}

/** Granular choices: essential (always on), on-device preferences and analytics. */
export default function ConsentSettings({ consent, onClose, onChoose }: { consent: Consent | null; onClose: () => void; onChoose: (c: Choice) => void }) {
  const [preferences, setPreferences] = useState(consent?.preferences ?? false);
  const [analytics, setAnalytics] = useState(consent?.analytics ?? false);
  return (
    <Dialog open title="Cookie settings" onClose={onClose} wide>
      <div className="space-y-1">
        <Toggle id="c-essential" label="Essential" on disabled>
          Keeps you signed in, protects forms against cross-site attacks, and remembers this choice. Always on, because Resoniq can&apos;t work without it.
        </Toggle>
        <Toggle id="c-preferences" label="On-device preferences" on={preferences} onChange={setPreferences}>
          Remembers your display and 3D settings, metronome, gear profile, unsent post drafts, practice notes and TANK-G bank plans in this browser. Off: they work for this visit and are forgotten when you leave. Turning this off deletes what&apos;s already stored.
        </Toggle>
        <Toggle id="c-analytics" label="Analytics" on={analytics} onChange={setAnalytics}>
          Resoniq doesn&apos;t use any analytics today. This choice is kept so that if measurement is ever added, it stays off unless you&apos;ve allowed it.
        </Toggle>
      </div>
      <p className="mt-3 font-body text-xs text-muted">Read the <Link href="/cookies" className="text-copper hover:underline" onClick={onClose}>cookie policy</Link> for every cookie and storage key, and how long each lasts.</p>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button onClick={() => onChoose({ preferences: false, analytics: false })}>Reject optional</Button>
        <Button onClick={() => onChoose({ preferences: true, analytics: true })}>Accept all</Button>
        <Button variant="primary" onClick={() => onChoose({ preferences, analytics })}>Save choices</Button>
      </div>
    </Dialog>
  );
}
