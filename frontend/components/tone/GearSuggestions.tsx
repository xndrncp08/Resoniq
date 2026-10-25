"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/app/ui";
import type { RecipeCore } from "@/types/tone";
import { GEAR_PROFILES, translate, translationText, type Measured } from "@/lib/gear-translate";
import { usePreferences, usePreferencesHydration } from "@/lib/stores/preferences";

/** The recipe as settings for the musician's own kind of gear, remembered per device. */
export default function GearSuggestions({ recipe, measured, title }: { recipe: RecipeCore; measured: Measured; title: string }) {
  usePreferencesHydration();
  const gear = usePreferences((s) => s.gear);
  const setGear = usePreferences((s) => s.setGear);
  const [copied, setCopied] = useState(false);
  const t = translate(recipe, gear, measured);
  const gearName = GEAR_PROFILES.find((g) => g.id === gear)!.name;
  return (
    <section aria-labelledby="gear-h" className="panel p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 id="gear-h" className="font-display text-lg font-semibold">On your gear</h3>
        <span className="label-engraved text-copper">Recommendation</span>
      </div>
      <div role="radiogroup" aria-label="Your gear" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {GEAR_PROFILES.map((g) => (
          <button key={g.id} type="button" role="radio" aria-checked={gear === g.id} onClick={() => setGear(g.id)} className={`focus-ring rounded-xl border p-2.5 text-left ${gear === g.id ? "border-copper/60 bg-copper/10" : "border-line hover:border-line-strong"}`}>
            <span className="block font-body text-[13px] font-medium leading-snug">{g.name}</span>
            <span className="block font-mono text-[10px] text-muted">{g.hint}</span>
          </button>
        ))}
      </div>
      <dl className="mt-5 divide-y divide-line rounded-xl border border-line">
        {t.steps.map((s, i) => (
          <div key={`${s.control}-${i}`} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[10rem_1fr]">
            <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{s.control}</dt>
            <dd className="font-body text-sm">
              <span className="text-ink">{s.setting}</span>
              {s.why && <span className="mt-0.5 block text-xs text-muted">{s.why}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <ul className="mt-4 space-y-1 font-body text-xs text-muted">{t.notes.map((n) => <li key={n}>{n}</li>)}</ul>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" icon="copy" onClick={async () => { await navigator.clipboard.writeText(translationText(title, gearName, t)); setCopied(true); }}>{copied ? "Copied" : "Copy setup"}</Button>
        {t.link && <Link href={t.link.href} className="focus-ring rounded-full px-3 py-1.5 font-body text-[13px] text-copper hover:underline">{t.link.label}</Link>}
      </div>
    </section>
  );
}
