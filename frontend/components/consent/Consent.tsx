"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/app/ui";
import { clearDeviceStorage, persistMemory, writeConsentCookie, type Consent } from "@/lib/consent";

export type Choice = { preferences: boolean; analytics: boolean };

// The detailed settings (and the dialog's animation runtime) load only when someone opens them.
const SettingsDialog = dynamic(() => import("@/components/consent/ConsentSettings"), { ssr: false });
type Ctx = { consent: Consent | null; choose: (c: Choice) => void; openSettings: () => void };
const ConsentContext = createContext<Ctx | null>(null);

export function useConsent() {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useConsent needs <ConsentProvider>.");
  return ctx;
}

/**
 * Remembers the visitor's privacy choice, shows the banner until there is
 * one, and opens the detailed settings from anywhere ("Cookie settings").
 * Optional storage stays off until the visitor opts in.
 */
export function ConsentProvider({ initial, children }: { initial: Consent | null; children: ReactNode }) {
  const [consent, setConsent] = useState(initial);
  const [settings, setSettings] = useState(false);

  const choose = useCallback((c: Choice) => {
    const next = { ...c, at: Date.now() };
    writeConsentCookie(next);
    if (next.preferences) persistMemory();
    else clearDeviceStorage();
    setConsent(next);
    setSettings(false);
  }, []);
  const value = useMemo(() => ({ consent, choose, openSettings: () => setSettings(true) }), [consent, choose]);

  return (
    <ConsentContext.Provider value={value}>
      {children}
      {!consent && !settings && <Banner onChoose={choose} onCustomize={() => setSettings(true)} />}
      {settings && <SettingsDialog consent={consent} onClose={() => setSettings(false)} onChoose={choose} />}
    </ConsentContext.Provider>
  );
}

function Banner({ onChoose, onCustomize }: { onChoose: (c: Choice) => void; onCustomize: () => void }) {
  return (
    <section aria-labelledby="consent-title" className="fixed inset-x-0 bottom-0 z-[70] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5">
      <div className="panel mx-auto flex max-w-4xl flex-col gap-4 p-4 shadow-panel sm:flex-row sm:items-center sm:p-5">
        <div className="min-w-0 flex-1">
          <h2 id="consent-title" className="font-display text-base font-semibold">Your privacy, your call</h2>
          <p className="mt-1 font-body text-sm leading-relaxed text-ink-dim">
            Resoniq uses essential cookies to keep you signed in and secure. With your permission it also remembers settings and unsent drafts in this browser. No ads, no tracking, no analytics. <Link href="/cookies" className="text-copper underline-offset-2 hover:underline">Cookie policy</Link>
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <Button size="sm" className="col-span-2 sm:col-auto" variant="ghost" onClick={onCustomize}>Customize</Button>
          <Button size="sm" onClick={() => onChoose({ preferences: false, analytics: false })}>Reject optional</Button>
          <Button size="sm" variant="primary" onClick={() => onChoose({ preferences: true, analytics: true })}>Accept all</Button>
        </div>
      </div>
    </section>
  );
}

/** "Cookie settings": reopens the choices from the footer, Settings or the policy page. */
export function CookieSettingsButton({ className = "", children = "Cookie settings" }: { className?: string; children?: ReactNode }) {
  const ctx = useContext(ConsentContext);
  if (!ctx) return null;
  return (
    <button type="button" onClick={ctx.openSettings} className={className}>
      {children}
    </button>
  );
}
